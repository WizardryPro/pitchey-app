// Regression guard for the provenance owner-resolution hardening.
//
// The pitches table carries BOTH `user_id` and `creator_id` (schema drift). The
// seal must record the pitch's ACTUAL owner, and — critically — must produce the
// SAME content_hash it always did for pitches where the two columns agree (every
// currently-sealed pitch), so no existing "unchanged since sealed" guarantee moves.
import { describe, it, expect, vi } from 'vitest';
import { sealPitchProvenance, sha256Hex } from '../pitch-provenance';

// Minimal tagged-template mock of the Neon client. Routes each query to a canned
// result by matching a substring, and records the INSERT bind values so we can
// assert which owner id was sealed.
function mockSql(pitchRow: Record<string, unknown>) {
  const inserted: { creatorId?: unknown; hash?: unknown } = {};
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = strings.join('?');
    if (q.includes('FROM pitches WHERE id')) return Promise.resolve([pitchRow]);
    if (q.includes('SELECT content_hash FROM pitch_provenance')) return Promise.resolve([]); // no prev
    if (q.includes('COUNT(*)')) return Promise.resolve([{ n: 0 }]);
    if (q.includes('INSERT INTO pitch_provenance')) {
      // VALUES (${pitchId}, ${ownerId}, ${hash}, 'sha256', ${version}, ${prevHash}, NOW())
      inserted.creatorId = values[1];
      inserted.hash = values[2];
      return Promise.resolve([{ sealed_at: '2026-07-01T00:00:00Z', content_version: 1 }]);
    }
    return Promise.resolve([]);
  };
  return { sql: sql as any, inserted };
}

const baseContent = {
  id: 4343, title: 'Bob', logline: 'x', short_synopsis: '', long_synopsis: '',
  synopsis: '', genre: 'drama', format: 'feature', themes: '', budget: '1',
  status: 'published',
};

// Recompute the expected hash the same way canonical() does, to prove the sealed
// hash is a function of the resolved owner id (and unchanged when the columns agree).
async function expectedHash(ownerId: number) {
  const p = baseContent as Record<string, unknown>;
  const norm = (v: unknown) => v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const canonical = JSON.stringify({
    pitch_id: Number(p.id), creator_id: Number(ownerId), title: norm(p.title),
    logline: norm(p.logline), short_synopsis: norm(p.short_synopsis), long_synopsis: norm(p.long_synopsis),
    synopsis: norm(p.synopsis), genre: norm(p.genre), format: norm(p.format), themes: norm(p.themes), budget: norm(p.budget),
  });
  return sha256Hex(canonical);
}

describe('sealPitchProvenance owner resolution', () => {
  it('seals user_id when user_id === creator_id, and the hash is unchanged (hash-neutral)', async () => {
    const { sql, inserted } = mockSql({ ...baseContent, user_id: 1049, creator_id: 1049 });
    const res = await sealPitchProvenance(sql, 4343);
    expect(res?.isNew).toBe(true);
    expect(inserted.creatorId).toBe(1049);
    expect(inserted.hash).toBe(await expectedHash(1049));
  });

  it('seals the canonical creator_id when the columns diverge, and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // user_id is a stale/tester id (1007); creator_id is the real owner (1049).
    const { sql, inserted } = mockSql({ ...baseContent, user_id: 1007, creator_id: 1049 });
    const res = await sealPitchProvenance(sql, 4343);
    expect(res?.isNew).toBe(true);
    expect(inserted.creatorId).toBe(1049);              // real owner, not the tester
    expect(inserted.hash).toBe(await expectedHash(1049));
    expect(warn).toHaveBeenCalled();                    // divergence surfaced
    const logged = JSON.parse((warn.mock.calls[0][0]) as string);
    expect(logged.action).toBe('owner_column_divergence');
    expect(logged.sealed_owner_id).toBe(1049);
    warn.mockRestore();
  });

  it('falls back to user_id when creator_id is null', async () => {
    const { sql, inserted } = mockSql({ ...baseContent, user_id: 1049, creator_id: null });
    await sealPitchProvenance(sql, 4343);
    expect(inserted.creatorId).toBe(1049);
  });
});
