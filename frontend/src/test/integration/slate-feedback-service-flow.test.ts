/**
 * Integration: Service ↔ apiClient ↔ fetch boundary
 *
 * Covers two service flows:
 *   A. SlateService CRUD (create → update → add pitch → reorder → remove pitch → delete)
 *   B. FeedbackService submit / update / delete lifecycle
 *
 * Both services use the real `apiClient` (from lib/api-client.ts) which talks to
 * `global.fetch`. We intercept at fetch so the real apiClient JSON-unwrapping,
 * retry logic, and 401-handling code all execute.
 *
 * No source files are modified.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// We do NOT mock apiClient — the real module runs through to global.fetch
// ---------------------------------------------------------------------------

// Dynamic imports after mock declarations
let SlateService: typeof import('../../services/slate.service').SlateService;
let FeedbackService: typeof import('../../services/feedback.service').FeedbackService;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal Response that satisfies what api-client needs */
function jsonResponse(body: unknown, status = 200): Response {
  const bodyStr = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') return 'application/json';
        return null;
      },
    },
    text: () => Promise.resolve(bodyStr),
    json: () => Promise.resolve(body),
    clone: function () { return this; },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: SlateService ↔ apiClient ↔ fetch', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();

    // Import real services after mocks are in place
    const slateMod = await import('../../services/slate.service');
    SlateService = slateMod.SlateService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // A-1: list slates
  // -------------------------------------------------------------------------
  describe('A-1: SlateService.list — GET /api/slates', () => {
    it('returns slates array from wrapped backend response', async () => {
      const slates = [
        { id: 1, title: 'My Slate', description: null, cover_image: null, status: 'draft', created_at: '2025-01-01', updated_at: '2025-01-01' },
        { id: 2, title: 'Published Slate', description: 'Desc', cover_image: null, status: 'published', created_at: '2025-01-02', updated_at: '2025-01-02' },
      ];
      // apiClient.get returns { success, data } where data = server's top-level
      // api-client unwraps: data.data || data, so respond with { success, data: { slates } }
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: { slates } })
      );

      const result = await SlateService.list();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('My Slate');
    });

    it('returns empty array when backend errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: 'DB connection failed' }, 500)
      );

      const result = await SlateService.list();

      expect(result).toEqual([]);
    });

    it('returns empty array when fetch throws (network failure)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('NetworkError when attempting to fetch resource')
      );

      const result = await SlateService.list();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // A-2: create slate
  // -------------------------------------------------------------------------
  describe('A-2: SlateService.create — POST /api/slates', () => {
    it('returns created slate from response', async () => {
      const newSlate = { id: 10, title: 'Horror Picks', description: 'My picks', cover_image: null, status: 'draft' as const, created_at: '2025-03-01', updated_at: '2025-03-01' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: newSlate })
      );

      const result = await SlateService.create({ title: 'Horror Picks', description: 'My picks' });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(10);
      expect(result?.title).toBe('Horror Picks');

      // Verify POST was called
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/slates');
      expect(init?.method).toBe('POST');
    });

    it('returns the apiClient error object (not null) on 4xx — wiring bug', async () => {
      // WIRING BUG: SlateService.create does `return res?.data ?? res ?? null`.
      // On a 4xx, apiClient returns { success:false, error:{...} } (does NOT throw).
      // res.data is undefined, so `?? res` kicks in — returning the error object,
      // not null as the interface implies. The service should check res.success.
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: 'Unauthorized' }, 401)
      );

      const result = await SlateService.create({ title: 'Fail Slate' });

      // Documents current (buggy) behavior: returns the apiClient error wrapper
      expect(result).not.toBeNull();
      expect((result as any)?.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // A-3: update slate
  // -------------------------------------------------------------------------
  describe('A-3: SlateService.update — PUT /api/slates/:id', () => {
    it('sends updated fields and returns updated slate', async () => {
      const updated = { id: 10, title: 'Sci-Fi Picks', description: null, cover_image: null, status: 'published' as const, created_at: '2025-03-01', updated_at: '2025-03-02' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: updated })
      );

      const result = await SlateService.update(10, { title: 'Sci-Fi Picks', status: 'published' });

      expect(result?.title).toBe('Sci-Fi Picks');
      expect(result?.status).toBe('published');

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/slates/10');
      expect(init?.method).toBe('PUT');
    });
  });

  // -------------------------------------------------------------------------
  // A-4: addPitch and removePitch
  // -------------------------------------------------------------------------
  describe('A-4: SlateService.addPitch / removePitch', () => {
    it('addPitch returns true on success', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true })
      );

      const ok = await SlateService.addPitch(10, 42);

      expect(ok).toBe(true);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/slates/10/pitches');
      expect(init?.method).toBe('POST');
    });

    it('addPitch returns true even on network error — wiring bug', async () => {
      // WIRING BUG: SlateService.addPitch uses try/catch but apiClient.post() swallows
      // errors internally (returns { success:false } instead of throwing). The service
      // catch() never fires. The method always returns true regardless of outcome.
      // Fix: check res.success before returning true.
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));

      const ok = await SlateService.addPitch(10, 42);

      // Documents current (buggy) behavior: always true even on network failure
      expect(ok).toBe(true);
    });

    it('removePitch calls DELETE and returns true on success', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true })
      );

      const ok = await SlateService.removePitch(10, 42);

      expect(ok).toBe(true);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/slates/10/pitches/42');
      expect(init?.method).toBe('DELETE');
    });
  });

  // -------------------------------------------------------------------------
  // A-5: reorderPitches
  // -------------------------------------------------------------------------
  describe('A-5: SlateService.reorderPitches', () => {
    it('sends pitch_ids in body and returns true on success', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true })
      );

      const ok = await SlateService.reorderPitches(10, [3, 1, 2]);

      expect(ok).toBe(true);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/slates/10/pitches/reorder');
      expect(init?.method).toBe('PUT');
      const body = JSON.parse(init?.body as string);
      expect(body.pitch_ids).toEqual([3, 1, 2]);
    });
  });

  // -------------------------------------------------------------------------
  // A-6: remove slate
  // -------------------------------------------------------------------------
  describe('A-6: SlateService.remove — DELETE /api/slates/:id', () => {
    it('returns true on 200', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true })
      );

      const ok = await SlateService.remove(10);

      expect(ok).toBe(true);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/slates/10');
      expect(init?.method).toBe('DELETE');
    });

    it('returns true even on network error — wiring bug (same as addPitch)', async () => {
      // WIRING BUG: Same issue as addPitch — apiClient.delete() never throws,
      // so the catch() in SlateService.remove() never fires. Always returns true.
      // Fix: check the returned res.success before returning true.
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network'));

      const ok = await SlateService.remove(10);

      // Documents current (buggy) behavior
      expect(ok).toBe(true);
    });
  });
});

