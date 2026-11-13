import React from 'react';
import type {
  AgentKind,
  AgentTotal,
  CrawlersSection,
  FailingRequestsSection,
  McpSection,
  NpmSection,
  RequestLogCoverage,
  SectionError,
} from '../../lib/api-client';
import { formatNumber, isSectionError } from './admin-format';
import { BarList, SectionErrorBox, StatTile } from './admin-ui';

// Cards built from the Vercel request logs copied into Neon every 6 hours
// (scripts/ingest-vercel-requests.mjs), plus npm downloads

const KIND_LABELS: Record<AgentKind, string> = {
  assistant: 'AI app',
  ai_crawler: 'AI crawler',
  search: 'Search',
  social: 'Social',
  seo: 'SEO',
  bot: 'Bot / probe',
  library: 'SDK / script',
  browser: 'Browser',
  unknown: 'Unknown',
};

type Series<T> = { key: keyof T & string; label: string; className: string };

function StackedBars<T extends { date: string }>({ rows, series }: { rows: T[]; series: Series<T>[] }) {
  const value = (row: T, key: keyof T) => Number(row[key]) || 0;
  const totals = rows.map((row) => series.reduce((sum, s) => sum + value(row, s.key), 0));
  const max = Math.max(...totals, 1);
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-[2px] h-24">
        {rows.map((row, i) => (
          <div
            key={row.date}
            className="flex-1 flex flex-col-reverse overflow-hidden rounded-t-sm min-h-[2px] bg-divider"
            style={{ height: `${Math.max((totals[i] / max) * 100, 2)}%` }}
            title={`${row.date}: ${series.map((s) => `${s.label} ${formatNumber(value(row, s.key))}`).join(', ')}`}
          >
            {series.map((s) => (
              <div
                key={s.key}
                className={s.className}
                style={{ height: totals[i] ? `${(value(row, s.key) / totals[i]) * 100}%` : 0 }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`inline-block size-2.5 rounded-sm ${s.className}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const Coverage: React.FC<{ coverage: RequestLogCoverage }> = ({ coverage }) => (
  <p className="text-xs text-faint">
    {coverage.first
      ? `Request logs from ${new Date(coverage.first).toLocaleDateString()} to ${new Date(coverage.last!).toLocaleString()} (${formatNumber(coverage.rows)} requests)`
      : 'No request logs yet: the import runs every 6 hours.'}
  </p>
);

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

const AgentTable: React.FC<{ rows: AgentTotal[]; empty: string }> = ({ rows, empty }) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="text-left text-muted">
        <th className="pb-2 font-medium">Client</th>
        <th className="pb-2 pl-4 font-medium hidden sm:table-cell">Type</th>
        <th className="pb-2 pl-4 font-medium text-right">Requests</th>
        <th className="pb-2 pl-4 font-medium text-right">Errors</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.name} className="border-t border-divider">
          <td className="py-1.5 pr-4 truncate max-w-0 w-full" title={row.name}>
            {row.name}
          </td>
          <td className="py-1.5 pl-4 text-muted whitespace-nowrap hidden sm:table-cell">{KIND_LABELS[row.kind]}</td>
          <td className="py-1.5 pl-4 text-right tabular-nums">{formatNumber(row.requests)}</td>
          <td
            className={`py-1.5 pl-4 text-right tabular-nums whitespace-nowrap ${row.errors ? 'text-danger-soft' : 'text-faint'}`}
          >
            {row.errors ? `${formatNumber(row.errors)} (${percent(row.errors, row.requests)})` : '0'}
          </td>
        </tr>
      ))}
      {rows.length === 0 && (
        <tr>
          <td className="py-1.5 text-faint" colSpan={4}>
            {empty}
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

const McpBody: React.FC<{ data: McpSection }> = ({ data }) => {
  const apps = data.clients.filter((c) => c.kind === 'assistant');
  const appRequests = apps.reduce((sum, c) => sum + c.requests, 0);
  const appErrors = apps.reduce((sum, c) => sum + c.errors, 0);
  const allRequests = data.statuses.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="AI app requests (30d)" value={formatNumber(appRequests)} />
        <StatTile label="AI apps seen" value={formatNumber(apps.length)} />
        <StatTile label="AI app error rate" value={percent(appErrors, appRequests)} />
        <StatTile label="All /mcp requests (30d)" value={formatNumber(allRequests)} />
      </div>
      <StackedBars
        rows={data.daily}
        series={[
          { key: 'assistants', label: 'AI apps (Claude, ChatGPT, Cursor…)', className: 'bg-accent' },
          { key: 'libraries', label: 'SDKs and scripts', className: 'bg-cat-condition' },
          { key: 'bots', label: 'Directories, probes and bots', className: 'bg-faint/40' },
        ]}
      />
      <AgentTable rows={data.clients} empty="No /mcp requests yet" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {data.statuses.map((s) => (
          <span key={s.status} className={s.status >= 400 ? 'text-danger-soft' : undefined}>
            {s.status}: {formatNumber(s.count)}
          </span>
        ))}
      </div>
      <Coverage coverage={data.coverage} />
    </div>
  );
};

const NpmBody: React.FC<{ data: NpmSection }> = ({ data }) => (
  <div className="space-y-3">
    <div className="flex gap-6 text-sm">
      <span>
        <span className="font-medium">{formatNumber(data.total30d)}</span>{' '}
        <span className="text-muted">downloads in 30 days</span>
      </span>
      <span>
        <span className="font-medium">{formatNumber(data.last7d)}</span> <span className="text-muted">in the last 7</span>
      </span>
    </div>
    <BarList points={data.daily.map((day) => ({ label: day.date, value: day.downloads }))} />
    <p className="text-xs text-faint">npm counts every install, including mirrors and CI, so expect a baseline.</p>
  </div>
);

export const CliMcpCard: React.FC<{ mcp: McpSection | SectionError; npm: NpmSection | SectionError }> = ({
  mcp,
  npm,
}) => (
  <div className="card space-y-8">
    <div>
      <h2 className="text-xl font-medium mb-4">MCP server (/mcp, last 30 days)</h2>
      {isSectionError(mcp) ? <SectionErrorBox source="MCP usage" error={mcp.error} /> : <McpBody data={mcp} />}
    </div>
    <div>
      <h3 className="text-lg font-medium mb-3">
        npm package{!isSectionError(npm) && <span className="text-muted font-normal"> ({npm.package})</span>}
      </h3>
      {isSectionError(npm) ? <SectionErrorBox source="npm downloads" error={npm.error} /> : <NpmBody data={npm} />}
    </div>
  </div>
);

export const CrawlersCard: React.FC<{ data: CrawlersSection | SectionError }> = ({ data }) => (
  <div className="card">
    <h2 className="text-xl font-medium mb-4">Crawlers and AI agents (pages, last 30 days)</h2>
    {isSectionError(data) ? (
      <SectionErrorBox source="crawler stats" error={data.error} />
    ) : (
      <div className="space-y-6">
        <StackedBars
          rows={data.daily}
          series={[
            { key: 'browsers', label: 'Browsers', className: 'bg-accent' },
            { key: 'search', label: 'Search engines', className: 'bg-cat-composite' },
            { key: 'ai', label: 'AI crawlers and agents', className: 'bg-cat-action' },
            { key: 'other', label: 'Other bots and scripts', className: 'bg-faint/40' },
          ]}
        />
        <p className="text-sm text-muted">
          {formatNumber(data.browsers)} browser requests; everything else by client:
        </p>
        <AgentTable rows={data.agents} empty="No crawler requests yet" />
        <Coverage coverage={data.coverage} />
      </div>
    )}
  </div>
);

export const FailingRequestsCard: React.FC<{ data: FailingRequestsSection | SectionError }> = ({ data }) => (
  <div className="card">
    <h2 className="text-xl font-medium mb-4">Failing requests (HTTP 4xx and 5xx)</h2>
    {isSectionError(data) ? (
      <SectionErrorBox source="failing requests" error={data.error} />
    ) : (
      <div className="space-y-6">
        <StackedBars
          rows={data.daily}
          series={[
            { key: 'clientErrors', label: '4xx', className: 'bg-warning' },
            { key: 'serverErrors', label: '5xx', className: 'bg-danger' },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 pl-4 font-medium">Path (last 7 days)</th>
                <th className="pb-2 pl-4 font-medium text-right">Requests</th>
                <th className="pb-2 pl-4 font-medium text-right">Clients</th>
                <th className="pb-2 pl-4 font-medium text-right">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((row) => (
                <tr key={`${row.status}-${row.path}`} className="border-t border-divider">
                  <td className={`py-1.5 tabular-nums ${row.status >= 500 ? 'text-danger-soft' : 'text-muted'}`}>
                    {row.status}
                  </td>
                  <td className="py-1.5 pl-4 truncate max-w-0 w-full" title={row.path}>
                    {row.path}
                  </td>
                  <td className="py-1.5 pl-4 text-right tabular-nums">{formatNumber(row.count)}</td>
                  <td className="py-1.5 pl-4 text-right text-muted tabular-nums">{formatNumber(row.agents)}</td>
                  <td className="py-1.5 pl-4 text-right text-faint whitespace-nowrap">
                    {new Date(row.lastSeen).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.top.length === 0 && (
                <tr>
                  <td className="py-1.5 text-faint" colSpan={5}>
                    No failing requests in the last 7 days
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Coverage coverage={data.coverage} />
      </div>
    )}
  </div>
);
