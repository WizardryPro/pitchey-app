import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3, Plus, X, Search, Loader2, Flame, Eye, Heart, Star, BadgeCheck, Crown, Layers,
} from 'lucide-react';
import PortalTopNav from '@shared/components/layout/PortalTopNav';
import { compareService, type CompareSubject, type PickerItem } from '../services/compare.service';

const MAX_SUBJECTS = 4;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatUsd(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function budgetRange(s: CompareSubject): string {
  const lo = formatUsd(num(s.budget_min));
  const hi = formatUsd(num(s.budget_max));
  if (lo === '—' && hi === '—') return '—';
  if (lo === hi) return lo;
  return `${lo}–${hi}`;
}

function monthYear(iso: string | null): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

interface MetricRow {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  value: (s: CompareSubject) => string;        // display
  score?: (s: CompareSubject) => number | null; // for leader highlight (higher = better)
}

const CREATOR_ROWS: MetricRow[] = [
  { key: 'pitches', label: 'Published pitches', icon: Layers, value: (s) => String(num(s.pitch_count) ?? 0), score: (s) => num(s.pitch_count) },
  { key: 'heat', label: 'Avg heat', icon: Flame, value: (s) => (num(s.avg_heat) != null ? num(s.avg_heat)!.toFixed(1) : '—'), score: (s) => num(s.avg_heat) },
  { key: 'pitchey', label: 'Avg Pitchey score', icon: Star, value: (s) => (num(s.avg_pitchey) != null ? `${num(s.avg_pitchey)!.toFixed(1)}/10` : '—'), score: (s) => num(s.avg_pitchey) },
  { key: 'views', label: 'Total views', icon: Eye, value: (s) => String(num(s.total_views) ?? 0), score: (s) => num(s.total_views) },
  { key: 'likes', label: 'Total likes', icon: Heart, value: (s) => String(num(s.total_likes) ?? 0), score: (s) => num(s.total_likes) },
  { key: 'budget', label: 'Budget range', value: (s) => budgetRange(s) },
  { key: 'newest', label: 'Latest pitch', value: (s) => monthYear(s.newest_at) },
];

const PITCH_ROWS: MetricRow[] = [
  { key: 'heat', label: 'Heat', icon: Flame, value: (s) => (num(s.avg_heat) != null ? num(s.avg_heat)!.toFixed(1) : '—'), score: (s) => num(s.avg_heat) },
  { key: 'pitchey', label: 'Pitchey score', icon: Star, value: (s) => (num(s.avg_pitchey) != null ? `${num(s.avg_pitchey)!.toFixed(1)}/10` : '—'), score: (s) => num(s.avg_pitchey) },
  { key: 'views', label: 'Views', icon: Eye, value: (s) => String(num(s.total_views) ?? 0), score: (s) => num(s.total_views) },
  { key: 'likes', label: 'Likes', icon: Heart, value: (s) => String(num(s.total_likes) ?? 0), score: (s) => num(s.total_likes) },
  { key: 'budget', label: 'Budget', value: (s) => budgetRange(s) },
  { key: 'format', label: 'Format', value: (s) => s.format || '—' },
  { key: 'newest', label: 'Created', value: (s) => monthYear(s.newest_at) },
];

const SLATE_ROWS: MetricRow[] = [
  { key: 'pitches', label: 'Pitches', icon: Layers, value: (s) => String(num(s.pitch_count) ?? 0), score: (s) => num(s.pitch_count) },
  { key: 'heat', label: 'Avg heat', icon: Flame, value: (s) => (num(s.avg_heat) != null ? num(s.avg_heat)!.toFixed(1) : '—'), score: (s) => num(s.avg_heat) },
  { key: 'pitchey', label: 'Avg Pitchey score', icon: Star, value: (s) => (num(s.avg_pitchey) != null ? `${num(s.avg_pitchey)!.toFixed(1)}/10` : '—'), score: (s) => num(s.avg_pitchey) },
  { key: 'views', label: 'Total views', icon: Eye, value: (s) => String(num(s.total_views) ?? 0), score: (s) => num(s.total_views) },
  { key: 'likes', label: 'Total likes', icon: Heart, value: (s) => String(num(s.total_likes) ?? 0), score: (s) => num(s.total_likes) },
  { key: 'budget', label: 'Budget range', value: (s) => budgetRange(s) },
  { key: 'newest', label: 'Latest pitch', value: (s) => monthYear(s.newest_at) },
];

// ---------------------------------------------------------------------------
// Creator picker
// ---------------------------------------------------------------------------

function Picker({ onAdd, disabled, existing, noun, search }: { onAdd: (id: number) => void; disabled: boolean; existing: number[]; noun: string; search: (q: string) => Promise<PickerItem[]> }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try { setResults(await search(q)); }
      catch { setResults([]); }
      finally { setLoading(false); setOpen(true); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, search]);

  return (
    <div className="relative max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-purple-500">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          disabled={disabled}
          placeholder={disabled ? `Up to ${MAX_SUBJECTS} ${noun}s` : `Search ${noun}s to add…`}
          className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none disabled:opacity-50"
        />
        {loading && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
      </div>
      {open && results.length > 0 && !disabled && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
          {results.map((r) => {
            const added = existing.includes(r.id);
            return (
              <button
                key={r.id}
                disabled={added}
                onClick={() => { onAdd(r.id); setQ(''); setResults([]); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-purple-50 disabled:opacity-40 transition"
              >
                <span className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden">
                  {r.image ? <img src={r.image} alt="" className="w-full h-full object-cover" /> : (r.name[0] || '?')}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 truncate">{r.name}</span>
                  {r.sub && <span className="block text-[11px] text-gray-400 capitalize truncate">{r.sub}</span>}
                </span>
                {added ? <span className="ml-auto text-[11px] text-gray-400">Added</span> : <Plus className="ml-auto w-4 h-4 text-purple-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type: 'creator' | 'pitch' | 'slate' = rawType === 'pitch' ? 'pitch' : rawType === 'slate' ? 'slate' : 'creator';
  const isPitch = type === 'pitch';
  const isSlate = type === 'slate';
  const rows = isPitch ? PITCH_ROWS : isSlate ? SLATE_ROWS : CREATOR_ROWS;
  const ids = useMemo(() => (
    (searchParams.get('ids') || '')
      .split(',').map((s) => parseInt(s, 10)).filter(Number.isFinite).slice(0, MAX_SUBJECTS)
  ), [searchParams]);

  const [subjects, setSubjects] = useState<CompareSubject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ids.length === 0) { setSubjects([]); return; }
    setLoading(true);
    compareService.subjects(type, ids)
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, [type, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const setIds = (next: number[]) => {
    const uniq = Array.from(new Set(next)).slice(0, MAX_SUBJECTS);
    const params: Record<string, string> = {};
    if (type !== 'creator') params.type = type;
    if (uniq.length) params.ids = uniq.join(',');
    setSearchParams(params);
  };
  const switchType = (next: 'creator' | 'slate') => {
    const params: Record<string, string> = {};
    if (next !== 'creator') params.type = next;
    setSearchParams(params);
  };
  const addId = (id: number) => setIds([...ids, id]);
  const removeId = (id: number) => setIds(ids.filter((x) => x !== id));

  // Per-row leader index (highest score; ties highlight all).
  const leaders = useMemo(() => {
    const map: Record<string, Set<number>> = {};
    for (const row of rows) {
      if (!row.score) continue;
      const scores = subjects.map((s) => row.score!(s));
      const max = Math.max(...scores.map((v) => (v ?? -Infinity)));
      if (!Number.isFinite(max) || max <= 0) continue;
      map[row.key] = new Set(scores.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0));
    }
    return map;
  }, [subjects, rows]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">
      <PortalTopNav />

      <section className="relative overflow-hidden bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_60%_at_85%_0%,rgba(245,158,11,0.18),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold tracking-[0.18em] uppercase">
            <BarChart3 className="w-3.5 h-3.5" /> Compare
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mb-2">{isPitch ? 'Compare Pitches' : isSlate ? 'Compare Slates' : 'Compare Creators'}</h1>
          <p className="text-white/85 max-w-2xl text-lg">
            {isPitch
              ? 'These pitches side by side — heat, score, traction, budget — to decide which to take forward.'
              : isSlate
                ? 'Curated slates side by side — depth, heat, score and range — to see which collection lands hardest.'
                : 'Put creators’ bodies of work side by side — heat, score, traction, range — to decide who to back.'}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isPitch && (
          <>
            {/* Creators / Slates toggle */}
            <div className="inline-flex items-center gap-1 p-1 mb-5 rounded-full bg-gray-100">
              {(['creator', 'slate'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => switchType(t)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${type === t ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {t === 'creator' ? 'Creators' : 'Slates'}
                </button>
              ))}
            </div>
            <div className="mb-6">
              <Picker
                onAdd={addId}
                disabled={ids.length >= MAX_SUBJECTS}
                existing={ids}
                noun={isSlate ? 'slate' : 'creator'}
                search={isSlate ? compareService.searchSlates.bind(compareService) : compareService.searchCreators.bind(compareService)}
              />
            </div>
          </>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-purple-500 animate-spin" /></div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-50 text-purple-500 mb-4"><BarChart3 className="w-7 h-7" /></div>
            <h3 className="font-display font-bold text-xl text-gray-900 mb-1">{isPitch ? 'Nothing to compare' : isSlate ? 'Add slates to compare' : 'Add creators to compare'}</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {isPitch
                ? 'Select submissions from a call’s inbox and choose “Compare” to see them here.'
                : `Search above to add 2–${MAX_SUBJECTS} ${isSlate ? 'slates' : 'creators'} and see them side by side.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 min-w-[640px]">
              <thead>
                <tr>
                  <th className="w-44 align-bottom" />
                  {subjects.map((s) => (
                    <th key={s.subject_id} className="p-3 align-bottom">
                      <div className="relative rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                        <button onClick={() => removeId(s.subject_id)} className="absolute top-2 right-2 text-gray-300 hover:text-gray-600" aria-label="Remove"><X className="w-4 h-4" /></button>
                        {type === 'creator' ? (
                          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-500 overflow-hidden">
                            {s.avatar ? <img src={s.avatar} alt="" className="w-full h-full object-cover" /> : (s.name[0] || '?')}
                          </div>
                        ) : (
                          <div className="w-full h-20 mb-2 rounded-lg bg-gray-900 overflow-hidden flex items-center justify-center">
                            {s.thumbnail ? <img src={s.thumbnail} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-500 text-xs">{(isSlate ? 'Slate' : s.genre) || 'Pitch'}</span>}
                          </div>
                        )}
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-gray-900 text-sm truncate">{s.name}</span>
                          {(s.verification_tier === 'gold' || s.verification_tier === 'silver') && <BadgeCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                        </div>
                        <div className="text-[11px] text-gray-400 capitalize truncate">{type === 'creator' ? s.user_type : (s.subtitle || '')}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={row.key} className={ri % 2 ? 'bg-gray-50/60' : ''}>
                    <td className="px-3 py-3 text-sm font-medium text-gray-500">
                      <span className="inline-flex items-center gap-1.5">{row.icon && <row.icon className="w-3.5 h-3.5 text-gray-400" />}{row.label}</span>
                    </td>
                    {subjects.map((s, si) => {
                      const isLeader = leaders[row.key]?.has(si);
                      if (row.key === 'genres') return null;
                      return (
                        <td key={s.subject_id} className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-sm ${isLeader ? 'font-bold text-purple-700' : 'text-gray-800'}`}>
                            {isLeader && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                            {row.value(s)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="px-3 py-3 text-sm font-medium text-gray-500 align-top">Genres</td>
                  {subjects.map((s) => (
                    <td key={s.subject_id} className="px-3 py-3 align-top">
                      <div className="flex flex-wrap justify-center gap-1">
                        {(s.genres || []).slice(0, 5).map((g) => (
                          <span key={g} className="inline-flex rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-100 px-2 py-0.5 text-[11px] font-medium">{g}</span>
                        ))}
                        {(!s.genres || s.genres.length === 0) && <span className="text-sm text-gray-400">—</span>}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
