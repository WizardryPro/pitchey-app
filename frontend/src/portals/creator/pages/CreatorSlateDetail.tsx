import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Layers, Pencil, Check, X, Trash2,
  GripVertical, Film, Eye, Heart, Plus, Globe,
  EyeOff, Search, ExternalLink
} from 'lucide-react';
import { SlateService, type SlateDetail, type SlatePitch } from '@/services/slate.service';
import { apiClient } from '@/lib/api-client';

interface PitchSearchResult {
  id: number;
  title: string;
  logline: string;
  genre: string | null;
  format: string | null;
  title_image: string | null;
  status: string;
}

export default function CreatorSlateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [slate, setSlate] = useState<SlateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Add pitch modal
  const [showAddPitch, setShowAddPitch] = useState(false);
  const [pitchSearch, setPitchSearch] = useState('');
  const [pitchResults, setPitchResults] = useState<PitchSearchResult[]>([]);
  const [searchingPitches, setSearchingPitches] = useState(false);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const slateId = parseInt(id || '0', 10);

  useEffect(() => {
    if (!slateId) return;
    loadSlate();
  }, [slateId]);

  const loadSlate = async () => {
    setLoading(true);
    const data = await SlateService.get(slateId);
    if (data) {
      setSlate(data);
      setEditTitle(data.title);
      setEditDescription(data.description || '');
    }
    setLoading(false);
  };

  const handleSaveDetails = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const updated = await SlateService.update(slateId, {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
    });
    if (updated && slate) {
      setSlate({ ...slate, title: updated.title, description: updated.description });
    }
    setEditing(false);
    setSaving(false);
  };

  const handleTogglePublish = async () => {
    if (!slate) return;
    const newStatus = slate.status === 'published' ? 'draft' : 'published';
    const updated = await SlateService.update(slateId, { status: newStatus });
    if (updated) {
      setSlate({ ...slate, status: newStatus });
    }
  };

  const handleRemovePitch = async (pitchId: number) => {
    if (!slate) return;
    const ok = await SlateService.removePitch(slateId, pitchId);
    if (ok) {
      setSlate({
        ...slate,
        pitches: slate.pitches.filter(p => p.id !== pitchId),
      });
    }
  };

  // Search user's pitches to add
  const searchPitches = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPitchResults([]);
      return;
    }
    setSearchingPitches(true);
    try {
      const res = await apiClient.get<any>(`/api/pitches?search=${encodeURIComponent(query)}&limit=10`);
      const pitches = (res as any)?.data?.pitches ?? (res as any)?.pitches ?? [];
      // Filter out pitches already in the slate
      const existingIds = new Set(slate?.pitches.map(p => p.id) || []);
      setPitchResults(pitches.filter((p: PitchSearchResult) => !existingIds.has(p.id)));
    } catch {
      setPitchResults([]);
    }
    setSearchingPitches(false);
  }, [slate]);

  useEffect(() => {
    const timer = setTimeout(() => searchPitches(pitchSearch), 300);
    return () => clearTimeout(timer);
  }, [pitchSearch, searchPitches]);

  const handleAddPitch = async (pitchId: number) => {
    const ok = await SlateService.addPitch(slateId, pitchId);
    if (ok) {
      await loadSlate();
      // Remove from search results
      setPitchResults(prev => prev.filter(p => p.id !== pitchId));
    }
  };

  // Drag-and-drop reorder
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (targetIndex: number) => {
    if (dragIndex === null || !slate || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const pitches = [...slate.pitches];
    const [moved] = pitches.splice(dragIndex, 1);
    pitches.splice(targetIndex, 0, moved);

    // Optimistic update
    setSlate({ ...slate, pitches });
    setDragIndex(null);
    setDragOverIndex(null);

    // Persist
    await SlateService.reorderPitches(slateId, pitches.map(p => p.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!slate) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Slate not found</p>
        <button onClick={() => navigate('/creator/slates')} className="text-indigo-400 hover:text-indigo-300 mt-2">
          Back to Slates
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => navigate('/creator/slates')}
            className="mt-1 p-1 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            {editing ? (
              <div className="space-y-2">
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="text-2xl font-bold bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white focus:outline-none focus:border-indigo-500 w-full"
                  maxLength={150}
                  autoFocus
                />
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Description..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-gray-300 focus:outline-none focus:border-indigo-500 resize-none text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveDetails} disabled={saving} className="p-1 text-green-400 hover:text-green-300">
                    <Check className="h-5 w-5" />
                  </button>
                  <button onClick={() => { setEditing(false); setEditTitle(slate.title); setEditDescription(slate.description || ''); }} className="p-1 text-gray-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white truncate">{slate.title}</h1>
                  <button onClick={() => setEditing(true)} className="p-1 text-gray-500 hover:text-white transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                {slate.description && <p className="text-gray-400 mt-1">{slate.description}</p>}
              </>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                slate.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/40 text-gray-300'
              }`}>
                {slate.status === 'published' ? 'Published' : 'Draft'}
              </span>
              <span>{slate.pitches.length} pitch{slate.pitches.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleTogglePublish}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              slate.status === 'published'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-green-600 text-white hover:bg-green-500'
            }`}
          >
            {slate.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
            {slate.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button
            onClick={() => setShowAddPitch(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Pitch
          </button>
        </div>
      </div>

      {/* Public link (if published) */}
      {slate.status === 'published' && (
        <div className="bg-green-900/20 border border-green-800/50 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4 text-green-400 shrink-0" />
          <span className="text-green-300">Public link:</span>
          <code className="text-green-400 truncate">/api/slates/{slate.id}/public</code>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/slates/${slate.id}/public`)}
            className="ml-auto text-green-400 hover:text-green-300 shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pitches */}
      {slate.pitches.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-700 rounded-xl">
          <Film className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No pitches in this slate yet</p>
          <button
            onClick={() => setShowAddPitch(true)}
            className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm"
          >
            Add your first pitch
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {slate.pitches.map((pitch, index) => (
            <div
              key={pitch.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
              className={`flex items-center gap-3 bg-gray-800/50 border rounded-lg p-3 transition-all ${
                dragOverIndex === index ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700/50 hover:border-gray-600'
              } ${dragIndex === index ? 'opacity-50' : ''}`}
            >
              <div className="cursor-grab text-gray-600 hover:text-gray-400">
                <GripVertical className="h-5 w-5" />
              </div>

              {/* Thumbnail */}
              <div className="h-16 w-24 bg-gray-700/50 rounded overflow-hidden shrink-0">
                {pitch.cover_image ? (
                  <img src={pitch.cover_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="h-5 w-5 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <h3 className="text-white font-medium truncate">{pitch.title}</h3>
                <p className="text-gray-500 text-sm truncate">{pitch.logline}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {pitch.genre && <span>{pitch.genre}</span>}
                  {pitch.format && <span>{pitch.format}</span>}
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{pitch.view_count}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{pitch.like_count}</span>
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={e => { e.stopPropagation(); handleRemovePitch(pitch.id); }}
                className="p-2 text-gray-600 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Pitch Modal */}
      {showAddPitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddPitch(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Add Pitch to Slate</h2>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={pitchSearch}
                  onChange={e => setPitchSearch(e.target.value)}
                  placeholder="Search your pitches..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px]">
              {searchingPitches ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
                </div>
              ) : pitchResults.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {pitchSearch ? 'No pitches found' : 'Type to search your pitches'}
                </p>
              ) : (
                pitchResults.map(pitch => (
                  <div key={pitch.id} className="flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-700/50 rounded-lg hover:border-gray-600">
                    <div className="h-10 w-16 bg-gray-700/50 rounded overflow-hidden shrink-0">
                      {pitch.title_image ? (
                        <img src={pitch.title_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-4 w-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{pitch.title}</p>
                      <p className="text-gray-500 text-xs truncate">{pitch.genre}{pitch.format ? ` · ${pitch.format}` : ''}</p>
                    </div>
                    <button
                      onClick={() => handleAddPitch(pitch.id)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded transition-colors shrink-0"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-700">
              <button onClick={() => setShowAddPitch(false)} className="w-full py-2 text-gray-400 hover:text-white transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
