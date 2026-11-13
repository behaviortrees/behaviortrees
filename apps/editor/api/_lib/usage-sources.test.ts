import { describe, expect, it, vi } from 'vitest';
import { lastDays, summarizeCrawlers, summarizeMcp } from './usage-sources.js';

vi.mock('./db.js', () => ({}));

const days = ['2026-11-12', '2026-11-13'];
const row = (day: string, userAgent: string, status: number, count: number) => ({ day, userAgent, status, count });

describe('lastDays', () => {
  it('lists the last n UTC dates, oldest first', () => {
    expect(lastDays(3, new Date('2026-11-13T02:00:00Z'))).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
  });
});

describe('summarizeMcp', () => {
  const summary = summarizeMcp(
    [
      row('2026-11-12', 'Claude-User', 200, 10),
      row('2026-11-12', 'Claude-User', 400, 5),
      row('2026-11-13', 'claude-code/2.1.321 (claude-desktop, agent-sdk/0.3.321)', 200, 4),
      row('2026-11-13', 'mcpbeat/0.1 (+https://mcpbeat.com/bot/; liveness check)', 200, 7),
      row('2026-11-13', 'python-httpx/0.28.1', 200, 2),
      row('2026-11-13', '', 202, 1),
      row('2026-10-01', 'Claude-User', 200, 99),
    ],
    days
  );

  it('splits each day into AI apps, SDKs and scripts, and bots', () => {
    expect(summary.daily).toEqual([
      { date: '2026-11-12', assistants: 15, libraries: 0, bots: 0 },
      { date: '2026-11-13', assistants: 4, libraries: 3, bots: 7 },
    ]);
  });

  it('totals requests and errors per client', () => {
    expect(summary.clients[0]).toEqual({ name: 'Claude (apps)', kind: 'assistant', requests: 114, errors: 5 });
    expect(summary.clients.map((c) => c.name)).toContain('mcpbeat');
  });

  it('counts statuses', () => {
    expect(summary.statuses).toEqual([
      { status: 200, count: 122 },
      { status: 400, count: 5 },
      { status: 202, count: 1 },
    ]);
  });
});

describe('summarizeCrawlers', () => {
  const summary = summarizeCrawlers(
    [
      row('2026-11-13', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', 200, 20),
      row('2026-11-13', 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 200, 6),
      row('2026-11-13', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)', 200, 3),
      row('2026-11-13', 'Claude-User', 200, 2),
      row('2026-11-13', 'AgentWebMap-research/0.1', 404, 1),
    ],
    days
  );

  it('splits each day into browsers, search, AI and other', () => {
    expect(summary.daily[1]).toEqual({ date: '2026-11-13', browsers: 20, search: 6, ai: 5, other: 1 });
  });

  it('ranks the non-browser agents, keeping browsers as a total', () => {
    expect(summary.browsers).toBe(20);
    expect(summary.agents.map((a) => a.name)).toEqual(['YandexBot', 'GPTBot', 'Claude (apps)', 'AgentWebMap-research']);
    expect(summary.agents.at(-1)).toMatchObject({ errors: 1 });
  });
});
