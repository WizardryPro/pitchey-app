// Content-hash provenance for pitches ("Sealed on [date]").
//
// Seals the SUBSTANTIVE content of a published pitch with a SHA-256 timestamp so a
// creator can later prove the material existed on Pitchey before any disclosure.
// This protects the IDEA — it is independent of `verification_tier`, which is about
// trusting the PERSON. Uses the Workers global Web Crypto (`crypto.subtle`), NOT the
// node `crypto` module (the worker build externalises that).

// Loose type: callers pass the Neon tagged-template client (this.db.getSql()).
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Deterministic, fixed-key-order serialization of the substantive content. Volatile
// fields (view counts, timestamps, images) are excluded so the seal tracks the idea,
// not cosmetic churn. pitch_id + creator_id are included so the hash is globally
// unique (two different pitches can never collide).
function canonical(p: Record<string, unknown>, ownerId: number): string {
  const norm = (v: unknown) =>
    v === null || v === undefined ? ''
    : typeof v === 'object' ? JSON.stringify(v)
    : String(v);
  return JSON.stringify({
    pitch_id: Number(p.id),
    creator_id: Number(ownerId),
    title: norm(p.title),
    logline: norm(p.logline),
    short_synopsis: norm(p.short_synopsis),
    long_synopsis: norm(p.long_synopsis),
    synopsis: norm(p.synopsis),
    genre: norm(p.genre),
    format: norm(p.format),
    themes: norm(p.themes),
    budget: norm(p.budget),
  });
}

// Result of a seal attempt. `isNew` is true only when a NEW content_hash row was
// actually inserted (i.e. first publish, or content changed since the last seal) —
// callers use it to fire the "your pitch was sealed" email exactly once per seal,
// never on a no-op re-publish of identical content. Null is returned on error
// (sealing must never throw / never break publishing).
export interface SealResult {
  isNew: boolean;
  hash: string;
  sealedAt: string | null;
  version: number;
}

