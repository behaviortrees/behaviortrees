import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchErrorStats } from './analytics-sources.js';

const ISSUE_A = '01a1e15c-3936-7bc3-9a52-9a1863838a0c';
const ISSUE_B = '01a1ca30-9255-76e2-bef9-cf6471ee4b06';
const LAST_SEEN = 1_763_250_000;

type Responder = (query: string) => unknown[][] | 'forbidden';

function stubPostHog(respond: Responder) {
  const queries: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const query: string = JSON.parse(init.body).query.query;
      queries.push(query);
      const results = respond(query);
      if (results === 'forbidden') return new Response('{}', { status: 403 });
      return new Response(JSON.stringify({ results }), { status: 200 });
    })
  );
  return queries;
}

const eventQueryResults = (query: string, top: unknown[][]) => {
  if (query.includes('group by day')) return [['2026-11-15', 3]];
  if (query.includes('limit 5')) return top;
  return [[3, 2]];
};

beforeEach(() => {
  vi.stubEnv('POSTHOG_API_KEY', 'phx_test');
  vi.stubEnv('POSTHOG_PROJECT_ID', '522911');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('fetchErrorStats', () => {
  it('counts only exceptions in active issues and names the top ones by issue', async () => {
    const queries = stubPostHog((query) => {
      if (query.includes('from system.error_tracking_issues') && !query.includes('from events')) {
        if (query.includes('count()')) return [[8]];
        return [
          [ISSUE_A, 'TypeError', "Cannot read properties of undefined (reading 'target')"],
          [ISSUE_B, 'ChunkLoadError', null],
        ];
      }
      return eventQueryResults(query, [
        [ISSUE_A, 2, 1, LAST_SEEN],
        [ISSUE_B, 1, 1, LAST_SEEN],
      ]);
    });

    const stats = await fetchErrorStats();

    const eventQueries = queries.filter((q) => q.includes('from events'));
    expect(eventQueries).toHaveLength(3);
    for (const query of eventQueries) expect(query).toContain("where status = 'active'");
    expect(stats.activeOnly).toBe(true);
    expect(stats.total30d).toBe(3);
    expect(stats.top).toEqual([
      {
        type: 'TypeError',
        message: "Cannot read properties of undefined (reading 'target')",
        count: 2,
        users: 1,
        lastSeen: LAST_SEEN * 1000,
        url: `https://us.posthog.com/project/522911/error-tracking/${ISSUE_A}`,
      },
      {
        type: 'ChunkLoadError',
        message: '',
        count: 1,
        users: 1,
        lastSeen: LAST_SEEN * 1000,
        url: `https://us.posthog.com/project/522911/error-tracking/${ISSUE_B}`,
      },
    ]);
  });

  it('skips the issue lookup when no active issue had exceptions', async () => {
    const queries = stubPostHog((query) => {
      if (query.includes('from system.error_tracking_issues') && !query.includes('from events')) return [[0]];
      return eventQueryResults(query, []);
    });

    const stats = await fetchErrorStats();

    expect(stats.top).toEqual([]);
    expect(queries.filter((q) => q.includes('select toString(id), name'))).toHaveLength(0);
  });

  it('counts every exception by type and message when the key cannot read issues', async () => {
    const queries = stubPostHog((query) => {
      if (query.includes('system.error_tracking_issues')) return 'forbidden';
      return eventQueryResults(query, [['TypeError', 'boom', 4, 2, LAST_SEEN]]);
    });

    const stats = await fetchErrorStats();

    expect(queries.filter((q) => q.includes('from events')).every((q) => !q.includes('status'))).toBe(true);
    expect(stats.activeOnly).toBe(false);
    expect(stats.top).toEqual([
      { type: 'TypeError', message: 'boom', count: 4, users: 2, lastSeen: LAST_SEEN * 1000 },
    ]);
  });
});
