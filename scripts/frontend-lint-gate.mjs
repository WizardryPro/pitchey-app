#!/usr/bin/env node
// Frontend ESLint ratchet gate.
//
// WHY: `frontend/` lint never gates. CI runs `npm run lint` with
// `continue-on-error: true` (ci-cd.yml) and quality-gates.yml's code-quality
// gate is "informational only" — so lint errors accumulate invisibly (8908
// errors / 184 warnings as of 2026-06-27, trending UP with each feature PR).
// This is the frontend twin of scripts/worker-typecheck-gate.mjs: it counts
// ESLint *errors* (severity 2) and FAILS if the count rises above the baseline,
// stopping the bleeding without requiring all pre-existing errors fixed first.
//
// RATCHET: one-way, downward only.
//   errors >  BASELINE -> FAIL (a PR introduced new lint errors)
//   errors <  BASELINE -> PASS, but loudly asks you to LOWER the baseline
//   errors == BASELINE -> PASS
//
// HOW TO LOWER: when you fix lint errors, set BASELINE below to the new (lower)
// count and commit it in the same PR. The number can only ever go down.
//
// Scope: errors only. Warnings (184) are reported but not gated — same choice as
// the worker gate (errors are the actionable signal; warnings are noise here).
//
// Usage: node scripts/frontend-lint-gate.mjs [--list]

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ── The baseline. Lower it (never raise it) as frontend lint errors are fixed. ──
const BASELINE = 8908;
// 2026-06-27: created at the measured floor (8908 errors / 184 warnings). Top
// rules: no-unsafe-member-access, no-unsafe-assignment, no-explicit-any,
// no-unused-vars, no-misused-promises. The gate blocks any NEW error.

const LIST = process.argv.includes('--list');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, '..', 'frontend');
const eslint = resolve(frontendDir, 'node_modules', '.bin', 'eslint');
if (!existsSync(eslint)) {
  console.error('❌ No eslint binary found at frontend/node_modules/.bin/eslint. Run `cd frontend && npm ci` first.');
  process.exit(2);
}

let out = '';
try {
  out = execSync(`${eslint} . --format json`, { cwd: frontendDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  // eslint exits 1 when there are errors — expected; the JSON report is on stdout.
  out = `${e.stdout || ''}`;
}

let report;
try {
  report = JSON.parse(out);
} catch {
  console.error('❌ Could not parse ESLint JSON output. The lint run itself likely crashed:');
  console.error(out.slice(0, 2000));
  process.exit(2);
}

let errors = 0;
let warnings = 0;
const ruleCounts = new Map();
for (const file of report) {
  for (const m of file.messages) {
    if (m.severity === 2) errors++;
    else warnings++;
    if (m.severity === 2 && m.ruleId) ruleCounts.set(m.ruleId, (ruleCounts.get(m.ruleId) || 0) + 1);
  }
}

console.log(`Frontend ESLint: ${errors} error(s), ${warnings} warning(s) (baseline ${errors > BASELINE ? BASELINE + ' errors' : BASELINE})`);
if (LIST) {
  const top = [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('--- top error rules ---');
  for (const [rule, n] of top) console.log(`  ${String(n).padStart(5)}  ${rule}`);
  console.log('---');
}

if (errors > BASELINE) {
  console.error(`\n❌ ${errors - BASELINE} NEW frontend lint error(s) introduced (baseline ${BASELINE}).`);
  console.error('   Lint does not gate at deploy, so this ratchet is the net. Fix the new');
  console.error('   error(s) — run `cd frontend && npx eslint .` to see them — or do not merge.\n');
  process.exit(1);
}

if (errors < BASELINE) {
  console.log(`\n✅ ${BASELINE - errors} frontend lint error(s) fixed since the baseline. Nice.`);
  console.log(`   👉 Lower BASELINE in scripts/frontend-lint-gate.mjs to ${errors} and commit`);
  console.log('      it in this PR to lock the win (the ratchet only tightens).');
  process.exit(0);
}

console.log('✅ No new frontend lint errors.');
process.exit(0);
