---
name: catch-swallow-auditor
description: Audit a TypeScript/JavaScript codebase for swallowed errors — catch blocks and .catch() handlers that hide failures instead of surfacing them. Use this whenever the user wants to find error-swallowing antipatterns, audit catch blocks, classify how errors are handled, hunt down silent failures, or asks about ".catch(() => default)" / empty catch / fire-and-forget error handling. Trigger on phrases like "audit our error handling", "find swallowed errors", "where are we hiding failures", "catch block audit", or when reviewing a service for production-hardening. Especially relevant for Cloudflare Workers / Hono / Neon backends where a swallowed DB or fetch error becomes an invisible production incident.
---

# Catch-Swallow Auditor

## Why this exists

A swallowed error is one that's caught and then silently discarded or replaced with a
default, so the failure never reaches logs, monitoring, or the caller. In a serverless
backend (Workers/Hono + Neon) these are the worst class of bug: the request returns 200,
the user sees stale or empty data, and nothing fires in Sentry. The point of an audit
isn't to eliminate every catch — many are *correct*. It's to **classify each one** so the
genuinely dangerous ones get fixed and the intentional ones get documented.

The mistake people make is treating this as "find and delete all catches." That's wrong
and produces noise. The skill's real job is disciplined triage.

## The three buckets

Every catch/`.catch()` site falls into exactly one bucket. Assign one to each.

**1. Fire-and-forget (acceptable).** The operation genuinely doesn't matter if it fails:
best-effort analytics writes, cache warms, telemetry, non-critical notifications. Swallowing
is fine *as long as it's intentional and logged at debug level*. The fix here is usually just
a comment explaining why it's safe, not a code change.

**2. Migration-needed (must fix).** A real failure is being hidden. DB writes, auth checks,
payment operations, data the caller depends on. A swallowed error here means corruption,
silent data loss, or a security gap. These get rethrown, logged at error level, or surfaced
to the caller. This is the bucket that justifies the whole audit.

**3. Gate-feeding (conditional).** The caught error feeds a control-flow decision — a
fallback that's part of the design (try primary, fall back to secondary), a retry, a
graceful-degradation path. Acceptable *if* the gate is real and the error is still observable.
The risk is a "gate" that's actually just a disguised bucket-2 swallow. Look hard at whether
the fallback path is legitimate or whether it's masking a failure the caller should know about.

## Workflow

1. **Find the sites.** Run `scripts/find_catches.py <path>` (defaults to `src/`). It locates
   `catch` blocks, `.catch(...)` handlers, and the specific `.catch(() => default)` /
   `.catch(() => [])` / empty-catch shapes that are the highest-risk swallows. Output is a
   list of `file:line` with the surrounding snippet and a heuristic flag.

2. **Read each site in context.** The script flags candidates; it does not decide. Open each
   file around the reported line. You need the surrounding function to judge intent — what
   operation is wrapped, whether the result is depended on, whether anything is logged.

3. **Classify into the three buckets.** For each site assign bucket 1/2/3 with a one-line
   reason. When genuinely ambiguous between 2 and 3, default to 2 (migration-needed) and note
   the ambiguity — it's safer to over-flag a real failure than to wave through a disguised one.

4. **Emit the table.** Always produce this exact structure so audits are comparable over time:

```
## Catch-Swallow Audit — <path> — <date>
Total sites: N

### Bucket 1 — Fire-and-forget (acceptable): <count>
| file:line | operation | why safe |

### Bucket 2 — Migration-needed (must fix): <count>
| file:line | operation | what's hidden | suggested fix |

### Bucket 3 — Gate-feeding (conditional): <count>
| file:line | operation | gate it feeds | legitimate? |

### Summary
- Highest-priority fixes (bucket 2, ranked by blast radius):
- Sites needing a human decision:
```

5. **Rank bucket 2 by blast radius.** Not all must-fix sites are equal. A swallowed Stripe
   webhook error outranks a swallowed read on a rarely-hit endpoint. Order the fixes so the
   user works top-down.

## Notes

- Don't propose rewrites in the table — propose the *category* of fix (rethrow / log+surface /
  add fallback observability). The user decides implementation.
- If the codebase has a logging convention already (e.g. a `logger` import, Sentry capture),
  note which bucket-2 sites are missing it specifically.
- One pass per service/directory. If asked to audit the whole repo, do it per top-level
  service area so the tables stay readable rather than one giant dump.
