import { describe, it, expect } from 'vitest';
import {
  dealSheetTerms,
  canonicalDealSheet,
  sealDealSheet,
} from '../deal-signing';

// A representative raw `production_deals` (joined) row.
const baseDeal: Record<string, unknown> = {
  id: 42,
  pitch_id: 7,
  creator_id: 100,
  production_company_id: 200,
  deal_type: 'option',
  option_amount: 5000,
  purchase_price: 250000,
  backend_percentage: 5,
  development_fee: 10000,
  rights_territory: 'Worldwide',
  notes: 'First-look, 18-month option.',
  // Joined/cosmetic fields the seal must IGNORE:
  creator_name: 'Alex Creator',
  production_name: 'Stellar',
  created_at: '2026-06-27T00:00:00Z',
  deal_state: 'accepted',
};

describe('deal-signing seal', () => {
  it('is deterministic — same terms produce the same hash', async () => {
    const a = await sealDealSheet(baseDeal);
    const b = await sealDealSheet({ ...baseDeal });
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.algorithm).toBe('sha256');
  });

  it('ignores cosmetic / joined fields — only binding terms affect the hash', async () => {
    const a = await sealDealSheet(baseDeal);
    const b = await sealDealSheet({
      ...baseDeal,
      creator_name: 'DIFFERENT NAME',
      production_name: 'Other Co',
      created_at: '1999-01-01T00:00:00Z',
      deal_state: 'completed',
      some_future_column: 'whatever',
    });
    expect(a.hash).toBe(b.hash);
  });

  it('detects tampering — changing any binding term changes the hash', async () => {
    const original = await sealDealSheet(baseDeal);
    const mutations: Array<Partial<Record<string, unknown>>> = [
      { option_amount: 5001 },
      { purchase_price: 250001 },
      { backend_percentage: 6 },
      { development_fee: 0 },
      { rights_territory: 'North America' },
      { deal_type: 'purchase' },
      { notes: 'Altered terms.' },
    ];
    for (const m of mutations) {
      const tampered = await sealDealSheet({ ...baseDeal, ...m });
      expect(tampered.hash, `mutation ${JSON.stringify(m)} should change the hash`)
        .not.toBe(original.hash);
    }
  });

  it('treats numeric and string-numeric term values as equal (DB driver drift)', async () => {
    const a = await sealDealSheet(baseDeal);
    const b = await sealDealSheet({
      ...baseDeal,
      option_amount: '5000',
      purchase_price: '250000',
      backend_percentage: '5',
    });
    expect(a.hash).toBe(b.hash);
  });

  it('normalizes null/undefined notes and territory to empty, not the string "null"', () => {
    const t1 = dealSheetTerms({ ...baseDeal, notes: null, rights_territory: undefined });
    expect(t1.notes).toBe('');
    expect(t1.rights_territory).toBe('');
    const canon = canonicalDealSheet(t1);
    expect(canon).toContain('notes=');
    expect(canon).not.toContain('notes=null');
    expect(canon.startsWith('pitchey:deal-sheet:v1')).toBe(true);
  });
});
