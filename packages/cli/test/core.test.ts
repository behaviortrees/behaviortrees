import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeSharedTree } from '../../../apps/editor/src/lib/share-link';
import { EXAMPLE_TREES, getExample, listNodeTypes } from '../src/core/catalog';
import { convertTree } from '../src/core/convert';
import { createEditorLink, InvalidTreeError } from '../src/core/link';
import { validateTree } from '../src/core/validate';

const EXAMPLES_DIR = new URL('../../examples/trees/', import.meta.url);

const tree = (nodes: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
	title: 'T',
	root: 'a',
	nodes,
	...extra,
});

const messages = async (input: unknown) =>
	(await validateTree(input as Record<string, unknown>)).findings.map((f) => `${f.level}: ${f.message}`);

describe('examples', () => {
	it('bundles every file in packages/examples', () => {
		const ids = readdirSync(EXAMPLES_DIR).map((file) => file.replace(/\.json$/, ''));
		expect(EXAMPLE_TREES.map((example) => example.id).sort()).toEqual(ids.sort());
	});

	it.each(readdirSync(EXAMPLES_DIR))('%s validates with no errors or warnings', async (file) => {
		const result = await validateTree(readFileSync(new URL(file, EXAMPLES_DIR), 'utf8'));
		expect(result.findings.filter((f) => f.level !== 'info')).toEqual([]);
		expect(result.valid).toBe(true);
	});
});

describe('validateTree', () => {
	it('accepts a minimal hand-written tree', async () => {
		const result = await validateTree(
			tree(
				{ a: { name: 'Priority', children: ['b', 'c'] }, b: { name: 'Look' }, c: { name: 'Wait' } },
				{ custom_nodes: [{ name: 'Look', category: 'condition' }] },
			),
		);
		expect(result).toMatchObject({ valid: true, format: 'behavior3', kind: 'tree', trees: [{ title: 'T', nodes: 3 }] });
		expect(result.findings).toEqual([]);
	});

	it('reports structural errors the editor import would hide', async () => {
		const found = await messages(
			tree({
				a: { name: 'Sequence', children: ['b', 'missing'] },
				b: { name: 'Wait', children: ['c'] },
				c: { name: 'Inverter', children: ['a', 'd'] },
				d: { name: 'Wait' },
				e: { name: 'Succeeder' },
			}),
		);
		expect(found).toEqual(
			expect.arrayContaining([
				'error: Node "a" lists child "missing", which doesn\'t exist',
				'error: "b" is an action (Wait), so it can\'t have children',
				'error: Decorator "c" (Inverter) has 2 children; decorators wrap exactly one "child"',
				'error: The root node "a" is also a child of "c"',
				'warning: Node "e" isn\'t connected to the root, so it will never run',
			]),
		);
	});

	it('finds cycles and nodes with two parents', async () => {
		const found = await messages(
			tree({
				a: { name: 'Sequence', children: ['b', 'c'] },
				b: { name: 'Sequence', children: ['c'] },
				c: { name: 'Sequence', children: ['b'] },
			}),
		);
		expect(found).toEqual(
			expect.arrayContaining([
				'error: Node "c" has two parents ("a" and "b"); each node can appear once',
				'error: Node "b" has two parents ("a" and "c"); each node can appear once',
			]),
		);
	});

	it('suggests behavior3 names for names from other libraries', async () => {
		const found = await messages(tree({ a: { name: 'Selector', children: ['b'] }, b: { name: 'Fallback', children: ['c'] }, c: { name: 'Wait' } }));
		expect(found).toContain('warning: "Selector" isn\'t a behavior3 node, so the editor adds it as a custom composite. Did you mean "Priority"?');
	});

	it('needs a root that exists', async () => {
		expect(await messages(tree({ x: { name: 'Wait' } }, { root: 'nope' }))).toContain(
			'error: "root" is "nope", but there is no node with that id',
		);
	});

	it('checks custom node categories', async () => {
		expect(await messages(tree({ a: { name: 'Look' } }, { custom_nodes: [{ name: 'Look', category: 'sensor' }] }))).toContain(
			'error: Custom node "Look" has category "sensor"; use action, condition, composite or decorator',
		);
	});

	it('reports unreadable input instead of throwing', async () => {
		expect(await validateTree('not a tree')).toMatchObject({ valid: false });
		expect(await validateTree('<root BTCPP_format="4"><BehaviorTree ID="a"><Sequence></root>')).toMatchObject({
			valid: false,
			findings: [{ level: 'error', message: expect.stringMatching(/^Not valid XML/) }],
		});
		expect(await validateTree('{"scope":"node","name":"Look","category":"condition"}')).toMatchObject({ valid: false });
	});

	it('reads BehaviorTree.CPP XML', async () => {
		const xml = `<root BTCPP_format="4"><BehaviorTree ID="Main"><Sequence><AlwaysSuccess/><Sleep msec="10"/></Sequence></BehaviorTree></root>`;
		expect(await validateTree(xml)).toMatchObject({ valid: true, format: 'btcpp', kind: 'tree', trees: [{ title: 'Main', nodes: 3 }] });
	});
});

describe('convertTree', () => {
	it('round-trips behavior3 through BT.CPP XML', async () => {
		const source = getExample('robot-navigate-recovery')!;
		const xml = await convertTree(source, 'btcpp-v4');
		expect(xml.output).toMatch(/^<\?xml[\s\S]*BTCPP_format="4"/);
		const back = await convertTree(xml.output, 'behavior3');
		const result = await validateTree(back.output);
		expect(result.valid).toBe(true);
		expect(result.trees[0].nodes).toBe(Object.keys(source.nodes as object).length);
	});

	it('writes v3 for ROS 2 Humble, which has no format attribute', async () => {
		const { output } = await convertTree(getExample('enemy-patrol')!, 'btcpp-v3');
		expect(output).toContain('<root main_tree_to_execute="Enemy_Patrol_AI">');
		expect(output).not.toContain('BTCPP_format');
	});
});

describe('createEditorLink', () => {
	it('encodes the tree as written into the URL fragment', async () => {
		const input = tree({ a: { name: 'Wait' } });
		const link = await createEditorLink(input);
		expect(link.url).toMatch(/^https:\/\/www\.behaviortrees\.com\/editor#tree=[\w-]+$/);
		const decoded = await decodeSharedTree(link.url.split('#tree=')[1]);
		expect(decoded.data).toEqual(input);
	});

	it('refuses trees with errors', async () => {
		await expect(createEditorLink(tree({ a: { name: 'Sequence', children: ['x'] } }))).rejects.toBeInstanceOf(InvalidTreeError);
	});

	it('links BT.CPP XML as behavior3', async () => {
		const xml = `<root BTCPP_format="4"><BehaviorTree ID="Main"><Sequence><AlwaysSuccess/></Sequence></BehaviorTree></root>`;
		const decoded = await decodeSharedTree((await createEditorLink(xml)).url.split('#tree=')[1]);
		expect(decoded.data).toMatchObject({ title: 'Main', scope: 'tree' });
	});
});

describe('listNodeTypes', () => {
	it('lists the built-ins without the root', () => {
		const names = listNodeTypes().map((node) => node.name);
		expect(names).toEqual(expect.arrayContaining(['Sequence', 'Priority', 'Inverter', 'Wait']));
		expect(names).not.toContain('Root');
	});
});
