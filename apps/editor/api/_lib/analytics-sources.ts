// Server-side fetchers for the PostHog Query API (HogQL).
// Used only by the admin dashboard endpoint.

export type TrafficStats = {
  range30d: {
    visitors: number;
    pageviews: number;
    visitDuration: number;
    bounceRate: number;
  };
  today: { visitors: number; pageviews: number };
  timeseries: { date: string; visitors: number; pageviews: number }[];
  topPages: { page: string; visitors: number }[];
  topSources: { source: string; visitors: number }[];
};

export type PostHogStats = {
  events: { event: string; editor: string; count: number }[];
  daily: { date: string; count: number }[];
  funnel: { event: string; users: number }[];
  retention: {
    d7: { eligible: number; returned: number; rate: number };
    d30: { eligible: number; returned: number; rate: number };
  };
};

// BT.CPP shipped as a demand bet: how often its import/export get used
// against behavior3 JSON, who tries it, and why imports fail.
export type BtcppStats = {
  weekly: { week: string; event: string; format: string; count: number }[];
  failures: { format: string; reason: string; count: number }[];
  users30d: { btcpp: number; anyFormat: number };
};

// Exceptions from posthog-js error tracking, grouped by type and message
export type ErrorStats = {
  total30d: number;
  users30d: number;
  daily: { date: string; count: number }[];
  // lastSeen is epoch milliseconds
  top: { type: string; message: string; count: number; users: number; lastSeen: number }[];
  url: string;
};

const TRACKED_EVENTS = [
  'example_loaded',
  'tree_created',
  'project_created',
  'project_saved',
  'import',
  'import_failed',
  'export',
  'custom_node_created',
  'app_session_started',
  'editor_session_started',
  'user_signed_in',
  'cloud_sync_started',
  'cloud_sync_succeeded',
  'cloud_sync_failed',
  'project_became_substantial',
  'activation_completed',
  'pricing_viewed',
  'pricing_cta_clicked',
  'commercial_interest_submitted',
  'commercial_interest_failed',
];

