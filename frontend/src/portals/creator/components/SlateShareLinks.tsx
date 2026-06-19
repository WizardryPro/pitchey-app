import { useEffect, useState, useCallback } from 'react';
import { Link2, Copy, Check, Trash2, Eye, Plus } from 'lucide-react';
import { SlateService, type SlateShareLink } from '../../../services/slate.service';

// Tracked slate share links panel (moat #5) — mint per-share tokens with view
// counts + revocation. Lives in the slate editor.

function shareUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/slates/s/${token}`;
}

export default function SlateShareLinks({ slateId, published }: { slateId: number; published: boolean }) {
  const [links, setLinks] = useState<SlateShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLinks(await SlateService.listShareLinks(slateId));
    setLoading(false);
  }, [slateId]);

  useEffect(() => { void load(); }, [load]);

  const create = useCallback(async () => {
    setCreating(true);
    const link = await SlateService.createShareLink(slateId, label.trim() || undefined);
    if (link) { setLabel(''); await load(); }
    setCreating(false);
  }, [slateId, label, load]);

  const revoke = useCallback(async (id: number) => {
    if (await SlateService.revokeShareLink(id)) await load();
  }, [load]);

  const copy = useCallback(async (token: string) => {
    try { await navigator.clipboard.writeText(shareUrl(token)); setCopied(token); setTimeout(() => setCopied(null), 1500); }
    catch { /* clipboard blocked — no-op */ }
  }, []);

  const active = links.filter((l) => !l.revoked_at);

  return (
    <section data-testid="slate-share-links" className="bg-white rounded-xl ring-1 ring-gray-100 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="w-5 h-5 text-purple-600" />
        <h3 className="font-bold text-gray-900">Share this slate</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Create tracked links to send to investors &amp; producers — see how many times each was opened.
      </p>

      {!published && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          Publish this slate to make shared links viewable.
        </p>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Investor outreach)" aria-label="Share link label"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <button
          type="button" onClick={create} disabled={creating}
          className="inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5"
        >
          <Plus className="w-4 h-4" /> New link
        </button>
      </div>

      {loading ? (
        <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
      ) : active.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">No share links yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {active.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="font-medium text-gray-800 truncate">{l.label || 'Untitled link'}</div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {l.view_count} view{l.view_count === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button" onClick={() => copy(l.token)} aria-label="Copy link"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-purple-600 rounded-lg px-2 py-1"
                >
                  {copied === l.token ? <><Check className="w-4 h-4 text-green-600" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
                <button
                  type="button" onClick={() => revoke(l.id)} aria-label="Revoke link"
                  className="text-gray-400 hover:text-red-600 rounded-lg p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
