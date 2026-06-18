import { useEffect, useState } from 'react';
import { FileText, Users, Eye, Share2, Shield, Flame, ShieldCheck } from 'lucide-react';
import apiClient from '../../lib/api-client';
import VerificationBadge from '../VerificationBadge';
import { formatNumber } from '@shared/utils/formatters';

// "Your Pitchey" value dashboard (moat #8) — surfaces accumulated stored value so
// the lock-in we already shipped becomes *felt*. Read-only; self-contained (fetches
// its own data) and degrades to null on error so it can never break the dashboard.

type Tier = 'gold' | 'silver' | 'grey';

interface ValueData {
  verificationTier: Tier;
  memberSince: string | null;
  username: string | null;
  pitches: { total: number; published: number; sealed: number };
  audience: { followers: number; totalViews: number };
  reach: { shareLinkViews: number };
  trust: { ndas: number };
  heat: { top: number };
}

function memberSinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const year = new Date(iso).getFullYear();
  return Number.isFinite(year) && year > 1970 ? `Member since ${year}` : null;
}

interface TileProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
}
function Tile({ icon, value, label, sub }: TileProps) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 ring-1 ring-purple-100">
      <div className="flex items-center gap-2 text-purple-500 mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
      <div className="text-xs font-medium text-gray-600 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function YourPitcheyValue() {
  const [data, setData] = useState<ValueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiClient.get<ValueData>('/api/creator/value');
        const d = res?.data as Partial<ValueData> | undefined;
        // Guard on `pitches` as the value-shape marker, and normalize every nested
        // field so a malformed/unexpected response can never crash the render.
        if (active && res?.success && d && d.pitches) {
          setData({
            verificationTier: (d.verificationTier ?? 'grey') as Tier,
            memberSince: d.memberSince ?? null,
            username: d.username ?? null,
            pitches: {
              total: d.pitches.total ?? 0,
              published: d.pitches.published ?? 0,
              sealed: d.pitches.sealed ?? 0,
            },
            audience: { followers: d.audience?.followers ?? 0, totalViews: d.audience?.totalViews ?? 0 },
            reach: { shareLinkViews: d.reach?.shareLinkViews ?? 0 },
            trust: { ndas: d.trust?.ndas ?? 0 },
            heat: { top: d.heat?.top ?? 0 },
          });
        }
      } catch (err) {
        // Quiet degrade — this is an enhancement card, not a critical path.
        // eslint-disable-next-line no-console
        console.warn('YourPitcheyValue: failed to load', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div data-testid="your-pitchey-skeleton" className="bg-white rounded-2xl shadow-sm h-44 animate-pulse mb-8" />;
  }
  if (!data) return null; // failed / empty — don't disrupt the dashboard

  const since = memberSinceLabel(data.memberSince);

  return (
    <section
      data-testid="your-pitchey-value"
      aria-label="Your Pitchey value summary"
      className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 ring-1 ring-purple-100 mb-8"
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Your Pitchey
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Everything you've built here</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {data.verificationTier && data.verificationTier !== 'grey' && (
            <VerificationBadge tier={data.verificationTier} size="sm" />
          )}
          {since && <span className="text-xs text-gray-400">{since}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile
          icon={<FileText className="w-4 h-4" />}
          value={formatNumber(data.pitches.total)}
          label="Pitches"
          sub={`${formatNumber(data.pitches.published)} published · ${formatNumber(data.pitches.sealed)} sealed`}
        />
        <Tile icon={<Users className="w-4 h-4" />} value={formatNumber(data.audience.followers)} label="Followers" />
        <Tile icon={<Eye className="w-4 h-4" />} value={formatNumber(data.audience.totalViews)} label="Total views" />
        <Tile icon={<Share2 className="w-4 h-4" />} value={formatNumber(data.reach.shareLinkViews)} label="Share-link views" />
        <Tile icon={<Shield className="w-4 h-4" />} value={formatNumber(data.trust.ndas)} label="NDAs on your work" />
        <Tile icon={<Flame className="w-4 h-4" />} value={formatNumber(data.heat.top)} label="Top heat" />
      </div>
    </section>
  );
}
