import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcp';

const DOCS_URL = 'https://github.com/behaviortrees/behaviortrees/tree/main/packages/cli#readme';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
	'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};

// Stateless Streamable HTTP: every request gets a fresh server, so it runs on
// serverless functions with no session store. The tools are read-only and
// public, so there's no auth. `body` is the already-parsed JSON, if any.
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

	const server = createMcpServer();
	const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
	res.on('close', () => {
		void transport.close();
		void server.close();
	});
	await server.connect(transport);
	await transport.handleRequest(req, res, req.body);
}
