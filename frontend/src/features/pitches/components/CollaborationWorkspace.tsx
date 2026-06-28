import { useEffect, useState } from 'react';
import { Users, FileText, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ProductionService } from '@portals/production/services/production.service';
import type { ProductionNoteResponse, ProductionTeamMember } from '@portals/production/services/production.service';

/**
 * CollaborationWorkspace — the creator-facing view of a pitch-scoped collaboration's
 * SHARED workspace (Team Plan + Notes). Once a creator accepts a producer's
 * collaboration, both co-edit the same rows via the production workspace endpoints
 * (the backend's resolveWorkspace authorises the creator for an accepted collab).
 * Deliberately focused: Notes (add/list/delete) + Team Plan (roster co-edit) — the
 * two surfaces the producer plans on.
 */
const STATUS_OPTS: ProductionTeamMember['status'][] = ['confirmed', 'considering', 'pending'];
const NOTE_CATEGORIES = ['general', 'casting', 'location', 'budget', 'schedule', 'team'] as const;

export default function CollaborationWorkspace({ pitchId, partnerName }: { pitchId: number; partnerName?: string }) {
  const [notes, setNotes] = useState<ProductionNoteResponse[]>([]);
  const [team, setTeam] = useState<ProductionTeamMember[]>([]);
  const [newNote, setNewNote] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [loading, setLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [n, t] = await Promise.all([
          ProductionService.getPitchNotes(pitchId).catch(() => []),
          ProductionService.getPitchTeam(pitchId).catch(() => []),
        ]);
        if (!cancelled) { setNotes(n); setTeam(t); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pitchId]);

  const addNote = async () => {
    const content = newNote.trim();
    if (!content || addingNote) return;
    setAddingNote(true);
    try {
      const note = await ProductionService.createPitchNote(pitchId, { content, category });
      setNotes((prev) => [...prev, note]);
      setNewNote('');
    } catch {
      toast.error('Could not add note.');
    } finally {
      setAddingNote(false);
    }
  };

  const deleteNote = async (id: number) => {
    const prev = notes;
    setNotes(notes.filter((n) => n.id !== id));
    try {
      await ProductionService.deletePitchNote(pitchId, id);
    } catch {
      setNotes(prev);
      toast.error('Could not delete note.');
    }
  };

  const updateRole = (i: number, field: keyof ProductionTeamMember, value: string) =>
    setTeam((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  const addRole = () => setTeam((prev) => [...prev, { role: '', name: '', status: 'pending' }]);
  const removeRole = (i: number) => setTeam((prev) => prev.filter((_, idx) => idx !== i));
  const saveTeam = async () => {
    setSavingTeam(true);
    try {
      await ProductionService.updatePitchTeam(pitchId, team.filter((m) => m.role || m.name));
      toast.success('Team plan saved.');
    } catch {
      toast.error('Could not save the team plan.');
    } finally {
      setSavingTeam(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" /> <span className="ml-2 text-sm">Loading shared workspace…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-200 px-4 py-3 text-sm text-emerald-800">
        You're co-developing this pitch with <span className="font-semibold">{partnerName || 'the production company'}</span>.
        Anything you add here is shared between the two of you.
      </div>

      {/* Team Plan */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <Users className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-bold tracking-tight text-gray-900">Team Plan</h3>
        </div>
        <div className="space-y-2">
          {team.length === 0 && <p className="text-sm text-gray-400">No roles yet — add the key roles you'd attach.</p>}
          {team.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={m.role}
                onChange={(e) => updateRole(i, 'role', e.target.value)}
                placeholder="Role (e.g. Director)"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <input
                value={m.name}
                onChange={(e) => updateRole(i, 'name', e.target.value)}
                placeholder="Name"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <select
                value={m.status}
                onChange={(e) => updateRole(i, 'status', e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              >
                {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => removeRole(i)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="Remove role">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={addRole} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            <Plus className="h-4 w-4" /> Add role
          </button>
          <button onClick={saveTeam} disabled={savingTeam} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {savingTeam ? 'Saving…' : 'Save team plan'}
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <FileText className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-bold tracking-tight text-gray-900">Notes</h3>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {NOTE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition ${
                  category === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note for your collaborator…"
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button onClick={addNote} disabled={addingNote || !newNote.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              <Plus className="h-4 w-4" /> {addingNote ? 'Adding…' : 'Add note'}
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {notes.length === 0 && <p className="text-sm text-gray-400">No notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg bg-gray-50 px-3.5 py-3 ring-1 ring-inset ring-gray-100">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-500 ring-1 ring-inset ring-indigo-100">{n.category}</span>
                <button onClick={() => deleteNote(n.id)} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500" aria-label="Delete note">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{n.content}</p>
              {n.author && <p className="mt-1 text-[0.68rem] text-gray-400">— {n.author}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
