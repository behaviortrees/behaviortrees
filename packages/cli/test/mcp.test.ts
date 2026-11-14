import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleMcpRequest } from '../src/http';
import { createMcpServer } from '../src/mcp';

const textOf = (result: Awaited<ReturnType<Client['callTool']>>) =>
	(result.content as { type: string; text: string }[]).map((part) => part.text).join('');

describe('MCP server', () => {
	let client: Client;

	beforeAll(async () => {
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await createMcpServer().connect(serverTransport);
		client = new Client({ name: 'test', version: '0' });
		await client.connect(clientTransport);
	});

	it('lists its tools with instructions', async () => {
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name).sort()).toEqual([
			'convert_tree',
			'create_editor_link',
			'get_example',
			'list_node_types',
			'read_guide',
			'validate_tree',
		]);
		expect(client.getInstructions()).toContain('create_editor_link');
		for (const tool of tools) {
			expect(tool.annotations).toMatchObject({ title: tool.title, readOnlyHint: true });
		}
	});

	it('validates a tree passed as an object or a string', async () => {
		const tree = { title: 'T', root: 'a', nodes: { a: { name: 'Wait' } } };
		for (const input of [tree, JSON.stringify(tree)]) {
			const result = await client.callTool({ name: 'validate_tree', arguments: { tree: input } });
			expect(JSON.parse(textOf(result))).toMatchObject({ valid: true });
		}
	});

	it('makes a link, or explains why not', async () => {
		const ok = await client.callTool({
			name: 'create_editor_link',
			arguments: { tree: { title: 'T', root: 'a', nodes: { a: { name: 'Wait' } } } },
		});
		expect(JSON.parse(textOf(ok)).url).toMatch(/#tree=/);

		const bad = await client.callTool({
			name: 'create_editor_link',
			arguments: { tree: { title: 'T', root: 'a', nodes: { a: { name: 'Sequence', children: ['x'] } } } },
		});
		expect(bad.isError).toBe(true);
		expect(textOf(bad)).toContain('lists child "x"');
	});

	it('converts and returns examples', async () => {
		const example = await client.callTool({ name: 'get_example', arguments: { id: 'open-the-door' } });
		const xml = await client.callTool({ name: 'convert_tree', arguments: { tree: textOf(example), to: 'btcpp-v4' } });
		expect(textOf(xml)).toContain('BTCPP_format="4"');
		const missing = await client.callTool({ name: 'get_example', arguments: { id: 'nope' } });
		expect(missing.isError).toBe(true);
	});
});

describe('Streamable HTTP endpoint', () => {
	let server: Server;
	let url: URL;

	beforeAll(async () => {
		server = createServer((req, res) => void handleMcpRequest(req, res));
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`);
	});

	afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

	it('serves a stateless MCP session over HTTP', async () => {
		const client = new Client({ name: 'test', version: '0' });
		await client.connect(new StreamableHTTPClientTransport(url));
		const result = await client.callTool({ name: 'list_node_types', arguments: {} });
		expect(textOf(result)).toContain('Priority');
		await client.close();
	});

	it('serves 2026-07-28 clients, which probe with server/discover', async () => {
		const client = new Client({ name: 'test', version: '0' }, { versionNegotiation: { mode: 'auto' } });
		await client.connect(new StreamableHTTPClientTransport(url));
		expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
		expect(client.getInstructions()).toContain('create_editor_link');
		const result = await client.callTool({ name: 'get_example', arguments: { id: 'enemy-patrol' } });
		expect(textOf(result)).toContain('"nodes"');
		await client.close();
	});

	it('answers 2025-era requests with plain JSON', async () => {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
				'Mcp-Protocol-Version': '2025-11-25',
			},
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
		});
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect((await response.json()).result.tools).toHaveLength(6);
	});

	it('answers CORS preflights and refuses GET', async () => {
		const preflight = await fetch(url, { method: 'OPTIONS' });
		expect(preflight.status).toBe(204);
		expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
		expect((await fetch(url, { headers: { Accept: 'text/event-stream' } })).status).toBe(405);
	});

	it('sends browsers to the docs', async () => {
		const response = await fetch(url, { headers: { Accept: 'text/html' }, redirect: 'manual' });
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toContain('packages/cli#readme');
	});
});
