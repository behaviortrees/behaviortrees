import type { IncomingMessage, ServerResponse } from 'node:http';

// Why /mcp turned a request away, logged to Vercel's runtime logs. Request
// logs only show the status, and about a third of Claude's requests get a
// 400. Method names and headers only: never params, so no tree content.

export type McpFailure = {
  status: number;
  method: string | undefined;
  rpc: string[];
  protocolVersion: string | null;
  accept: string | null;
  contentType: string | null;
  hasSessionId: boolean;
  userAgent: string | null;
  error: string;
};

const header = (req: IncomingMessage, name: string) => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value.join(', ') : value) ?? null;
};

// JSON-RPC method names from a single message or a batch
const rpcMethods = (body: unknown): string[] =>
  (Array.isArray(body) ? body : [body])
    .map((message) => (message && typeof message === 'object' ? (message as { method?: unknown }).method : undefined))
    .filter((method): method is string => typeof method === 'string')
    .slice(0, 10);

// The SDK answers with {"jsonrpc":"2.0","error":{"message":…}}
function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === 'string') return parsed.error.message.slice(0, 300);
  } catch {
    // not JSON
  }
  return body.slice(0, 300);
}

export function describeMcpFailure(
  req: IncomingMessage & { body?: unknown },
  status: number,
  responseBody: string
): McpFailure {
  return {
    status,
    method: req.method,
    rpc: rpcMethods(req.body),
    protocolVersion: header(req, 'mcp-protocol-version'),
    accept: header(req, 'accept'),
    contentType: header(req, 'content-type'),
    hasSessionId: Boolean(header(req, 'mcp-session-id')),
    userAgent: header(req, 'user-agent')?.slice(0, 200) ?? null,
    error: errorMessage(responseBody),
  };
}

// Keeps the first few KB written to the response, to read the error from
export function recordResponseBody(res: ServerResponse): () => string {
  const chunks: string[] = [];
  let size = 0;
  const keep = (chunk: unknown) => {
    if (size >= 4096 || chunk == null || typeof chunk === 'function') return;
    const text = typeof chunk === 'string' ? chunk : chunk instanceof Uint8Array ? Buffer.from(chunk).toString('utf8') : '';
    chunks.push(text);
    size += text.length;
  };
  const write = res.write.bind(res) as (...args: unknown[]) => boolean;
  const end = res.end.bind(res) as (...args: unknown[]) => ServerResponse;
  res.write = ((...args: unknown[]) => {
    keep(args[0]);
    return write(...args);
  }) as ServerResponse['write'];
  res.end = ((...args: unknown[]) => {
    keep(args[0]);
    return end(...args);
  }) as ServerResponse['end'];
  return () => chunks.join('').slice(0, 4096);
}

export function logMcpFailures(req: IncomingMessage & { body?: unknown }, res: ServerResponse): void {
  const body = recordResponseBody(res);
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    console.warn(JSON.stringify({ mcp_failure: describeMcpFailure(req, res.statusCode, body()) }));
  });
}
