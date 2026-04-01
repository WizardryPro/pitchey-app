import React, { useState, useEffect } from 'react';
import { UserPlus, Copy, Check, Link2, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Invite {
  id: number;
  code: string;
  email: string | null;
  inviter_name: string;
  redeemed_at: string | null;
  expires_at: string;
  created_at: string;
  redeemed_by_name: string | null;
  redeemed_by_email: string | null;
}

export default function ProductionInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const loadInvites = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ invites: Invite[] }>('/api/invites');
      if (response.success && response.data?.invites) {
        setInvites(response.data.invites);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvites();
  }, []);

  const createInvite = async () => {
    try {
      setCreating(true);
      setError(null);
      const body = email.trim() ? { email: email.trim() } : {};
      const response = await apiClient.post<{ code: string; url: string }>('/api/invites', body);
      if (response.success && response.data?.code) {
        setEmail('');
        await loadInvites();
        copyToClipboard(response.data.code);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Invite Creators</h1>
        <p className="mt-1 text-gray-600">
          Share invite links with writers and creators so they can submit pitches directly to you.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Create invite */}
      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-purple-600" />
          Generate Invite Link
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Create a link to share with a creator. They'll see your name when they sign up.
        </p>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="Creator's email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={() => { void createInvite(); }}
            disabled={creating}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            Create Link
          </button>
        </div>
      </div>

      {/* Invite list */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Your Invites</h2>
          <p className="text-sm text-gray-500 mt-1">
            {invites.length} invite{invites.length !== 1 ? 's' : ''} created
          </p>
        </div>

        {invites.length === 0 ? (
          <div className="text-center py-16">
            <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No invites yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first invite link above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {invites.map((invite) => {
              const expired = isExpired(invite.expires_at);
              const redeemed = !!invite.redeemed_at;
              return (
                <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                        {invite.code}
                      </code>
                      {redeemed ? (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Redeemed</span>
                      ) : expired ? (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Expired</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Active</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {invite.email && <span>Sent to {invite.email} · </span>}
                      Created {new Date(invite.created_at).toLocaleDateString()}
                      {redeemed && invite.redeemed_by_name && (
                        <span className="text-green-600"> · Signed up as {invite.redeemed_by_name}</span>
                      )}
                    </div>
                  </div>
                  {!redeemed && !expired && (
                    <button
                      onClick={() => copyToClipboard(invite.code)}
                      className="ml-4 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      {copiedCode === invite.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Link
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
