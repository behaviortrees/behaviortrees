// Admin dashboard sections built from the Vercel request logs in Neon
// (MCP usage, crawlers, failing requests) and npm's public download counts.
import {
  getAgentDailyCounts,
  getFailingRequests,
  getRequestLogCoverage,
  type AgentDayRow,
  type FailingRequestRow,
  type RequestLogCoverage,
} from './db.js';
import { classifyAgent, type AgentKind } from './user-agents.js';

const NPM_PACKAGE = 'behaviortrees';

type AgentTotal = { name: string; kind: AgentKind; requests: number; errors: number };

export type McpStats = {
  coverage: RequestLogCoverage;
  // AI apps vs SDKs/scripts vs directory bots and probes, per day
  daily: { date: string; assistants: number; libraries: number; bots: number }[];
  clients: AgentTotal[];
  statuses: { status: number; count: number }[];
};

export type CrawlerStats = {
  coverage: RequestLogCoverage;
  daily: { date: string; browsers: number; search: number; ai: number; other: number }[];
  agents: AgentTotal[];
  browsers: number;
};

export type FailingRequestStats = {
  coverage: RequestLogCoverage;
  top: FailingRequestRow[];
  daily: { date: string; clientErrors: number; serverErrors: number }[];
};

export type NpmStats = {
  package: string;
  total30d: number;
  last7d: number;
  daily: { date: string; downloads: number }[];
};

// The last n UTC dates, oldest first, so charts show quiet days as zero
export function lastDays(n: number, now = new Date()): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: n }, (_, i) => new Date(today - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

function totalsByAgent(rows: AgentDayRow[], keep: (kind: AgentKind) => boolean): AgentTotal[] {
  const totals = new Map<string, AgentTotal>();
  for (const row of rows) {
    const { name, kind } = classifyAgent(row.userAgent);
    if (!keep(kind)) continue;
    const total = totals.get(name) ?? { name, kind, requests: 0, errors: 0 };
    total.requests += row.count;
    if (row.status >= 400) total.errors += row.count;
    totals.set(name, total);
  }
  return [...totals.values()].sort((a, b) => b.requests - a.requests);
}

export function summarizeMcp(rows: AgentDayRow[], days: string[]): Omit<McpStats, 'coverage'> {
  const daily = new Map(days.map((date) => [date, { date, assistants: 0, libraries: 0, bots: 0 }]));
  const statuses = new Map<number, number>();
  for (const row of rows) {
    statuses.set(row.status, (statuses.get(row.status) ?? 0) + row.count);
    const day = daily.get(row.day);
    if (!day) continue;
    const { kind } = classifyAgent(row.userAgent);
    if (kind === 'assistant') day.assistants += row.count;
    else if (kind === 'library' || kind === 'unknown') day.libraries += row.count;
    else day.bots += row.count;
  }
  return {
    daily: [...daily.values()],
    clients: totalsByAgent(rows, () => true).slice(0, 30),
    statuses: [...statuses].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
  };
}

export function summarizeCrawlers(rows: AgentDayRow[], days: string[]): Omit<CrawlerStats, 'coverage'> {
  const daily = new Map(days.map((date) => [date, { date, browsers: 0, search: 0, ai: 0, other: 0 }]));
  let browsers = 0;
  for (const row of rows) {
    const { kind } = classifyAgent(row.userAgent);
    if (kind === 'browser') browsers += row.count;
    const day = daily.get(row.day);
    if (!day) continue;
    if (kind === 'browser') day.browsers += row.count;
    else if (kind === 'search') day.search += row.count;
    else if (kind === 'ai_crawler' || kind === 'assistant') day.ai += row.count;
    else day.other += row.count;
  }
  return {
    daily: [...daily.values()],
    agents: totalsByAgent(rows, (kind) => kind !== 'browser').slice(0, 30),
    browsers,
  };
}

export async function fetchMcpStats(): Promise<McpStats> {
  const [coverage, rows] = await Promise.all([getRequestLogCoverage(), getAgentDailyCounts('mcp')]);
  return { coverage, ...summarizeMcp(rows, lastDays(30)) };
}

export async function fetchCrawlerStats(): Promise<CrawlerStats> {
  const [coverage, rows] = await Promise.all([getRequestLogCoverage(), getAgentDailyCounts('pages')]);
  return { coverage, ...summarizeCrawlers(rows, lastDays(30)) };
}

export async function fetchFailingRequests(): Promise<FailingRequestStats> {
  const [coverage, failing] = await Promise.all([getRequestLogCoverage(), getFailingRequests()]);
  const byDay = new Map(failing.daily.map((row) => [row.day, row]));
  return {
    coverage,
    top: failing.top,
    daily: lastDays(30).map((date) => ({
      date,
      clientErrors: byDay.get(date)?.clientErrors ?? 0,
      serverErrors: byDay.get(date)?.serverErrors ?? 0,
    })),
  };
}

// npm counts every tarball fetch, mirrors and CI included, so a quiet day
// still shows a baseline
export async function fetchNpmStats(): Promise<NpmStats> {
  const response = await fetch(`https://api.npmjs.org/downloads/range/last-month/${NPM_PACKAGE}`);
  if (!response.ok) throw new Error(`npm downloads API failed (${response.status})`);
  const json = (await response.json()) as { downloads?: { day: string; downloads: number }[] };
  const daily = (json.downloads ?? []).map((row) => ({ date: row.day, downloads: row.downloads }));
  return {
    package: NPM_PACKAGE,
    total30d: daily.reduce((sum, row) => sum + row.downloads, 0),
    last7d: daily.slice(-7).reduce((sum, row) => sum + row.downloads, 0),
    daily,
  };
}
