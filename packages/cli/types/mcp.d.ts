import type { IncomingMessage, ServerResponse } from 'node:http';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export declare function createMcpServer(): McpServer;
// Stateless Streamable HTTP handler; pass the parsed JSON body if the host
// already read it (Vercel does)
export declare function handleMcpRequest(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void>;
