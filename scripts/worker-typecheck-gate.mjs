#!/usr/bin/env node
// Worker type-check ratchet gate.
//
// WHY: the Cloudflare Worker (src/, wrangler `main`) is bundled by esbuild, which does
// NOT type-check. CI's `type-check` step only covers frontend/. So worker type errors
// accumulated invisibly (38+ live ones found 2026-06-25). This gate runs `tsc` over the
// root tsconfig and FAILS if the worker error count rises above the baseline — stopping
// the bleeding without requiring every pre-existing error fixed first.
//
// RATCHET: it is a one-way ratchet downward.
//   count >  BASELINE -> FAIL (a PR introduced new worker type errors)
//   count <  BASELINE -> PASS, but loudly asks you to LOWER the baseline to lock the win
//   count == BASELINE -> PASS
//
// HOW TO LOWER: when you fix worker errors, set BASELINE below to the new (lower) count
// and commit it in the same PR. The number can only ever go down.
//
// Usage: node scripts/worker-typecheck-gate.mjs [--list]

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// ── The baseline. Lower it (never raise it) as worker type errors are fixed. ──
const BASELINE = 40;
// 2026-06-25: 40 on main at gate creation. 9 of these are the notification latent-bug
// (issue #361, intentionally unfixed). The 5 fix PRs (#356–#360) drop it to 9 once
// merged — lower BASELINE to 9 in a follow-up after they land.

const LIST = process.argv.includes('--list');

// Prefer a root-installed tsc (CI: `npm ci` installs the root `typescript` devDep);
// fall back to the frontend binary for local runs that haven't installed root deps.
const tscCandidates = ['./node_modules/.bin/tsc', './frontend/node_modules/.bin/tsc'];
const tsc = tscCandidates.find((p) => existsSync(p));
if (!tsc) {
  console.error('❌ No tsc binary found. Run `npm ci` (root) first.');
  process.exit(2);
}

let out = '';
try {
  out = execSync(`${tsc} --noEmit -p tsconfig.json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  // tsc exits non-zero when there are errors — that's expected; capture its output.
  out = `${e.stdout || ''}${e.stderr || ''}`;
}

const errorLines = out.split('\n').filter((l) => /error TS\d+:/.test(l));
const count = errorLines.length;

console.log(`Worker type-check: ${count} error(s) (baseline ${BASELINE}) via ${tsc}`);
if (LIST && count) {
  console.log('---');
  for (const l of errorLines) console.log('  ' + l.trim());
  console.log('---');
}

if (count > BASELINE) {
  console.error(`\n❌ ${count - BASELINE} NEW worker type error(s) introduced (baseline ${BASELINE}).`);
  console.error('   The worker is not type-checked at deploy (esbuild only), so this gate is the');
  console.error('   net. Fix the new error(s) below, or do not merge.\n');
  if (!LIST) for (const l of errorLines) console.error('  ' + l.trim());
  process.exit(1);
}

if (count < BASELINE) {
  console.log(`\n✅ ${BASELINE - count} worker type error(s) fixed since the baseline. Nice.`);
  console.log(`   👉 Lower BASELINE in scripts/worker-typecheck-gate.mjs to ${count} and commit`);
  console.log('      it in this PR to lock the win (the ratchet only tightens).');
  process.exit(0);
}

console.log('✅ No new worker type errors.');
process.exit(0);
