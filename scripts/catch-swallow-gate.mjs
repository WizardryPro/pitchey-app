#!/usr/bin/env node
// Counts `.catch(() => …)` sites in src/, classifies each by prior-line tag,
// and reports the orchestrator-gate metric (untagged residue, excl. worker-integrated.ts).
//
// Tag convention (matches docs/catch-swallow-prep-2026-05-05.md §Phase 1):
//   `// fire-and-forget`              → bucket A (telemetry / best-effort write)
//   `// TODO(catch-swallow): migrate` → bucket C (read-side, slated for safeQuery)
//
// Tag must appear on the line immediately preceding the `.catch(...)` line, OR on
// the preceding line of a multi-line tagged template (we walk back through `.catch(`,
// the closing backtick line, and any preceding empty/whitespace lines until the
// first non-empty line — which must carry the tag to count as classified).
//
// Usage:
//   node scripts/catch-swallow-gate.mjs              # summary only
//   node scripts/catch-swallow-gate.mjs --list       # list each untagged site
//   node scripts/catch-swallow-gate.mjs --include-worker
//   node scripts/catch-swallow-gate.mjs --threshold 30   # exit 1 if untagged > N

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

const EXCLUDED_DIRS = new Set(['workers']); // crawl4ai parked, per CLAUDE.md
const EXCLUDED_FILES = new Set([
  // safe-query.ts contains `.catch(() =>` inside its docstring describing the
  // anti-pattern it fixes; not real call sites.
  'db/safe-query.ts',
]);

const args = new Set(process.argv.slice(2));
const list = args.has('--list');
const includeWorker = args.has('--include-worker');
const thresholdIdx = process.argv.indexOf('--threshold');
const threshold = thresholdIdx >= 0 ? Number(process.argv[thresholdIdx + 1]) : null;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = full.slice(SRC.length + 1);
    if (EXCLUDED_DIRS.has(entry)) continue;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts') && !EXCLUDED_FILES.has(rel)) out.push(full);
  }
  return out;
}

const CATCH_RE = /\.catch\(\(\)\s*=>/;
const TAG_FAF = /\/\/\s*fire-and-forget\b/;
const TAG_BUCKET_B = /\/\/\s*TODO\(catch-swallow\):\s*bucket-B\b/;
const TAG_TODO = /\/\/\s*TODO\(catch-swallow\)/;

// STMT_START: `sql\`` and `\w+\.\w+\(` included so each Promise.all element is its own statement.
const STMT_START = /^(await\s|return\s|const\s|let\s|var\s|this\.|\w+\s*=|sql`|\(sql`|\w+\.\w+\()/;

function classify(lines, idx) {
  // Walk backwards from the `.catch(...)` line through the statement body
  // (template literals, args, etc.) until we hit the line that *starts* the
  // statement. Window of 60 covers long SQL bodies.
  let stmtStart = idx;
  for (let j = idx; j >= 0 && j >= idx - 60; j--) {
    if (STMT_START.test(lines[j].trim())) { stmtStart = j; break; }
  }
  for (let j = stmtStart - 1; j >= 0 && j >= stmtStart - 5; j--) {
    const trimmed = lines[j].trim();
    if (trimmed === '') continue;
    if (TAG_FAF.test(trimmed)) return 'A';
    if (TAG_BUCKET_B.test(trimmed)) return 'B';
    if (TAG_TODO.test(trimmed)) return 'C';
    return 'untagged';
  }
  return 'untagged';
}

const files = walk(SRC);
const buckets = { A: [], B: [], C: [], untagged: [] };

for (const file of files) {
  const rel = file.slice(SRC.length + 1);
  if (!includeWorker && rel === 'worker-integrated.ts') continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!CATCH_RE.test(lines[i])) continue;
    const bucket = classify(lines, i);
    buckets[bucket].push(`${rel}:${i + 1}`);
  }
}

const total = buckets.A.length + buckets.B.length + buckets.C.length + buckets.untagged.length;
const untagged = buckets.untagged.length;

console.log(`Scope: src/ ${includeWorker ? '(incl. worker-integrated.ts)' : '(excl. worker-integrated.ts)'}`);
console.log(`Total \`.catch(() => …)\` sites:  ${total}`);
console.log(`  A. fire-and-forget:             ${buckets.A.length}`);
console.log(`  B. bucket-B breadcrumb pending: ${buckets.B.length}`);
console.log(`  C. TODO(catch-swallow):         ${buckets.C.length}`);
console.log(`  Untagged (gate metric):         ${untagged}`);

if (list && untagged > 0) {
  console.log('\nUntagged sites:');
  for (const site of buckets.untagged) console.log(`  ${site}`);
}

if (threshold !== null && untagged > threshold) {
  console.error(`\nGate FAIL: untagged residue ${untagged} > threshold ${threshold}`);
  process.exit(1);
}