// ===========================================================================
// Part B: FeedbackService ↔ apiClient ↔ fetch
// ===========================================================================

describe('Integration: FeedbackService ↔ apiClient ↔ fetch', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();

    const feedbackMod = await import('../../services/feedback.service');
    FeedbackService = feedbackMod.FeedbackService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // B-1: getFeedback
  // -------------------------------------------------------------------------
  describe('B-1: FeedbackService.getFeedback — GET /api/pitches/:id/feedback', () => {
    it('returns feedback response with ratings and entries', async () => {
      const feedback = {
        ratings: { pitchey_score: 8.0, viewer_score: 7.5, avg_rating: 7.75, total_reviews: 10, distribution: new Array(10).fill(0) },
        feedback: [
          { id: 1, reviewer_type: 'investor', rating: 8, strengths: ['Strong concept'], weaknesses: [], suggestions: [], overall_feedback: 'Good', is_interested: true, is_anonymous: false, created_at: '2025-01-01', reviewer_id: 5, reviewer_name: 'Alice', reviewer_company: null },
        ],
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: feedback })
      );

      const result = await FeedbackService.getFeedback(42);

      expect(result.ratings?.pitchey_score).toBe(8.0);
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0].reviewer_name).toBe('Alice');
    });

    it('returns empty default on network failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('net'));

      const result = await FeedbackService.getFeedback(42);

      expect(result.ratings).toBeNull();
      expect(result.feedback).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // B-2: submit feedback
  // -------------------------------------------------------------------------
  describe('B-2: FeedbackService.submit — POST /api/pitches/:id/feedback', () => {
    it('posts structured feedback and returns id', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: { id: 77 } })
      );

      const result = await FeedbackService.submit(42, {
        rating: 8,
        strengths: ['Great premise'],
        weaknesses: ['Pacing issues'],
        suggestions: ['Tighten act 2'],
        overall_feedback: 'Promising',
        is_interested: true,
        is_anonymous: false,
      });

      expect(result?.id).toBe(77);

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/pitches/42/feedback');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(init?.body as string);
      expect(body.rating).toBe(8);
      expect(body.strengths).toContain('Great premise');
    });

    it('returns null on server error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: 'Already reviewed' }, 409)
      );

      const result = await FeedbackService.submit(42, {
        rating: 5,
        strengths: [],
        weaknesses: [],
        suggestions: [],
      });

      // apiClient returns { success: false } on non-2xx; res.data is undefined → null
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // B-3: update feedback
  // -------------------------------------------------------------------------
  describe('B-3: FeedbackService.update — PUT /api/pitches/:id/feedback', () => {
    it('returns true on 2xx response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: { id: 77, created_at: '2025-01-01' } })
      );

      const ok = await FeedbackService.update(42, {
        rating: 9,
        strengths: ['Excellent'],
        weaknesses: [],
        suggestions: [],
      });

      expect(ok).toBe(true);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/pitches/42/feedback');
      expect(init?.method).toBe('PUT');
    });

    it('returns false on 4xx', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: 'Not found' }, 404)
      );

      const ok = await FeedbackService.update(42, { strengths: [], weaknesses: [], suggestions: [] });

      expect(ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // B-4: remove feedback
  // -------------------------------------------------------------------------
  describe('B-4: FeedbackService.remove — DELETE /api/pitches/:id/feedback', () => {
    it('returns true when backend confirms deletion', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: { success: true } })
      );

      const ok = await FeedbackService.remove(42);

      expect(ok).toBe(true);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/pitches/42/feedback');
      expect(init?.method).toBe('DELETE');
    });
  });

  // -------------------------------------------------------------------------
  // B-5: submitRating
  // -------------------------------------------------------------------------
  describe('B-5: FeedbackService.submitRating — POST /api/pitches/:id/rate', () => {
    it('returns true on 201 response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: { rating: 9 } }, 201)
      );

      const ok = await FeedbackService.submitRating(42, 9);

      expect(ok).toBe(true);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/pitches/42/rate');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(init?.body as string);
      expect(body.rating).toBe(9);
    });

    it('returns false on error without throwing', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network'));

      const ok = await FeedbackService.submitRating(42, 5);

      expect(ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // B-6: getConsumptionStatus
  // -------------------------------------------------------------------------
  describe('B-6: FeedbackService.getConsumptionStatus', () => {
    it('returns status object from backend', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: { eligible: true, viewDuration: 45, threshold: 30 } })
      );

      const status = await FeedbackService.getConsumptionStatus(42);

      expect(status.eligible).toBe(true);
      expect(status.viewDuration).toBe(45);
      expect(status.threshold).toBe(30);
    });

    it('returns default ineligible status on error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network'));

      const status = await FeedbackService.getConsumptionStatus(42);

      expect(status.eligible).toBe(false);
      expect(status.viewDuration).toBe(0);
      expect(status.threshold).toBe(30);
    });
  });

  // -------------------------------------------------------------------------
  // B-7: submitComment
  // -------------------------------------------------------------------------
  describe('B-7: FeedbackService.submitComment — POST /api/pitches/:id/comments', () => {
    it('returns true on 201 (api-client success flag)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: { id: 55 } }, 201)
      );

      const ok = await FeedbackService.submitComment(42, 'Great pitch!', false);

      expect(ok).toBe(true);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/pitches/42/comments');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(init?.body as string);
      expect(body.content).toBe('Great pitch!');
      expect(body.isAnonymous).toBe(false);
    });

    it('returns false when backend returns 4xx', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: 'Forbidden' }, 403)
      );

      const ok = await FeedbackService.submitComment(42, 'test comment');

      expect(ok).toBe(false);
    });

    it('sends isAnonymous flag for anonymous comments', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ success: true, data: { id: 56 } }, 201)
      );

      await FeedbackService.submitComment(42, 'Anonymous thought', true);

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(init?.body as string);
      expect(body.isAnonymous).toBe(true);
    });
  });
});
