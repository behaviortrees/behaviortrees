import { v4 as uuidv4 } from 'uuid';
import { Block, Connection, Node, NodeCategory, NodePort, PortDirection, Project, Tree } from '../../types';
import {
  B3_TO_BTCPP,
  BTCPP_BUILTINS,
  BtcppVersion,
  catalogNode,
  NAV2_CATEGORIES,
  V3_TO_V4_NAMES,
  V3_TO_V4_PORTS,
  V4_TO_V3_NAMES,
} from './btcpp-catalog';
import { DEFAULT_NODES } from './defaults';
import { childIdsInOrder, organizeTree, readTreeLayout, TreeLayout } from './organize';

// BehaviorTree.CPP XML (v3 and v4), the format of Groot2 and ROS 2 Nav2.
// Kept apart from b3.ts on purpose: projects persist and sync as behavior3
// JSON, and that path must never depend on DOM APIs. Imported trees keep
// their BT.CPP node names; behavior3 defaults are translated only on export.

export type { BtcppVersion };

export type BtcppIssue = {
  level: 'error' | 'warning' | 'info';
  message: string;
};

export type BtcppTreesImport = {
  kind: 'trees';
  version: BtcppVersion;
  trees: Tree[];
  mainTreeId?: string;
  // Node templates the trees use that the project doesn't have yet
  nodes: Record<string, Node>;
  // TreeNodesModel entries from the file: authoritative, so they update
  // existing custom nodes too
  models: Record<string, Node>;
  issues: BtcppIssue[];
};

export type BtcppNodesImport = {
  kind: 'nodes';
  version: BtcppVersion;
  models: Record<string, Node>;
  issues: BtcppIssue[];
};

export type BtcppImport = BtcppTreesImport | BtcppNodesImport;

export type BtcppExportOptions = {
  version: BtcppVersion;
  layout?: TreeLayout;
  includeNodesModel?: boolean;
};

export type BtcppExport = { xml: string; issues: BtcppIssue[] };

const WRAPPER_TAGS: Record<string, NodeCategory> = {
  Action: 'action',
  Condition: 'condition',
  Control: 'composite',
  Decorator: 'decorator',
};

const MODEL_TAGS: Record<Exclude<NodeCategory, 'root'>, string> = {
  action: 'Action',
  condition: 'Condition',
  composite: 'Control',
  decorator: 'Decorator',
};

const PORT_TAGS: Record<string, PortDirection> = {
  input_port: 'input',
  output_port: 'output',
  inout_port: 'inout',
};

const XML_NAME = /^[A-Za-z_][\w.:-]*$/;

const isLeaf = (category: NodeCategory) => category === 'action' || category === 'condition';

export function isLikelyXml(text: string): boolean {
  return /^\s*</.test(text.replace(/^\uFEFF/, ''));
}

// ---------------------------------------------------------------------------
// Import: BT.CPP XML -> internal model
// ---------------------------------------------------------------------------

// Shape guesses for nodes no model, catalog or Nav2 table knows. One child
// is ambiguous: a control with one child looks exactly like a decorator.
const CONTROL_NAME = /Sequence|Fallback|Selector|Parallel|Switch|Pipeline|RoundRobin|Recovery|Priority/;
const CONDITION_NAME = /^(Is|Has|Are|Can|Would|Should|Check)[A-Z]|(Reached|Updated|Received|Available|Valid|Present|Near)$/;

function guessCategory(name: string, maxChildren: number): NodeCategory {
  if (maxChildren >= 2) return 'composite';
  if (maxChildren === 1) return CONTROL_NAME.test(name) ? 'composite' : 'decorator';
  return CONDITION_NAME.test(name) ? 'condition' : 'action';
}

function parseDocument(text: string): Element {
  // Refuse DTDs outright rather than trusting the parser with entities
  if (/<!DOCTYPE/i.test(text)) {
    throw new Error('XML files with a DOCTYPE are not supported');
  }
  const doc = new DOMParser().parseFromString(text.replace(/^\uFEFF/, ''), 'application/xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error) {
    const detail = (error.textContent ?? '').trim().split('\n')[0];
    throw new Error(`Not valid XML${detail ? `: ${detail}` : ''}`);
  }
  if (doc.documentElement.tagName !== 'root') {
    throw new Error('Not a BehaviorTree.CPP file: expected a <root> element');
  }
  return doc.documentElement;
}

