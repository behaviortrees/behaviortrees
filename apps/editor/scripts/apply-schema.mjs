// Applies api/_lib/schema.sql to the Neon database in DATABASE_URL.
// Usage: node --env-file=.env.local scripts/apply-schema.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (run with --env-file=.env.local)');
  process.exit(1);
}

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../api/_lib/schema.sql');
const statements = readFileSync(schemaPath, 'utf8')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(url);
for (const statement of statements) {
  console.log(`${statement.split('\n')[0]} ...`);
  await sql.query(statement);
}

const tables = await sql.query(
  `select column_name, data_type from information_schema.columns
   where table_name = 'projects' order by ordinal_position`
);
console.log('\nprojects table columns:');
for (const row of tables) console.log(`  ${row.column_name}: ${row.data_type}`);
console.log('\nSchema applied.');
