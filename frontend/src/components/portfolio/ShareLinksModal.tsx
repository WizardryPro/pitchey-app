import { useState, useEffect } from 'react';
import { X, Copy, Check, Link2, Eye, Trash2, Plus } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

interface ShareLink {
  id: number;
  token: string;
  label: string | null;
  view_count: number;
  revoked_at: string | null;
  created_at: string;
}

interface ShareLinksModalProps {
  onClose: () => void;
}

export default function ShareLinksModal({ onClose }: ShareLinksModalProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const getShareUrl = (token: string) => `${window.location.origin}/portfolio/s/${token}`;

  useEffect(() => {
    fetchLinks();
  }, []);

  async function fetchLinks() {
    try {
      const res = await apiClient.get<{ links: ShareLink[] }>('/api/creator/share-links');
      if (res.success && res.data) {
        setLinks(res.data.links);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await apiClient.post<ShareLink>('/api/creator/share-links', {
        label: newLabel.trim() || undefined,
      });
      if (res.success && res.data) {
        setLinks(prev => [{ ...res.data!, revoked_at: null } as ShareLink, ...prev]);
        setNewLabel('');
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      const res = await apiClient.delete<{ success: boolean }>(`/api/creator/share-links/${id}`);
      if (res.success) {
        setLinks(prev =>
          prev.map(l => (l.id === id ? { ...l, revoked_at: new Date().toISOString() } : l))
        );
      }
    } catch {
      // silent
    }
  }

  function handleCopy(link: ShareLink) {
    navigator.clipboard.writeText(getShareUrl(link.token));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const activeLinks = links.filter(l => !l.revoked_at);
  const revokedLinks = links.filter(l => l.revoked_at);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Share Portfolio</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create new link */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Label (e.g. For Netflix)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {creating ? 'Creating...' : 'Generate Link'}
            </button>
          </div>
        </div>

        {/* Links list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading...</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No share links yet. Generate one above to share your portfolio.
            </p>
          ) : (
            <>
              {activeLinks.map(link => (
                <div key={link.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {link.label || 'Untitled Link'}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Eye className="w-3.5 h-3.5" />
                      {link.view_count} views
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-gray-600 bg-gray-50 px-2 py-1.5 rounded truncate">
                      {getShareUrl(link.token)}
                    </code>
                    <button
                      onClick={() => handleCopy(link)}
                      className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                      title="Copy link"
                    >
                      {copiedId === link.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevoke(link.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Revoke link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Created {new Date(link.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}

              {revokedLinks.length > 0 && (
                <>
                  <div className="text-xs text-gray-400 uppercase tracking-wide pt-2">Revoked</div>
                  {revokedLinks.map(link => (
                    <div key={link.id} className="border border-gray-100 rounded-lg p-3 opacity-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 line-through">
                          {link.label || 'Untitled Link'}
                        </span>
                        <span className="text-xs text-red-500 font-medium">Revoked</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {link.view_count} views &middot; Created {new Date(link.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
