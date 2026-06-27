// Deal-sheet sealing — P5.0 of the deal-servicing roadmap.
//
// Produces a DETERMINISTIC canonical serialization of a production deal's binding
// terms and a SHA-256 seal of it, so that:
//   1. both parties signing the same deal hash IDENTICAL bytes (the seal is shared), and
//   2. mutating a term after a party signed changes the live hash, making the prior
//      signature's `content_hash` no longer match — i.e. tampering is detectable.
//
// Reuses the provenance seal primitive (`sha256Hex` → crypto.subtle) rather than
// re-implementing hashing. This file deliberately holds NO money/Stripe logic — P5.0
// is pure switching-cost (a co-signed, hash-sealed instrument), nothing more.

import { sha256Hex } from './pitch-provenance';

// The binding terms of a deal, in a FIXED order. Anything that changes what the
// parties agreed to belongs here; anything cosmetic (display names, timestamps that
// don't bind) does not. Order is load-bearing — it is part of the canonical form.
export interface DealSheetTerms {
  deal_id: number;
  pitch_id: number | null;
  creator_id: number;
  production_company_id: number;
  deal_type: string;
  option_amount: number;
  purchase_price: number;
  backend_percentage: number;
  development_fee: number;
  rights_territory: string;
  notes: string;
}

// Pull the binding terms off a raw `production_deals` (joined) row in a way that is
// stable regardless of column ordering or extra joined fields.
export function dealSheetTerms(deal: Record<string, unknown>): DealSheetTerms {
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (v: unknown): string => (v == null ? '' : String(v));
  return {
    deal_id: num(deal.id),
    pitch_id: deal.pitch_id == null ? null : num(deal.pitch_id),
    creator_id: num(deal.creator_id),
    production_company_id: num(deal.production_company_id),
    deal_type: str(deal.deal_type),
    option_amount: num(deal.option_amount),
    purchase_price: num(deal.purchase_price),
    backend_percentage: num(deal.backend_percentage),
    development_fee: num(deal.development_fee),
    rights_territory: str(deal.rights_territory),
    notes: str(deal.notes),
  };
}

// Deterministic canonical string. Explicit field order + a version tag so the seal
// is reproducible and survives JSON key-ordering differences. The `v1` tag lets a
// future terms change re-version without silently invalidating old seals.
export function canonicalDealSheet(terms: DealSheetTerms): string {
  const ordered: Array<[keyof DealSheetTerms, string | number | null]> = [
    ['deal_id', terms.deal_id],
    ['pitch_id', terms.pitch_id],
    ['creator_id', terms.creator_id],
    ['production_company_id', terms.production_company_id],
    ['deal_type', terms.deal_type],
    ['option_amount', terms.option_amount],
    ['purchase_price', terms.purchase_price],
    ['backend_percentage', terms.backend_percentage],
    ['development_fee', terms.development_fee],
    ['rights_territory', terms.rights_territory],
    ['notes', terms.notes],
  ];
  return 'pitchey:deal-sheet:v1\n' +
    ordered.map(([k, v]) => `${k}=${v == null ? '' : v}`).join('\n');
}

export interface DealSeal {
  hash: string;
  algorithm: 'sha256';
  canonical: string;
}

// Seal a deal row → { hash } usable both at sign-time (persist) and read-time (compare).
export async function sealDealSheet(deal: Record<string, unknown>): Promise<DealSeal> {
  const canonical = canonicalDealSheet(dealSheetTerms(deal));
  const hash = await sha256Hex(canonical);
  return { hash, algorithm: 'sha256', canonical };
}
