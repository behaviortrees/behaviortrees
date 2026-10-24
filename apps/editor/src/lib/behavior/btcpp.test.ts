// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import enemyPatrol from '@behaviortrees/examples/trees/enemy-patrol.json';
import { Project, Tree } from '../../types';
import { B3Tree, b3ToProject } from './b3';
import {
  btcppToProject,
  BtcppExport,
  BtcppTreesImport,
  isLikelyXml,
  nodesToBtcpp,
  parseBtcppXml,
  projectToBtcpp,
  treeToBtcpp,
} from './btcpp';
import { DEFAULT_NODES } from './defaults';
import { childIdsInOrder } from './organize';

const FIXTURES = join(__dirname, '__fixtures__', 'btcpp');
const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

const importTrees = (xml: string): BtcppTreesImport => {
  const imported = parseBtcppXml(xml, DEFAULT_NODES, 'horizontal');
  if (imported.kind !== 'trees') throw new Error(`expected trees, got ${imported.kind}`);
  return imported;
};
const fromXml = (xml: string): Project => btcppToProject(importTrees(xml), 'Test');

// Ids and positions differ between imports; structure must not
type Shape = { name: string; title?: string; props: Record<string, unknown>; children: Shape[] };
const shape = (tree: Tree, id = tree.rootId!): Shape => {
  const block = tree.blocks[id];
  return {
    name: block.name,
    title: block.title,
    props: block.properties,
    children: childIdsInOrder(tree, id, 'horizontal').map((child) => shape(tree, child)),
  };
};
const shapes = (project: Project) =>
  Object.fromEntries(Object.values(project.trees).map((tree) => [tree.title, shape(tree)]));

const blockNamed = (tree: Tree, name: string) => Object.values(tree.blocks).find((b) => b.name === name)!;
const errors = (result: BtcppExport) => result.issues.filter((i) => i.level === 'error');
const messages = (result: { issues: { message: string }[] }) => result.issues.map((i) => i.message).join('\n');

const roundTrip = (project: Project, version: 3 | 4) => {
  const exported = projectToBtcpp(project, { version, layout: 'horizontal' });
  return { exported, reimported: fromXml(exported.xml) };
};

describe('isLikelyXml', () => {
  it('spots XML by its first character, ignoring a BOM', () => {
    expect(isLikelyXml('  <root/>')).toBe(true);
    expect(isLikelyXml('﻿<?xml version="1.0"?><root/>')).toBe(true);
    expect(isLikelyXml('{"trees": []}')).toBe(false);
  });
});

describe('importing Nav2 trees', () => {
  it('reads the Humble tree as v3 with Nav2 node types', () => {
    const imported = importTrees(fixture('nav2-humble-navigate.xml'));
    expect(imported.version).toBe(3);
    expect(imported.trees.map((t) => t.title)).toEqual(['MainTree']);
    expect(imported.issues).toEqual([]);

    const tree = imported.trees[0];
    expect(blockNamed(tree, 'RecoveryNode').category).toBe('composite');
    expect(blockNamed(tree, 'RateController').category).toBe('decorator');
    expect(blockNamed(tree, 'GoalUpdated').category).toBe('condition');
    expect(blockNamed(tree, 'ComputePathToPose').category).toBe('action');
    expect(blockNamed(tree, 'RoundRobin').category).toBe('composite');
  });

  it('keeps attribute text, instance names and child order exactly', () => {
    const tree = importTrees(fixture('nav2-humble-navigate.xml')).trees[0];
    expect(blockNamed(tree, 'RateController').properties).toEqual({ hz: '1.0' });
    // Nav2's Wait is not behavior3's Wait: no milliseconds injected
    expect(blockNamed(tree, 'Wait').properties).toEqual({ wait_duration: '5' });

    const top = shape(tree).children[0];
    expect(top.title).toBe('NavigateRecovery');
    expect(top.children.map((c) => c.title)).toEqual(['NavigateWithReplanning', 'RecoveryFallback']);
    expect(top.children[1].children[1].children.map((c) => c.name)).toEqual([
      'Sequence', 'Spin', 'Wait', 'BackUp',
    ]);
  });

  it('reads the Jazzy tree as v4', () => {
    const imported = importTrees(fixture('nav2-jazzy-navigate.xml'));
    expect(imported.version).toBe(4);
    expect(imported.issues).toEqual([]);
    const tree = imported.trees[0];
    expect(blockNamed(tree, 'PlannerSelector').category).toBe('action');
    expect(blockNamed(tree, 'WouldAPlannerRecoveryHelp').category).toBe('condition');
    expect(blockNamed(tree, 'ComputePathToPose').properties).toEqual({
      goal: '{goal}', path: '{path}', planner_id: '{selected_planner}', error_code_id: '{compute_path_error_code}',
    });
  });

  it('adds only the templates the project lacks', () => {
    const imported = importTrees(fixture('nav2-jazzy-navigate.xml'));
    expect(imported.nodes.RecoveryNode.category).toBe('composite');
    expect(imported.nodes.Fallback.category).toBe('composite');
    // Sequence and Wait already exist as behavior3 defaults
    expect(imported.nodes.Sequence).toBeUndefined();
    expect(imported.nodes.Wait).toBeUndefined();
  });
});

