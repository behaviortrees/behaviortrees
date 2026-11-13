import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { logMcpFailures } from './mcp-diagnostics.js';

// A stand-in for the SDK's transport: rejects a protocol version the way it
// does, and answers everything else
function fakeMcp(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const version = req.headers['mcp-protocol-version'];
  if (version === '2099-01-01') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.write(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: `Bad Request: Unsupported protocol version: ${version}` },
        id: null,
      })
    );
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end('{"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."},"id":null}');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"jsonrpc":"2.0","result":{},"id":1}');
}

let server: Server;
let url: string;

beforeAll(async () => {
  server = createServer((req: IncomingMessage & { body?: unknown }, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      req.body = raw ? JSON.parse(raw) : undefined;
      logMcpFailures(req, res);
      fakeMcp(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => vi.restoreAllMocks());

const logged = async (init: RequestInit) => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const response = await fetch(url, init);
  await response.text();
  await new Promise((resolve) => setTimeout(resolve, 20));
  return warn.mock.calls.map(([line]) => JSON.parse(String(line)).mcp_failure);
};

describe('logMcpFailures', () => {
  it('logs why a request was rejected, with method names but no params', async () => {
    const [failure] = await logged({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2099-01-01',
        'mcp-session-id': 'abc',
        'user-agent': 'Claude-User',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'validate_tree', arguments: { tree: '{"secret":"tree"}' } },
      }),
    });
    expect(failure).toEqual({
      status: 400,
      method: 'POST',
      rpc: ['tools/call'],
      protocolVersion: '2099-01-01',
      accept: 'application/json, text/event-stream',
      contentType: 'application/json',
      hasSessionId: true,
      userAgent: 'Claude-User',
      error: 'Bad Request: Unsupported protocol version: 2099-01-01',
    });
    expect(JSON.stringify(failure)).not.toContain('secret');
  });

  it('lists every method in a batch', async () => {
    const [failure] = await logged({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2099-01-01' },
      body: JSON.stringify([
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      ]),
    });
    expect(failure.rpc).toEqual(['notifications/initialized', 'tools/list']);
  });

  it('reads an error written with end() alone', async () => {
    const [failure] = await logged({ method: 'GET', headers: { accept: 'text/event-stream' } });
    expect(failure).toMatchObject({ status: 405, method: 'GET', rpc: [], error: 'Method not allowed.' });
  });

  it('logs nothing for a request that succeeds', async () => {
    const failures = await logged({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(failures).toEqual([]);
  });
});
