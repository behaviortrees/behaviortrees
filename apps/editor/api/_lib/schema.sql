-- Cloud project storage. Apply once via the Neon console or `psql $DATABASE_URL`.
--
-- Rows are keyed by (user_id, id): project ids are client-generated and only
-- unique per user. Deletes are soft (tombstones) so they propagate to other
-- devices; updated_at also advances on delete, making last-write-wins uniform.

create table if not exists projects (
  id          text not null,                      -- client-generated project id
  user_id     text not null,                      -- Clerk user id
  name        text not null,
  data        jsonb,                              -- full behavior3 project JSON (null once deleted)
  updated_at  timestamptz not null,               -- from payload updatedAt (LWW key)
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,                        -- soft-delete tombstone
  primary key (user_id, id)
);

create index if not exists projects_user_idx
  on projects (user_id) where deleted_at is null;
