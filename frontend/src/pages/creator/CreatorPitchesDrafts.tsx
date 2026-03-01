import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Edit3, Trash2, Save, Clock, AlertCircle,
  Plus, Search, Filter, Calendar, Eye, Copy,
  MoreVertical, Tag, Globe, Lock, CheckCircle
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { PitchService, type Pitch } from '../../services/pitch.service';

interface DraftPitch {
  id: string;
  title: string;
  logline?: string;
  genre: string[];
  status: 'draft' | 'auto-saved' | 'needs-review';
  lastSaved: string;
  progress: number;
  wordCount: number;
  isPublic: boolean;
  completionStatus: {
    basicInfo: boolean;
    characters: boolean;
    plot: boolean;
    budget: boolean;
    production: boolean;
  };
  createdDate: string;
  autosaveEnabled: boolean;
}

// Calculate completion progress based on filled fields
function calculateProgress(pitch: Pitch): number {
  let filledFields = 0;
  let totalFields = 10;

  if (pitch.title) filledFields++;
  if (pitch.logline) filledFields++;
  if (pitch.genre) filledFields++;
  if (pitch.format) filledFields++;
  if (pitch.shortSynopsis || pitch.longSynopsis) filledFields++;
  if (pitch.characters && pitch.characters.length > 0) filledFields++;
  if (pitch.budgetBracket || pitch.estimatedBudget) filledFields++;
  if (pitch.titleImage) filledFields++;
  if (pitch.targetAudience) filledFields++;
  if (pitch.themes) filledFields++;

  return Math.round((filledFields / totalFields) * 100);
}

// Transform API pitch to local draft format
function transformToDraft(apiPitch: Pitch): DraftPitch {
  const progress = calculateProgress(apiPitch);

  // Determine completion status
  const completionStatus = {
    basicInfo: !!(apiPitch.title && apiPitch.logline && apiPitch.genre),
    characters: !!(apiPitch.characters && apiPitch.characters.length > 0),
    plot: !!(apiPitch.shortSynopsis || apiPitch.longSynopsis),
    budget: !!(apiPitch.budgetBracket || apiPitch.estimatedBudget),
    production: !!(apiPitch.productionTimeline)
  };

  // Map status
  let status: 'draft' | 'auto-saved' | 'needs-review' = 'draft';
  if (apiPitch.status === 'under_review') {
    status = 'needs-review';
  }

  // Estimate word count from synopsis
  const wordCount =
    ((apiPitch.shortSynopsis || '').split(/\s+/).length || 0) +
    ((apiPitch.longSynopsis || '').split(/\s+/).length || 0);

  return {
    id: String(apiPitch.id),
    title: apiPitch.title,
    logline: apiPitch.logline,
    genre: apiPitch.genre ? [apiPitch.genre.charAt(0).toUpperCase() + apiPitch.genre.slice(1)] : [],
    status,
    lastSaved: apiPitch.updatedAt,
    progress,
    wordCount,
    isPublic: false, // Drafts are not public
    completionStatus,
    createdDate: apiPitch.createdAt,
    autosaveEnabled: true
  };
}

interface DraftFilters {
  status: 'all' | 'draft' | 'auto-saved' | 'needs-review';
  genre: string;
  timeRange: '1d' | '7d' | '30d' | 'all';
  completion: 'all' | 'incomplete' | 'complete';
}