describe('importing node models', () => {
  it.each([
    ['nav2-tree-nodes-humble.xml', 51],
    ['nav2-tree-nodes-jazzy.xml', 65],
  ])('reads %s as nodes', (file, count) => {
    const imported = parseBtcppXml(fixture(file), DEFAULT_NODES, 'horizontal');
    expect(imported.kind).toBe('nodes');
    expect(Object.keys(imported.models)).toHaveLength(count);
  });

  it('keeps port direction, type, default and description', () => {
    const { models } = parseBtcppXml(fixture('nav2-tree-nodes-jazzy.xml'), DEFAULT_NODES, 'horizontal');
    const backUp = models.BackUp;
    expect(backUp.category).toBe('action');
    expect(backUp.ports!.backup_dist).toEqual({
      direction: 'input', type: 'double', default: '0.15', description: 'Total distance to backup (m).',
    });
    expect(backUp.ports!.error_code_id.direction).toBe('output');
    expect(backUp.properties.backup_dist).toBe('0.15');
    expect(backUp.properties).not.toHaveProperty('error_code_id');
    expect(models.RateController.category).toBe('decorator');
  });
});

describe('importing Groot2-style files', () => {
  const imported = importTrees(fixture('multi-subtree.xml'));
  const main = imported.trees.find((t) => t.title === 'PickAndPlace')!;

  it('opens the main tree and warns about includes', () => {
    expect(imported.trees.map((t) => t.title)).toEqual(['PickAndPlace', 'Grasp']);
    expect(imported.mainTreeId).toBe(main.id);
    expect(messages(imported)).toMatch(/Included file ".\/shared\/recovery.xml" wasn't loaded/);
  });

  it('reads explicit and compact syntax, SubTree and pre-conditions', () => {
    expect(blockNamed(main, 'SubTree').properties).toEqual({ ID: 'Grasp', target: '{object_pose}', _autoremap: 'true' });
    expect(blockNamed(main, 'MoveArm').properties).toEqual({ goal: '{place_pose}', speed: '0.5', _skipIf: 'already_placed' });
    expect(blockNamed(main, 'IsGripperOpen').category).toBe('condition');
    expect(imported.models.MoveArm.ports!.speed.default).toBe('1.0');
    // SubTree port models describe trees, not palette nodes
    expect(imported.models.Grasp).toBeUndefined();
    expect(imported.nodes.Script.properties).toEqual({ code: '' });
  });
});

describe('importing v3 files', () => {
  const imported = importTrees(fixture('v3-legacy.xml'));
  const main = imported.trees.find((t) => t.title === 'MainTree')!;

  it('uses v4 node and port names', () => {
    expect(imported.version).toBe(3);
    expect(blockNamed(main, 'SequenceWithMemory').title).toBe('Mission');
    expect(blockNamed(main, 'Parallel').properties).toEqual({ success_count: '2', failure_count: '1' });
    expect(blockNamed(main, 'RetryUntilSuccessful').properties).toEqual({ num_attempts: '2' });
  });

  it('turns both v3 subtree styles into v4 SubTree', () => {
    const subtrees = Object.values(main.blocks).filter((b) => b.name === 'SubTree');
    expect(subtrees.map((b) => b.properties)).toEqual([
      { ID: 'Dock', _autoremap: '1' },
      // A plain v3 SubTree remapped to bare keys; v4 needs braces
      { ID: 'Report', message: '{status_text}' },
    ]);
  });
});

describe('category guesses', () => {
  it('guesses from shape and name and says so', () => {
    const imported = importTrees(`<root BTCPP_format="4"><BehaviorTree ID="T">
      <TryAll><Retrying><IsDoorOpen/></Retrying><OpenDoor/></TryAll>
    </BehaviorTree></root>`);
    const tree = imported.trees[0];
    expect(blockNamed(tree, 'TryAll').category).toBe('composite');
    expect(blockNamed(tree, 'Retrying').category).toBe('decorator');
    expect(blockNamed(tree, 'IsDoorOpen').category).toBe('condition');
    expect(blockNamed(tree, 'OpenDoor').category).toBe('action');
    expect(messages(imported)).toMatch(/Guessed the node type of TryAll, Retrying, IsDoorOpen, OpenDoor/);
  });

  it('decides a name from its widest use', () => {
    const tree = importTrees(`<root BTCPP_format="4"><BehaviorTree ID="T">
      <Sequence><Gate><A/></Gate><Gate><B/><C/></Gate></Sequence>
    </BehaviorTree></root>`).trees[0];
    Object.values(tree.blocks).filter((b) => b.name === 'Gate').forEach((b) => expect(b.category).toBe('composite'));
  });

  it('keeps extra children of a decorator on the canvas, unconnected', () => {
    const imported = importTrees(`<root BTCPP_format="4"><BehaviorTree ID="T">
      <Inverter><AlwaysSuccess/><AlwaysFailure/></Inverter>
    </BehaviorTree></root>`);
    const tree = imported.trees[0];
    expect(Object.keys(tree.blocks)).toHaveLength(4);
    expect(childIdsInOrder(tree, blockNamed(tree, 'Inverter').id, 'horizontal')).toHaveLength(1);
    expect(imported.issues[0].level).toBe('error');
  });
});

describe('bad input', () => {
  it.each([
    ['<root><BehaviorTree ID="T">', /Not valid XML/, 'invalid_xml'],
    ['<!DOCTYPE x [<!ENTITY a "b">]><root/>', /DOCTYPE/, 'xml_doctype'],
    ['<behavior_tree/>', /expected a <root> element/, 'not_behavior_tree'],
    ['<root BTCPP_format="4"/>', /no <BehaviorTree> or <TreeNodesModel>/, 'not_behavior_tree'],
  ])('rejects %s', (xml, error, reason) => {
    expect(() => parseBtcppXml(xml, DEFAULT_NODES, 'horizontal')).toThrow(error);
    expect(() => parseBtcppXml(xml, DEFAULT_NODES, 'horizontal')).toThrow(
      expect.objectContaining({ name: 'InvalidFileError', reason })
    );
  });
});

describe('round trips', () => {
  it.each([
    ['nav2-jazzy-navigate.xml', 4],
    ['nav2-humble-navigate.xml', 3],
    ['multi-subtree.xml', 4],
    ['v3-legacy.xml', 3],
  ] as const)('%s survives export as v%i and re-import', (file, version) => {
    const project = fromXml(fixture(file));
    const { exported, reimported } = roundTrip(project, version);
    expect(errors(exported)).toEqual([]);
    expect(shapes(reimported)).toEqual(shapes(project));
  });

  it('writes Nav2 Jazzy back in its own vocabulary', () => {
    const { xml } = projectToBtcpp(fromXml(fixture('nav2-jazzy-navigate.xml')), { version: 4, layout: 'horizontal' });
    expect(xml).toContain('<root BTCPP_format="4" main_tree_to_execute="MainTree">');
    expect(xml).toContain('<RateController hz="1.0">');
    expect(xml).toContain('<Wait wait_duration="5.0"/>');
    expect(xml).toContain('<RecoveryNode name="NavigateRecovery" number_of_retries="6">');
  });

  it('says when port directions were guessed, until a node model is imported', () => {
    const project = fromXml(fixture('nav2-jazzy-navigate.xml'));
    const guessed = projectToBtcpp(project, { version: 4, layout: 'horizontal' });
    expect(messages(guessed)).toMatch(/Port directions of BackUp, ComputePathToPose, ControllerSelector, FollowPath, PlannerSelector, Spin, WouldAControllerRecoveryHelp, WouldAPlannerRecoveryHelp aren't known/);
    expect(guessed.xml).toContain('<input_port name="error_code_id"/>');

    const nav2 = parseBtcppXml(fixture('nav2-tree-nodes-jazzy.xml'), DEFAULT_NODES, 'horizontal');
    Object.assign(project.nodes, nav2.models);
    const modeled = projectToBtcpp(project, { version: 4, layout: 'horizontal' });
    expect(messages(modeled)).not.toMatch(/Port directions/);
    expect(modeled.xml).toContain('<output_port name="error_code_id" type="uint16">');
  });

  it('writes v3 spellings for Humble', () => {
    const { xml } = projectToBtcpp(fromXml(fixture('v3-legacy.xml')), { version: 3, layout: 'horizontal' });
    expect(xml).toContain('<root main_tree_to_execute="MainTree">');
    expect(xml).toContain('<SequenceStar name="Mission">');
    expect(xml).toContain('<Parallel success_threshold="2" failure_threshold="1">');
    expect(xml).toContain('<SubTreePlus ID="Dock" __autoremap="1"/>');
  });

  it('escapes attribute text, including multi-line Script code', () => {
    const code = 'msg := "a & <b>"\ncount += 1';
    const project = fromXml(`<root BTCPP_format="4"><BehaviorTree ID="T"><Script code="x"/></BehaviorTree></root>`);
    const tree = Object.values(project.trees)[0];
    blockNamed(tree, 'Script').properties.code = code;
    const { xml } = projectToBtcpp(project, { version: 4, layout: 'horizontal' });
    expect(xml).toContain('code="msg := &quot;a &amp; &lt;b&gt;&quot;&#10;count += 1"');
    expect(blockNamed(Object.values(fromXml(xml).trees)[0], 'Script').properties.code).toBe(code);
  });
});

describe('exporting behavior3 trees', () => {
  const enemy = b3ToProject({ id: 'p', name: 'Enemy', trees: [enemyPatrol as B3Tree] });

  it('translates defaults and models the custom nodes', () => {
    const result = projectToBtcpp(enemy, { version: 4, layout: 'horizontal' });
    expect(errors(result)).toEqual([]);
    expect(result.xml).toContain('<Fallback name="Enemy AI">');
    expect(result.xml).toContain('<Sleep msec="2000"/>');
    expect(result.xml).toContain('<Condition ID="IsPlayerInRange">');
    expect(result.xml).toContain('<input_port name="range" default="2"/>');
    expect(result.xml).not.toContain('Priority');
  });

  it('keeps Wait under v3, with a warning', () => {
    const result = projectToBtcpp(enemy, { version: 3, layout: 'horizontal' });
    expect(result.xml).toContain('<Wait milliseconds="2000"/>');
    expect(messages(result)).toMatch(/Wait has no BehaviorTree.CPP v3 equivalent|Wait has no BT.CPP v3 equivalent/);
  });

  it('renames properties to ports and flags nodes with no equivalent', () => {
    const project = b3ToProject({
      id: 'p',
      name: 'Defaults',
      trees: [{
        id: 't', title: 'Loop', root: 'r',
        nodes: {
          r: { id: 'r', name: 'Repeater', properties: { maxLoop: -1 }, child: 'm' },
          m: { id: 'm', name: 'MemPriority', properties: {}, children: ['s', 'l'] },
          s: { id: 's', name: 'Succeeder', properties: {} },
          l: { id: 'l', name: 'Limiter', properties: { maxLoop: 1 }, child: 'f' },
          f: { id: 'f', name: 'Failer', properties: {} },
        },
      }],
    });
    const result = projectToBtcpp(project, { version: 4, layout: 'horizontal' });
    expect(result.xml).toContain('<Repeat num_cycles="-1">');
    expect(result.xml).toContain('<AlwaysSuccess/>');
    expect(result.xml).toContain('<AlwaysFailure/>');
    expect(result.xml).toContain('<Control ID="MemPriority"/>');
    expect(messages(result)).toMatch(/MemPriority has no BT.CPP equivalent/);
    expect(messages(result)).toMatch(/Limiter has no BT.CPP equivalent/);
  });
});

describe('export checks', () => {
  it('flags a decorator with two children', () => {
    const project = fromXml(`<root BTCPP_format="4"><BehaviorTree ID="T"><Inverter><AlwaysSuccess/></Inverter></BehaviorTree></root>`);
    const tree = Object.values(project.trees)[0];
    const extra = { ...blockNamed(tree, 'AlwaysSuccess'), id: 'extra', position: { x: 0, y: 500 } };
    tree.blocks.extra = extra;
    tree.connections.c = { id: 'c', source: blockNamed(tree, 'Inverter').id, target: 'extra' };
    expect(messages(projectToBtcpp(project, { version: 4 }))).toMatch(/decorator with 2 children/);
  });

  it('flags empty trees and composites, and unconnected nodes', () => {
    const project = fromXml(`<root BTCPP_format="4">
      <BehaviorTree ID="A"><Sequence/></BehaviorTree>
      <BehaviorTree ID="B"/>
    </root>`);
    const treeA = Object.values(project.trees).find((t) => t.title === 'A')!;
    treeA.blocks.loose = { id: 'loose', name: 'AlwaysSuccess', category: 'action', properties: {}, position: { x: 0, y: 900 } };
    const result = projectToBtcpp(project, { version: 4 });
    expect(messages(result)).toMatch(/"Sequence" in "A" has no children/);
    expect(messages(result)).toMatch(/Tree "B" is empty/);
    expect(messages(result)).toMatch(/1 node in "A" isn't connected to the root/);
    expect(result.xml).not.toContain('loose');
  });

  it('exports a tree with the subtrees it uses, and finds loops', () => {
    const project = fromXml(`<root BTCPP_format="4" main_tree_to_execute="A">
      <BehaviorTree ID="A"><SubTree ID="B"/></BehaviorTree>
      <BehaviorTree ID="B"><SubTree ID="A"/></BehaviorTree>
      <BehaviorTree ID="Unused"><AlwaysSuccess/></BehaviorTree>
    </root>`);
    const result = treeToBtcpp(project, project.selectedTreeId!, { version: 4 });
    expect(result.xml).toContain('<BehaviorTree ID="B">');
    expect(result.xml).not.toContain('Unused');
    expect(messages(result)).toMatch(/SubTrees form a loop: A → B → A/);
  });

  it('warns about missing subtrees and keeps tree IDs unique', () => {
    const project = fromXml(`<root BTCPP_format="4">
      <BehaviorTree ID="My Tree"><SubTree ID="Elsewhere"/></BehaviorTree>
      <BehaviorTree ID="My Tree"><AlwaysSuccess/></BehaviorTree>
    </root>`);
    const result = projectToBtcpp(project, { version: 4 });
    expect(result.xml).toContain('<BehaviorTree ID="My_Tree">');
    expect(result.xml).toContain('<BehaviorTree ID="My_Tree_2">');
    expect(messages(result)).toMatch(/SubTree references "Elsewhere"/);
  });

  it('drops pre-conditions and v4-only builtins from v3 with warnings', () => {
    const result = projectToBtcpp(fromXml(fixture('multi-subtree.xml')), { version: 3, layout: 'horizontal' });
    expect(result.xml).not.toContain('_skipIf');
    expect(messages(result)).toMatch(/"_skipIf" on "MoveArm" in "PickAndPlace" needs BT.CPP v4/);
    expect(messages(result)).toMatch(/Script isn't a builtin in BT.CPP v3/);
  });

  it('writes a nodes-only file', () => {
    const imported = parseBtcppXml(fixture('nav2-tree-nodes-humble.xml'), DEFAULT_NODES, 'horizontal');
    const project = b3ToProject({ id: 'p', name: 'Nodes', trees: [] });
    Object.assign(project.nodes, imported.models);
    const { xml } = nodesToBtcpp(project, { version: 4 });
    const again = parseBtcppXml(xml, DEFAULT_NODES, 'horizontal');
    expect(again.models).toEqual(imported.models);
  });
});
