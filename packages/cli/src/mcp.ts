import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getExample, listExamples, listNodeTypes } from './core/catalog';
import { convertTree, CONVERT_TARGETS } from './core/convert';
import { listGuides, readGuide } from './core/guides';
import { createEditorLink } from './core/link';
import { SITE } from './core/site';
import { validateTree } from './core/validate';
import { VERSION } from './version';

const INSTRUCTIONS = `Tools for behavior trees (game AI and robotics) from ${SITE}, a free online visual behavior tree editor.

Typical flow when a user wants a behavior tree: write it as behavior3 JSON, check it with validate_tree, fix any errors, then call create_editor_link and give the user the link. It opens the tree in the editor in their browser, laid out and editable, with no account needed. convert_tree turns behavior3 JSON into BehaviorTree.CPP XML (Groot2, ROS 2 Nav2) and back. list_node_types shows the built-in nodes; get_example returns complete example trees to copy from; read_guide explains concepts.`;

const TREE_FORMAT = `behavior3 JSON: {"title": "...", "root": "<id of the first node under the root>", "nodes": {"<id>": {"name": "<node type>", "title": "<optional label>", "children": ["<id>", ...] (composites, in run order) or "child": "<id>" (decorators), "properties": {...}}}, "custom_nodes": [{"name": "IsEnemyVisible", "category": "condition"}]}. Positions ("display") are optional. Any node name that isn't built in (see list_node_types) must be declared in custom_nodes with a category of action, condition, composite or decorator. A whole project ({"trees": [...], "custom_nodes": [...]}) or BehaviorTree.CPP XML also works.`;

const treeInput = z
	.union([z.string(), z.record(z.unknown())])
	.describe(`The tree: ${TREE_FORMAT}`);

const text = (value: unknown) => ({
	content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

const failure = (error: unknown) => ({
	content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
	isError: true,
});

export function createMcpServer(): McpServer {
	const server = new McpServer({ name: 'behaviortrees', title: 'Behavior Trees', version: VERSION }, { instructions: INSTRUCTIONS });
	const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

	server.registerTool(
		'validate_tree',
		{
			title: 'Validate a behavior tree',
			description: `Check a behavior tree for errors before using it: missing or dangling children, nodes with two parents, cycles, decorators with more than one child, leaves with children, unknown node names, and BehaviorTree.CPP import problems. Returns valid (true when there are no errors), the trees found, and findings at error, warning or info level.`,
			inputSchema: { tree: treeInput },
			annotations: readOnly,
		},
		async ({ tree }) => text(await validateTree(tree)),
	);

	server.registerTool(
		'create_editor_link',
		{
			title: 'Open a tree in the editor',
			description: `Make a link that opens the tree in the behaviortrees.com editor in the user's browser, auto-laid-out and editable, with no account needed. The tree travels inside the link (the URL fragment), so nothing is uploaded or stored. The tree must validate without errors. Give the user the returned url.`,
			inputSchema: { tree: treeInput },
			annotations: readOnly,
		},
		async ({ tree }) => {
			try {
				return text(await createEditorLink(tree));
			} catch (error) {
				return failure(error);
			}
		},
	);

	server.registerTool(
		'convert_tree',
		{
			title: 'Convert a behavior tree',
			description:
				'Convert between behavior3 JSON and BehaviorTree.CPP XML (v4 for ROS 2 Jazzy and Groot2, v3 for ROS 2 Humble), the same way the editor imports and exports. Returns the converted text and any issues (BT.CPP has no equivalent for some behavior3 nodes and vice versa).',
			inputSchema: {
				tree: treeInput,
				to: z.enum(CONVERT_TARGETS as [string, ...string[]]).describe('Target format: behavior3, btcpp-v4 or btcpp-v3'),
			},
			annotations: readOnly,
		},
		async ({ tree, to }) => {
			try {
				const result = await convertTree(tree, to as (typeof CONVERT_TARGETS)[number]);
				const issues = result.issues.length
					? `\n\nIssues:\n${result.issues.map((issue) => `- ${issue.level}: ${issue.message}`).join('\n')}`
					: '';
				return text(`${result.output}${issues}`);
			} catch (error) {
				return failure(error);
			}
		},
	);

	server.registerTool(
		'list_node_types',
		{
			title: 'List built-in node types',
			description:
				'The built-in behavior3 nodes a tree can use without declaring them: composites (Sequence, Priority = selector/fallback, MemSequence, MemPriority), decorators (Inverter, Repeater, MaxTime, ...) and leaves (Wait, Succeeder, Failer, ...), with descriptions and default properties.',
			inputSchema: {},
			annotations: readOnly,
		},
		async () => text(listNodeTypes()),
	);

	server.registerTool(
		'get_example',
		{
			title: 'Get an example tree',
			description:
				'Complete, working example trees (enemy patrol, cooldown-gated attacks, robot navigation with recovery, and more) to learn the format from or start with. Without an id, lists the examples; with an id, returns that tree as behavior3 JSON.',
			inputSchema: { id: z.string().optional().describe('Example id from the list; omit to list them') },
			annotations: readOnly,
		},
		async ({ id }) => {
			if (!id) return text(listExamples());
			const example = getExample(id);
			return example ? text(example) : failure(`No example "${id}". Examples: ${listExamples().map((e) => e.id).join(', ')}`);
		},
	);

	server.registerTool(
		'read_guide',
		{
			title: 'Read a behavior tree guide',
			description:
				'Practical guides from behaviortrees.com/learn as Markdown: what behavior trees are, node types, blackboards, debugging, structuring large trees, and behavior trees in Unity, Unreal, Godot, Python and robotics (BehaviorTree.CPP, ROS 2, Nav2). Without a slug, lists the guides.',
			inputSchema: { slug: z.string().optional().describe('Guide slug from the list; omit to list them') },
			annotations: { ...readOnly, openWorldHint: true },
		},
		async ({ slug }) => {
			try {
				return text(slug ? await readGuide(slug) : await listGuides());
			} catch (error) {
				return failure(error);
			}
		},
	);

	return server;
}
