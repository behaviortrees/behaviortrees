import type { IncomingMessage, ServerResponse } from 'node:http';
import type { McpServer } from '@modelcontextprotocol/server';

export declare function createMcpServer(): McpServer;
// Stateless Streamable HTTP handler; pass the parsed JSON body if the host
// already read it (Vercel does)
export declare function handleMcpRequest(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void>;
