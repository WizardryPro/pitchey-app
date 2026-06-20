import { useEffect, useState, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { formatNumber } from '@shared/utils/formatters';

// Deal negotiation thread (disintermediation defense P3). Shared by the creator
// deal inbox and the production deals page — role-neutral, deal-scoped. Keeps the
// back-and-forth (and any proposed terms) on Pitchey instead of in email.

interface DealMessage {
  id: number;
  sender_id: number;
  sender_role: 'creator' | 'production';
  kind: 'message' | 'counter';
  body: string | null;
  proposed_amount: number | null;
  proposed_terms: string | null;
  created_at: string;
  sender_name: string | null;
}

export default function DealThread({ dealId }: { dealId: number }) {
  const [messages, setMessages] = useState<DealMessage[] | null>(null);
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ messages: DealMessage[] }>(`/api/deals/${dealId}/messages`);
      setMessages(res?.success && res.data?.messages ? res.data.messages : []);
    } catch {
      setMessages([]);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const send = useCallback(async () => {
    const payload: Record<string, unknown> = {};
    if (text.trim()) payload.body = text.trim();
    if (amount.trim()) payload.proposedAmount = Number(amount);
    if (!payload.body && payload.proposedAmount === undefined) return;
    setBusy(true);
    try {
      await apiClient.post(`/api/deals/${dealId}/messages`, payload);
      setText('');
      setAmount('');
      await load();
    } catch {
      /* best-effort; reload reflects truth */
    } finally {
      setBusy(false);
    }
  }, [dealId, text, amount, load]);

  return (
    <div className="mt-3 rounded-lg bg-gray-50 p-3">
      {messages === null ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading thread…
        </div>
      ) : messages.length === 0 ? (
        <p className="text-xs text-gray-400 py-1">No messages yet. Start the negotiation here to keep it on Pitchey.</p>
      ) : (
        <ul className="space-y-2 mb-3 max-h-64 overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{m.sender_name ?? 'User'}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-400">{m.sender_role}</span>
                {m.kind === 'counter' && (
                  <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-blue-100 text-blue-700">counter</span>
                )}
                <span className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              {m.body && <p className="text-gray-700">{m.body}</p>}
              {(m.proposed_amount != null || m.proposed_terms) && (
                <p className="text-xs text-blue-700">
                  Proposed{m.proposed_amount != null ? ` €${formatNumber(m.proposed_amount)}` : ''}
                  {m.proposed_terms ? ` · ${m.proposed_terms}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          aria-label="Message"
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          placeholder="Message…"
        />
        <input
          type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
          aria-label="Proposed amount"
          className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          placeholder="€ amount"
        />
        <button
          type="button" disabled={busy}
          onClick={() => void send()}
          aria-label="Send"
          className="inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
