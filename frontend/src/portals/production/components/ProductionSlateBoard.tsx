import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, CheckCircle, Users, FileText, ShieldCheck, ArrowRight, Handshake } from 'lucide-react';
import apiClient from '../../../lib/api-client';

interface SlateItem {
  pitchId: number;
  title: string;
  genre: string | null;
  format: string | null;
  poster: string | null;
  source: 'owned' | 'saved';
  stage: 'evaluating' | 'reviewing' | 'packaging' | 'ready';
  completeness: { score: number; total: number };
  checklistPct: number;
  rolesConfirmed: number;
  rolesTotal: number;
  rolesFilled: number;
  notesCount: number;
  hasNda: boolean;
  collaboration?: 'none' | 'pending' | 'accepted';
}

// The funnel a producer actually runs their slate on. Stages are derived from
// the production workspace (see /api/production/slate); left → right is the path
// from "should I pursue this?" to "financeable package."
const STAGES = [
  { key: 'evaluating', label: 'Evaluating', hint: 'Triage inbound', dot: 'bg-slate-400', head: 'text-slate-600', ring: 'ring-slate-200' },
  { key: 'reviewing',  label: 'Reviewing',  hint: 'Due diligence',  dot: 'bg-blue-500',  head: 'text-blue-700',  ring: 'ring-blue-200' },
  { key: 'packaging',  label: 'Packaging',  hint: 'Attaching talent', dot: 'bg-indigo-500', head: 'text-indigo-700', ring: 'ring-indigo-200' },
  { key: 'ready',      label: 'Ready',      hint: 'Financeable',    dot: 'bg-emerald-500', head: 'text-emerald-700', ring: 'ring-emerald-200' },
] as const;

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'indigo' | 'emerald' | 'blue' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium ${tones[tone]}`}>{children}</span>;
}

function SlateCard({ item, onOpen }: { item: SlateItem; onOpen: () => void }) {
  const completePct = item.completeness.total ? Math.round((item.completeness.score / item.completeness.total) * 100) : 0;
  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-indigo-200 hover:shadow"
    >
      <div className="flex items-start gap-3">
        {item.poster ? (
          <img src={item.poster} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{item.title || 'Untitled'}</p>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${
              item.source === 'owned' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-700'
            }`}>
              {item.source}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-400">{[item.format, item.genre].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={completePct >= 75 ? 'emerald' : 'slate'}>{item.completeness.score}/{item.completeness.total} complete</Badge>
        {item.checklistPct > 0 && (
          <Badge tone={item.checklistPct >= 80 ? 'emerald' : 'indigo'}>
            <CheckCircle className="h-3 w-3" /> {item.checklistPct}%
          </Badge>
        )}
        {item.rolesTotal > 0 && item.rolesConfirmed > 0 && (
          <Badge tone="indigo"><Users className="h-3 w-3" /> {item.rolesConfirmed}/{item.rolesTotal}</Badge>
        )}
        {item.hasNda && <Badge tone="blue"><ShieldCheck className="h-3 w-3" /> NDA</Badge>}
        {item.notesCount > 0 && <Badge tone="slate"><FileText className="h-3 w-3" /> {item.notesCount}</Badge>}
        {item.collaboration === 'accepted' && <Badge tone="emerald"><Handshake className="h-3 w-3" /> Collaborating</Badge>}
        {item.collaboration === 'pending' && <Badge tone="indigo"><Handshake className="h-3 w-3" /> Proposed</Badge>}
      </div>
    </button>
  );
}

export default function ProductionSlateBoard() {
  const [slate, setSlate] = useState<SlateItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res: any = await apiClient.get('/api/production/slate');
        if (!live) return;
        const data = res?.data ?? res;
        setSlate(Array.isArray(data?.slate) ? data.slate : []);
        setCounts(data?.counts ?? {});
      } catch {
        /* dashboard degrades quietly — the rest of the page still renders */
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const total = slate.length;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900">Your Slate</h2>
            <p className="text-xs text-gray-500">Your production pipeline — every project you own or saved, grouped by how close it is to being made. Move projects forward as you complete each one's workspace.</p>
          </div>
        </div>
        <button onClick={() => navigate('/production/browse')} className="hidden items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 sm:inline-flex">
          Find pitches <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-50" />)}
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-10 text-center">
          <p className="text-sm font-medium text-gray-600">Your slate is empty.</p>
          <p className="mt-1 text-xs text-gray-400">Create a pitch or save one from the marketplace, then build out its Feasibility, Team & Notes to advance it through the funnel.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const items = slate.filter((s) => s.stage === stage.key);
            return (
              <div key={stage.key} className={`rounded-xl bg-gray-50/70 p-3 ring-1 ring-inset ${stage.ring}`}>
                <div className="mb-3 flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                    <span className={`text-sm font-semibold ${stage.head}`}>{stage.label}</span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
                    {counts[stage.key] ?? items.length}
                  </span>
                </div>
                <p className="mb-2 px-0.5 text-[0.68rem] text-gray-400">{stage.hint}</p>
                <div className="space-y-2.5">
                  {items.length === 0 ? (
                    <p className="px-0.5 py-2 text-xs text-gray-300">—</p>
                  ) : (
                    items.map((item) => (
                      <SlateCard key={`${item.source}-${item.pitchId}`} item={item} onOpen={() => navigate(`/production/pitch/${item.pitchId}`)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
