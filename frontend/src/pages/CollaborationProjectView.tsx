import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckSquare, FileText, MessageSquare, Activity,
  Eye, Lock, Plus, User, Calendar, DollarSign, Flag,
  CheckCircle, Square,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  CollaboratorService,
  type CollaborationProject,
  type CollaborationNote,
  type ActivityEntry,
} from '@/services/collaborator.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'checklist' | 'notes' | 'chat' | 'activity';

type NoteCategory = 'all' | 'casting' | 'location' | 'budget' | 'schedule' | 'team' | 'general';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  assigned_role: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stageColor(stage: string): string {
  switch (stage.toLowerCase()) {
    case 'development': return 'bg-blue-100 text-blue-800';
    case 'pre-production': return 'bg-yellow-100 text-yellow-800';
    case 'production': return 'bg-green-100 text-green-800';
    case 'post-production': return 'bg-purple-100 text-purple-800';
    case 'distribution': return 'bg-pink-100 text-pink-800';
    case 'completed': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function mapActionLabel(action: string): string {
  const map: Record<string, string> = {
    checklist_toggled: 'toggled a checklist item',
    note_added: 'added a note',
    collaborator_invited: 'invited a collaborator',
    invitation_accepted: 'accepted an invitation',
    collaborator_removed: 'removed a collaborator',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}

function relativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

const NOTE_CATEGORIES: NoteCategory[] = [
  'all', 'casting', 'location', 'budget', 'schedule', 'team', 'general',
];

const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  all: 'All',
  casting: 'Casting',
  location: 'Location',
  budget: 'Budget',
  schedule: 'Schedule',
  team: 'Team',
  general: 'General',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  id,
  active,
  icon: Icon,
  label,
  onClick,
}: {
  id: TabId;
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: (id: TabId) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-purple-600 text-purple-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab({ project }: { project: CollaborationProject }) {
  return (
    <div className="space-y-6">
      {/* Stage + completion */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Project Status</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${stageColor(project.stage)}`}>
            {project.stage}
          </span>
        </div>

        {/* Completion bar */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-600">Overall completion</span>
          <span className="text-sm font-semibold text-purple-700">{project.completion_percentage}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, project.completion_percentage))}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-purple-600" />
          Timeline
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide mb-1">Start Date</dt>
            <dd className="text-sm font-medium text-gray-900">{formatDate(project.start_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide mb-1">Target Completion</dt>
            <dd className="text-sm font-medium text-gray-900">{formatDate(project.target_completion_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide mb-1">Next Milestone</dt>
            <dd className="text-sm font-medium text-gray-900">
              {project.next_milestone
                ? (
                  <span className="flex items-center gap-1">
                    <Flag className="h-3 w-3 text-purple-500" />
                    {project.next_milestone}
                    {project.milestone_date && (
                      <span className="text-gray-500 font-normal"> · {formatDate(project.milestone_date)}</span>
                    )}
                  </span>
                )
                : 'No upcoming milestone'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Budget */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-purple-600" />
          Budget
        </h3>
        {project.budget_visible ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <dt className="text-xs text-gray-500 uppercase tracking-wide mb-1">Allocated</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {project.budget_allocated !== undefined ? formatCurrency(project.budget_allocated) : '—'}
              </dd>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <dt className="text-xs text-gray-500 uppercase tracking-wide mb-1">Spent</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {project.budget_spent !== undefined ? formatCurrency(project.budget_spent) : '—'}
              </dd>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <dt className="text-xs text-purple-600 uppercase tracking-wide mb-1">Remaining</dt>
              <dd className="text-lg font-semibold text-purple-700">
                {project.budget_remaining !== undefined ? formatCurrency(project.budget_remaining) : '—'}
              </dd>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Budget details not shared for this project.</p>
        )}
      </div>

      {/* Owner */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-purple-600" />
          Project Owner
        </h3>
        <div className="flex items-center gap-3">
          {project.owner.avatar_url ? (
            <img
              src={project.owner.avatar_url}
              alt={project.owner.name}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-purple-100"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center ring-2 ring-purple-200">
              <User className="h-5 w-5 text-purple-600" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">{project.owner.name}</p>
            <p className="text-xs text-gray-500">Project Owner</p>
          </div>
        </div>

        {project.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Project Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist tab
// ---------------------------------------------------------------------------

function ChecklistTab({
  projectId,
  myRole,
}: {
  projectId: number;
  myRole: string;
}) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    void loadChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const res = await CollaboratorService.getCollaborationChecklist(projectId);
      if (res.success && res.data?.checklist) {
        // Normalize checklist from server — could be a flat object or array
        const raw = res.data.checklist;
        if (Array.isArray(raw)) {
          setItems(raw as ChecklistItem[]);
        } else if (typeof raw === 'object' && raw !== null) {
          const normalized: ChecklistItem[] = Object.entries(raw).map(([id, val]) => {
            if (typeof val === 'object' && val !== null) {
              const v = val as Record<string, unknown>;
              return {
                id,
                label: (v['label'] as string | undefined) ?? id,
                completed: Boolean(v['completed']),
                assigned_role: (v['assigned_role'] as string | undefined) ?? '',
              };
            }
            return { id, label: id, completed: Boolean(val), assigned_role: '' };
          });
          setItems(normalized);
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(`Failed to load checklist: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (item: ChecklistItem) => {
    if (toggling) return;
    const isMine = !item.assigned_role || item.assigned_role === myRole;
    if (!isMine) return;

    const prev = items;
    setItems(current =>
      current.map(i => (i.id === item.id ? { ...i, completed: !i.completed } : i))
    );
    setToggling(item.id);

    try {
      const res = await CollaboratorService.toggleChecklistItem(projectId, item.id, !item.completed);
      if (!res.success) {
        setItems(prev);
        toast.error(res.error ?? 'Failed to update checklist item');
      } else {
        toast.success(item.completed ? 'Item unchecked' : 'Item checked');
      }
    } catch (err) {
      setItems(prev);
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(`Error: ${e.message}`);
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <CheckSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No checklist items for this project yet.</p>
      </div>
    );
  }

  const completed = items.filter(i => i.completed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {completed} of {items.length} items completed
        </p>
        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 rounded-full transition-all"
            style={{ width: `${items.length > 0 ? (completed / items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {items.map(item => {
          const isMine = !item.assigned_role || item.assigned_role === myRole;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 ${isMine ? 'hover:bg-purple-50' : ''}`}
            >
              {isMine ? (
                <button
                  onClick={() => void handleToggle(item)}
                  disabled={toggling === item.id}
                  className="flex-shrink-0 text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
                  aria-label={item.completed ? 'Uncheck item' : 'Check item'}
                >
                  {item.completed ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
              ) : (
                <Lock className="h-5 w-5 flex-shrink-0 text-gray-300" />
              )}

              <span
                className={`flex-1 text-sm ${
                  item.completed ? 'line-through text-gray-400' : 'text-gray-800'
                }`}
              >
                {item.label}
              </span>

              {item.assigned_role && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                  {item.assigned_role}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes tab
// ---------------------------------------------------------------------------

function NotesTab({ projectId }: { projectId: number }) {
  const [notes, setNotes] = useState<CollaborationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory>('all');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<Exclude<NoteCategory, 'all'>>('general');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const res = await CollaboratorService.getCollaborationNotes(projectId);
      if (res.success && res.data?.notes) {
        setNotes(res.data.notes);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(`Failed to load notes: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newContent.trim();
    if (!content) return;

    setSubmitting(true);
    try {
      const res = await CollaboratorService.addCollaborationNote(projectId, {
        content,
        category: newCategory,
      });
      if (res.success && res.data?.note) {
        setNotes(prev => [res.data!.note, ...prev]);
        setNewContent('');
        setNewCategory('general');
        toast.success('Note added');
      } else {
        toast.error(res.error ?? 'Failed to add note');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = categoryFilter === 'all'
    ? notes
    : notes.filter(n => n.category === categoryFilter);

  const categoryColors: Record<string, string> = {
    casting: 'bg-pink-100 text-pink-700',
    location: 'bg-green-100 text-green-700',
    budget: 'bg-yellow-100 text-yellow-700',
    schedule: 'bg-blue-100 text-blue-700',
    team: 'bg-indigo-100 text-indigo-700',
    general: 'bg-gray-100 text-gray-600',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add note form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-purple-600" />
          Add a Note
        </h3>
        <form onSubmit={(e) => void handleAddNote(e)} className="space-y-3">
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Write your note here..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <div className="flex items-center gap-3">
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as Exclude<NoteCategory, 'all'>)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {NOTE_CATEGORIES.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>{NOTE_CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting || !newContent.trim()}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Note
            </button>
          </div>
        </form>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {NOTE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {NOTE_CATEGORY_LABELS[cat]}
            {cat !== 'all' && (
              <span className="ml-1 opacity-70">
                ({notes.filter(n => n.category === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {categoryFilter === 'all' ? 'No notes yet. Be the first to add one.' : `No ${categoryFilter} notes yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(note => (
            <div key={note.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    categoryColors[note.category] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {NOTE_CATEGORY_LABELS[note.category as NoteCategory] ?? note.category}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">{relativeTime(note.created_at)}</span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{note.content}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <User className="h-3 w-3" />
                {note.author}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team Chat tab
// ---------------------------------------------------------------------------

function TeamChatTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
      <MessageSquare className="h-12 w-12 text-gray-300 mb-4" />
      <p className="text-base font-medium text-gray-700 mb-1">Project messaging coming soon</p>
      <p className="text-sm text-gray-400 text-center max-w-xs">
        Team chat for collaborators will be available in a future update.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity tab
// ---------------------------------------------------------------------------

function ActivityTab({ projectId }: { projectId: number }) {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      const res = await CollaboratorService.getCollaborationActivity(projectId, { limit: 50 });
      if (res.success && res.data?.activity) {
        setActivity(res.data.activity);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(`Failed to load activity: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No activity recorded for this project yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {activity.map(entry => (
        <div key={entry.id} className="flex items-start gap-3 px-5 py-4">
          {/* Avatar */}
          {entry.user.avatar_url ? (
            <img
              src={entry.user.avatar_url}
              alt={entry.user.name}
              className="h-8 w-8 rounded-full object-cover flex-shrink-0 ring-2 ring-purple-100 mt-0.5"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <User className="h-4 w-4 text-purple-600" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">
              <span className="font-medium">{entry.user.name}</span>
              {' '}
              <span className="text-gray-500">{mapActionLabel(entry.action)}</span>
            </p>
            {entry.user.role && (
              <p className="text-xs text-gray-400 mt-0.5">{entry.user.role}</p>
            )}
          </div>

          <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{relativeTime(entry.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CollaborationProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<CollaborationProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const numericProjectId = projectId ? parseInt(projectId, 10) : NaN;

  useEffect(() => {
    if (isNaN(numericProjectId)) {
      setError('Invalid project ID');
      setLoading(false);
      return;
    }
    void loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericProjectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await CollaboratorService.getCollaborationProject(numericProjectId);
      if (res.success && res.data?.project) {
        setProject(res.data.project);
      } else {
        setError(res.error ?? 'Project not found');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ----- Loading state -----
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  // ----- Error state -----
  if (error || !project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-red-700 mb-1">Unable to load project</p>
          <p className="text-sm text-red-500 mb-4">{error ?? 'An unknown error occurred'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'checklist', label: 'Checklist', icon: CheckSquare },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'chat', label: 'Team Chat', icon: MessageSquare },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Your role:{' '}
              <span className="font-medium text-purple-700">
                {project.my_role}
              </span>
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide ${stageColor(project.stage)}`}>
            {project.stage}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex -mb-px">
          {tabs.map(tab => (
            <TabButton
              key={tab.id}
              id={tab.id}
              active={activeTab === tab.id}
              icon={tab.icon}
              label={tab.label}
              onClick={setActiveTab}
            />
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab project={project} />}
      {activeTab === 'checklist' && (
        <ChecklistTab projectId={numericProjectId} myRole={project.my_role} />
      )}
      {activeTab === 'notes' && <NotesTab projectId={numericProjectId} />}
      {activeTab === 'chat' && <TeamChatTab />}
      {activeTab === 'activity' && <ActivityTab projectId={numericProjectId} />}
    </div>
  );
}