async function posthogQuery(query: string): Promise<unknown[][]> {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) throw new Error('PostHog is not configured');

  const response = await fetch(
    `https://us.posthog.com/api/projects/${projectId}/query/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    }
  );
  if (!response.ok) {
    throw new Error(`PostHog query failed (${response.status})`);
  }
  const json = (await response.json()) as { results: unknown[][] };
  return json.results;
}

// Web traffic from PostHog's $pageview events and its sessions table, which
// replaces the Plausible stats the dashboard used to show.
export async function fetchTrafficStats(): Promise<TrafficStats> {
  const [aggregate, sessions, today, timeseries, pages, sources] = await Promise.all([
    posthogQuery(
      `select count(distinct person_id) as visitors, count() as pageviews
       from events
       where event = '$pageview' and timestamp >= now() - interval 30 day`
    ),
    posthogQuery(
      `select count() as sessions,
              avg($session_duration) as avg_duration,
              countIf($is_bounce) as bounces
       from sessions
       where $start_timestamp >= now() - interval 30 day and $pageview_count > 0`
    ),
    posthogQuery(
      `select count(distinct person_id) as visitors, count() as pageviews
       from events
       where event = '$pageview' and timestamp >= toStartOfDay(now())`
    ),
    posthogQuery(
      `select toString(toDate(timestamp)) as day,
              count(distinct person_id) as visitors,
              count() as pageviews
       from events
       where event = '$pageview' and timestamp >= now() - interval 30 day
       group by day
       order by day asc`
    ),
    posthogQuery(
      `select coalesce(toString(properties.$pathname), '/') as page,
              count(distinct person_id) as visitors
       from events
       where event = '$pageview' and timestamp >= now() - interval 30 day
       group by page
       order by visitors desc
       limit 8`
    ),
    posthogQuery(
      `select coalesce($entry_referring_domain, '$direct') as source,
              count() as visits
       from sessions
       where $start_timestamp >= now() - interval 30 day and $pageview_count > 0
       group by source
       order by visits desc
       limit 8`
    ),
  ]);

  const sessionCount = Number(sessions[0]?.[0] ?? 0);
  const bounces = Number(sessions[0]?.[2] ?? 0);

  return {
    range30d: {
      visitors: Number(aggregate[0]?.[0] ?? 0),
      pageviews: Number(aggregate[0]?.[1] ?? 0),
      visitDuration: Number(sessions[0]?.[1] ?? 0),
      bounceRate: sessionCount > 0 ? (bounces / sessionCount) * 100 : 0,
    },
    today: {
      visitors: Number(today[0]?.[0] ?? 0),
      pageviews: Number(today[0]?.[1] ?? 0),
    },
    timeseries: timeseries.map((row) => ({
      date: String(row[0]),
      visitors: Number(row[1]),
      pageviews: Number(row[2]),
    })),
    topPages: pages.map((row) => ({
      page: String(row[0]),
      visitors: Number(row[1]),
    })),
    topSources: sources.map((row) => ({
      source: String(row[0]),
      visitors: Number(row[1]),
    })),
  };
}

export async function fetchPostHogStats(): Promise<PostHogStats> {
  const eventList = TRACKED_EVENTS.map((name) => `'${name}'`).join(',');
  const [events, daily, funnel, retentionRows] = await Promise.all([
    posthogQuery(
      `select event, coalesce(toString(properties.editor), 'unknown') as editor, count() as c
       from events
       where timestamp >= now() - interval 30 day and event in (${eventList})
       group by event, editor
       order by c desc`
    ),
    posthogQuery(
      `select toString(toDate(timestamp)) as day, count() as c
       from events
       where timestamp >= now() - interval 30 day and event in (${eventList})
       group by day
       order by day asc`
    ),
    posthogQuery(
      `select event, count(distinct distinct_id) as users
       from events
       where timestamp >= now() - interval 30 day
         and event in ('app_session_started','activation_completed','pricing_viewed',
                       'pricing_cta_clicked','commercial_interest_submitted',
                       'user_signed_in','cloud_sync_succeeded')
       group by event
       order by users desc`
    ),
    posthogQuery(
      `select distinct_id, event, toString(toDate(timestamp)) as day
       from events
       where timestamp >= now() - interval 70 day
         and event in ('activation_completed','app_session_started')
       group by distinct_id, event, day
       order by day asc
       limit 50000`
    ),
  ]);

  const users = new Map<string, { activatedAt: number | null; sessions: number[] }>();
  for (const row of retentionRows) {
    const id = String(row[0]);
    const event = String(row[1]);
    const day = Date.parse(`${String(row[2])}T00:00:00Z`);
    if (Number.isNaN(day)) continue;
    const user = users.get(id) ?? { activatedAt: null, sessions: [] };
    if (event === 'activation_completed') {
      user.activatedAt =
        user.activatedAt === null ? day : Math.min(user.activatedAt, day);
    } else {
      user.sessions.push(day);
    }
    users.set(id, user);
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const retention = {
    d7: { eligible: 0, returned: 0, rate: 0 },
    d30: { eligible: 0, returned: 0, rate: 0 },
  };

  for (const user of users.values()) {
    if (user.activatedAt === null) continue;
    const age = Math.floor((today - user.activatedAt) / dayMs);
    const returnedIn = (from: number, through: number) =>
      user.sessions.some((session) => {
        const offset = Math.floor((session - user.activatedAt!) / dayMs);
        return offset >= from && offset <= through;
      });

    if (age >= 13) {
      retention.d7.eligible += 1;
      if (returnedIn(7, 13)) retention.d7.returned += 1;
    }
    if (age >= 35) {
      retention.d30.eligible += 1;
      if (returnedIn(28, 35)) retention.d30.returned += 1;
    }
  }

  retention.d7.rate =
    retention.d7.eligible > 0
      ? (retention.d7.returned / retention.d7.eligible) * 100
      : 0;
  retention.d30.rate =
    retention.d30.eligible > 0
      ? (retention.d30.returned / retention.d30.eligible) * 100
      : 0;

  return {
    events: events.map((row) => ({
      event: String(row[0]),
      editor: String(row[1]),
      count: Number(row[2]),
    })),
    daily: daily.map((row) => ({
      date: String(row[0]),
      count: Number(row[1]),
    })),
    funnel: funnel.map((row) => ({
      event: String(row[0]),
      users: Number(row[1]),
    })),
    retention,
  };
}

export async function fetchBtcppStats(): Promise<BtcppStats> {
  const [weekly, failures, users] = await Promise.all([
    posthogQuery(
      `select toString(toStartOfWeek(timestamp, 1)) as week,
              event,
              coalesce(toString(properties.format), 'unknown') as format,
              count() as c
       from events
       where timestamp >= toStartOfWeek(now() - interval 7 week, 1)
         and event in ('import', 'export')
       group by week, event, format
       order by week asc`
    ),
    posthogQuery(
      `select coalesce(toString(properties.format), 'unknown') as format,
              coalesce(toString(properties.reason), 'unknown') as reason,
              count() as c
       from events
       where event = 'import_failed' and timestamp >= now() - interval 30 day
       group by format, reason
       order by c desc`
    ),
    posthogQuery(
      `select count(distinct if(toString(properties.format) like 'btcpp%', person_id, null)) as btcpp,
              count(distinct person_id) as any_format
       from events
       where event in ('import', 'export', 'import_failed')
         and timestamp >= now() - interval 30 day`
    ),
  ]);

  return {
    weekly: weekly.map((row) => ({
      week: String(row[0]),
      event: String(row[1]),
      format: String(row[2]),
      count: Number(row[3]),
    })),
    failures: failures.map((row) => ({
      format: String(row[0]),
      reason: String(row[1]),
      count: Number(row[2]),
    })),
    users30d: {
      btcpp: Number(users[0]?.[0] ?? 0),
      anyFormat: Number(users[0]?.[1] ?? 0),
    },
  };
}

export async function fetchErrorStats(): Promise<ErrorStats> {
  // $exception_list is a JSON array, outermost exception first
  const [totals, daily, top] = await Promise.all([
    posthogQuery(
      `select count() as c, count(distinct person_id) as users
       from events
       where event = '$exception' and timestamp >= now() - interval 30 day`
    ),
    posthogQuery(
      `select toString(toDate(timestamp)) as day, count() as c
       from events
       where event = '$exception' and timestamp >= now() - interval 30 day
       group by day
       order by day asc`
    ),
    posthogQuery(
      `select JSONExtractString(properties.$exception_list, 1, 'type') as type,
              JSONExtractString(properties.$exception_list, 1, 'value') as message,
              count() as c,
              count(distinct person_id) as users,
              toUnixTimestamp(max(timestamp)) as last_seen
       from events
       where event = '$exception' and timestamp >= now() - interval 30 day
       group by type, message
       order by c desc
       limit 5`
    ),
  ]);

  return {
    total30d: Number(totals[0]?.[0] ?? 0),
    users30d: Number(totals[0]?.[1] ?? 0),
    daily: daily.map((row) => ({
      date: String(row[0]),
      count: Number(row[1]),
    })),
    top: top.map((row) => ({
      type: String(row[0]) || 'Error',
      message: String(row[1]),
      count: Number(row[2]),
      users: Number(row[3]),
      lastSeen: Number(row[4]) * 1000,
    })),
    // posthogQuery already threw if the project id were missing
    url: `https://us.posthog.com/project/${process.env.POSTHOG_PROJECT_ID}/error_tracking`,
  };
}