export default function CreatorPitchesDrafts() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftPitch[]>([]);
  const [filteredDrafts, setFilteredDrafts] = useState<DraftPitch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DraftFilters>({
    status: 'all',
    genre: 'all',
    timeRange: 'all',
    completion: 'all'
  });
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);

  useEffect(() => {
    loadDrafts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [drafts, filters, searchQuery]);

  const loadDrafts = async () => {
    try {
      setLoading(true);

      const myPitches = await PitchService.getMyPitches();

      // Filter to only draft and under_review pitches
      const draftPitches = myPitches
        .filter((p: Pitch) => p.status === 'draft' || p.status === 'under_review')
        .map(transformToDraft);

      setDrafts(draftPitches);
    } catch (error) {
      console.error('Failed to load drafts:', error);
      // Keep empty array on error
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...drafts];

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(draft =>
        draft.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        draft.logline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        draft.genre.some(g => g.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(draft => draft.status === filters.status);
    }

    // Apply genre filter
    if (filters.genre !== 'all') {
      filtered = filtered.filter(draft => draft.genre.includes(filters.genre));
    }

    // Apply completion filter
    if (filters.completion !== 'all') {
      if (filters.completion === 'complete') {
        filtered = filtered.filter(draft => draft.progress >= 90);
      } else {
        filtered = filtered.filter(draft => draft.progress < 90);
      }
    }

    // Apply time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const timeRanges: Record<string, number> = {
        '1d': 1 * 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const rangeMs = timeRanges[filters.timeRange];
      if (rangeMs) {
        const cutoff = new Date(now.getTime() - rangeMs);
        filtered = filtered.filter(draft => new Date(draft.lastSaved) > cutoff);
      }
    }

    setFilteredDrafts(filtered);
  };

  const handleSelectDraft = (draftId: string) => {
    setSelectedDrafts(prev =>
      prev.includes(draftId)
        ? prev.filter(id => id !== draftId)
        : [...prev, draftId]
    );
  };

  const handleSelectAll = () => {
    if (selectedDrafts.length === filteredDrafts.length) {
      setSelectedDrafts([]);
    } else {
      setSelectedDrafts(filteredDrafts.map(d => d.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDrafts.length === 0) return;
    try {
      await Promise.all(
        selectedDrafts.map(id => PitchService.delete(Number(id)).catch(() => null))
      );
      setDrafts(prev => prev.filter(draft => !selectedDrafts.includes(draft.id)));
      setSelectedDrafts([]);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const handleDuplicateDraft = async (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      const newDraft: DraftPitch = {
        ...draft,
        id: String(Date.now()),
        title: `${draft.title} (Copy)`,
        createdDate: new Date().toISOString(),
        lastSaved: new Date().toISOString(),
        status: 'draft'
      };
      setDrafts(prev => [newDraft, ...prev]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'auto-saved': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'needs-review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'auto-saved': return Save;
      case 'draft': return Edit3;
      case 'needs-review': return AlertCircle;
      default: return FileText;
    }
  };

  const formatLastSaved = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'bg-red-500';
    if (progress < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Draft Pitches</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage your work-in-progress pitches and drafts
            </p>
          </div>
          <button
            onClick={() => navigate('/create-pitch')}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Pitch
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search drafts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="auto-saved">Auto-saved</option>
                <option value="needs-review">Needs Review</option>
              </select>

              <select
                value={filters.genre}
                onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Genres</option>
                <option value="Sci-Fi">Sci-Fi</option>
                <option value="Drama">Drama</option>
                <option value="Thriller">Thriller</option>
                <option value="Comedy">Comedy</option>
                <option value="Action">Action</option>
                <option value="Horror">Horror</option>
              </select>

              <select
                value={filters.completion}
                onChange={(e) => setFilters(prev => ({ ...prev, completion: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Progress</option>
                <option value="incomplete">Incomplete</option>
                <option value="complete">Near Complete</option>
              </select>

              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Time</option>
                <option value="1d">Last Day</option>
                <option value="7d">Last Week</option>
                <option value="30d">Last Month</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedDrafts.length > 0 && (
            <div className="mt-4 flex items-center justify-between p-3 bg-purple-50 rounded-md">
              <span className="text-sm text-purple-700">
                {selectedDrafts.length} draft{selectedDrafts.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="text-sm px-3 py-1 text-red-600 hover:text-red-700"
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedDrafts([])}
                  className="text-sm px-3 py-1 text-gray-600 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredDrafts.length} of {drafts.length} drafts
          </p>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={selectedDrafts.length === filteredDrafts.length && filteredDrafts.length > 0}
              onChange={handleSelectAll}
              className="mr-2 rounded border-gray-300"
            />
            Select all
          </label>
        </div>

        {/* Drafts Grid */}
        {filteredDrafts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No drafts found</h3>
            <p className="text-gray-600 mb-6">
              {drafts.length === 0 
                ? "You haven't created any pitch drafts yet."
                : "No drafts match your current filters."
              }
            </p>
            <button
              onClick={() => navigate('/create-pitch')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Pitch
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDrafts.map((draft) => {
              const StatusIcon = getStatusIcon(draft.status);
              
              return (
                <div key={draft.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedDrafts.includes(draft.id)}
                          onChange={() => handleSelectDraft(draft.id)}
                          className="mt-1 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                            {draft.title}
                          </h3>
                          {draft.logline && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {draft.logline}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {draft.isPublic ? (
                          <Globe className="w-4 h-4 text-green-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-gray-400" />
                        )}
                        <div className="relative">
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Status and Progress */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(draft.status)}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {draft.status.replace('-', ' ')}
                          </span>
                          {draft.autosaveEnabled && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Auto-save
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {draft.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(draft.progress)}`}
                          style={{ width: `${draft.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Genres */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {draft.genre.map((g, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md">
                          <Tag className="w-3 h-3 mr-1" />
                          {g}
                        </span>
                      ))}
                    </div>

                    {/* Completion Status */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-2">Completion Status</p>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {Object.entries(draft.completionStatus).map(([key, completed]) => (
                          <div key={key} className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${completed ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className={completed ? 'text-green-700' : 'text-gray-500'}>
                              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 mb-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>Last saved {formatLastSaved(draft.lastSaved)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        <span>{draft.wordCount.toLocaleString()} words</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>Created {new Date(draft.createdDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/pitch-edit/${draft.id}`)}
                        className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        <Edit3 className="w-4 h-4 mr-1 inline" />
                        Edit
                      </button>
                      <button
                        onClick={() => navigate(`/pitch/${draft.id}/preview`)}
                        className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicateDraft(draft.id)}
                        className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}