function parseModel(el: Element, name: string, category: NodeCategory): Node {
  const ports: Record<string, NodePort> = {};
  Array.from(el.children).forEach((portEl) => {
    const direction = PORT_TAGS[portEl.tagName];
    const portName = portEl.getAttribute('name');
    if (!direction || !portName) return;
    const type = portEl.getAttribute('type');
    const defaultValue = portEl.getAttribute('default');
    const description = (portEl.textContent ?? '').trim();
    ports[portName] = {
      direction,
      ...(type ? { type } : {}),
      ...(defaultValue !== null ? { default: defaultValue } : {}),
      ...(description ? { description } : {}),
    };
  });

  return {
    name,
    title: name,
    category,
    description: '',
    properties: Object.fromEntries(
      Object.entries(ports)
        .filter(([, p]) => p.direction !== 'output')
        .map(([key, p]) => [key, p.default ?? ''])
    ),
    ports,
    isDefault: false,
  };
}

const normalizeName = (name: string) => V3_TO_V4_NAMES[name] ?? name;

export function parseBtcppXml(
  text: string,
  knownNodes: Record<string, Node>,
  layout: TreeLayout = readTreeLayout(),
): BtcppImport {
  const root = parseDocument(text);
  const version: BtcppVersion = root.getAttribute('BTCPP_format') === '4' ? 4 : 3;
  const issues: BtcppIssue[] = [];

  const models: Record<string, Node> = {};
  const treeElements: Element[] = [];

  Array.from(root.children).forEach((el) => {
    if (el.tagName === 'TreeNodesModel') {
      Array.from(el.children).forEach((modelEl) => {
        const category = WRAPPER_TAGS[modelEl.tagName];
        const id = modelEl.getAttribute('ID');
        // SubTree port models describe trees, not palette nodes
        if (!category || !id) return;
        const name = normalizeName(id);
        models[name] = parseModel(modelEl, name, category);
      });
    } else if (el.tagName === 'BehaviorTree') {
      treeElements.push(el);
    } else if (el.tagName === 'include') {
      issues.push({
        level: 'warning',
        message: `Included file "${el.getAttribute('path') ?? ''}" wasn't loaded. Import it separately.`,
      });
    } else {
      issues.push({ level: 'warning', message: `Skipped unknown <${el.tagName}> element` });
    }
  });

  if (treeElements.length === 0) {
    if (Object.keys(models).length === 0) {
      throw new Error('This file has no <BehaviorTree> or <TreeNodesModel>');
    }
    return { kind: 'nodes', version, models, issues };
  }

  // First pass: how each node name is used across every tree, so a name's
  // category is decided once, from its widest use
  const nameOf = (el: Element) =>
    normalizeName(WRAPPER_TAGS[el.tagName] ? (el.getAttribute('ID') ?? el.tagName) : el.tagName);
  const usage: Record<string, { maxChildren: number; explicit?: NodeCategory; keys: Set<string> }> = {};
  const survey = (el: Element) => {
    const name = nameOf(el);
    const entry = (usage[name] ??= { maxChildren: 0, keys: new Set() });
    entry.maxChildren = Math.max(entry.maxChildren, el.children.length);
    if (WRAPPER_TAGS[el.tagName]) entry.explicit = WRAPPER_TAGS[el.tagName];
    Array.from(el.attributes).forEach((attr) => entry.keys.add(attr.name));
    Array.from(el.children).forEach(survey);
  };
  treeElements.forEach((treeEl) => Array.from(treeEl.children).forEach(survey));

  const guessed: string[] = [];
  const categories: Record<string, NodeCategory> = {};
  Object.entries(usage).forEach(([name, use]) => {
    const known = knownNodes[name]?.category;
    const category =
      (name === 'SubTree' ? 'action' : undefined) ??
      use.explicit ??
      models[name]?.category ??
      (known && known !== 'root' ? known : undefined) ??
      BTCPP_BUILTINS[name]?.category ??
      NAV2_CATEGORIES[name];
    if (category) {
      categories[name] = category;
    } else {
      categories[name] = guessCategory(name, use.maxChildren);
      guessed.push(name);
    }
  });

  if (guessed.length > 0) {
    issues.push({
      level: 'info',
      message: `Guessed the node type of ${guessed.join(', ')}. Import a TreeNodesModel file to set them exactly.`,
    });
  }

  // Attributes become string properties; v3 spellings become v4 ones
  const propertiesOf = (el: Element, name: string): Record<string, unknown> => {
    const properties: Record<string, unknown> = {};
    const renames = version === 3 ? (V3_TO_V4_PORTS[name] ?? {}) : {};
    const classicSubTree = version === 3 && el.tagName === 'SubTree';

    Array.from(el.attributes).forEach(({ name: key, value }) => {
      if (key === 'name') return;
      if (key === 'ID' && WRAPPER_TAGS[el.tagName]) return;
      if (key === '__autoremap') {
        properties._autoremap = value;
        return;
      }
      if (key === '__shared_blackboard') {
        if (value === 'true' || value === '1') {
          properties._autoremap = 'true';
          issues.push({
            level: 'warning',
            message: `SubTree "${el.getAttribute('ID') ?? ''}" shared its parent's blackboard (v3). It now uses _autoremap, which only shares the subtree's own ports.`,
          });
        }
        return;
      }
      // v3's plain SubTree remapped to bare blackboard keys; v4 needs braces
      if (classicSubTree && key !== 'ID' && !/^\{.*\}$/.test(value)) {
        properties[key] = `{${value}}`;
        return;
      }
      properties[renames[key] ?? key] = value;
    });
    return properties;
  };

  const trees: Tree[] = [];
  const reported = new Set<string>();

  treeElements.forEach((treeEl, index) => {
    const title = treeEl.getAttribute('ID') || `Tree ${index + 1}`;
    if (!treeEl.getAttribute('ID')) {
      issues.push({ level: 'warning', message: `A <BehaviorTree> had no ID; named it "${title}"` });
    }

    const rootId = uuidv4();
    const tree: Tree = {
      id: uuidv4(),
      title,
      description: '',
      blocks: {
        [rootId]: {
          id: rootId,
          name: 'Root',
          title,
          description: '',
          category: 'root',
          properties: {},
          position: { x: 0, y: 0 },
        },
      },
      connections: {},
      rootId,
      properties: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const connect = (source: string, target: string) => {
      const connection: Connection = { id: uuidv4(), source, target };
      tree.connections[connection.id] = connection;
    };

    // Children connect in document order, which organize honors below. A
    // node that can't hold them all keeps its first and the rest stay on
    // the canvas unconnected, so nothing in the file is lost.
    const attachChildren = (parent: Block, childIds: string[]) => {
      const capacity = parent.category === 'composite' ? Infinity : isLeaf(parent.category) ? 0 : 1;
      childIds.forEach((childId, i) => {
        if (i < capacity) connect(parent.id, childId);
      });
      const key = `${tree.title}/${parent.name}`;
      if (childIds.length > capacity && !reported.has(key)) {
        reported.add(key);
        const label = parent.category === 'root' ? `Tree "${tree.title}"` : `${parent.name} in "${tree.title}"`;
        issues.push({
          level: 'error',
          message: `${label} has ${childIds.length} children but can only have ${capacity}. The extra ones are left unconnected.`,
        });
      }
    };

    const addBlock = (el: Element): string => {
      const name = nameOf(el);
      const block: Block = {
        id: uuidv4(),
        name,
        title: el.getAttribute('name') || name,
        description: '',
        category: categories[name],
        properties: propertiesOf(el, name),
        position: { x: 0, y: 0 },
      };
      tree.blocks[block.id] = block;
      attachChildren(block, Array.from(el.children).map(addBlock));
      return block.id;
    };

    attachChildren(tree.blocks[rootId], Array.from(treeEl.children).map(addBlock));
    organizeTree(tree, layout, true);
    trees.push(tree);
  });

  const mainName = root.getAttribute('main_tree_to_execute');
  let mainTree = mainName ? trees.find((t) => t.title === mainName) : undefined;
  if (!mainTree) {
    mainTree = trees[0];
    if (mainName) {
      issues.push({ level: 'warning', message: `main_tree_to_execute names "${mainName}", which isn't in the file` });
    } else if (trees.length > 1) {
      issues.push({ level: 'info', message: `No main_tree_to_execute; opened "${mainTree.title}"` });
    }
  }

  // Templates for every name the project doesn't know yet
  const nodes: Record<string, Node> = {};
  Object.entries(usage).forEach(([name, use]) => {
    if (knownNodes[name]) return;
    nodes[name] = models[name] ??
      catalogNode(name) ?? {
        name,
        title: name,
        category: categories[name],
        description: '',
        properties: Object.fromEntries(
          [...use.keys].filter((key) => key !== 'name' && key !== 'ID' && !key.startsWith('_')).map((key) => [key, ''])
        ),
        isDefault: false,
      };
  });

  return { kind: 'trees', version, trees, mainTreeId: mainTree.id, nodes, models, issues };
}

export function btcppToProject(imported: BtcppTreesImport, name: string): Project {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    description: '',
    trees: Object.fromEntries(imported.trees.map((tree) => [tree.id, tree])),
    nodes: { ...DEFAULT_NODES, ...imported.nodes, ...imported.models },
    selectedTreeId: imported.mainTreeId,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Export: internal model -> BT.CPP XML
// ---------------------------------------------------------------------------

const escapeAttr = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Parsers turn raw newlines in attributes into spaces; keep Script code intact
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;')
    .replace(/\t/g, '&#9;');

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sanitizeId = (title: string) => title.trim().replace(/\s+/g, '_') || 'Tree';

// behavior3 defaults with no BT.CPP equivalent
const UNMAPPED_B3 = new Set(['MemPriority', 'Limiter', 'RepeatUntilFailure', 'Runner', 'Error']);

// `references` are keys whose value is a {blackboard} entry: only those can
// be outputs, so only those make a guessed direction worth mentioning
type ModelUse = { category: NodeCategory; template?: Node; keys: Set<string>; references: Set<string> };

function exportTrees(
  project: Project,
  mainTreeId: string,
  treeIds: string[] | 'referenced',
  { version, layout = readTreeLayout(), includeNodesModel = true }: BtcppExportOptions,
): BtcppExport {
  const issues: BtcppIssue[] = [];
  const once = new Set<string>();
  const issue = (level: BtcppIssue['level'], message: string) => {
    if (once.has(message)) return;
    once.add(message);
    issues.push({ level, message });
  };

  // Every project tree gets a unique BT.CPP ID, so SubTree references
  // resolve whether or not the referenced tree is exported
  const allTrees = Object.values(project.trees);
  const xmlIds: Record<string, string> = {};
  const taken = new Set<string>();
  allTrees.forEach((tree) => {
    const base = sanitizeId(tree.title);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
    taken.add(id);
    xmlIds[tree.id] = id;
  });

  const resolveSubTree = (ref: string): Tree | undefined =>
    allTrees.find((t) => t.title === ref) ?? allTrees.find((t) => xmlIds[t.id] === ref);

  const subTreeRefs = (tree: Tree): string[] =>
    Object.values(tree.blocks)
      .filter((b) => b.name === 'SubTree' && typeof b.properties.ID === 'string' && b.properties.ID)
      .map((b) => b.properties.ID as string);

  // Which trees to write: the main tree first, then the rest
  let ordered: Tree[];
  if (treeIds === 'referenced') {
    ordered = [];
    const seen = new Set<string>();
    const queue = [project.trees[mainTreeId]];
    while (queue.length > 0) {
      const tree = queue.shift()!;
      if (seen.has(tree.id)) continue;
      seen.add(tree.id);
      ordered.push(tree);
      subTreeRefs(tree).forEach((ref) => {
        const target = resolveSubTree(ref);
        if (target) queue.push(target);
      });
    }
  } else {
    const main = project.trees[mainTreeId];
    ordered = [main, ...treeIds.map((id) => project.trees[id]).filter((t) => t && t.id !== main.id)];
  }

  // BT.CPP refuses recursive subtrees
  const visiting: string[] = [];
  const done = new Set<string>();
  const checkCycles = (tree: Tree) => {
    if (done.has(tree.id)) return;
    if (visiting.includes(tree.id)) {
      const path = [...visiting.slice(visiting.indexOf(tree.id)), tree.id].map((id) => project.trees[id].title);
      issue('error', `SubTrees form a loop: ${path.join(' → ')}. BT.CPP can't load recursive trees.`);
      return;
    }
    visiting.push(tree.id);
    subTreeRefs(tree).forEach((ref) => {
      const target = resolveSubTree(ref);
      if (target) checkCycles(target);
      else issue('warning', `SubTree references "${ref}", which isn't in this project. Your runtime must register it.`);
    });
    visiting.pop();
    done.add(tree.id);
  };
  ordered.forEach(checkCycles);

  ordered.forEach((tree) => {
    if (xmlIds[tree.id] !== tree.title) {
      issue('info', `Tree "${tree.title}" is written with ID "${xmlIds[tree.id]}"`);
    }
  });

  const modelUses: Record<string, ModelUse> = {};
  const lines: string[] = [];
  let droppedDescriptions = false;

  const writeTree = (tree: Tree) => {
    const id = xmlIds[tree.id];
    if (tree.description || Object.keys(tree.properties ?? {}).length > 0) droppedDescriptions = true;

    const root = tree.rootId ? tree.blocks[tree.rootId] : undefined;
    if (!root) {
      issue('error', `Tree "${tree.title}" has no root node`);
      lines.push(`  <BehaviorTree ID="${escapeAttr(id)}"/>`);
      return;
    }

    const visited = new Set<string>([root.id]);
    const rootChildren = childIdsInOrder(tree, root.id, layout);
    if (rootChildren.length !== 1) {
      issue(
        'error',
        rootChildren.length === 0
          ? `Tree "${tree.title}" is empty. BT.CPP needs one node under the root.`
          : `The root of "${tree.title}" has ${rootChildren.length} children. BT.CPP allows one.`
      );
    }

    const writeBlock = (blockId: string, depth: number) => {
      if (visited.has(blockId)) return;
      visited.add(blockId);
      const block = tree.blocks[blockId];
      const template = project.nodes[block.name];
      const where = `"${block.title || block.name}" in "${tree.title}"`;
      if (block.description) droppedDescriptions = true;

      // Name: translate behavior3 defaults, then the v3 spelling
      let name = block.name;
      let renames: Record<string, string> = {};
      const translation = template?.isDefault ? B3_TO_BTCPP[name] : undefined;
      const keys = Object.keys(block.properties);
      const isB3Wait = name !== 'Wait' || keys.every((k) => k === 'milliseconds');
      if (translation && isB3Wait) {
        if (translation.v4Only && version === 3) {
          issue('warning', `${name} has no BT.CPP v3 equivalent. Your runtime must register a "${name}" node.`);
        } else {
          name = translation.name;
          renames = translation.props ?? {};
        }
      } else if (template?.isDefault && UNMAPPED_B3.has(name)) {
        issue('warning', `${name} has no BT.CPP equivalent. Your runtime must register a "${name}" node.`);
      }

      const builtin = BTCPP_BUILTINS[name];
      if (builtin && !builtin.versions.includes(version)) {
        issue('warning', `${name} isn't a builtin in BT.CPP v${version}`);
      }

      // Properties become attributes, in the panel's order
      const attrs: Array<[string, string]> = [];
      Object.entries(block.properties).forEach(([rawKey, value]) => {
        const key = renames[rawKey] ?? rawKey;
        if (value === '' || value === null || value === undefined) return;
        if (key === 'name' || (key === 'ID' && name !== 'SubTree')) {
          issue('warning', `Property "${key}" on ${where} is reserved in BT.CPP and was left out`);
          return;
        }
        if (!XML_NAME.test(key)) {
          issue('warning', `Property "${key}" on ${where} isn't a valid XML attribute name and was left out`);
          return;
        }
        if (builtin && name !== 'SubTree' && !builtin.ports[key] && !key.startsWith('_')) {
          issue('warning', `${name} has no "${key}" port; it was left out of ${where}`);
          return;
        }
        if (key.startsWith('_') && version === 3 && !(name === 'SubTree' && key === '_autoremap')) {
          issue('warning', `"${key}" on ${where} needs BT.CPP v4 and was left out`);
          return;
        }
        let text: string;
        if (typeof value === 'object') {
          text = JSON.stringify(value);
          issue('warning', `Property "${key}" on ${where} is an object; it was written as JSON text`);
        } else {
          text = String(value);
        }
        attrs.push([key, text]);
      });

      if (builtin) {
        Object.entries(builtin.ports).forEach(([key, port]) => {
          if (port.direction === 'input' && port.default === undefined && !attrs.some(([k]) => k === key)) {
            issue('warning', `${where} is missing the "${key}" port that ${name} requires`);
          }
        });
      }

      // v3 spellings
      let tag = name;
      if (version === 3) {
        tag = translation?.v3Name && name === translation.name ? translation.v3Name : (V4_TO_V3_NAMES[name] ?? name);
        const portRenames = Object.fromEntries(
          Object.entries(V3_TO_V4_PORTS[name] ?? {}).map(([v3, v4]) => [v4, v3])
        );
        attrs.forEach((attr) => {
          attr[0] = portRenames[attr[0]] ?? attr[0];
        });
        if (name === 'SubTree') {
          tag = 'SubTreePlus';
          attrs.forEach((attr) => {
            if (attr[0] === '_autoremap') attr[0] = '__autoremap';
          });
        }
      }

      // SubTree leads with its ID; everything else with the instance name
      const title = block.title && block.title !== block.name && block.title !== template?.title ? block.title : '';
      const ordered = name === 'SubTree'
        ? [...attrs.filter(([k]) => k === 'ID'), ...(title ? [['name', title] as [string, string]] : []), ...attrs.filter(([k]) => k !== 'ID')]
        : [...(title ? [['name', title] as [string, string]] : []), ...attrs];
      const attrText = ordered.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');

      if (!builtin && name !== 'SubTree') {
        const use = (modelUses[name] ??= { category: block.category, template, keys: new Set(), references: new Set() });
        attrs.forEach(([k, v]) => {
          use.keys.add(k);
          if (/^\{.+\}$/.test(v)) use.references.add(k);
        });
      }

      const children = childIdsInOrder(tree, block.id, layout);
      if (block.category === 'decorator' && children.length !== 1) {
        issue('error', `${where} is a decorator with ${children.length} children. BT.CPP needs exactly one.`);
      } else if (block.category === 'composite' && children.length === 0) {
        issue('error', `${where} has no children. BT.CPP needs at least one.`);
      } else if (isLeaf(block.category) && children.length > 0) {
        issue('error', `${where} is a leaf node but has children. BT.CPP doesn't allow that.`);
      }

      const indent = '  '.repeat(depth);
      if (children.length === 0) {
        lines.push(`${indent}<${tag}${attrText}/>`);
      } else {
        lines.push(`${indent}<${tag}${attrText}>`);
        children.forEach((childId) => writeBlock(childId, depth + 1));
        lines.push(`${indent}</${tag}>`);
      }
    };

    lines.push(`  <BehaviorTree ID="${escapeAttr(id)}">`);
    rootChildren.forEach((childId) => writeBlock(childId, 2));
    lines.push('  </BehaviorTree>');

    const unreachable = Object.keys(tree.blocks).filter((blockId) => !visited.has(blockId)).length;
    if (unreachable > 0) {
      issue(
        'warning',
        `${unreachable} node${unreachable === 1 ? '' : 's'} in "${tree.title}" ${unreachable === 1 ? "isn't" : "aren't"} connected to the root and ${unreachable === 1 ? 'was' : 'were'} left out`
      );
    }
  };

  ordered.forEach(writeTree);

  if (droppedDescriptions) {
    issue('info', "Descriptions and tree properties aren't part of BT.CPP XML and were left out");
  }

  const model = includeNodesModel ? nodesModelLines(modelUses) : { lines: [], inferred: [] };
  if (model.inferred.length > 0) {
    issue(
      'info',
      `Port directions of ${model.inferred.join(', ')} aren't known, so they were written as inputs. Import their TreeNodesModel (for Nav2, nav2_tree_nodes.xml) to get outputs right.`
    );
  }
  const head = version === 4
    ? `<root BTCPP_format="4" main_tree_to_execute="${escapeAttr(xmlIds[mainTreeId])}">`
    : `<root main_tree_to_execute="${escapeAttr(xmlIds[mainTreeId])}">`;

  return {
    xml: ['<?xml version="1.0" encoding="UTF-8"?>', head, ...lines, ...model.lines, '</root>', ''].join('\n'),
    issues,
  };
}

// <TreeNodesModel> for custom nodes, so Groot2 knows their types and ports.
// `inferred` names the nodes whose ports had to be guessed as inputs.
function nodesModelLines(uses: Record<string, ModelUse>): { lines: string[]; inferred: string[] } {
  const names = Object.keys(uses).sort();
  const inferred: string[] = [];
  if (names.length === 0) return { lines: [], inferred };

  const lines = ['  <TreeNodesModel>'];
  names.forEach((name) => {
    const { category, template, keys, references } = uses[name];
    if (category === 'root') return;
    const ports: Record<string, NodePort> = { ...(template?.ports ?? {}) };
    const extra = template?.ports
      ? []
      : Object.keys(template && !template.isDefault ? template.properties : {});
    [...extra, ...keys].forEach((key) => {
      if (!ports[key] && !key.startsWith('_')) {
        if (references.has(key) && !inferred.includes(name)) inferred.push(name);
        const fallback = template && !template.isDefault ? template.properties[key] : undefined;
        ports[key] = {
          direction: 'input',
          ...(fallback !== undefined && fallback !== '' && typeof fallback !== 'object' ? { default: String(fallback) } : {}),
        };
      }
    });

    const tag = MODEL_TAGS[category];
    const portLines = Object.entries(ports).map(([key, port]) => {
      const portTag = `${port.direction}_port`;
      const attrs =
        ` name="${escapeAttr(key)}"` +
        (port.type ? ` type="${escapeAttr(port.type)}"` : '') +
        (port.default !== undefined ? ` default="${escapeAttr(port.default)}"` : '');
      return port.description
        ? `      <${portTag}${attrs}>${escapeText(port.description)}</${portTag}>`
        : `      <${portTag}${attrs}/>`;
    });

    if (portLines.length === 0) {
      lines.push(`    <${tag} ID="${escapeAttr(name)}"/>`);
    } else {
      lines.push(`    <${tag} ID="${escapeAttr(name)}">`, ...portLines, `    </${tag}>`);
    }
  });
  lines.push('  </TreeNodesModel>');
  return { lines, inferred };
}

// The selected tree plus every tree it reaches through SubTree nodes
export function treeToBtcpp(project: Project, treeId: string, options: BtcppExportOptions): BtcppExport {
  return exportTrees(project, treeId, 'referenced', options);
}

export function projectToBtcpp(project: Project, options: BtcppExportOptions): BtcppExport {
  const treeIds = Object.keys(project.trees);
  if (treeIds.length === 0) throw new Error('This project has no trees');
  const main = project.selectedTreeId && project.trees[project.selectedTreeId] ? project.selectedTreeId : treeIds[0];
  return exportTrees(project, main, treeIds, options);
}

// A TreeNodesModel-only file with the project's custom nodes
export function nodesToBtcpp(project: Project, { version }: BtcppExportOptions): BtcppExport {
  const uses: Record<string, ModelUse> = {};
  Object.values(project.nodes).forEach((node) => {
    if (node.isDefault || BTCPP_BUILTINS[node.name] || node.category === 'root') return;
    uses[node.name] = { category: node.category, template: node, keys: new Set(), references: new Set() };
  });
  const head = version === 4 ? '<root BTCPP_format="4">' : '<root>';
  return {
    xml: ['<?xml version="1.0" encoding="UTF-8"?>', head, ...nodesModelLines(uses).lines, '</root>', ''].join('\n'),
    issues: Object.keys(uses).length === 0 ? [{ level: 'info', message: 'This project has no custom nodes' }] : [],
  };
}

// Toast text for import results: the first few issues, most severe first
export function summarizeIssues(issues: BtcppIssue[], limit = 3): string | undefined {
  if (issues.length === 0) return undefined;
  const rank = { error: 0, warning: 1, info: 2 };
  const sorted = [...issues].sort((a, b) => rank[a.level] - rank[b.level]);
  const shown = sorted.slice(0, limit).map((i) => i.message);
  const more = sorted.length - shown.length;
  return [...shown, ...(more > 0 ? [`…and ${more} more`] : [])].join('\n');
}
