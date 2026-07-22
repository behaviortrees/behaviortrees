import { neon } from '@neondatabase/serverless';

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
