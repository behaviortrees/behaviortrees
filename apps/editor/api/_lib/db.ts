import { neon } from '@neondatabase/serverless';
import type { ValidatedCommercialInterest } from './interest-validate.js';

// All SQL lives here so a later swap to a query builder stays localized.

export type ProjectMetaRow = {
  id: string;
  name: string;
  updated_at: string;
  deleted_at: string | null;
};

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  return neon(url);
}

export async function listProjects(userId: string): Promise<ProjectMetaRow[]> {
  const rows = await sql()`
    select id, name, updated_at, deleted_at
    from projects
    where user_id = ${userId}
  `;
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    updated_at: new Date(row.updated_at as string).toISOString(),
    deleted_at: row.deleted_at ? new Date(row.deleted_at as string).toISOString() : null,
  }));
}

export async function getProject(userId: string, id: string): Promise<unknown | null> {
  const rows = await sql()`
    select data
    from projects
    where user_id = ${userId} and id = ${id} and deleted_at is null
  `;
  return rows.length > 0 ? rows[0].data : null;
}

// Last-write-wins upsert: a payload older than the stored row is rejected so a
// stale tab can't clobber newer data. A newer payload also resurrects a
// soft-deleted row (edit beats delete).
export async function upsertProject(
  userId: string,
  id: string,
  name: string,
  data: unknown,
  updatedAt: string
): Promise<boolean> {
  const rows = await sql()`
    insert into projects (id, user_id, name, data, updated_at)
    values (${id}, ${userId}, ${name}, ${JSON.stringify(data)}::jsonb, ${updatedAt})
    on conflict (user_id, id) do update
      set name = excluded.name,
          data = excluded.data,
          updated_at = excluded.updated_at,
          deleted_at = null
      where projects.updated_at <= excluded.updated_at
    returning id
  `;
  return rows.length > 0;
}

export type AdminProjectRow = {
  id: string;
  user_id: string;
  name: string;
  updated_at: string;
  created_at: string;
};

export async function listLatestProjectsAllUsers(limit = 20): Promise<AdminProjectRow[]> {
  const rows = await sql()`
    select id, user_id, name, updated_at, created_at
    from projects
    where deleted_at is null
    order by updated_at desc
    limit ${limit}
  `;
  return rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    updated_at: new Date(row.updated_at as string).toISOString(),
    created_at: new Date(row.created_at as string).toISOString(),
  }));
}

export async function getProjectTotals(): Promise<{
  totalActive: number;
  totalUsers: number;
}> {
  const rows = await sql()`
    select count(*)::int as total_active,
           count(distinct user_id)::int as total_users
    from projects
    where deleted_at is null
  `;
  return {
    totalActive: rows[0].total_active as number,
    totalUsers: rows[0].total_users as number,
  };
}

export async function softDeleteProject(
  userId: string,
  id: string,
  deletedAt: string
): Promise<void> {
  await sql()`
    update projects
    set deleted_at = ${deletedAt},
        updated_at = ${deletedAt},
        data = null
    where user_id = ${userId} and id = ${id} and updated_at <= ${deletedAt}
  `;
}

export async function upsertCommercialInterest(
  interest: ValidatedCommercialInterest
): Promise<{ isNew: boolean }> {
  const email = interest.email.trim().toLowerCase();
  const rows = await sql()`
    insert into commercial_interests (
      email_normalized,
      plan,
      runtime,
      usage_mode,
      obstacle,
      obstacle_detail,
      source_path,
      contact_consent
    )
    values (
      ${email},
      ${interest.plan},
      ${interest.runtime},
      ${interest.usageMode},
      ${interest.obstacle},
      ${interest.obstacleDetail ?? null},
      ${interest.sourcePath},
      ${interest.contactConsent}
    )
    on conflict (email_normalized, plan) do update
      set runtime = excluded.runtime,
          usage_mode = excluded.usage_mode,
          obstacle = excluded.obstacle,
          obstacle_detail = excluded.obstacle_detail,
          source_path = excluded.source_path,
          contact_consent = excluded.contact_consent,
          updated_at = now()
    returning (xmax = 0) as inserted
  `;
  return { isNew: rows[0]?.inserted === true };
}

export type CommercialInterestStats = {
  total: number;
  byPlan: { name: string; value: number }[];
  byRuntime: { name: string; value: number }[];
  byUsage: { name: string; value: number }[];
  latest: {
    email: string;
    plan: string;
    runtime: string;
    usageMode: string;
    obstacle: string;
    obstacleDetail: string | null;
    createdAt: string;
  }[];
};

