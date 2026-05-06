#!/usr/bin/env node
// Phase 1a tagger — inserts `// TODO(catch-swallow): migrate to safeQuery` (or
// `// fire-and-forget`) on the line preceding the statement that hangs the
// `.catch(() => …)`. Idempotent: re-running is a no-op for already-tagged sites.
//
// Usage:
//   node scripts/catch-swallow-tag.mjs <bucket> <file> [<file>...]
//
//   <bucket> ∈ { C, A }
//   C → `// TODO(catch-swallow): migrate to safeQuery`
//   A → `// fire-and-forget`
//
// Examples:
//   node scripts/catch-swallow-tag.mjs C src/handlers/production-dashboard-extended.ts
//   node scripts/catch-swallow-tag.mjs A src/handlers/messaging-simple.ts
//
// Run scripts/catch-swallow-gate.mjs after to verify.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [bucket, ...files] = process.argv.slice(2);

const TAG = bucket === 'A' ? '// fire-and-forget' :
            bucket === 'C' ? '// TODO(catch-swallow): migrate to safeQuery' :
            null;
if (!TAG || files.length === 0) {
  console.error('Usage: catch-swallow-tag.mjs <A|C> <file> [<file>...]');
  process.exit(2);
}

const CATCH_RE = /\.catch\(\(\)\s*=>/;
// STMT_START matches the line that begins the catch's statement. `sql\`` and
// `\w+\.\w+\(` are included so each element of a Promise.all([sql\`\`.catch,
// db.query(...).catch]) gets its own statement-start (and its own tag).
const STMT_START = /^(await\s|return\s|const\s|let\s|var\s|this\.|\w+\s*=|sql`|\(sql`|\w+\.\w+\()/;
const TAG_FAF = /\/\/\s*fire-and-forget\b/;
const TAG_TODO = /\/\/\s*TODO\(catch-swallow\)/;

function findStmtStart(lines, idx) {
  // Walk back through the statement body (SQL template lines, args, etc.) to
  // find the line that opens the statement. Window of 60 covers long SQL bodies.
  for (let j = idx; j >= 0 && j >= idx - 60; j--) {
    if (STMT_START.test(lines[j].trim())) return j;
  }
  return idx;
}

function alreadyTagged(lines, stmtStart) {
  for (let j = stmtStart - 1; j >= 0 && j >= stmtStart - 5; j--) {
    const t = lines[j].trim();
    if (t === '') continue;
    return TAG_FAF.test(t) || TAG_TODO.test(t);
  }
  return false;
}

let totalTagged = 0;
for (const file of files) {
  const path = resolve(file);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  // Walk bottom-up so insertions don't shift earlier indices.
  const insertions = [];
  for (let i = 0; i < lines.length; i++) {
    if (!CATCH_RE.test(lines[i])) continue;
    const stmtStart = findStmtStart(lines, i);
    if (alreadyTagged(lines, stmtStart)) continue;
    const indent = lines[stmtStart].match(/^\s*/)[0];
    insertions.push({ at: stmtStart, line: `${indent}${TAG}` });
  }
  if (insertions.length === 0) {
    console.log(`${file}: 0 (already tagged or no sites)`);
    continue;
  }
  // Apply bottom-up
  for (let k = insertions.length - 1; k >= 0; k--) {
    const { at, line } = insertions[k];
    lines.splice(at, 0, line);
  }
  writeFileSync(path, lines.join('\n'));
  console.log(`${file}: +${insertions.length}`);
  totalTagged += insertions.length;
}
console.log(`---\nTotal sites tagged: ${totalTagged}`);
