#!/usr/bin/env node
// Migration runner for Neon PostgreSQL.
//
// Applied-state lives in `schema_migrations` keyed by filename. Ordering is by filename
// ASCII sort — which matches the numeric-prefix naming convention even with gaps/dupes.
//
// Subcommands:
//   status     — list applied / pending migrations
//   apply      — run pending migrations in a single transaction each
//   check      — exit 1 if any pending migrations exist (for CI)
//   baseline   — mark all current files as applied WITHOUT running them (one-time bootstrap
//                for databases that were migrated out-of-band)
//
// Required: DATABASE_URL env var (Neon pooled or direct connection string).

import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'src', 'db', 'migrations');

const CMD = process.argv[2] || 'status';
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

function die(msg, code = 1) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

function log(msg) {
  console.log(msg);
}

async function discoverFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.bak'))
    .sort();
}

async function hashFile(name) {
  const contents = await readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
  return { contents, sha256: createHash('sha256').update(contents).digest('hex') };
}

async function ensureTable(sql) {
  // Some envs already have a `schema_migrations` table with a legacy shape (empty or
  // partially-filled from an older runner). We don't recreate it — we reconcile the
  // columns we need via IF NOT EXISTS so drift doesn't break the runner.
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY
    )
  `;
  await sql`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS sha256     TEXT`;
  await sql`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS applied_by TEXT`;

  // If the existing table was keyed by something other than `filename` (e.g. an integer
  // `id` PK from Drizzle/Prisma), ensure `filename` is at least unique so our upserts work.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'schema_migrations'
          AND indexdef ILIKE '%UNIQUE%filename%'
      ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_filename_uniq
          ON schema_migrations(filename);
      END IF;
    END$$
  `;
}

async function listApplied(sql) {
  const rows = await sql`SELECT filename, sha256, applied_at FROM schema_migrations`;
  return new Map(rows.map((r) => [r.filename, r]));
}

function classify(files, applied) {
  const pending = [];
  const drift = [];
  const ok = [];
  for (const name of files) {
    const rec = applied.get(name);
    if (!rec) pending.push(name);
    else ok.push(name);
  }
  return { pending, drift, ok };
}

async function cmdStatus(sql) {
  await ensureTable(sql);
  const files = await discoverFiles();
  const applied = await listApplied(sql);
  const { pending, ok } = classify(files, applied);

  log(`Migrations dir: ${MIGRATIONS_DIR}`);
  log(`Total files:    ${files.length}`);
  log(`Applied:        ${ok.length}`);
  log(`Pending:        ${pending.length}`);

  if (VERBOSE && ok.length) {
    log('\nApplied:');
    for (const name of ok) {
      const rec = applied.get(name);
      log(`  ✓ ${name}  (${rec.applied_at.toISOString?.() ?? rec.applied_at})`);
    }
  }
  if (pending.length) {
    log('\nPending:');
    for (const name of pending) log(`  ○ ${name}`);
  }
  return { pending, ok };
}

async function cmdCheck(sql) {
  const { pending } = await cmdStatus(sql);
  if (pending.length > 0) {
    die(`${pending.length} pending migration(s) — deploy blocked. Run 'node scripts/migrate.mjs apply' or 'baseline'.`, 2);
  }
  log('\n✓ No pending migrations — deploy may proceed.');
}

async function cmdApply(sql) {
  await ensureTable(sql);
  const files = await discoverFiles();
  const applied = await listApplied(sql);
  const { pending } = classify(files, applied);

  if (pending.length === 0) {
    log('No pending migrations.');
    return;
  }

  log(`Applying ${pending.length} migration(s)...`);
  const who = process.env.USER || process.env.GITHUB_ACTOR || 'ci';

  for (const name of pending) {
    const { contents, sha256 } = await hashFile(name);
    log(`→ ${name}`);
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`
          INSERT INTO schema_migrations (filename, sha256, applied_by)
          VALUES (${name}, ${sha256}, ${who})
          ON CONFLICT (filename) DO NOTHING
        `;
      });
      log(`  ✓ applied`);
    } catch (err) {
      die(`failed on ${name}: ${err.message}`, 3);
    }
  }
  log('\n✓ All pending migrations applied.');
}

async function cmdBaseline(sql) {
  await ensureTable(sql);
  const files = await discoverFiles();
  const applied = await listApplied(sql);
  const newly = files.filter((f) => !applied.has(f));

  if (newly.length === 0) {
    log('Nothing to baseline — all files already recorded.');
    return;
  }

  log(`Recording ${newly.length} file(s) as applied WITHOUT executing them.`);
  log('This assumes the database schema already reflects these migrations.');
  log('Use only for one-time bootstrap of a pre-existing database.\n');

  const who = process.env.USER || process.env.GITHUB_ACTOR || 'baseline';
  for (const name of newly) {
    const { sha256 } = await hashFile(name);
    await sql`
      INSERT INTO schema_migrations (filename, sha256, applied_by)
      VALUES (${name}, ${sha256}, ${who})
      ON CONFLICT (filename) DO NOTHING
    `;
    log(`  ✓ ${name}`);
  }
  log('\n✓ Baseline complete.');
}

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) die('DATABASE_URL not set.');

  const sql = postgres(connStr, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
    // Suppress IF NOT EXISTS "already exists" NOTICE spam on re-runs.
    onnotice: () => {},
  });

  try {
    switch (CMD) {
      case 'status':   await cmdStatus(sql); break;
      case 'apply':    await cmdApply(sql); break;
      case 'check':    await cmdCheck(sql); break;
      case 'baseline': await cmdBaseline(sql); break;
      default: die(`unknown command: ${CMD}\n  usage: node scripts/migrate.mjs [status|apply|check|baseline] [--verbose]`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
