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

-- Pre-billing demand validation. Free-form details stay here rather than in
-- product analytics so email addresses and customer context are not copied
-- into PostHog event properties.
create table if not exists commercial_interests (
  id                bigserial primary key,
  email_normalized  text not null,
  plan              text not null check (plan in ('pro', 'team', 'integration')),
  runtime           text not null,
  usage_mode        text not null,
  obstacle          text not null,
  obstacle_detail   text,
  source_path       text not null,
  contact_consent   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (email_normalized, plan)
);

create index if not exists commercial_interests_created_idx
  on commercial_interests (created_at desc);

-- Vercel CDN request logs. Vercel keeps them a day, so
-- .github/workflows/vercel-logs.yml copies them here every 6 hours
-- (scripts/ingest-vercel-requests.ts). Static assets and the PostHog proxy
-- are skipped. Vercel's export has the visitor's country, never the IP.
create table if not exists vercel_requests (
  request_id     text primary key,
  ts             timestamptz not null,
  method         text not null,
  host           text not null,
  path           text not null,
  status         integer not null,
  route          text,
  cache_result   text,
  region         text,
  country        text,
  user_agent     text,
  waf_action     text,
  deployment_id  text
);

create index if not exists vercel_requests_ts_idx
  on vercel_requests (ts desc);

create index if not exists vercel_requests_path_ts_idx
  on vercel_requests (path, ts desc);
