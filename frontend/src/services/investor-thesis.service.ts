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

// An investor whose thesis matches a given pitch (camelCase, surfaced to the creator).
export interface MatchingInvestor {
  investorId: number;
  username: string | null;
  companyName: string | null;
  genres: string[];
  formats: string[];
  positioning: string;
  // Financials intentionally excluded — the matching surface shows public intent,
  // not check size (R11 privacy decision).
}

// The public (creator/anon-readable) thesis — SAFE SUBSET only. The endpoint
// deliberately omits financial bounds, so this type has none.
export interface PublicThesis {
  companyName: string | null;
  username: string | null;
  positioning: string;
  genres: string[];
  formats: string[];
  stages: string[];
  dealTypes: string[];
  territories: string[];
  themes: string[];
}

// The raw snake_case shape the backend returns for matching investors.
interface RawMatchingInvestor {
  investor_id: number;
  username?: string | null;
  company_name?: string | null;
  genres?: string[];
  formats?: string[];
  positioning?: string | null;
  // (no check_size_* — the matching endpoint no longer returns financials)
}

// A published pitch that matches the investor's thesis (camelCase, for the dashboard view).
export interface ThesisMatch {
  id: number;
  title: string;
  genre: string | null;
  format: string | null;
  creatorId: number | null;
  matchScore: number;
}

interface RawThesisMatch {
  id: number;
  title?: string | null;
  genre?: string | null;
  format?: string | null;
  creator_id?: number | null;
  match_score?: number | null;
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

  // Public investor theses whose genres include this pitch's genre — the
  // creator-facing demand signal (moat #7 matching). Read-only; returns [] on any
  // error so the panel degrades to nothing rather than breaking the pitch view.
  static async getMatchingInvestors(pitchId: number): Promise<MatchingInvestor[]> {
    try {
      const response = await apiClient.get<{ success: boolean; investors: RawMatchingInvestor[] }>(
        `/api/pitches/${pitchId}/matching-investors`,
      );
      if (!response.success) return [];
      return (response.data?.investors ?? []).map((r) => ({
        investorId: r.investor_id,
        username: r.username ?? null,
        companyName: r.company_name ?? null,
        genres: Array.isArray(r.genres) ? r.genres : [],
        formats: Array.isArray(r.formats) ? r.formats : [],
        positioning: r.positioning ?? '',
      }));
    } catch {
      return [];
    }
  }

  // An investor's PUBLIC thesis (safe subset — no financials), for the
  // creator-facing "view full thesis" disclosure. Returns null when the thesis
  // is private/missing (the endpoint 404s) or on any error, so the UI degrades
  // to a neutral empty state rather than throwing.
  static async getPublicThesis(investorId: number): Promise<PublicThesis | null> {
    try {
      const response = await apiClient.get<{ success: boolean; thesis: PublicThesis }>(
        `/api/public/thesis/${investorId}`,
      );
      if (!response.success || !response.data?.thesis) return null;
      const t = response.data.thesis;
      const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
      return {
        companyName: t.companyName ?? null,
        username: t.username ?? null,
        positioning: typeof t.positioning === 'string' ? t.positioning : '',
        genres: arr(t.genres),
        formats: arr(t.formats),
        stages: arr(t.stages),
        dealTypes: arr(t.dealTypes),
        territories: arr(t.territories),
        themes: arr(t.themes),
      };
    } catch {
      return null;
    }
  }

  // Published pitches that match the authenticated investor's thesis (the investor-facing
  // demand→supply view). Read-only; returns [] on any error so the section stays invisible
  // rather than breaking the dashboard.
  static async getThesisMatches(): Promise<ThesisMatch[]> {
    try {
      const response = await apiClient.get<{ success: boolean; matches: RawThesisMatch[] }>(
        '/api/investor/thesis/matches',
      );
      if (!response.success) return [];
      return (response.data?.matches ?? []).map((r) => ({
        id: r.id,
        title: r.title ?? 'Untitled',
        genre: r.genre ?? null,
        format: r.format ?? null,
        creatorId: r.creator_id ?? null,
        matchScore: r.match_score ?? 0,
      }));
    } catch {
      return [];
    }
  }
}

export const investorThesisService = InvestorThesisService;