export async function getCommercialInterestStats(): Promise<CommercialInterestStats> {
  const [totalRows, planRows, runtimeRows, usageRows, latestRows] = await Promise.all([
    sql()`select count(*)::int as total from commercial_interests`,
    sql()`
      select plan as name, count(*)::int as value
      from commercial_interests group by plan order by value desc
    `,
    sql()`
      select runtime as name, count(*)::int as value
      from commercial_interests group by runtime order by value desc
    `,
    sql()`
      select usage_mode as name, count(*)::int as value
      from commercial_interests group by usage_mode order by value desc
    `,
    sql()`
      select email_normalized, plan, runtime, usage_mode, obstacle,
             obstacle_detail, created_at
      from commercial_interests
      order by created_at desc
      limit 20
    `,
  ]);

  const ranked = (rows: Record<string, unknown>[]) =>
    rows.map((row) => ({
      name: String(row.name),
      value: Number(row.value),
    }));

  return {
    total: Number(totalRows[0]?.total ?? 0),
    byPlan: ranked(planRows),
    byRuntime: ranked(runtimeRows),
    byUsage: ranked(usageRows),
    latest: latestRows.map((row) => ({
      email: String(row.email_normalized),
      plan: String(row.plan),
      runtime: String(row.runtime),
      usageMode: String(row.usage_mode),
      obstacle: String(row.obstacle),
      obstacleDetail:
        row.obstacle_detail === null ? null : String(row.obstacle_detail),
      createdAt: new Date(row.created_at as string).toISOString(),
    })),
  };
}

// --- Vercel request logs (copied in by scripts/ingest-vercel-requests.mjs) ---

export type RequestLogCoverage = { first: string | null; last: string | null; rows: number };

export async function getRequestLogCoverage(): Promise<RequestLogCoverage> {
  const [row] = await sql()`
    select min(ts) as first, max(ts) as last, count(*)::int as rows from vercel_requests
  `;
  return {
    first: row?.first ? new Date(row.first as string).toISOString() : null,
    last: row?.last ? new Date(row.last as string).toISOString() : null,
    rows: Number(row?.rows ?? 0),
  };
}

export type AgentDayRow = { day: string; userAgent: string; status: number; count: number };

// Requests per day, user agent and status over the last 30 days: either the
// MCP endpoint, or the site's pages (everything outside /api and /mcp)
export async function getAgentDailyCounts(target: 'mcp' | 'pages'): Promise<AgentDayRow[]> {
  const mcp = target === 'mcp';
  const rows = await sql()`
    select to_char(date_trunc('day', ts), 'YYYY-MM-DD') as day,
           coalesce(user_agent, '') as user_agent,
           status,
           count(*)::int as count
    from vercel_requests
    where ts >= now() - interval '30 days'
      and ((${mcp} and path = '/mcp') or (not ${mcp} and path <> '/mcp' and path not like '/api/%'))
    group by 1, 2, 3
  `;
  return rows.map((row) => ({
    day: String(row.day),
    userAgent: String(row.user_agent),
    status: Number(row.status),
    count: Number(row.count),
  }));
}

export type FailingRequestRow = {
  status: number;
  path: string;
  count: number;
  agents: number;
  lastSeen: string;
};

export async function getFailingRequests(): Promise<{
  top: FailingRequestRow[];
  daily: { day: string; clientErrors: number; serverErrors: number }[];
}> {
  const [top, daily] = await Promise.all([
    sql()`
      select status, path, count(*)::int as count,
             count(distinct coalesce(user_agent, ''))::int as agents, max(ts) as last_seen
      from vercel_requests
      where ts >= now() - interval '7 days' and status >= 400
      group by status, path
      order by count desc
      limit 25
    `,
    sql()`
      select to_char(date_trunc('day', ts), 'YYYY-MM-DD') as day,
             count(*) filter (where status between 400 and 499)::int as client_errors,
             count(*) filter (where status >= 500)::int as server_errors
      from vercel_requests
      where ts >= now() - interval '30 days' and status >= 400
      group by 1
      order by 1
    `,
  ]);
  return {
    top: top.map((row) => ({
      status: Number(row.status),
      path: String(row.path),
      count: Number(row.count),
      agents: Number(row.agents),
      lastSeen: new Date(row.last_seen as string).toISOString(),
    })),
    daily: daily.map((row) => ({
      day: String(row.day),
      clientErrors: Number(row.client_errors),
      serverErrors: Number(row.server_errors),
    })),
  };
}
