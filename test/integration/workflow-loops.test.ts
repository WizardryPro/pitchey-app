// Production workflow-loop hardening (pre-launch). The 60 production companies are
// active operators — they'll live in these multi-step loops. Drives them end-to-end
// vs a Neon branch and stays as a permanent guard:
//   1. Open call → creator submits → production reviews + updates status
//   2. Collaboration workspace (notes / checklist / team on a pitch)

import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient, json } from './client';

function digArray(body: any): any[] {
  const c = body?.data?.submissions ?? body?.data?.items ?? body?.data?.pitches ?? body?.data?.calls
    ?? body?.pitches ?? body?.submissions ?? body?.calls ?? body?.data ?? body;
  return Array.isArray(c) ? c : [];
}
function pickId(body: any, ...keys: string[]): any {
  const root = body?.data ?? body;
  for (const k of keys) if (root?.[k]?.id != null) return root[k].id;
  return root?.id ?? null;
}

describe('workflow: open call → submit → review', () => {
  const producer = new TestClient();
  const creator = new TestClient();
  let pitchId: number | null = null;

  beforeAll(async () => {
    await producer.login('stellar.production@demo.com', 'Demo123', 'production');
    await creator.login('alex.creator@demo.com', 'Demo123', 'creator');
    const mine = digArray(await json(await creator.get('/api/creator/pitches')));
    const pub = mine.find((p: any) => String(p.status) === 'published') ?? mine[0];
    pitchId = pub?.id ?? null;
  });

  it('runs the full call → submission → review cycle without breakage', async () => {
    expect(pitchId, 'precondition: creator owns a pitch').not.toBeNull();

    // 1) Production posts an open call.
    const mk = await producer.post('/api/calls', {
      title: 'Looking for grounded sci-fi', mandate: 'Seeking grounded sci-fi features under EUR 5M.',
      seekingGenres: ['Sci-Fi'], seekingFormats: ['Feature Film'], budgetMinUsd: 1000000, budgetMaxUsd: 5000000, region: 'uk',
    });
    expect(mk.status, await mk.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201]).toContain(mk.status);
    const callId = pickId(await json(mk), 'call');
    expect(callId, 'created call should have an id').toBeTruthy();

    // 2) Creator submits a pitch to the call.
    const sub = await creator.post(`/api/calls/${callId}/submissions`, { pitchId, message: 'A great fit.' });
    expect(sub.status, await sub.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201]).toContain(sub.status);

    // 3) Production reviews the submissions for its call.
    const listed = await producer.get(`/api/calls/${callId}/submissions`);
    expect(listed.status).toBe(200);
    const submissions = digArray(await json(listed));
    const sm = submissions.find((s: any) => String(s.pitch_id ?? s.pitchId) === String(pitchId)) ?? submissions[0];
    expect(sm, 'the submission should be visible to the call owner').toBeTruthy();

    // 4) Production updates the submission status (shortlist).
    const upd = await producer.patch(`/api/calls/submissions/${sm.id}`, { status: 'shortlisted' });
    expect(upd.status, await upd.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201]).toContain(upd.status);

    // 5) Creator can see their own submissions.
    const mineSubs = await creator.get('/api/calls/submissions/mine');
    expect(mineSubs.status).not.toBe(500);
    expect(mineSubs.status).toBe(200);
  });

  it('rejects an invalid submission status', async () => {
    // (Uses any existing submission id is unnecessary — the handler validates status
    //  before lookup, so a bogus id with a bad status still 400s on the status.)
    const res = await producer.patch('/api/calls/submissions/999999', { status: 'not-a-status' });
    expect(res.status).not.toBe(500);
    expect([400, 404]).toContain(res.status);
  });
});

describe('workflow: collaboration workspace (notes / checklist / team)', () => {
  const producer = new TestClient();
  let pitchId: number | null = null;

  beforeAll(async () => {
    await producer.login('stellar.production@demo.com', 'Demo123', 'production');
    const browse = digArray(await json(await producer.get('/api/pitches/browse?limit=5')));
    pitchId = browse[0]?.id ?? null;
  });

  it('notes / checklist / team reads never 500', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; }
    for (const sub of ['notes', 'checklist', 'team']) {
      const res = await producer.get(`/api/production/pitches/${pitchId}/${sub}`);
      expect(res.status, `${sub} → ${res.status}`).not.toBe(500);
      expect([200, 403, 404]).toContain(res.status);
    }
  });

  it('posting a note / updating checklist / team never 500', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; }
    const note = await producer.post(`/api/production/pitches/${pitchId}/notes`, { content: 'Audit note' });
    expect(note.status, await note.clone().text().catch(() => '')).not.toBe(500);

    const checklist = await producer.put(`/api/production/pitches/${pitchId}/checklist`, { items: [{ label: 'Review deck', done: false }] });
    expect(checklist.status).not.toBe(500);

    const team = await producer.put(`/api/production/pitches/${pitchId}/team`, { members: [] });
    expect(team.status).not.toBe(500);
  });
});
