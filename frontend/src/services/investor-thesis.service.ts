// Investor Thesis Service
//
// A structured investment mandate is the monetization foundation: it's the
// machine-readable version of the prose thesis that used to live in the
// investor profile's `bio` textarea. It powers targeted creator/producer
// outreach and (later) matching. This is a DEDICATED resource, separate from
// the generic /api/user/profile, so the thesis can be revised and surfaced
// independently of identity/fund/NDA-address fields.
//
// Contract (camelCase, mirrors the backend):
//   GET /api/investor/thesis  -> { success, thesis: ThesisObject }
//   PUT /api/investor/thesis  (body = ThesisObject) -> { success, thesis }
import { apiClient } from '../lib/api-client';

export interface InvestorThesis {
  genres: string[];
  formats: string[];
  stages: string[];
  dealTypes: string[];
  territories: string[];
  themes: string[];
  budgetMinUsd: number | null;
  budgetMaxUsd: number | null;
  checkSizeMinUsd: number | null;
  checkSizeMaxUsd: number | null;
  positioning: string;
  isPublic: boolean;
}

// A clean empty mandate — used as the initial form state and as a safe default
// when the backend returns an as-yet-unfilled thesis.
export const EMPTY_THESIS: InvestorThesis = {
  genres: [],
  formats: [],
  stages: [],
  dealTypes: [],
  territories: [],
  themes: [],
  budgetMinUsd: null,
  budgetMaxUsd: null,
  checkSizeMinUsd: null,
  checkSizeMaxUsd: null,
  positioning: '',
  isPublic: false,
};

// Coerce a partial/loose payload into a well-formed thesis so the form never
// chokes on a missing field from an older record.
function normalize(raw: Partial<InvestorThesis> | null | undefined): InvestorThesis {
  const r = raw ?? {};
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    genres: arr(r.genres),
    formats: arr(r.formats),
    stages: arr(r.stages),
    dealTypes: arr(r.dealTypes),
    territories: arr(r.territories),
    themes: arr(r.themes),
    budgetMinUsd: num(r.budgetMinUsd),
    budgetMaxUsd: num(r.budgetMaxUsd),
    checkSizeMinUsd: num(r.checkSizeMinUsd),
    checkSizeMaxUsd: num(r.checkSizeMaxUsd),
    positioning: typeof r.positioning === 'string' ? r.positioning : '',
    isPublic: r.isPublic === true,
  };
}

export class InvestorThesisService {
  static async getThesis(): Promise<InvestorThesis> {
    const response = await apiClient.get<{ success: boolean; thesis: Partial<InvestorThesis> }>(
      '/api/investor/thesis'
    );
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to load investment thesis');
    }
    return normalize(response.data?.thesis);
  }

  static async updateThesis(thesis: InvestorThesis): Promise<InvestorThesis> {
    const response = await apiClient.put<{ success: boolean; thesis: Partial<InvestorThesis> }, InvestorThesis>(
      '/api/investor/thesis',
      thesis
    );
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to save investment thesis');
    }
    // Backend echoes the saved thesis; fall back to the submitted value if it doesn't.
    return normalize(response.data?.thesis ?? thesis);
  }
}

export const investorThesisService = InvestorThesisService;
