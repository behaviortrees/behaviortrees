import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script, no types
import { isSkippedPath, parsePage, toRow } from './ingest-vercel-requests.mjs';

const record = {
  timestamp: '2026-11-13T14:11:03.181Z',
  projectId: 'prj_1',
  requestId: 'wg6tf-1794579063181-7ee40426fa8f',
  deploymentId: 'dpl_1',
  environment: 'production',
  requestHostname: 'www.behaviortrees.com',
  requestPath: '/mcp',
  requestMethod: 'POST',
  httpStatus: 200,
  route: '/api/mcp',
  pathType: 'streaming_func',
  cacheResult: 'MISS',
  edgeNetworkRegion: 'cle1',
  service: '/mcp',
  clientIpCountry: 'US',
  clientUserAgent: 'curl/8.7.1',
  wafAction: 'allow',
};

describe('isSkippedPath', () => {
  it.each([
    '/assets/index-a1b2c3.js',
    '/assets/index-a1b2c3.css',
    '/_astro/page.Cb75_YAQ.css',
    '/fonts/inter.woff2',
    '/imgs/logo.svg',
    '/favicon.ico',
    '/og-image.png',
    '/ingest/e/',
    '/ingest/static/1.447.3/surveys.js',
  ])('skips %s', (path) => {
    expect(isSkippedPath(path)).toBe(true);
  });

  it.each([
    '/',
    '/mcp',
    '/editor',
    '/api/projects',
    '/learn/what-is-a-behavior-tree/',
    '/learn/what-is-a-behavior-tree.md',
    '/learn/guides.json',
    '/robots.txt',
    '/llms.txt',
    '/sitemap-index.xml',
    '/.well-known/glama.json',
  ])('keeps %s', (path) => {
    expect(isSkippedPath(path)).toBe(false);
  });
});

describe('toRow', () => {
  it('maps a request record to the table columns', () => {
    expect(toRow(record)).toEqual([
      'wg6tf-1794579063181-7ee40426fa8f',
      '2026-11-13T14:11:03.181Z',
      'POST',
      'www.behaviortrees.com',
      '/mcp',
      200,
      '/api/mcp',
      'MISS',
      'cle1',
      'US',
      'curl/8.7.1',
      'allow',
      'dpl_1',
    ]);
  });

  it('stores missing optional fields as null', () => {
    const row = toRow({ ...record, route: undefined, cacheResult: undefined, clientIpCountry: undefined, clientUserAgent: '' });
    expect([row[6], row[7], row[9], row[10]]).toEqual([null, null, null, null]);
  });
});

describe('parsePage', () => {
  const line = (value: unknown) => JSON.stringify(value);

  it('collects request records and the next-page cursor', () => {
    const output = [
      line({ type: 'request', data: record }),
      line({ type: 'request', data: { ...record, requestId: 'b' } }),
      line({ type: 'summary', recordsReturned: 2, pagination: { hasMore: true, next: 'cursor-2' } }),
      '',
    ].join('\n');
    const page = parsePage(output);
    expect(page.records.map((r: { requestId: string }) => r.requestId)).toEqual([record.requestId, 'b']);
    expect(page.next).toBe('cursor-2');
  });

  it('stops when there are no more pages', () => {
    expect(parsePage(line({ type: 'summary', pagination: { hasMore: false, next: null } })).next).toBeNull();
  });

  it.each([
    ['empty output', ''],
    ['records without a summary', line({ type: 'request', data: record })],
  ])('throws on %s, so a failed CLI run never reads as no requests', (_case, output) => {
    expect(() => parsePage(output)).toThrow(/no summary line/);
  });

  it('throws on an error line, such as an expired token or a too-old window', () => {
    const error = line({
      status: 'error',
      reason: 'plan_upgrade_required',
      message: 'CDN request logs require Observability Plus',
    });
    expect(() => parsePage(error)).toThrow(/vercel logs failed: CDN request logs require Observability Plus/);
  });
});
