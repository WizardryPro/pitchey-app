---
id: sig-2026-06-25-006
date: 2026-06-25
severity: high
source: audit-type-errors
status: confirmed
---

**Finding:** src/services/notification.service.ts — 9× TS2339: NotificationPreferences type missing quietHours*/timezone/ndaNotifications/etc. Type drift on a live notification path.

**Evidence:**
```
src/services/notification.service.ts(933-978): error TS2339: Property 'quietHoursEnabled'/'timezone'/'ndaNotifications'/... does not exist on type 'NotificationPreferences'.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — reached via notification-integration.service.ts → worker-integrated.ts:149 (instantiated :798).

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
