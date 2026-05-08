#!/usr/bin/env node
// Per-site tagger — applies bucket tags from a JSON config keyed by line number.
// Used for files (e.g. worker-integrated.ts) where bulk-by-file tagging is wrong
// because sites span multiple buckets. Idempotent: skips already-tagged sites.
//
// Config shape:
//   {
//     "src/worker-integrated.ts": [
//       { "line": 1402, "bucket": "A" },
//       { "line": 9973, "bucket": "B", "reason": "stripe getSubscription, null fallback" },
//       { "line": 8751, "bucket": "C" }
//     ]
//   }
//
// Usage:
//   node scripts/catch-swallow-tag-per-site.mjs <config.json>

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = process.argv[2];
if (!configPath) {
  console.error('Usage: catch-swallow-tag-per-site.mjs <config.json>');
  process.exit(2);
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));

const STMT_START = /^(await\s|return\s|const\s|let\s|var\s|this\.|\w+\s*=|sql`|\(sql`|\w+\.\w+\()/;
const TAG_FAF = /\/\/\s*fire-and-forget\b/;
const TAG_TODO = /\/\/\s*TODO\(catch-swallow\)/;

function findStmtStart(lines, idx) {
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

function tagText(bucket, reason) {
  const suffix = reason ? ` — ${reason}` : '';
  if (bucket === 'A') return `// fire-and-forget${suffix}`;
  if (bucket === 'B') return `// TODO(catch-swallow): bucket-B breadcrumb pending${suffix}`;
  if (bucket === 'C') return `// TODO(catch-swallow): migrate to safeQuery${suffix}`;
  throw new Error(`Unknown bucket: ${bucket}`);
}

let totalTagged = 0;
for (const [file, sites] of Object.entries(config)) {
  const path = resolve(file);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  // Sort bottom-up so earlier insertions don't shift later line numbers
  const sortedSites = [...sites].sort((a, b) => b.line - a.line);
  const insertions = [];
  for (const { line, bucket, reason } of sortedSites) {
    const idx = line - 1;
    const stmtStart = findStmtStart(lines, idx);
    if (alreadyTagged(lines, stmtStart)) {
      console.log(`  ${file}:${line} already tagged, skipping`);
      continue;
    }
    const indent = lines[stmtStart].match(/^\s*/)[0];
    insertions.push({ at: stmtStart, line: `${indent}${tagText(bucket, reason)}` });
  }
  for (const { at, line } of insertions) {
    lines.splice(at, 0, line);
  }
  writeFileSync(path, lines.join('\n'));
  console.log(`${file}: +${insertions.length}`);
  totalTagged += insertions.length;
}
console.log(`---\nTotal sites tagged: ${totalTagged}`);
