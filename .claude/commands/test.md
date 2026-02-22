---
description: Run tests, write new tests, or check coverage for Pitchey platform
allowed-tools: Bash(npm run:*), Bash(npx vitest:*), Bash(curl:*), Read, Task
argument-hint: [test-type | write <batch> | coverage]
---

## Test Suite Execution

Requested test type: $ARGUMENTS

## Your Task

### If "write" specified — Launch test-writer agent(s)

Parse the batch argument after "write":

| Argument | Action |
|----------|--------|
| `write production` | Launch test-writer for Batch 1 (Production Portal — 25 pages at 0%) |
| `write creator` | Launch test-writer for Batch 2 (Creator Portal — 11 untested pages) |
| `write admin` | Launch test-writer for Batch 3 (Admin Portal — 5 pages at 0%) |
| `write shared` | Launch test-writer for Batch 4 (Shared Pages — ~35 pages) |
| `write investor` | Launch test-writer for Batch 5 (Investor Portal — untested pages) |
| `write services` | Launch test-writer for Batch 6 (24 untested services) |
| `write` (no arg) | Auto-pick lowest-coverage batch (Production → Admin → Creator → Shared → Investor → Services) |

For each batch, use the Task tool with `subagent_type: "test-writer"` and provide:
1. The list of source files to test (from the batch definition in CLAUDE.md)
2. The portal type and user_type for mock configuration
3. Instructions to run each test after writing, fix failures (max 3 attempts), then run the full suite

For large batches (10+ pages), split into sub-batches and launch parallel agents:
- Production: 3 parallel agents (1a: Core, 1b: Submissions, 1c: Projects+Settings)
- Creator: 2 parallel agents (2a: Core, 2b: Features)
- Shared: 3 parallel agents (4a: Browse, 4b: Auth+Landing, 4c: Features)

After all agents complete, run the full test suite and report total tests added.

### If "coverage" specified:
1. Run: `cd /opt/enterprise/site-a/frontend && npx vitest run --coverage`
2. Report coverage summary by directory:
   - pages/production/ — X%
   - pages/creator/ — X%
   - pages/Admin/ — X%
   - pages/investor/ — X%
   - pages/ (shared) — X%
   - services/ — X%
3. Identify top 10 untested files by size

### If no specific test type provided:
1. Run TypeScript type checking: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
2. Run frontend tests: `cd frontend && npx vitest run`
3. Test API health: `curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health`
4. Test demo accounts login

### If "auth" or "authentication" specified:
Test all three portal authentications:
1. Creator login: `alex.creator@demo.com` / `Demo123`
2. Investor login: `sarah.investor@demo.com` / `Demo123`
3. Production login: `stellar.production@demo.com` / `Demo123`

### If "performance" specified:
1. Check response times for key endpoints
2. Test database query performance
3. Verify Redis cache hit rates
4. Monitor WebSocket connection stability

### If "integration" specified:
1. Test frontend-backend connection
2. Verify WebSocket real-time features
3. Check file upload to R2
4. Test NDA workflow end-to-end

Report all test results with pass/fail status and any errors encountered.
