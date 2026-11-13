// Copies Vercel's CDN request logs into the vercel_requests table. Vercel
// keeps them a day without Observability Plus, so
// .github/workflows/vercel-logs.yml runs this every 6 hours over the last
// 23 hours; request IDs make the overlap free.
//
// Usage: VERCEL_TOKEN=… DATABASE_URL=… node scripts/ingest-vercel-requests.mjs
// Optional: VERCEL_SCOPE, VERCEL_PROJECT, INGEST_SINCE (default 23h)
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { neon } from '@neondatabase/serverless';

const SKIPPED_PREFIXES = ['/ingest/', '/assets/', '/_astro/', '/fonts/', '/imgs/'];
const SKIPPED_FILES = /\.(js|mjs|css|map|woff2?|ttf|otf|png|jpe?g|gif|webp|avif|svg|ico)$/i;
const BATCH = 1000;

const COLUMNS = [
  ['request_id', 'text'],
  ['ts', 'timestamptz'],
  ['method', 'text'],
  ['host', 'text'],
  ['path', 'text'],
  ['status', 'int'],
  ['route', 'text'],
  ['cache_result', 'text'],
  ['region', 'text'],
  ['country', 'text'],
  ['user_agent', 'text'],
  ['waf_action', 'text'],
  ['deployment_id', 'text'],
];

// Bundles, images, fonts and the PostHog proxy: volume that says nothing
// PostHog doesn't. robots.txt, llms.txt, sitemaps and the .md guides stay,
// since they are what crawlers and agents read.
export function isSkippedPath(path) {
  return SKIPPED_PREFIXES.some((prefix) => path.startsWith(prefix)) || SKIPPED_FILES.test(path);
}

export function toRow(record) {
  return [
    record.requestId,
    record.timestamp,
    record.requestMethod,
    record.requestHostname,
    record.requestPath,
    record.httpStatus,
    record.route ?? null,
    record.cacheResult ?? null,
    record.edgeNetworkRegion ?? null,
    record.clientIpCountry ?? null,
    record.clientUserAgent || null,
    record.wafAction ?? null,
    record.deploymentId ?? null,
  ];
}

// One page of `vercel logs requests --json`: request lines, then a summary
// line with the cursor for the next page. Errors come back as a status line.
export function parsePage(output) {
  const records = [];
  let next = null;
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (entry.status === 'error') throw new Error(`vercel logs failed: ${entry.message}`);
    if (entry.type === 'request') records.push(entry.data);
    if (entry.type === 'summary') next = entry.pagination?.hasMore ? entry.pagination.next : null;
  }
  return { records, next };
}

function runVercel(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.VERCEL_BIN ?? 'vercel', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      // Errors are printed as a JSON status line, sometimes with exit code 0
      try {
        resolve(parsePage(stdout));
      } catch (error) {
        reject(code === 0 ? error : new Error(`${error.message}\n${stderr.trim()}`));
      }
    });
  });
}

async function fetchRecords() {
  const base = [
    'logs',
    'requests',
    '--scope',
    process.env.VERCEL_SCOPE ?? 'hoskins',
    '--project',
    process.env.VERCEL_PROJECT ?? 'behaviortrees',
    '--environment',
    'production',
    '--since',
    process.env.INGEST_SINCE ?? '23h',
    '--limit',
    '10000',
    '--json',
  ];
  const records = [];
  let page = await runVercel(base);
  records.push(...page.records);
  while (page.next) {
    page = await runVercel([...base, '--next', page.next]);
    records.push(...page.records);
  }
  return records;
}

async function insert(sql, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const columns = COLUMNS.map((_, c) => batch.map((row) => row[c]));
    const result = await sql.query(
      `insert into vercel_requests (${COLUMNS.map(([name]) => name).join(', ')})
       select * from unnest(${COLUMNS.map(([, type], c) => `$${c + 1}::${type}[]`).join(', ')})
       on conflict (request_id) do nothing
       returning 1`,
      columns
    );
    inserted += result.length;
  }
  return inserted;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const records = await fetchRecords();
  const rows = records.filter((record) => !isSkippedPath(record.requestPath)).map(toRow);
  const inserted = await insert(neon(process.env.DATABASE_URL), rows);
  console.log(`Fetched ${records.length} requests, kept ${rows.length}, stored ${inserted} new.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
