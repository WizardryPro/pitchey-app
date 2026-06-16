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
// Body-parse idiom: `request.json().catch(() => ({}))` / `.catch(() => (null))`.
// This never hides an operational error — it defaults a malformed/empty body and
// the handler validates it immediately after (returning 400 on bad input). It is
// provably safe, so it is exempt from the gate rather than forced to carry a
// misleading `// fire-and-forget` tag.
const PARSE_IDIOM_RE = /\.json\(\)\.catch\(\(\)\s*=>/;
const TAG_FAF = /\/\/\s*fire-and-forget\b/;
const TAG_BUCKET_B = /\/\/\s*TODO\(catch-swallow\):\s*bucket-B\b/;
const TAG_TODO = /\/\/\s*TODO\(catch-swallow\)/;

// STMT_START: `sql\`` and `\w+\.\w+\(` included so each Promise.all element is its own statement.
// `\w+\s*=\s*\(?\s*await\s` (not bare `\w+\s*=`) — see scripts/catch-swallow-tag.mjs for rationale.
// `\(?` allows for `x = (await sql\`...\`.catch(...))` parenthesized form.
const STMT_START = /^(await\s|return\s|const\s|let\s|var\s|this\.|\w+\s*=\s*\(?\s*await\s|\w+\s*=\s*sql`|sql`|\(sql`|\w+\.\w+\()/;

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

// findMidTemplateComments — flags `// TODO(catch-swallow)` or `// fire-and-forget`
// lines that sit *inside* a `sql\`…\`` template literal. PostgreSQL has no `//`
// comment syntax, so any such line breaks the SQL at runtime — the breakage is
// invisible because the catch swallows it. PR #85's tagger had a STMT_START
// regex bug that produced 5 of these in handlers (fixed in this PR).
function findMidTemplateComments(lines) {
  const out = [];
  // Track `sql\`…\`` template depth — only reset when a closing backtick is
  // followed (after .catch chain or end-of-statement) by a non-template line.
  // For our codebase, every `sql\`` template terminates with `\`` on its own
  // line, optionally with `.catch(...)` or `;`. We treat any line containing a
  // bare backtick (not preceded by `\\`) as the closer when a template is open.
  let inTemplate = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inTemplate) {
      if (/\bsql`/.test(line) && !/sql`[^`]*`/.test(line)) inTemplate = true;
      continue;
    }
    // In template — check for closing backtick
    if (/`/.test(line)) inTemplate = false;
    // Tag lines inside the template are bugs.
    // `\b` only attached to `fire-and-forget` (after the word `forget`); not to
    // `TODO(catch-swallow)` because `)` is non-word and the next char (`:` or EOL)
    // is also non-word — `\b` would never fire and the bug detector silently passes.
    if (/^[ \t]*\/\/\s*(?:TODO\(catch-swallow\)|fire-and-forget\b)/.test(line)) {
      out.push(i + 1); // 1-based
    }
  }
  return out;
}

const files = walk(SRC);
const buckets = { A: [], B: [], C: [], untagged: [] };
const midTemplateBugs = []; // { file, line }[]

for (const file of files) {
  const rel = file.slice(SRC.length + 1);
  if (!includeWorker && rel === 'worker-integrated.ts') continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!CATCH_RE.test(lines[i])) continue;
    if (PARSE_IDIOM_RE.test(lines[i])) continue; // safe body-parse fallback
    const bucket = classify(lines, i);
    buckets[bucket].push(`${rel}:${i + 1}`);
  }
  for (const ln of findMidTemplateComments(lines)) {
    midTemplateBugs.push(`${rel}:${ln}`);
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

if (midTemplateBugs.length > 0) {
  console.error(`\nGate FAIL: ${midTemplateBugs.length} mid-template comment(s) — these break SQL at runtime, masked by .catch:`);
  for (const site of midTemplateBugs) console.error(`  ${site}`);
  process.exit(1);
}

if (threshold !== null && untagged > threshold) {
  console.error(`\nGate FAIL: untagged residue ${untagged} > threshold ${threshold}`);
  process.exit(1);
}
