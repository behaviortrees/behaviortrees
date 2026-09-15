import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { CLOUD_ENABLED } from '../../lib/auth';
import {
  AdminDashboardResponse,
  ApiError,
  CommercialInterestsSection,
  PostHogSection,
  ProjectsSection,
  SectionError,
  TrafficSection,
  fetchAdminDashboard,
} from '../../lib/api-client';
import { Button } from '../../components/ui/button';

function isSectionError(section: object): section is SectionError {
  return 'error' in section;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="card">
    <div className="text-2xl font-medium">{value}</div>
    <div className="text-sm text-muted mt-1">{label}</div>
  </div>
);

const SectionErrorBox: React.FC<{ source: string; error: string }> = ({ source, error }) => (
  <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
    Failed to load {source}: {error}
  </div>
);

// Simple CSS bar list — no chart dependency
const BarList: React.FC<{ points: { label: string; value: number }[] }> = ({ points }) => {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="flex items-end gap-[2px] h-24">
      {points.map((point) => (
        <div
          key={point.label}
          className="flex-1 rounded-t-sm bg-accent/60 hover:bg-accent transition-colors min-h-[2px]"
          style={{ height: `${Math.max((point.value / max) * 100, 2)}%` }}
          title={`${point.label}: ${formatNumber(point.value)}`}
        />
      ))}
    </div>
  );
};

