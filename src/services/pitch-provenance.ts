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
function canonical(p: Record<string, unknown>): string {
  const norm = (v: unknown) =>
    v === null || v === undefined ? ''
    : typeof v === 'object' ? JSON.stringify(v)
    : String(v);
  return JSON.stringify({
    pitch_id: Number(p.id),
    creator_id: Number(p.user_id),
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

// Seal a pitch's current content. Idempotent (identical content never duplicates;
// changed content adds a new version row). Only seals PUBLISHED pitches. NEVER
// throws — provenance must never break publishing.
export async function sealPitchProvenance(sql: Sql, pitchId: number | string): Promise<void> {
  try {
    const rows = await sql`
      SELECT id, user_id, title, logline, short_synopsis, long_synopsis, synopsis,
             genre, format, themes, budget, status
      FROM pitches WHERE id = ${pitchId}
    `;
    const p = rows[0];
    if (!p || p.status !== 'published') return;

    const hash = await sha256Hex(canonical(p));

    // prev_hash chains to the creator's most recent seal → tamper-evident.
    const prevRows = await sql`
      SELECT content_hash FROM pitch_provenance
      WHERE creator_id = ${p.user_id} ORDER BY sealed_at DESC LIMIT 1
    `;
    const prevHash = (prevRows[0]?.content_hash as string | undefined) ?? null;

    const verRows = await sql`
      SELECT COUNT(*)::int AS n FROM pitch_provenance WHERE pitch_id = ${pitchId}
    `;
    const version = (Number(verRows[0]?.n) || 0) + 1;

    await sql`
      INSERT INTO pitch_provenance
        (pitch_id, creator_id, content_hash, algorithm, content_version, prev_hash, sealed_at)
      VALUES (${pitchId}, ${p.user_id}, ${hash}, 'sha256', ${version}, ${prevHash}, NOW())
      ON CONFLICT (content_hash) DO NOTHING
    `;
  } catch (err) {
    console.error('sealPitchProvenance error:', err instanceof Error ? err.message : String(err));
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
