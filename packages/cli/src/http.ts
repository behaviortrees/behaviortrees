import type { IncomingMessage, ServerResponse } from 'node:http';
import { NodeStreamableHTTPServerTransport, toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
import { createMcpHandler, isLegacyRequest } from '@modelcontextprotocol/server';
import { createMcpServer } from './mcp';

const DOCS_URL = 'https://github.com/behaviortrees/behaviortrees/tree/main/packages/cli#readme';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': '*, Authorization',
	'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};

// Stateless Streamable HTTP: every request gets a fresh server, so it runs on
// serverless functions with no session store. The tools are read-only and
// public, so there's no auth. `body` is the already-parsed JSON, if any.
const modern = toNodeHandler(createMcpHandler(createMcpServer, { legacy: 'reject' }));

// 2025-era clients (initialize, no per-request _meta) keep plain JSON
// responses; the SDK's own legacy fallback answers them over SSE
async function legacy(req: IncomingMessage, res: ServerResponse, body: unknown) {
	const server = createMcpServer();
	const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
	res.on('close', () => {
		void transport.close();
		void server.close();
	});
	await server.connect(transport);
	await transport.handleRequest(req, res, body);
}

// Vercel parses JSON bodies; a plain Node server leaves the stream unread
async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
	if (req.body !== undefined) return req.body;
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	const text = Buffer.concat(chunks).toString('utf8');
	if (!text) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

export async function handleMcpRequest(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
	for (const [key, value] of Object.entries(CORS)) res.setHeader(key, value);

	if (req.method === 'OPTIONS') {
		res.writeHead(204).end();
		return;
	}
	// A person following the server URL from a directory gets the docs
	if (req.method === 'GET' && String(req.headers.accept ?? '').includes('text/html')) {
		res.writeHead(302, { Location: DOCS_URL }).end();
		return;
	}
	if (req.method !== 'POST') {
		res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' }).end(
			JSON.stringify({
				jsonrpc: '2.0',
				error: { code: -32000, message: 'This MCP server is stateless: send JSON-RPC requests with POST.' },
				id: null,
			}),
		);
		return;
	}

	const body = await readBody(req);
	const isLegacy = await isLegacyRequest(await toWebRequest(req, body), body);
	await (isLegacy ? legacy(req, res, body) : modern(req, res, body));
}
