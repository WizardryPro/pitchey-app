# Scope — Collaboration NDA (creators sign the Platform Standard NDA on joining a company)

**Date:** 2026-06-05 · **Status:** SCOPE ONLY — awaiting approval before Phase 1.
**Goal:** When a creator joins a production company via a B3 join code, they sign the **Platform Standard NDA** (click-to-sign) before getting workspace access. Producer sees per-seat NDA status; an auto-generated PDF lands in both parties' records.

## Two NDAs — keep them distinct
| | Access NDA (exists) | **Collaboration NDA (this)** |
|---|---|---|
| Who signs | investor/production evaluating | **creator joining a company** |
| Over what | a creator's pitch (full script) | the **company's** project IP |
| Scope | per-pitch | **per-company (team)** — sign once, covers all its projects |
| Mechanism | credit-based request → owner approves → sign | **free click-to-sign at join** |
| Table | `ndas` (pitch_id NOT NULL) | **new `company_nda_signatures`** |

The `ndas` table is pitch-scoped and pulled into the credit/approve flow — do NOT overload it. New table, clean separation.

## 1. Data model — `company_nda_signatures` (migration 099)
Immutable audit record (don't store the legally-meaningful signature only as a mutable flag on `team_members`):
```sql
CREATE TABLE IF NOT EXISTS company_nda_signatures (
  id              SERIAL PRIMARY KEY,
  team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  signer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'signed' CHECK (status IN ('signed','revoked')),
  nda_version     TEXT NOT NULL,            -- which template revision was agreed
  signed_name     TEXT NOT NULL,            -- typed full legal name
  signed_address  TEXT,                     -- address-at-signing (the existing open follow-up)
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      INET,
  user_agent      TEXT,
  signature_data  JSONB,                    -- {agreedCheckbox, renderedHash, ...}
  document_url    TEXT,                      -- generated countersigned PDF (R2)
  revoked_at      TIMESTAMPTZ,
  UNIQUE(team_id, signer_id)
);
```
Source of truth for "has creator X signed company Y's NDA." `team_members` stays as-is; the gate joins this table.

## 2. The flow
1. Creator redeems join code → `joinTeamByCodeHandler` inserts `team_members` role `member` (unchanged) — but they're **NDA-pending** (no `company_nda_signatures` row yet).
2. On their dashboard / first attempt to open a company project, they're prompted to **sign the Platform Standard NDA**, rendered via `/api/ndas/standard` with **company-context autofill** (`disclosingName` = company, `recipientName` = creator, `recipientAddress` = creator's, `projectName` = "all [Company] projects") — the endpoint already accepts these params, no `pitchId` needed.
3. Read → tick **"I have read and agree to be bound"** + type **full legal name** (+ address) → **Sign**.
4. Backend writes a `company_nda_signatures` row (version, name, address, IP, UA, signature_data) and `ctx.waitUntil`-generates a **PDF** (reuse `NDAFPDFGenerationService`), stores it in R2, sets `document_url`.
5. On sign → **full collaborator** (workspace edit unlocks).
6. Producer's **"Invite Creators" card** shows each seat as **Pending / Signed ✓** (+ link to the signed PDF). Creator can re-download their copy.
7. **Fallback** (edge case — wet-ink / bespoke terms): allow uploading an externally-signed copy that the producer marks verified. Not the default path.

## 3. Backend
- `GET  /api/teams/:id/collaboration-nda` — returns the rendered NDA + the signer's current status (signed/pending) for the acting creator.
- `POST /api/teams/:id/collaboration-nda/sign` — body `{ agreed:true, name, address }`; validates the member belongs to the team, writes the signature row (captures IP/UA from request), kicks off PDF gen. Idempotent (UNIQUE).
- `GET  /api/teams/:id/members` (or extend the existing code/seat endpoint) — returns each member + NDA status for the producer's card.
- **Gate in `resolveWorkspace` (production-pitch-data.ts):** for a production-owned pitch, the member branch becomes `isTeamMember && hasSignedCompanyNda(team_id, userId)`. Until signed → `canView=false`/`canEdit=false` (member sees the sign prompt, not the materials). Owner unaffected. NDA-signed external producers unaffected.
- **Gate in the creator-companies endpoint** (`/api/creator/companies`): annotate each company with `ndaSigned` so the dashboard can show "Sign NDA to collaborate".

## 4. Frontend
- New **`CollaborationNdaModal`** (or a `/creator/companies/:teamId/nda` page): renders the standard NDA (reuse the `StandardNDA.tsx` render — it's currently read-only; factor the body into a shared viewer), plus the agree-checkbox + name/address inputs + Sign button. Posts to the sign endpoint.
- **CreatorCollaborations card:** companies with `ndaSigned=false` show a **"Sign NDA to collaborate"** badge/CTA instead of opening projects; signed companies open normally.
- **ProductionPitchView (member, NDA-pending):** the Access card / workspace shows "Sign the [Company] collaboration NDA to start editing" → opens the modal. (Replaces the "You're collaborating…" note from PR #208 for the *pending* sub-state.)
- **Producer CompanyJoinCodeCard:** per-seat list with Pending / Signed ✓ + PDF link.

## 5. Reused infra (low build cost)
- NDA text + company autofill: `getStandardNda` (`/api/ndas/standard`) — already param-driven.
- PDF: `NDAFPDFGenerationService` (HTML→PDF + text fallback) → R2 (existing buckets).
- Template version: the `notification_templates`/089 standard-NDA row already carries the text + an implicit version; capture a version string at sign time.

## 6. Decisions
- **D1 — pre-sign access:** signed gate blocks **both view+edit** of the workspace (member sees only the sign prompt). *(alt: allow read-only pre-sign — weaker protection, not recommended.)*
- **D2 — scope:** **per-company** (one signature covers all that company's current+future projects). *(alt: per-pitch — heavier, not what "join the company" implies.)*
- **D3 — record:** dedicated `company_nda_signatures` table (recommended) vs columns on `team_members`.
- **D4 — re-sign on version bump:** if the platform NDA text changes, do existing members re-sign? **v1: no** (their signed version is recorded); flag for later.
- **D5 — PDF countersignature:** generate a PDF stamped with the creator's signature block + the company as disclosing party. Producer's counter-signature is implicit (they issued the code) — or add an explicit producer-sign step? **v1: implicit**, note for later.
- **D6 — fallback upload path:** include the wet-ink upload+verify fallback in v1, or defer? **Recommend defer** — click-to-sign covers the platform standard NDA; add upload only if a company needs it.

## 7. Phasing (stop between)
- **Phase 1 — DB + backend:** migration 099, the 2 sign/status endpoints, the `resolveWorkspace` gate + `hasSignedCompanyNda`, creator-companies `ndaSigned` annotation. Smoke: member can't edit until signed; signing unlocks.
- **Phase 2 — frontend sign flow:** the NDA modal + creator-dashboard CTA + pending-state prompt in the pitch view.
- **Phase 3 — producer visibility + PDF:** per-seat status on the join-code card, PDF generation + R2 + download links.
- **Phase 4 (optional):** wet-ink upload fallback (D6), version-bump re-sign (D4), explicit producer counter-sign (D5).

## Open questions for you
- Q1: confirm **per-company, sign-once** (D2) and **block view+edit pre-sign** (D1).
- Q2: defer the wet-ink upload fallback to Phase 4 (D6)?
- Q3: is the lawyer-drafted standard NDA's text appropriate for the creator↔company direction as-is, or does it need a collaboration-specific variant? (It was drafted "per pitch and signer" — worth a quick legal sanity check before relying on it for company collaboration.)