// Seal a pitch's current content. Idempotent (identical content never duplicates;
// changed content adds a new version row). Only seals PUBLISHED pitches. NEVER
// throws — provenance must never break publishing.
export async function sealPitchProvenance(sql: Sql, pitchId: number | string): Promise<SealResult | null> {
  try {
    const rows = await sql`
      SELECT id, user_id, creator_id, title, logline, short_synopsis, long_synopsis, synopsis,
             genre, format, themes, budget, status
      FROM pitches WHERE id = ${pitchId}
    `;
    const p = rows[0];
    if (!p || p.status !== 'published') return null;

    // Resolve the pitch's owner. The pitches table carries BOTH `user_id` and
    // `creator_id` due to historical schema drift; the rest of the codebase treats
    // creator_id as canonical when present (COALESCE(creator_id, user_id), e.g.
    // creator-dashboard.ts). Provenance must seal the ACTUAL owner, not whichever
    // column a given create-path happened to populate — otherwise a divergence bakes
    // the wrong creator into both the hash and the public "who sealed this" display.
    // NOTE (hash safety): for every currently-sealed pitch user_id === creator_id, so
    // this yields the identical creator_id and therefore the IDENTICAL content_hash —
    // no existing seal's "unchanged since sealed" guarantee is affected. It only
    // changes behaviour if the two columns ever diverge (the bug this prevents).
    const ownerId = Number(p.creator_id ?? p.user_id);
    if (p.creator_id != null && p.user_id != null && Number(p.creator_id) !== Number(p.user_id)) {
      // Divergence is a data-integrity signal worth surfacing (never throw — sealing
      // must not break publishing). Sealing proceeds with the canonical (creator_id).
      console.warn(JSON.stringify({
        level: 'warn',
        category: 'pitch_provenance',
        action: 'owner_column_divergence',
        pitch_id: Number(p.id),
        user_id: Number(p.user_id),
        creator_id: Number(p.creator_id),
        sealed_owner_id: ownerId,
      }));
    }

    const hash = await sha256Hex(canonical(p, ownerId));

    // prev_hash chains to the creator's most recent seal → tamper-evident.
    const prevRows = await sql`
      SELECT content_hash FROM pitch_provenance
      WHERE creator_id = ${ownerId} ORDER BY sealed_at DESC LIMIT 1
    `;
    const prevHash = (prevRows[0]?.content_hash as string | undefined) ?? null;

    const verRows = await sql`
      SELECT COUNT(*)::int AS n FROM pitch_provenance WHERE pitch_id = ${pitchId}
    `;
    const version = (Number(verRows[0]?.n) || 0) + 1;

    const inserted = await sql`
      INSERT INTO pitch_provenance
        (pitch_id, creator_id, content_hash, algorithm, content_version, prev_hash, sealed_at)
      VALUES (${pitchId}, ${ownerId}, ${hash}, 'sha256', ${version}, ${prevHash}, NOW())
      ON CONFLICT (content_hash) DO NOTHING
      RETURNING sealed_at, content_version
    `;

    // A returned row means a brand-new seal was written; empty means the identical
    // content was already sealed (ON CONFLICT no-op) — not a new seal, no email.
    if (inserted.length > 0) {
      return {
        isNew: true,
        hash,
        sealedAt: inserted[0].sealed_at as string,
        version: Number(inserted[0].content_version),
      };
    }
    return { isNew: false, hash, sealedAt: null, version };
  } catch (err) {
    console.error('sealPitchProvenance error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Badge data for getPitch: earliest seal date (the priority-of-idea claim) + the
// current content hash (for the verify link). Returns null if never sealed.
export async function getPitchSeal(
  sql: Sql, pitchId: number | string,
): Promise<{ sealed_at: string; content_hash: string } | null> {
  try {
    const rows = await sql`
      SELECT
        (SELECT MIN(sealed_at) FROM pitch_provenance WHERE pitch_id = ${pitchId}) AS sealed_at,
        (SELECT content_hash FROM pitch_provenance WHERE pitch_id = ${pitchId}
           ORDER BY sealed_at DESC LIMIT 1) AS content_hash
    `;
    const r = rows[0];
    if (!r || !r.sealed_at) return null;
    return { sealed_at: r.sealed_at as string, content_hash: r.content_hash as string };
  } catch {
    return null;
  }
}

// Public verify-by-hash. Returns ONLY non-sensitive fields — never the protected
// synopsis/content. The hash + date + creator + title IS the certificate.
export async function verifyProvenanceByHash(sql: Sql, hash: string): Promise<{
  sealed: boolean; sealed_at?: string; content_version?: number;
  creator_username?: string; pitch_title?: string; pitch_id?: number;
}> {
  try {
    const clean = String(hash || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(clean)) return { sealed: false };
    const rows = await sql`
      SELECT pr.sealed_at, pr.content_version, pr.pitch_id,
             u.username AS creator_username, p.title AS pitch_title
      FROM pitch_provenance pr
      JOIN pitches p ON p.id = pr.pitch_id
      JOIN users u ON u.id = pr.creator_id
      WHERE pr.content_hash = ${clean}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return { sealed: false };
    return {
      sealed: true,
      sealed_at: r.sealed_at as string,
      content_version: Number(r.content_version),
      creator_username: r.creator_username as string,
      pitch_title: r.pitch_title as string,
      pitch_id: Number(r.pitch_id),
    };
  } catch (err) {
    console.error('verifyProvenanceByHash error:', err instanceof Error ? err.message : String(err));
    return { sealed: false };
  }
}

// ---------------------------------------------------------------------------
// Certificate of Provenance — the downloadable evidence artifact.
//
// Unlike the PUBLIC verify endpoint (date+creator+title only), the certificate is
// OWNER-ONLY and content-INCLUSIVE: it embeds the exact sealed content alongside
// its hash, timestamp and chain, so the single document is self-contained proof of
// "this material existed on Pitchey on this date." The caller MUST enforce that the
// requester owns the pitch before rendering (the data includes user_id for that).
// ---------------------------------------------------------------------------

export interface CertificateData {
  pitch: {
    id: number; user_id: number; title: string; logline: string;
    short_synopsis: string; long_synopsis: string; synopsis: string;
    genre: string; format: string; themes: string; budget: string;
  };
  creator: { username: string; name: string; email: string };
  firstSealedAt: string;          // earliest seal = priority-of-idea date
  latestHash: string;
  latestSealedAt: string;
  versions: Array<{ version: number; hash: string; sealed_at: string; prev_hash: string | null }>;
  currentHash: string;            // hash of the pitch's content right now
  contentMatchesSeal: boolean;    // currentHash === latestHash (content unchanged since seal)
  ots: {
    status: 'none' | 'pending' | 'complete';  // OpenTimestamps / Bitcoin anchor state
    submittedAt: string | null;
    upgradedAt: string | null;
    blockHeight: number | null;
    calendars: string | null;
  };
}

// Fetch everything needed to render a certificate. Returns null if the pitch
// doesn't exist or was never sealed. Owner check is the CALLER's responsibility.
export async function getCertificateData(sql: Sql, pitchId: number | string): Promise<CertificateData | null> {
  try {
    const rows = await sql`
      SELECT p.id, p.user_id, p.creator_id, p.title, p.logline, p.short_synopsis, p.long_synopsis,
             p.synopsis, p.genre, p.format, p.themes, p.budget,
             u.username, u.name AS creator_name, u.email AS creator_email
      FROM pitches p JOIN users u ON u.id = p.user_id
      WHERE p.id = ${pitchId}
    `;
    const p = rows[0];
    if (!p) return null;

    const seals = await sql`
      SELECT content_hash, content_version, prev_hash, sealed_at,
             ots_proof, ots_calendars, ots_submitted_at, ots_upgraded_at, ots_block_height
      FROM pitch_provenance WHERE pitch_id = ${pitchId}
      ORDER BY content_version ASC
    `;
    if (!seals.length) return null;

    const latest = seals[seals.length - 1];
    const otsStatus: 'none' | 'pending' | 'complete' =
      latest.ots_upgraded_at ? 'complete' : (latest.ots_proof ? 'pending' : 'none');
    // Resolve the owner the SAME way sealPitchProvenance does (COALESCE(creator_id,
    // user_id)) so this "does current content still match the seal?" hash stays
    // comparable to the sealed hash. Hash-neutral where the columns agree.
    const ownerId = Number(p.creator_id ?? p.user_id);
    const currentHash = await sha256Hex(canonical(p, ownerId));

    return {
      pitch: {
        id: Number(p.id), user_id: Number(p.user_id),
        title: p.title ?? '', logline: p.logline ?? '',
        short_synopsis: p.short_synopsis ?? '', long_synopsis: p.long_synopsis ?? '',
        synopsis: p.synopsis ?? '', genre: p.genre ?? '', format: p.format ?? '',
        themes: typeof p.themes === 'object' ? JSON.stringify(p.themes) : (p.themes ?? ''),
        budget: p.budget ?? '',
      },
      creator: {
        username: p.username ?? '', name: p.creator_name ?? '', email: p.creator_email ?? '',
      },
      firstSealedAt: seals[0].sealed_at as string,
      latestHash: latest.content_hash as string,
      latestSealedAt: latest.sealed_at as string,
      versions: seals.map((s: Record<string, unknown>) => ({
        version: Number(s.content_version),
        hash: s.content_hash as string,
        sealed_at: s.sealed_at as string,
        prev_hash: (s.prev_hash as string | null) ?? null,
      })),
      currentHash,
      contentMatchesSeal: currentHash === (latest.content_hash as string),
      ots: {
        status: otsStatus,
        submittedAt: (latest.ots_submitted_at as string | null) ?? null,
        upgradedAt: (latest.ots_upgraded_at as string | null) ?? null,
        blockHeight: latest.ots_block_height != null ? Number(latest.ots_block_height) : null,
        calendars: (latest.ots_calendars as string | null) ?? null,
      },
    };
  } catch (err) {
    console.error('getCertificateData error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Submit a freshly-sealed content hash to the OpenTimestamps calendars and store the
// pending .ots proof. Best-effort; never throws (must not break publishing). Only
// fills a row that has no proof yet (idempotent on re-publish).
export async function submitProvenanceToOts(sql: Sql, contentHash: string): Promise<void> {
  try {
    const { createOtsForDigest } = await import('./opentimestamps');
    const out = await createOtsForDigest(contentHash);
    if (!out) return;
    await sql`
      UPDATE pitch_provenance
      SET ots_proof = ${out.otsBase64}, ots_calendars = ${out.calendars.join(',')}, ots_submitted_at = NOW()
      WHERE content_hash = ${contentHash} AND ots_proof IS NULL
    `;
  } catch (err) {
    console.error('submitProvenanceToOts error:', err instanceof Error ? err.message : String(err));
  }
}

// Lazily upgrade a pending proof to a Bitcoin-attested one. Called on certificate /
// .ots download. No-op until the proof is >1h old (Bitcoin confirmation takes hours)
// and until a calendar actually returns the attestation. Best-effort; never throws.
export async function maybeUpgradeProvenanceOts(sql: Sql, contentHash: string): Promise<void> {
  try {
    const rows = await sql`
      SELECT ots_proof, ots_submitted_at FROM pitch_provenance
      WHERE content_hash = ${contentHash} AND ots_proof IS NOT NULL AND ots_upgraded_at IS NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (!row?.ots_proof) return;
    if (row.ots_submitted_at) {
      const ageMs = Date.now() - new Date(row.ots_submitted_at as string).getTime();
      if (ageMs < 60 * 60 * 1000) return;          // < 1h: Bitcoin not confirmed yet
    }
    const { upgradeOts } = await import('./opentimestamps');
    const up = await upgradeOts(row.ots_proof as string);
    if (up?.complete) {
      await sql`
        UPDATE pitch_provenance
        SET ots_proof = ${up.otsBase64}, ots_upgraded_at = NOW(), ots_block_height = ${up.blockHeight ?? null}
        WHERE content_hash = ${contentHash}
      `;
    }
  } catch (err) {
    console.error('maybeUpgradeProvenanceOts error:', err instanceof Error ? err.message : String(err));
  }
}

// Cron sweep (hourly): submit any seals that lack a proof, and upgrade pending proofs
// older than 1h. Decouples the slow calendar round-trips from the publish path. Best-
// effort and bounded (LIMIT) so a backlog can't blow the cron budget; the next run
// picks up the rest. Creates its own Neon client from env (cron has no request db).
export async function sweepProvenanceOts(env: any): Promise<{ submitted: number; upgraded: number }> {
  const url = env?.DATABASE_URL;
  if (!url) return { submitted: 0, upgraded: 0 };
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url) as unknown as Sql;
  let submitted = 0, upgraded = 0;
  try {
    const toSubmit = await sql`
      SELECT content_hash FROM pitch_provenance
      WHERE ots_proof IS NULL ORDER BY sealed_at DESC LIMIT 20
    `;
    for (const r of toSubmit) { await submitProvenanceToOts(sql, r.content_hash as string); submitted++; }

    const toUpgrade = await sql`
      SELECT content_hash FROM pitch_provenance
      WHERE ots_proof IS NOT NULL AND ots_upgraded_at IS NULL
        AND ots_submitted_at < NOW() - INTERVAL '1 hour'
      ORDER BY ots_submitted_at ASC LIMIT 20
    `;
    for (const r of toUpgrade) { await maybeUpgradeProvenanceOts(sql, r.content_hash as string); upgraded++; }
  } catch (err) {
    console.error('sweepProvenanceOts error:', err instanceof Error ? err.message : String(err));
  }
  return { submitted, upgraded };
}

// Fetch the raw .ots proof for download. Returns ownerId for the caller's owner check.
export async function getProvenanceOts(
  sql: Sql, pitchId: number | string,
): Promise<{ ownerId: number; otsBase64: string; hash: string } | null> {
  try {
    const rows = await sql`
      SELECT pr.creator_id, pr.ots_proof, pr.content_hash
      FROM pitch_provenance pr
      WHERE pr.pitch_id = ${pitchId} AND pr.ots_proof IS NOT NULL
      ORDER BY pr.content_version DESC LIMIT 1
    `;
    const r = rows[0];
    if (!r?.ots_proof) return null;
    return { ownerId: Number(r.creator_id), otsBase64: r.ots_proof as string, hash: r.content_hash as string };
  } catch (err) {
    console.error('getProvenanceOts error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  } catch { return String(v); }
}

// Render the certificate as a self-contained, print-optimized HTML page. Workers
// can't produce a real PDF (see nda-pdf.service.ts) — the page carries a "Save as
// PDF" button that triggers the browser's print-to-PDF. `verifyBaseUrl` is the
// public frontend origin so the printed QR/text link resolves for third parties.
export function renderCertificateHTML(data: CertificateData, opts: { verifyBaseUrl: string }): string {
  const base = (opts.verifyBaseUrl || '').replace(/\/+$/, '');
  const verifyUrl = `${base}/verify/p/${data.latestHash}`;
  const creatorLabel = data.creator.name?.trim()
    ? `${esc(data.creator.name)} (@${esc(data.creator.username)})`
    : `@${esc(data.creator.username)}`;

  const contentRow = (label: string, value: string) => value && value.trim()
    ? `<div class="field"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`
    : '';

  const historyRows = data.versions.map((v) => `
    <tr>
      <td>v${v.version}</td>
      <td>${esc(fmtDate(v.sealed_at))}</td>
      <td class="mono">${esc(v.hash)}</td>
    </tr>`).join('');

  const integrity = data.contentMatchesSeal
    ? `<span class="ok">✓ The pitch content is UNCHANGED since it was sealed.</span>`
    : `<span class="warn">⚠ The pitch content has been edited since the latest seal below. The content shown here corresponds to hash <span class="mono">${esc(data.currentHash)}</span>.</span>`;

  const otsBlock = (() => {
    if (data.ots.status === 'complete') {
      return `<div class="seal-box" style="border-color:#a7f3d0;background:#f0fdf4;">
        <div class="field"><div class="value"><span class="ok">✓ Independently anchored to the Bitcoin blockchain.</span></div></div>
        ${data.ots.blockHeight ? `<div class="field"><div class="label">Bitcoin block</div><div class="value">#${esc(String(data.ots.blockHeight))}</div></div>` : ''}
        <div class="field"><div class="label">Confirmed</div><div class="value">${esc(fmtDate(data.ots.upgradedAt))}</div></div>
        <p style="font-size:12px;color:var(--muted);margin:6px 0 0;">The content hash above is embedded in the Bitcoin blockchain, proving it existed before this block. No party — including Pitchey — can backdate or forge this timestamp.</p>
        <p style="font-size:13px;margin:8px 0 0;"><a href="/api/pitches/${data.pitch.id}/provenance.ots">Download the machine-verifiable .ots proof file</a></p>
      </div>`;
    }
    if (data.ots.status === 'pending') {
      return `<div class="seal-box">
        <div class="field"><div class="value">⏳ Submitted to the OpenTimestamps calendars on <strong>${esc(fmtDate(data.ots.submittedAt))}</strong> — awaiting Bitcoin confirmation (typically a few hours).</div></div>
        <p style="font-size:12px;color:var(--muted);margin:6px 0 0;">Once confirmed, this seal is provable against the Bitcoin blockchain independently of Pitchey. The .ots proof file can also be verified now with standard OpenTimestamps tooling.</p>
        <p style="font-size:13px;margin:8px 0 0;"><a href="/api/pitches/${data.pitch.id}/provenance.ots">Download the .ots proof file</a></p>
      </div>`;
    }
    return '';
  })();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Certificate of Provenance — ${esc(data.pitch.title)}</title>
<style>
  :root { --ink:#1a1a2e; --muted:#6b7280; --line:#e5e7eb; --accent:#059669; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: var(--ink);
         max-width: 800px; margin: 0 auto; padding: 48px 40px; line-height: 1.55;
         background: #fff; }
  .toolbar { text-align: right; margin-bottom: 24px; }
  .toolbar button { font-family: system-ui, sans-serif; font-size: 14px; cursor: pointer;
    background: var(--accent); color: #fff; border: 0; border-radius: 8px;
    padding: 10px 18px; }
  header { text-align: center; border-bottom: 3px double var(--ink); padding-bottom: 20px; margin-bottom: 28px; }
  header .crest { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: var(--muted); }
  header h1 { font-size: 28px; margin: 8px 0 4px; }
  header .sub { color: var(--muted); font-size: 14px; }
  .statement { font-size: 15px; background: #f9fafb; border-left: 3px solid var(--accent);
    padding: 14px 18px; margin: 0 0 28px; }
  h2 { font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted);
    border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 28px 0 14px; }
  .field { margin-bottom: 12px; }
  .field .label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
  .field .value { font-size: 16px; white-space: pre-wrap; }
  .mono { font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 12px; word-break: break-all; }
  .seal-box { border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; background: #fafdfb; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-family: system-ui, sans-serif; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
  .ok { color: var(--accent); font-weight: bold; }
  .warn { color: #b45309; font-weight: bold; }
  .verify { text-align: center; margin: 28px 0; padding: 16px; border: 1px dashed var(--line); border-radius: 10px; }
  .verify a { color: #2563eb; }
  footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid var(--line);
    font-size: 11px; color: var(--muted); text-align: center; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Save as PDF / Print</button></div>

  <header>
    <div class="crest">Pitchey · Content Provenance</div>
    <h1>Certificate of Provenance</h1>
    <div class="sub">Tamper-evident proof of authorship and priority of idea</div>
  </header>

  <p class="statement">
    This certifies that the creative material described below was recorded on the
    Pitchey platform and cryptographically sealed (SHA-256) on
    <strong>${esc(fmtDate(data.firstSealedAt))}</strong>. The seal establishes that
    this content existed in this form on that date. ${integrity}
  </p>

  <h2>Creator</h2>
  <div class="field"><div class="value">${creatorLabel}</div></div>

  <h2>Sealed Work</h2>
  ${contentRow('Title', data.pitch.title)}
  ${contentRow('Logline', data.pitch.logline)}
  ${contentRow('Genre', data.pitch.genre)}
  ${contentRow('Format', data.pitch.format)}
  ${contentRow('Themes', data.pitch.themes)}
  ${contentRow('Short Synopsis', data.pitch.short_synopsis)}
  ${contentRow('Synopsis', data.pitch.long_synopsis || data.pitch.synopsis)}

  <h2>Cryptographic Seal</h2>
  <div class="seal-box">
    <div class="field"><div class="label">Content hash (SHA-256)</div><div class="value mono">${esc(data.latestHash)}</div></div>
    <div class="field"><div class="label">First sealed</div><div class="value">${esc(fmtDate(data.firstSealedAt))}</div></div>
    <div class="field"><div class="label">Latest seal</div><div class="value">${esc(fmtDate(data.latestSealedAt))}</div></div>
  </div>

  ${otsBlock ? `<h2>Independent Timestamp (OpenTimestamps · Bitcoin)</h2>${otsBlock}` : ''}

  ${data.versions.length > 1 ? `<h2>Seal History (tamper-evident chain)</h2>
  <table><thead><tr><th>Version</th><th>Sealed</th><th>Content hash</th></tr></thead>
  <tbody>${historyRows}</tbody></table>` : ''}

  <div class="verify">
    Anyone can independently verify this seal at<br>
    <a href="${esc(verifyUrl)}">${esc(verifyUrl)}</a>
  </div>

  <footer>
    Generated by Pitchey for pitch #${data.pitch.id}. The hash is computed over the
    substantive content (title, logline, synopses, genre, format, themes, budget).
    This certificate is evidence of priority; it is not a registration of copyright.
  </footer>
</body>
</html>`;
}
