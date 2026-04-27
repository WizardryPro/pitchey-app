import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Plus, Search, Eye, EyeOff, Trash2,
  Film, MoreVertical, Pencil, Globe
} from 'lucide-react';
import { SlateService, type Slate } from '@/services/slate.service';

export default function CreatorSlates() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [slates, setSlates] = useState<Slate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  useEffect(() => {
    loadSlates();
  }, []);

  const loadSlates = async () => {
    setLoading(true);
    const data = await SlateService.list();
    setSlates(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const slate = await SlateService.create({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
    });
    if (slate) {
      setSlates(prev => [slate, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setShowCreate(false);
      navigate(`/creator/slates/${slate.id}`);
    }
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this slate? This cannot be undone.')) return;
    const ok = await SlateService.remove(id);
    if (ok) setSlates(prev => prev.filter(s => s.id !== id));
    setMenuOpen(null);
  };

  const handleTogglePublish = async (slate: Slate) => {
    const newStatus = slate.status === 'published' ? 'draft' : 'published';
    const updated = await SlateService.update(slate.id, { status: newStatus });
    if (updated) {
      setSlates(prev => prev.map(s => s.id === slate.id ? { ...s, status: newStatus } : s));
    }
    setMenuOpen(null);
  };

  const filtered = slates.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchQuery && !s.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: slates.length,
    published: slates.filter(s => s.status === 'published').length,
    drafts: slates.filter(s => s.status === 'draft').length,
    totalPitches: slates.reduce((sum, s) => sum + (s.pitch_count || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-purple-600" />
            Slates
          </h1>
          <p className="text-gray-600 mt-1">Curate collections of related pitches</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Slate
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Slates', value: stats.total, icon: Layers },
          { label: 'Published', value: stats.published, icon: Globe },
          { label: 'Drafts', value: stats.drafts, icon: Pencil },
          { label: 'Total Pitches', value: stats.totalPitches, icon: Film },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <stat.icon className="h-4 w-4" />
              {stat.label}
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search slates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'published', 'draft'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                statusFilter === s
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Slate</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Sci-Fi Collection"
                  maxLength={150}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="What's this slate about?"
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || creating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slate List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-xl">
          <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 text-lg">
            {slates.length === 0 ? 'No slates yet' : 'No slates match your filters'}
          </p>
          {slates.length === 0 && (
            <p className="text-gray-500 mt-1">Create a slate to curate and share collections of pitches</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(slate => (
            <div
              key={slate.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => navigate(`/creator/slates/${slate.id}`)}
            >
              {/* Cover */}
              <div className="h-32 bg-gradient-to-br from-purple-100 to-indigo-100 relative">
                {slate.cover_image && (
                  <img src={slate.cover_image} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    slate.status === 'published'
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {slate.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
                {/* Menu */}
                <div className="absolute top-2 left-2">
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === slate.id ? null : slate.id); }}
                    className="p-1 rounded bg-white/90 text-gray-600 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen === slate.id && (
                    <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[160px] z-10">
                      <button
                        onClick={e => { e.stopPropagation(); handleTogglePublish(slate); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {slate.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {slate.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(slate.id); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="text-gray-900 font-semibold truncate">{slate.title}</h3>
                {slate.description && (
                  <p className="text-gray-600 text-sm mt-1 line-clamp-2">{slate.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Film className="h-3.5 w-3.5" />
                    {slate.pitch_count || 0} pitches
                  </span>
                  <span>{new Date(slate.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
