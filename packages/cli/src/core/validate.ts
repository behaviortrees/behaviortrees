import { DEFAULT_NODES, type B3NodeSpec, type B3NodeTemplate, type B3Tree, type NodeCategory } from './editor';
import { loadInput, type TreeInput } from './load';

export type Finding = {
	level: 'error' | 'warning' | 'info';
	message: string;
	tree?: string;
};

export type ValidationResult = {
	valid: boolean;
	format?: 'behavior3' | 'btcpp';
	kind?: 'tree' | 'project';
	trees: { title: string; nodes: number }[];
	findings: Finding[];
};

const CATEGORIES = new Set<NodeCategory>(['composite', 'decorator', 'action', 'condition']);

// Names from other behavior tree libraries that behavior3 spells differently
const ALIASES: Record<string, string> = {
	Selector: 'Priority',
	Fallback: 'Priority',
	ReactiveSelector: 'Priority',
	ReactiveSequence: 'Sequence',
	Repeat: 'Repeater',
	Timeout: 'MaxTime',
	Invert: 'Inverter',
	Not: 'Inverter',
	AlwaysSuccess: 'Succeeder',
	AlwaysFailure: 'Failer',
};

const article = (word: string) => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);

function checkCustomNodes(templates: B3NodeTemplate[] | undefined, out: Finding[], tree?: string) {
	for (const template of templates ?? []) {
		if (!template?.name) {
			out.push({ level: 'error', message: 'A custom node has no "name"', tree });
		} else if (template.category && !CATEGORIES.has(template.category)) {
			out.push({
				level: 'error',
				message: `Custom node "${template.name}" has category "${template.category}"; use action, condition, composite or decorator`,
				tree,
			});
		}
	}
}