const RankedTable: React.FC<{
  title: string;
  rows: { name: string; value: number }[];
}> = ({ title, rows }) => (
  <div className="flex-1 min-w-0">
    <h3 className="text-sm font-medium text-muted mb-2">{title}</h3>
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-t border-divider">
            <td className="py-1.5 pr-4 truncate max-w-0 w-full">{row.name}</td>
            <td className="py-1.5 text-right text-muted tabular-nums">
              {formatNumber(row.value)}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td className="py-1.5 text-faint">No data</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const TrafficCard: React.FC<{ data: TrafficSection | SectionError }> = ({ data }) => (
  <div className="card">
    <h2 className="text-xl font-medium mb-4">Traffic (PostHog pageviews, last 30 days)</h2>
    {isSectionError(data) ? (
      <SectionErrorBox source="traffic" error={data.error} />
    ) : (
      <div className="space-y-6">
        <BarList
          points={data.timeseries.map((day) => ({ label: day.date, value: day.visitors }))}
        />
        <div className="flex gap-6 text-sm text-faint">
          <span>Bounce rate: {Math.round(data.range30d.bounceRate)}%</span>
          <span>Avg visit: {formatDuration(data.range30d.visitDuration)}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-8">
          <RankedTable
            title="Top pages"
            rows={data.topPages.map((p) => ({ name: p.page, value: p.visitors }))}
          />
          <RankedTable
            title="Top sources"
            rows={data.topSources.map((s) => ({ name: s.source, value: s.visitors }))}
          />
        </div>
      </div>
    )}
  </div>
);

const EventsCard: React.FC<{ data: PostHogSection | SectionError }> = ({ data }) => {
  if (isSectionError(data)) {
    return (
      <div className="card">
        <h2 className="text-xl font-medium mb-4">Product events (PostHog, last 30 days)</h2>
        <SectionErrorBox source="PostHog" error={data.error} />
      </div>
    );
  }

  const byEvent = new Map<string, { react: number; classic: number; other: number }>();
  for (const row of data.events) {
    const entry = byEvent.get(row.event) ?? { react: 0, classic: 0, other: 0 };
    if (row.editor === 'react') entry.react += row.count;
    else if (row.editor === 'classic') entry.classic += row.count;
    else entry.other += row.count;
    byEvent.set(row.event, entry);
  }
  const rows = [...byEvent.entries()]
    .map(([event, counts]) => ({ event, ...counts, total: counts.react + counts.classic + counts.other }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="card">
      <h2 className="text-xl font-medium mb-4">Product events (PostHog, last 30 days)</h2>
      <div className="space-y-6">
        <BarList points={data.daily.map((day) => ({ label: day.date, value: day.count }))} />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 font-medium">Event</th>
              <th className="pb-2 font-medium text-right">React</th>
              <th className="pb-2 font-medium text-right">Classic</th>
              <th className="pb-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.event} className="border-t border-divider">
                <td className="py-1.5 pr-4">{row.event}</td>
                <td className="py-1.5 text-right text-muted tabular-nums">
                  {formatNumber(row.react)}
                </td>
                <td className="py-1.5 text-right text-muted tabular-nums">
                  {formatNumber(row.classic)}
                </td>
                <td className="py-1.5 text-right tabular-nums">{formatNumber(row.total)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="py-1.5 text-faint" colSpan={4}>
                  No events in the last 30 days
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FunnelCard: React.FC<{ data: PostHogSection | SectionError }> = ({ data }) => (
  <div className="card">
    <h2 className="text-xl font-medium mb-4">Commercial funnel (unique users, 30 days)</h2>
    {isSectionError(data) ? (
      <SectionErrorBox source="PostHog funnel" error={data.error} />
    ) : (
      <RankedTable
        title="Funnel events"
        rows={data.funnel.map((row) => ({ name: row.event, value: row.users }))}
      />
    )}
  </div>
);

const RetentionCard: React.FC<{ data: PostHogSection | SectionError }> = ({ data }) => (
  <div className="card">
    <h2 className="text-xl font-medium mb-4">Activated-user retention</h2>
    {isSectionError(data) ? (
      <SectionErrorBox source="PostHog retention" error={data.error} />
    ) : (
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: 'D7 return (days 7–13)', value: data.retention.d7 },
          { label: 'D30 return (days 28–35)', value: data.retention.d30 },
        ].map((period) => (
          <div key={period.label} className="rounded-md border border-divider p-4">
            <div className="text-2xl font-medium">
              {period.value.eligible > 0 ? `${Math.round(period.value.rate)}%` : '—'}
            </div>
            <div className="mt-1 text-sm text-muted">{period.label}</div>
            <div className="mt-2 text-xs text-faint">
              {formatNumber(period.value.returned)} returned of{' '}
              {formatNumber(period.value.eligible)} eligible
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const CommercialInterestsCard: React.FC<{
  data: CommercialInterestsSection | SectionError;
}> = ({ data }) => {
  if (isSectionError(data)) {
    return (
      <div className="card">
        <h2 className="text-xl font-medium mb-4">Early-access requests</h2>
        <SectionErrorBox source="commercial interests" error={data.error} />
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-medium mb-4">Early-access requests</h2>
      <div className="grid gap-8 md:grid-cols-3">
        <RankedTable title="By plan" rows={data.byPlan} />
        <RankedTable title="By runtime" rows={data.byRuntime} />
        <RankedTable title="By team size" rows={data.byUsage} />
      </div>

      <h3 className="mt-8 mb-2 text-sm font-medium text-muted">Latest requests</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Plan</th>
              <th className="pb-2 font-medium">Runtime</th>
              <th className="pb-2 font-medium">Team</th>
              <th className="pb-2 font-medium">Obstacle</th>
              <th className="pb-2 font-medium text-right">Received</th>
            </tr>
          </thead>
          <tbody>
            {data.latest.map((row) => (
              <tr key={`${row.email}-${row.plan}`} className="border-t border-divider">
                <td className="py-1.5 pr-4">{row.email}</td>
                <td className="py-1.5 pr-4 text-muted">{row.plan}</td>
                <td className="py-1.5 pr-4 text-muted">{row.runtime}</td>
                <td className="py-1.5 pr-4 text-muted">{row.usageMode}</td>
                <td
                  className="max-w-[260px] truncate py-1.5 pr-4 text-muted"
                  title={row.obstacleDetail ?? row.obstacle}
                >
                  {row.obstacleDetail ?? row.obstacle}
                </td>
                <td className="py-1.5 text-right text-faint whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {data.latest.length === 0 && (
              <tr>
                <td className="py-1.5 text-faint" colSpan={6}>
                  No requests yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LatestProjectsCard: React.FC<{ data: ProjectsSection | SectionError }> = ({ data }) => (
  <div className="card">
    <h2 className="text-xl font-medium mb-4">Latest saved projects</h2>
    {isSectionError(data) ? (
      <SectionErrorBox source="projects" error={data.error} />
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="pb-2 font-medium">Project</th>
            <th className="pb-2 font-medium">User</th>
            <th className="pb-2 font-medium text-right">Updated</th>
            <th className="pb-2 font-medium text-right">Created</th>
          </tr>
        </thead>
        <tbody>
          {data.latest.map((row) => (
            <tr key={`${row.userId}-${row.id}`} className="border-t border-divider">
              <td className="py-1.5 pr-4 truncate max-w-0 w-2/5">{row.name}</td>
              <td className="py-1.5 pr-4 text-muted truncate">
                {row.userName ?? row.userEmail ?? `${row.userId.slice(0, 14)}…`}
              </td>
              <td className="py-1.5 text-right text-muted whitespace-nowrap">
                {new Date(row.updatedAt).toLocaleString()}
              </td>
              <td className="py-1.5 text-right text-faint whitespace-nowrap">
                {new Date(row.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {data.latest.length === 0 && (
            <tr>
              <td className="py-1.5 text-faint" colSpan={4}>
                No cloud projects yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    )}
  </div>
);

// Split so Clerk hooks only run when the provider is mounted (CLOUD_ENABLED)
const AdminDashboard: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (fresh: boolean) => {
      setLoading(true);
      setError(null);
      try {
        setData(await fetchAdminDashboard(fresh, () => getToken()));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setError('Sign in as the admin to view this page.');
        } else if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setError('Not authorized.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        }
      } finally {
        setLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setError('Sign in as the admin to view this page.');
      setLoading(false);
      return;
    }
    load(false);
  }, [isLoaded, isSignedIn, load]);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card text-center">
          <h2 className="text-xl font-medium mb-2">Admin</h2>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto">
        <p className="text-muted">Loading dashboard…</p>
      </div>
    );
  }

  if (!data) return null;

  const traffic = data.traffic;
  const projects = data.projects;
  const posthog = data.posthog;
  const interests = data.interests;
  const funnelValue = (event: string) =>
    isSectionError(posthog)
      ? null
      : posthog.funnel.find((row) => row.event === event)?.users ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-medium">Admin</h1>
          <p className="text-sm text-faint mt-1">
            Generated {new Date(data.generatedAt).toLocaleString()}
            {data.cached ? ' (cached)' : ''}
          </p>
        </div>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          disabled={loading}
          onClick={() => load(true)}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <StatTile
          label="Visitors (30d)"
          value={isSectionError(traffic) ? '—' : formatNumber(traffic.range30d.visitors)}
        />
        <StatTile
          label="Pageviews (30d)"
          value={isSectionError(traffic) ? '—' : formatNumber(traffic.range30d.pageviews)}
        />
        <StatTile
          label="Visitors today"
          value={isSectionError(traffic) ? '—' : formatNumber(traffic.today.visitors)}
        />
        <StatTile
          label="Active projects"
          value={isSectionError(projects) ? '—' : formatNumber(projects.totalActive)}
        />
        <StatTile
          label="Users with projects"
          value={isSectionError(projects) ? '—' : formatNumber(projects.totalUsers)}
        />
        <StatTile
          label="Activated users (30d)"
          value={
            funnelValue('activation_completed') === null
              ? '—'
              : formatNumber(funnelValue('activation_completed')!)
          }
        />
        <StatTile
          label="Access requests"
          value={isSectionError(interests) ? '—' : formatNumber(interests.total)}
        />
      </div>

      <TrafficCard data={data.traffic} />
      <EventsCard data={data.posthog} />
      <FunnelCard data={data.posthog} />
      <RetentionCard data={data.posthog} />
      <CommercialInterestsCard data={data.interests} />
      <LatestProjectsCard data={data.projects} />
    </div>
  );
};

const AdminPage: React.FC = () => {
  if (!CLOUD_ENABLED) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card text-center">
          <h2 className="text-xl font-medium mb-2">Admin</h2>
          <p className="text-muted">Cloud features are not configured.</p>
        </div>
      </div>
    );
  }
  return <AdminDashboard />;
};

export default AdminPage;
