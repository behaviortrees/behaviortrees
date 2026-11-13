import { handleMcpRequest } from 'behaviortrees/mcp';
import type { VercelRequest, VercelResponse } from './_lib/http.js';
import { logMcpFailures } from './_lib/mcp-diagnostics.js';

// The public MCP server at www.behaviortrees.com/mcp (rewritten here by
// vercel.json). Stateless Streamable HTTP; the tools live in packages/cli.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  logMcpFailures(req, res);
  await handleMcpRequest(req, res);
}