function checkTree(spec: B3Tree, categories: Map<string, NodeCategory>, out: Finding[]) {
	const tree = spec.title || spec.id || 'Untitled tree';
	const push = (level: Finding['level'], message: string) => out.push({ level, message, tree });

	if (!spec.nodes || typeof spec.nodes !== 'object' || Array.isArray(spec.nodes)) {
		push('error', 'The tree has no "nodes" object (node id → node)');
		return;
	}
	checkCustomNodes(spec.custom_nodes, out, tree);
	const treeCategories = new Map(categories);
	for (const template of spec.custom_nodes ?? []) {
		if (template?.name) treeCategories.set(template.name, template.category ?? 'action');
	}

	const byId = new Map<string, B3NodeSpec>();
	for (const [key, node] of Object.entries(spec.nodes)) {
		if (!node || typeof node !== 'object') {
			push('error', `Node "${key}" is not an object`);
			continue;
		}
		const id = node.id ?? key;
		if (node.id && node.id !== key) {
			push('warning', `Node keyed "${key}" has id "${node.id}"; children and root must refer to "${node.id}"`);
		}
		byId.set(id, node);
	}

	const childrenOf = (node: B3NodeSpec): string[] =>
		Array.isArray(node.children) ? node.children : node.child !== undefined && node.child !== null ? [node.child] : [];

	if (byId.size > 0) {
		if (spec.root === undefined || spec.root === null) {
			push('error', 'The tree has nodes but no "root" (the id of the first node under the root)');
		} else if (!byId.has(spec.root)) {
			push('error', `"root" is "${spec.root}", but there is no node with that id`);
		}
	}

	const parents = new Map<string, string>();
	const undeclared = new Map<string, NodeCategory>();
	const aliased = new Set<string>();
	for (const [id, node] of byId) {
		if (!node.name) {
			push('error', `Node "${id}" has no "name"`);
			continue;
		}
		const known = treeCategories.get(node.name);
		const category = known ?? (Array.isArray(node.children) ? 'composite' : node.child !== undefined ? 'decorator' : 'action');
		if (!known && ALIASES[node.name] && !aliased.has(node.name)) {
			aliased.add(node.name);
			push(
				'warning',
				`"${node.name}" isn't a behavior3 node, so the editor adds it as a custom ${category}. Did you mean "${ALIASES[node.name]}"?`,
			);
		}
		if (!known && !ALIASES[node.name]) undeclared.set(node.name, category);

		if (node.children !== undefined && !Array.isArray(node.children)) {
			push('error', `Node "${id}" has "children" that isn't an array`);
		}
		const children = childrenOf(node);
		if (category === 'composite' && node.child !== undefined && !Array.isArray(node.children)) {
			push('warning', `"${id}" is a composite (${node.name}); composites list "children", not a single "child"`);
		}
		if (category === 'composite' && children.length === 0) {
			push('warning', `Composite "${id}" (${node.name}) has no children, so it does nothing`);
		}
		if (category === 'decorator') {
			if (Array.isArray(node.children) && node.children.length > 1) {
				push('error', `Decorator "${id}" (${node.name}) has ${node.children.length} children; decorators wrap exactly one "child"`);
			} else if (Array.isArray(node.children)) {
				push('warning', `Decorator "${id}" (${node.name}) uses "children"; decorators take a single "child"`);
			} else if (children.length === 0) {
				push('warning', `Decorator "${id}" (${node.name}) has no child`);
			}
		}
		if ((category === 'action' || category === 'condition') && children.length > 0) {
			push('error', `"${id}" is ${article(category)} (${node.name}), so it can't have children`);
		}

		for (const child of children) {
			if (!byId.has(child)) {
				push('error', `Node "${id}" lists child "${child}", which doesn't exist`);
			} else if (child === spec.root) {
				push('error', `The root node "${child}" is also a child of "${id}"`);
			} else if (parents.has(child)) {
				push('error', `Node "${child}" has two parents ("${parents.get(child)}" and "${id}"); each node can appear once`);
			} else {
				parents.set(child, id);
			}
		}
	}

	if (undeclared.size > 0) {
		const names = [...undeclared].map(([name, category]) => `${name} (${category})`).join(', ');
		push(
			'info',
			`Not built in and not in custom_nodes, so the editor infers their category: ${names}. Declare them in custom_nodes to set it, e.g. {"name": "IsEnemyVisible", "category": "condition"}.`,
		);
	}

	// Walk from the root: report cycles, then anything never reached
	const reached = new Set<string>();
	const walk = (id: string, path: Set<string>) => {
		if (path.has(id)) {
			push('error', `Cycle: "${id}" is its own descendant`);
			return;
		}
		if (reached.has(id) || !byId.has(id)) return;
		reached.add(id);
		path.add(id);
		for (const child of childrenOf(byId.get(id)!)) walk(child, path);
		path.delete(id);
	};
	if (spec.root && byId.has(spec.root)) walk(spec.root, new Set());
	const orphans = [...byId.keys()].filter((id) => !reached.has(id));
	if (orphans.length > 0 && spec.root && byId.has(spec.root)) {
		push(
			'warning',
			`${orphans.length === 1 ? 'Node' : 'Nodes'} ${orphans.map((id) => `"${id}"`).join(', ')} ${orphans.length === 1 ? "isn't" : "aren't"} connected to the root, so ${orphans.length === 1 ? 'it' : 'they'} will never run`,
		);
	}
}

export async function validateTree(input: TreeInput): Promise<ValidationResult> {
	let loaded;
	try {
		loaded = await loadInput(input);
	} catch (error) {
		return { valid: false, trees: [], findings: [{ level: 'error', message: (error as Error).message }] };
	}

	const findings: Finding[] = loaded.issues.map((issue) => ({ level: issue.level, message: issue.message }));

	if (loaded.format === 'behavior3') {
		const categories = new Map<string, NodeCategory>(
			Object.values(DEFAULT_NODES).map((node) => [node.name, node.category]),
		);
		const projectNodes = (loaded.json as { custom_nodes?: B3NodeTemplate[] }).custom_nodes;
		if (loaded.kind === 'project') checkCustomNodes(projectNodes, findings);
		for (const template of projectNodes ?? []) {
			if (template?.name) categories.set(template.name, template.category ?? 'action');
		}
		for (const tree of loaded.b3Trees) checkTree(tree, categories, findings);
	}

	const trees = Object.values(loaded.project.trees).map((tree) => ({
		title: tree.title,
		nodes: Object.keys(tree.blocks).length - 1,
	}));
	if (trees.length === 0) findings.push({ level: 'error', message: 'The project has no trees' });

	return {
		valid: !findings.some((finding) => finding.level === 'error'),
		format: loaded.format,
		kind: loaded.kind,
		trees,
		findings,
	};
}
