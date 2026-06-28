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
const BASELINE = 7151;
// 2026-06-27: created at the measured floor (8908 errors / 184 warnings). Top
// rules: no-unsafe-member-access, no-unsafe-assignment, no-explicit-any,
// no-unused-vars, no-misused-promises. The gate blocks any NEW error.
// 2026-06-27: lowered 8908 -> 8837 (-71) after typing the team + collaboration
// service API boundaries (removed unnecessary `(response.data as any)` casts;
// fixed a latent double-wrapped `get<ApiResponse<...>>` generic that hid a
// real stats-access bug). slice 1 of the `any`-complex teardown (src/services).
// 2026-06-28: lowered 8837 -> 8736 (-101). A2a: typed transformPitchData's input
// (RawPitch boundary shape) in src/lib/api.ts — cleared the unsafe member-access
// inside the transform with zero consumer cascade (return kept `any`; tightening
// it to Pitch is deferred — the file's Pitch differs from the page-level Pitch
// type tree). Remaining api.ts errors are axios response-envelope typing (A2b).
// 2026-06-28: lowered 8736 -> 8371 (-365). A3: typed the input boundaries of the
// three feature services — nda.service (transform raw params + raw response types),
// investment.service (Raw* shapes + response generics; fixed investmentDate Date→
// string drift), pitch.service (added missing RawPitchData fields + raw response
// arrays). Same input-typing/loose-return pattern; zero cascade, full suite green.
// 2026-06-28: lowered 8371 -> 8283 (-88). C1a: voided bare `navigate(...)` floating
// promises (React Router v6 navigate returns a Promise) across 53 files. `void` is
// behavior-preserving — the promise was already floating; you never await navigation
// in a handler. Start of the promise-handling (C1) hardening workstream.
// 2026-06-28: lowered 8283 -> 7727 (-556). C1c: narrowed no-misused-promises with
// checksVoidReturn.attributes:false (eslint.config.js) — async JSX event handlers
// are idiomatic, safe React (React discards the return). Rule stays ON for timers,
// callbacks, object handlers (26 genuine cases remain → C1c-residual follow-up).
// 2026-06-28: lowered 7727 -> 7466 (-261). C1b-1: void-prefixed bare-statement
// floating promises (load/fetch/other calls) across 150 files, behavior-preserving.
// 2026-06-28: lowered 7466 -> 7408 (-58). C1b-2: cleared the remaining multi-line
// floating promises — voided .then() chains + IIFEs (prepend), and inserted `void`
// before inner calls in inline effects/handlers/if-blocks. no-floating-promises is
// now ZERO across the codebase (all 407 of the rule's hits resolved over C1a/b).
// 2026-06-28: lowered 7408 -> 7393 (-15). C1c-residual-1: wrapped 15 misused-promises
// — timers with async fn-refs (setInterval(fn)→setInterval(()=>void fn())) + object/
// arrow handlers (onClick:()=>nav()→()=>{void nav()}). 11 subtle ones deferred:
// inline setInterval(async()=>) ×4, new Promise(async executor), WS context-value ×2,
// test mocks ×4. (Pre-existing flaky CharacterManagement scrollIntoView timer test is
// unrelated — not in this diff, passes in isolation.)
// 2026-06-28: lowered 7393 -> 7306 (-87). C3a (config hygiene): disabled `no-undef`
// for TS (redundant w/ TS, false-positives React/NodeJS/process — tseslint rec) and
// ignored functions/**, worker/**, vite.config.*.ts (outside tsconfig.app.json /
// build artifacts — they only produced parserOptions.project parse errors, never
// real lint). no-undef + parse errors now 0.
// 2026-06-28: lowered 7306 -> 7294 (-12). C3b: eslint --fix merged duplicate imports
// (import/no-duplicates → 0) + removed 4 useless regex escapes (behavior-preserving).
// Remaining small rules need per-site judgment → C3c: require-await (36),
// no-case-declarations (15), no-empty (7), import/no-restricted-paths (3),
// no-async-promise-executor (1).
// 2026-06-28: lowered 7294 -> 7151 (-143). C2a: removed unused single-line imports
// via codemod (eslint findings → strip the name; drop the line if it empties).
// GUARD: skips any import line containing `as` — aliased-import removal mangles
// (an early run rewrote `pitchAPI as newPitchAPI` into `pitchAPI as savedPitchesAPI`,
// breaking it). tsc is the safety net (clean = every removed name was truly unused).
// Remaining no-unused-vars (800): assigned-vars (~467), args (80), multiline/aliased
// imports → C2b/C2c.

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
