import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Briefcase, Building2, Wallet, Plus, X, MapPin, CalendarDays, DollarSign,
  BadgeCheck, Loader2, Pencil, Megaphone, ArrowRight, Send, Inbox, Check, Star, BarChart3,
} from 'lucide-react';
import PortalTopNav from '@shared/components/layout/PortalTopNav';
import { getPortalPath } from '@/utils/navigation';
import { normalizeUserType } from '@shared/types/user-type';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { getGenresSync, getFormatsSync } from '@config/pitchConstants';
import { pitchService } from '../features/pitches/services/pitch.service';
import {
  callsService, type OpenCall, type CallInput,
  type CallSubmission, type SubmissionStatus,
} from '../services/calls.service';
import { pitchUrl } from '@/utils/pitchUrl';

interface MyPitch { id: number; title: string; genre?: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function budgetLabel(c: OpenCall): string | null {
  const lo = formatUsd(c.budget_min_usd);
  const hi = formatUsd(c.budget_max_usd);
  if (lo && hi) return `${lo}–${hi}`;
  if (hi) return `up to ${hi}`;
  if (lo) return `${lo}+`;
  return null;
}

function splitList(s: string | null): string[] {
  return (s || '').split(',').map((x) => x.trim()).filter(Boolean);
}

const TYPE_META = {
  production: { label: 'Production', Icon: Building2, accent: 'text-indigo-600 bg-indigo-50 ring-indigo-100' },
  investor: { label: 'Investor', Icon: Wallet, accent: 'text-emerald-600 bg-emerald-50 ring-emerald-100' },
} as const;

// ---------------------------------------------------------------------------
// Poster badge
// ---------------------------------------------------------------------------

function PosterRow({ call }: { call: OpenCall }) {
  const meta = TYPE_META[call.poster_type] ?? TYPE_META.production;
  const verified = call.poster_verification_tier === 'gold' || call.poster_verification_tier === 'silver';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ring-1 ${meta.accent}`}>
        <meta.Icon className="w-4 h-4" />
      </span>
      <span className="flex items-center gap-1 min-w-0">
        <span className="text-sm font-semibold text-gray-900 truncate">{call.poster_name || 'A company'}</span>
        {verified && <BadgeCheck className="w-4 h-4 text-amber-500 flex-shrink-0" aria-label="Verified" />}
      </span>
      <span className="text-xs text-gray-400">· {meta.label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Call card
// ---------------------------------------------------------------------------

function CallCard({
  call, isOwner, canSubmit, alreadySubmitted, onView, onEdit, onToggleStatus, onSubmit, onViewSubmissions,
}: {
  call: OpenCall;
  isOwner: boolean;
  canSubmit: boolean;
  alreadySubmitted: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onSubmit: () => void;
  onViewSubmissions: () => void;
}) {
  const genres = splitList(call.seeking_genres);
  const budget = budgetLabel(call);
  const open = call.status === 'open';
  const subCount = Number(call.submission_count || 0);
  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200/70 shadow-[0_10px_36px_-18px_rgba(17,12,46,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_-20px_rgba(17,12,46,0.28)] hover:border-gray-300">
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <PosterRow call={call} />
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              open ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {open ? (call.slots != null ? `Open · ${call.slots} slots` : 'Open') : 'Closed'}
          </span>
        </div>

        <h3 className="font-display font-bold text-lg text-gray-900 leading-snug mb-1.5 line-clamp-2">
          {call.title}
        </h3>
        {call.mandate && (
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3">{call.mandate}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {genres.slice(0, 3).map((g) => (
            <span key={g} className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-100 px-2 py-0.5 text-[11px] font-medium">
              {g}
            </span>
          ))}
          {budget && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100 px-2 py-0.5 text-[11px] font-medium">
              <DollarSign className="w-3 h-3" />{budget}
            </span>
          )}
          {call.region && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 text-gray-600 ring-1 ring-gray-200 px-2 py-0.5 text-[11px] font-medium">
              <MapPin className="w-3 h-3" />{call.region}
            </span>
          )}
          {call.deadline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 text-gray-600 ring-1 ring-gray-200 px-2 py-0.5 text-[11px] font-medium">
              <CalendarDays className="w-3 h-3" />{call.deadline}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={onView}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-900 transition"
        >
          View mandate <ArrowRight className="w-4 h-4" />
        </button>
        {isOwner ? (
          <div className="ml-auto flex items-center gap-3">
            <button onClick={onViewSubmissions} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-purple-700 transition">
              <Inbox className="w-3.5 h-3.5" /> {subCount} submission{subCount === 1 ? '' : 's'}
            </button>
            <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition" aria-label="Edit call">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={onToggleStatus} className="text-xs font-medium text-gray-500 hover:text-gray-800 transition">
              {open ? 'Close' : 'Reopen'}
            </button>
          </div>
        ) : canSubmit && open ? (
          alreadySubmitted ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <Check className="w-4 h-4" /> Submitted
            </span>
          ) : (
            <button onClick={onSubmit} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold shadow shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition">
              <Send className="w-3.5 h-3.5" /> Submit your pitch
            </button>
          )
        ) : subCount > 0 ? (
          <span className="ml-auto text-xs text-gray-400">{subCount} submission{subCount === 1 ? '' : 's'}</span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View mandate modal
// ---------------------------------------------------------------------------

function ViewCallModal({ call, onClose, canSubmit, alreadySubmitted, onSubmit }: { call: OpenCall; onClose: () => void; canSubmit?: boolean; alreadySubmitted?: boolean; onSubmit?: () => void }) {
  const meta = TYPE_META[call.poster_type] ?? TYPE_META.production;
  const budget = budgetLabel(call);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <PosterRow call={call} />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${meta.accent} mb-3`}>
            <meta.Icon className="w-3.5 h-3.5" /> {meta.label} mandate
          </span>
          <h2 className="font-display font-bold text-xl text-gray-900 mb-3">{call.title}</h2>
          {call.mandate && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">{call.mandate}</p>}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {splitList(call.seeking_genres).length > 0 && (
              <div className="col-span-2"><dt className="text-xs uppercase tracking-wide text-gray-400 mb-1">Seeking genres</dt><dd className="text-gray-800">{call.seeking_genres}</dd></div>
            )}
            {splitList(call.seeking_formats).length > 0 && (
              <div className="col-span-2"><dt className="text-xs uppercase tracking-wide text-gray-400 mb-1">Formats</dt><dd className="text-gray-800">{call.seeking_formats}</dd></div>
            )}
            {budget && <div><dt className="text-xs uppercase tracking-wide text-gray-400 mb-1">Budget</dt><dd className="text-gray-800">{budget}</dd></div>}
            {call.region && <div><dt className="text-xs uppercase tracking-wide text-gray-400 mb-1">Region</dt><dd className="text-gray-800">{call.region}</dd></div>}
            {call.deadline && <div><dt className="text-xs uppercase tracking-wide text-gray-400 mb-1">Deadline</dt><dd className="text-gray-800">{call.deadline}</dd></div>}
          </dl>
        </div>
        {canSubmit && call.status === 'open' && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            {alreadySubmitted ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><Check className="w-4 h-4" /> Submitted</span>
            ) : (
              <button onClick={onSubmit} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold shadow hover:from-purple-500 hover:to-indigo-500 transition">
                <Send className="w-4 h-4" /> Submit your pitch
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post / edit modal
// ---------------------------------------------------------------------------

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 rounded-lg border border-gray-200 bg-gray-50/50">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              type="button"
              key={o}
              onClick={() => onToggle(o)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${on ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-purple-300'}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PostCallModal({ editing, prefill, onClose, onSaved }: { editing: OpenCall | null; prefill?: Partial<OpenCall> | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const allGenres = useMemo(() => [...getGenresSync()], []);
  const allFormats = useMemo(() => [...getFormatsSync()], []);
  const [saving, setSaving] = useState(false);
  // `prefill` seeds a NEW call (from the saved-search bridge) without flipping to
  // edit mode — submit still branches on `editing` only, so prefill → create.
  const [title, setTitle] = useState(editing?.title ?? prefill?.title ?? '');
  const [mandate, setMandate] = useState(editing?.mandate ?? prefill?.mandate ?? '');
  const [genres, setGenres] = useState<string[]>(splitList(editing?.seeking_genres ?? prefill?.seeking_genres ?? null));
  const [formats, setFormats] = useState<string[]>(splitList(editing?.seeking_formats ?? prefill?.seeking_formats ?? null));
  const [budgetMin, setBudgetMin] = useState(editing?.budget_min_usd != null ? String(editing.budget_min_usd) : (prefill?.budget_min_usd != null ? String(prefill.budget_min_usd) : ''));
  const [budgetMax, setBudgetMax] = useState(editing?.budget_max_usd != null ? String(editing.budget_max_usd) : (prefill?.budget_max_usd != null ? String(prefill.budget_max_usd) : ''));
  const [region, setRegion] = useState(editing?.region ?? prefill?.region ?? '');
  const [slots, setSlots] = useState(editing?.slots != null ? String(editing.slots) : '');
  const [deadline, setDeadline] = useState(editing?.deadline ?? '');

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Give your call a title'); return; }
    setSaving(true);
    const payload: CallInput = {
      title: title.trim(),
      mandate: mandate.trim(),
      seekingGenres: genres.join(', '),
      seekingFormats: formats.join(', '),
      budgetMinUsd: budgetMin ? Number(budgetMin) : null,
      budgetMaxUsd: budgetMax ? Number(budgetMax) : null,
      region: region.trim(),
      slots: slots ? Number(slots) : null,
      deadline: deadline || null,
    };
    try {
      if (editing) await callsService.update(editing.id, payload);
      else await callsService.create(payload);
      toast.success(editing ? 'Call updated' : 'Your call is live');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="font-display font-bold text-lg text-gray-900">{editing ? 'Edit call' : 'Post a call'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Title *</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Seeking grounded sci-fi features" maxLength={160} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Mandate</label>
            <textarea className={`${inputCls} min-h-[90px]`} value={mandate} onChange={(e) => setMandate(e.target.value)} placeholder="What are you looking for? Tone, scale, what stands out…" />
          </div>
          <ChipGroup label="Seeking genres" options={allGenres} selected={genres} onToggle={(v) => toggle(genres, setGenres, v)} />
          <ChipGroup label="Formats" options={allFormats} selected={formats} onToggle={(v) => toggle(formats, setFormats, v)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Budget min (USD)</label>
              <input className={inputCls} type="number" min="0" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Budget max (USD)</label>
              <input className={inputCls} type="number" min="0" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="15000000" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Slots</label>
              <input className={inputCls} type="number" min="0" value={slots} onChange={(e) => setSlots(e.target.value)} placeholder="—" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Region</label>
              <input className={inputCls} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. UK / Ireland" maxLength={120} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Deadline</label>
            <input className={inputCls} type="date" value={deadline ?? ''} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 transition">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Save changes' : 'Post call'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submit pitch modal (creator)
// ---------------------------------------------------------------------------

function SubmitPitchModal({ call, onClose, onSubmitted }: { call: OpenCall; onClose: () => void; onSubmitted: () => void }) {
  const toast = useToast();
  const [pitches, setPitches] = useState<MyPitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    pitchService.getMyPitches()
      .then((ps) => setPitches(ps.map((p) => ({ id: Number(p.id), title: p.title ?? 'Untitled', genre: p.genre as string | undefined }))))
      .catch(() => setPitches([]))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!selected) { toast.error('Pick a pitch to submit'); return; }
    setSubmitting(true);
    try {
      await callsService.submit(call.id, selected, message.trim());
      toast.success('Pitch submitted');
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-lg text-gray-900">Submit your pitch</h2>
            <p className="text-xs text-gray-500">to “{call.title}”</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
          ) : pitches.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">You don’t have any pitches yet — create one first, then submit it here.</p>
          ) : (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Choose a pitch</label>
              <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
                {pitches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${selected === p.id ? 'border-purple-500 ring-1 ring-purple-300 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                  >
                    <div className="text-sm font-semibold text-gray-900">{p.title}</div>
                    {p.genre && <div className="text-xs text-gray-500">{p.genre}</div>}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Note to the company (optional)</label>
              <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-purple-500" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why is this a fit?" />
            </>
          )}
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
          <button onClick={submit} disabled={submitting || loading || pitches.length === 0} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 transition">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submissions modal (call owner)
// ---------------------------------------------------------------------------

const SUB_STATUS_STYLE: Record<SubmissionStatus, string> = {
  new: 'bg-gray-100 text-gray-600',
  shortlisted: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  declined: 'bg-red-50 text-red-600 ring-1 ring-red-200',
};

function SubmissionsModal({ call, onClose }: { call: OpenCall; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<CallSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    callsService.submissions(call.id).then(setSubs).catch(() => setSubs([])).finally(() => setLoading(false));
  }, [call.id]);

  const setStatus = async (s: CallSubmission, status: SubmissionStatus) => {
    const previousStatus = s.status;
    setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, status } : x)));
    try {
      await callsService.updateSubmission(s.id, status);
      toast.success(`Submission marked as ${status}`);
    } catch (err) {
      // Revert so the displayed status never diverges from what was saved.
      setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: previousStatus } : x)));
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const toggleSelect = (pitchId: number) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(pitchId)) n.delete(pitchId); else n.add(pitchId);
    return n;
  });
  const compareSelected = () => navigate(`/compare?type=pitch&ids=${Array.from(selected).join(',')}`);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-lg text-gray-900">Submissions</h2>
            <p className="text-xs text-gray-500">“{call.title}”</p>
          </div>
          <div className="flex items-center gap-3">
            {selected.size >= 2 && (
              <button onClick={compareSelected} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold shadow shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition">
                <BarChart3 className="w-3.5 h-3.5" /> Compare {selected.size}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
          ) : subs.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No submissions yet.
            </div>
          ) : (
            <div className="space-y-3">
              {subs.map((s) => (
                <div key={s.id} className={`rounded-xl border p-4 transition ${selected.has(s.pitch_id) ? 'border-purple-300 ring-1 ring-purple-200 bg-purple-50/40' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3 mb-1">
                    <input
                      type="checkbox"
                      checked={selected.has(s.pitch_id)}
                      onChange={() => toggleSelect(s.pitch_id)}
                      className="mt-1 w-4 h-4 accent-purple-600 cursor-pointer flex-shrink-0"
                      aria-label="Select for comparison"
                    />
                    <div className="min-w-0 flex-1">
                      <button onClick={() => navigate(pitchUrl(s.pitch_id))} className="text-sm font-bold text-gray-900 hover:text-purple-700 transition text-left">
                        {s.pitch_title || `Pitch #${s.pitch_id}`}
                      </button>
                      <div className="text-xs text-gray-500">{s.creator_name || 'Unknown'}{s.pitch_genre ? ` · ${s.pitch_genre}` : ''}</div>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${SUB_STATUS_STYLE[s.status]}`}>{s.status}</span>
                  </div>
                  {s.message && <p className="text-sm text-gray-600 mb-3">{s.message}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setStatus(s, 'shortlisted')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition"><Star className="w-3.5 h-3.5" /> Shortlist</button>
                    <button onClick={() => setStatus(s, 'accepted')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"><Check className="w-3.5 h-3.5" /> Accept</button>
                    <button onClick={() => setStatus(s, 'declined')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-gray-100 transition">Decline</button>
                    <button onClick={() => navigate(pitchUrl(s.pitch_id))} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 transition">View pitch <ArrowRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TYPE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'production', label: 'Production' },
  { key: 'investor', label: 'Investor' },
];

export default function OpportunitiesBoard() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, isAuthenticated } = useBetterAuthStore();
  const userType = user?.userType;
  const canPost = isAuthenticated && (userType === 'production' || userType === 'investor');
  const canSubmit = isAuthenticated && (userType === 'creator' || userType === 'production');

  // Keep portal chrome consistent (same fix as /marketplace): authenticated
  // creator/investor/production users browse this inside their PortalLayout sidebar
  // (/<portal>/opportunities) instead of the standalone top-nav page. Watcher/admin/
  // anon keep the standalone page (no in-portal route for them). Query string preserved.
  const isInsidePortal = /^\/(watcher|creator|investor|production|admin)\//.test(location.pathname);
  const portalSeg = getPortalPath(normalizeUserType(userType));
  const inPortalPath = ['creator', 'investor', 'production'].includes(portalSeg) ? `/${portalSeg}/opportunities` : null;
  useEffect(() => {
    if (!isInsidePortal && inPortalPath) {
      void navigate(`${inPortalPath}${location.search}`, { replace: true });
    }
  }, [isInsidePortal, inPortalPath, location.search, navigate]);

  const [calls, setCalls] = useState<OpenCall[]>([]);

  // Saved-search → Open Call bridge: /opportunities?post=1&title=&mandate=&genres=&formats=
  // opens the create form pre-filled so demand is reviewed before it publishes +
  // notifies matching creators. We wait for the in-portal redirect to land first,
  // then consume the params (and strip them so a refresh doesn't reopen the modal).
  useEffect(() => {
    if (!isInsidePortal && inPortalPath) return; // let the redirect above land first
    const params = new URLSearchParams(location.search);
    if (params.get('post') !== '1') return;
    if (canPost) {
      const csv = (k: string) => {
        const v = params.get(k);
        return v ? v.split(',').map((s) => s.trim()).filter(Boolean).join(', ') : undefined;
      };
      setPrefill({
        title: params.get('title') ?? undefined,
        mandate: params.get('mandate') ?? undefined,
        seeking_genres: csv('genres'),
        seeking_formats: csv('formats'),
      } as Partial<OpenCall>);
      setEditing(null);
      setShowPost(true);
    }
    // strip the consumed params either way (canPost or not)
    void navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInsidePortal, inPortalPath, location.search, canPost]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showPost, setShowPost] = useState(false);
  const [editing, setEditing] = useState<OpenCall | null>(null);
  const [prefill, setPrefill] = useState<Partial<OpenCall> | null>(null);
  const [viewing, setViewing] = useState<OpenCall | null>(null);
  const [submitting, setSubmitting] = useState<OpenCall | null>(null);
  const [submissionsFor, setSubmissionsFor] = useState<OpenCall | null>(null);
  const [submittedCallIds, setSubmittedCallIds] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const data = await callsService.list({ type: typeFilter });
      setCalls(data);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMine = async () => {
    if (!canSubmit) return;
    try {
      const mine = await callsService.mySubmissions();
      setSubmittedCallIds(new Set(mine.map((s) => s.call_id)));
    } catch { /* non-blocking */ }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [typeFilter]);
  useEffect(() => { void loadMine();   }, [isAuthenticated]);

  const openCount = calls.filter((c) => c.status === 'open').length;

  const handlePostClick = () => {
    if (!isAuthenticated) { void navigate('/login'); return; }
    setEditing(null); setShowPost(true);
  };

  const handleSubmitClick = (call: OpenCall) => {
    if (!isAuthenticated) { void navigate('/login'); return; }
    setViewing(null); setSubmitting(call);
  };

  const toggleStatus = async (call: OpenCall) => {
    const nextStatus = call.status === 'open' ? 'closed' : 'open';
    try {
      await callsService.update(call.id, { status: nextStatus });
      void load();
      toast.success(nextStatus === 'open' ? 'Call reopened' : 'Call closed to new submissions');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t update the call. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">
      {!isInsidePortal && <PortalTopNav />}

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_60%_at_85%_0%,rgba(245,158,11,0.18),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold tracking-[0.18em] uppercase">
                <Megaphone className="w-3.5 h-3.5" /> Opportunities
              </div>
              <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mb-2">Open Calls</h1>
              <p className="text-white/85 max-w-2xl text-lg">
                What producers and investors are actively looking for — post a mandate, or find the one that fits your story.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-3xl font-bold leading-none">{openCount}</div>
                <div className="text-[11px] uppercase tracking-wide text-white/70 mt-1">Open calls</div>
              </div>
              {canPost && (
                <button onClick={handlePostClick} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-purple-700 font-semibold shadow-lg hover:bg-gray-100 transition">
                  <Plus className="w-5 h-5" /> Post a call
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex items-center gap-2">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                typeFilter === t.key ? 'bg-purple-600 text-white shadow' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-purple-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-purple-500 animate-spin" /></div>
        ) : calls.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-50 text-purple-500 mb-4">
              <Briefcase className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-xl text-gray-900 mb-1">No open calls yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {canPost
                ? 'Be the first to tell creators what you’re looking for.'
                : 'Production companies and investors will post what they’re seeking here. Check back soon.'}
            </p>
            {canPost && (
              <button onClick={handlePostClick} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition">
                <Plus className="w-5 h-5" /> Post the first call
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {calls.map((call) => {
              const isOwner = isAuthenticated && String(user?.id) === String(call.poster_user_id);
              return (
                <CallCard
                  key={call.id}
                  call={call}
                  isOwner={isOwner}
                  canSubmit={canSubmit && !isOwner}
                  alreadySubmitted={submittedCallIds.has(call.id)}
                  onView={() => setViewing(call)}
                  onEdit={() => { setEditing(call); setShowPost(true); }}
                  onToggleStatus={() => toggleStatus(call)}
                  onSubmit={() => handleSubmitClick(call)}
                  onViewSubmissions={() => setSubmissionsFor(call)}
                />
              );
            })}
          </div>
        )}
      </div>

      {showPost && (
        <PostCallModal
          editing={editing}
          prefill={editing ? null : prefill}
          onClose={() => { setShowPost(false); setEditing(null); setPrefill(null); }}
          onSaved={() => { setShowPost(false); setEditing(null); setPrefill(null); void load(); }}
        />
      )}
      {viewing && (
        <ViewCallModal
          call={viewing}
          onClose={() => setViewing(null)}
          canSubmit={canSubmit && String(user?.id) !== String(viewing.poster_user_id)}
          alreadySubmitted={submittedCallIds.has(viewing.id)}
          onSubmit={() => handleSubmitClick(viewing)}
        />
      )}
      {submitting && (
        <SubmitPitchModal
          call={submitting}
          onClose={() => setSubmitting(null)}
          onSubmitted={() => { setSubmitting(null); void loadMine(); void load(); }}
        />
      )}
      {submissionsFor && <SubmissionsModal call={submissionsFor} onClose={() => setSubmissionsFor(null)} />}
    </div>
  );
}
