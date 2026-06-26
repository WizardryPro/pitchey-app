#!/usr/bin/env node
// Read-only orphan-handler candidate finder for Pitchey.
// Model: the live request path is rooted at src/worker-integrated.ts. A handler/route/
// worker-module file is an ORPHAN candidate if NO other file in src/ imports it (by its
// module path) AND none of its exported handler-ish names appear elsewhere in src/.
// Conservative: errs toward "live" (any reference anywhere = not a candidate).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = process.argv[2] || process.cwd();   // run from repo root, or pass it explicitly
const SRC = join(ROOT, 'src');

// PROTECTED parked paths (#60/#61) — never flag, per STACK.md.
const PROTECTED = [
  'src/workflows/',
  'src/workers/crawl4ai-worker.ts',
  'src/services/console-analysis-crawler.ts',
];
const CANDIDATE_DIRS = ['handlers', 'routes', 'worker-modules'];

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.ts') && !e.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const allSrc = walk(SRC);
const rel = (p) => relative(ROOT, p);
const isProtected = (p) => PROTECTED.some((x) => rel(p).startsWith(x) || rel(p) === x);

// Preload all src file contents once.
const contents = new Map();
for (const f of allSrc) contents.set(f, readFileSync(f, 'utf8'));

// Candidate universe: handler/route/worker-module files, excluding tests, types, index barrels, protected.
const candidates = allSrc.filter((f) => {
  const r = rel(f);
  if (!r.startsWith('src/')) return false;
  const seg = r.split('/')[1];
  if (!CANDIDATE_DIRS.includes(seg)) return false;
  if (isProtected(f)) return false;
  if (/\.test\.ts$|__tests__|\/types?\.ts$|\/index\.ts$/.test(r)) return false;
  return true;
});

const orphans = [];
const smellFiles = [];
for (const f of candidates) {
  const stem = basename(f).replace(/\.ts$/, '');           // e.g. "collaborator"
  const body = contents.get(f);
  if (/\bauthResult:\s*any\b/.test(body)) smellFiles.push(rel(f));

  // Is this file's module path imported anywhere else in src/?
  // Match import/require/dynamic-import specifiers that end in the stem (with optional dir prefix).
  const importRe = new RegExp(`(from\\s+['"]|import\\(\\s*['"]|require\\(\\s*['"])[^'"]*\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
  let referenced = false;
  for (const [g, gbody] of contents) {
    if (g === f) continue;
    if (importRe.test(gbody)) { referenced = true; break; }
  }
  if (!referenced) orphans.push(rel(f));
}

console.log(`# candidate universe (handlers/routes/worker-modules, excl tests/types/index/protected): ${candidates.length}`);
console.log(`# ORPHAN candidates (module path imported by NO other src file): ${orphans.length}`);
for (const o of orphans.sort()) console.log('  ORPHAN  ' + o);
console.log(`\n# orphan-signature smell ('authResult: any'): ${smellFiles.length}`);
for (const s of smellFiles.sort()) console.log('  SMELL   ' + s);
