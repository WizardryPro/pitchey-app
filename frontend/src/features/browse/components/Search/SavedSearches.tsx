import React, { useState, useEffect } from 'react';
import { Search, Play, Edit, Bell, Clock, Plus, Trash2, Users, TrendingUp, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '@/store/betterAuthStore';

interface SearchFilters {
  genres?: string[];
  budget_range?: string;
  format?: string;
  [key: string]: unknown;
}

interface SavedSearch {
  id: number;
  name: string;
  description?: string;
  search_query: string;
  filters: SearchFilters;
  use_count: number;
  last_used?: string;
  is_public: boolean;
  notify_on_results: boolean;
  alert_frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  created_at: string;
  updated_at: string;
}

interface SavedSearchesProps {
  onSearchExecute: (query: string, filters: SearchFilters, searchName: string) => void;
  onCreateSearch?: (searchData: Partial<SavedSearch>) => void;
  className?: string;
}

export const SavedSearches: React.FC<SavedSearchesProps> = ({
  onSearchExecute,
  onCreateSearch: _onCreateSearch,
  className = ''
}) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [popularSearches, setPopularSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'mine' | 'popular'>('mine');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);

  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  // A saved search is private demand intent; only investors/production can turn
  // it into a public Open Call (the demand→supply bridge). The Open Call create
  // form opens pre-filled so demand is reviewed before it publishes + notifies
  // matching creators.
  const canPostCalls = user?.userType === 'investor' || user?.userType === 'production';

  const postAsOpenCall = (search: SavedSearch) => {
    const f = (search.filters || {}) as SearchFilters;
    const genres = Array.isArray(f.genres) ? f.genres : [];
    const fmt = Array.isArray(f.format)
      ? (f.format as unknown as string[])
      : (typeof f.format === 'string' && f.format ? [f.format] : []);
    const params = new URLSearchParams({ post: '1' });
    if (search.name) params.set('title', search.name);
    if (search.search_query) params.set('mandate', search.search_query);
    if (genres.length) params.set('genres', genres.join(','));
    if (fmt.length) params.set('formats', fmt.join(','));
    navigate(`/opportunities?${params.toString()}`);
  };

  useEffect(() => {
    void loadSavedSearches();
    void loadPopularSearches();
  }, []);

  const loadSavedSearches = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/search/saved', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json() as { savedSearches?: SavedSearch[] };
        setSavedSearches(data.savedSearches ?? []);
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPopularSearches = async () => {
    try {
      const response = await fetch('/api/search/saved/popular?limit=10', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json() as { popularSearches?: SavedSearch[] };
        setPopularSearches(data.popularSearches ?? []);
      }
    } catch (error) {
      console.error('Failed to load popular searches:', error);
    }
  };

  const executeSearch = async (search: SavedSearch) => {
    try {
      const response = await fetch(`/api/search/saved/${search.id}/execute`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        onSearchExecute(search.search_query, search.filters, search.name);
        
        // Update use count locally
        setSavedSearches(prev => 
          prev.map(s => s.id === search.id ? { ...s, use_count: s.use_count + 1 } : s)
        );
      }
    } catch (error) {
      console.error('Failed to execute search:', error);
    }
  };

  const deleteSearch = async (searchId: number) => {
    if (!confirm('Are you sure you want to delete this saved search?')) return;
    
    try {
      const response = await fetch(`/api/search/saved/${searchId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        setSavedSearches(prev => prev.filter(s => s.id !== searchId));
      }
    } catch (error) {
      console.error('Failed to delete search:', error);
    }
  };

  const getFilterSummary = (query: string, filters: SearchFilters) => {
    const parts: string[] = [];
    if (query) parts.push(`"${query}"`);
    if (filters?.genres != null && filters.genres.length > 0) parts.push(`${filters.genres.length} genre(s)`);
    if (filters?.budget_range != null && filters.budget_range !== '') parts.push(`Budget: ${filters.budget_range}`);
    if (filters?.format != null && filters.format !== '') parts.push(`Format: ${filters.format}`);
    return parts.join(' • ') || 'No filters';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const CreateSearchModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      search_query: '',
      filters: {},
      is_public: false,
      notify_on_results: false,
      alert_frequency: 'never' as const
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const response = await fetch('/api/search/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData)
        });
        
        if (response.ok) {
          const newSearch = await response.json() as SavedSearch;
          setSavedSearches(prev => [newSearch, ...prev]);
          setShowCreateModal(false);
          setFormData({
            name: '',
            description: '',
            search_query: '',
            filters: {},
            is_public: false,
            notify_on_results: false,
            alert_frequency: 'never'
          });
        }
      } catch (error) {
        console.error('Failed to create saved search:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">Save Search</h3>
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Query</label>
              <input
                type="text"
                value={formData.search_query}
                onChange={(e) => setFormData(prev => ({ ...prev, search_query: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows={3}
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="is_public" className="text-sm text-gray-700">Make public</label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="notify_on_results"
                checked={formData.notify_on_results}
                onChange={(e) => setFormData(prev => ({ ...prev, notify_on_results: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="notify_on_results" className="text-sm text-gray-700">Notify on new results</label>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Search
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const SearchCard = ({ search, isPopular = false }: { search: SavedSearch; isPopular?: boolean }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-semibold text-gray-900">{search.name}</h3>
            {search.is_public && <Users className="h-4 w-4 text-blue-500" />}
            {search.notify_on_results && <Bell className="h-4 w-4 text-yellow-500" />}
          </div>
          {search.description && (
            <p className="text-sm text-gray-600 mb-2">{search.description}</p>
          )}
          <p className="text-xs text-gray-500">
            {getFilterSummary(search.search_query, search.filters)}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { void executeSearch(search); }}
            className="p-2 text-green-600 hover:bg-green-50 rounded"
            title="Execute search"
          >
            <Play className="h-4 w-4" />
          </button>

          {!isPopular && (
            <>
              <button
                onClick={() => setEditingSearch(search)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                title="Edit search"
              >
                <Edit className="h-4 w-4" />
              </button>

              {canPostCalls && (
                <button
                  onClick={() => postAsOpenCall(search)}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                  title="Post as Open Call — notify matching creators"
                >
                  <Megaphone className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={() => { void deleteSearch(search.id); }}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
                title="Delete search"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {search.last_used ? `Used ${formatDate(search.last_used)}` : 'Never used'}
          </span>
          <span className="flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            {search.use_count} uses
          </span>
        </div>
        <span>Created {formatDate(search.created_at)}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Saved Searches</h2>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading saved searches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Saved Searches</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Save Search</span>
        </button>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('mine')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'mine'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Searches ({savedSearches.length})
          </button>
          {/* Only surface the Popular tab once there's real community search
              volume — an empty trending list reads as broken. It auto-appears
              when populated. */}
          {popularSearches.length > 0 && (
            <button
              onClick={() => setActiveTab('popular')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'popular'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Popular ({popularSearches.length})
            </button>
          )}
        </nav>
      </div>
      
      {/* Search Lists. Fall back to "mine" whenever Popular is empty/hidden so
          a stale activeTab='popular' can never strand the user on a blank tab. */}
      {(activeTab === 'mine' || popularSearches.length === 0) && (
        <>
          {savedSearches.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No saved searches yet</h3>
              <p className="text-gray-600">Save your frequent searches for quick access later</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSearches.map(search => (
                <SearchCard key={search.id} search={search} />
              ))}
            </div>
          )}
        </>
      )}
      
      {activeTab === 'popular' && popularSearches.length > 0 && (
        <>
          <div className="space-y-3">
            {popularSearches.map(search => (
              <SearchCard key={search.id} search={search} isPopular />
            ))}
          </div>
        </>
      )}
      
      {/* Modals */}
      {showCreateModal && <CreateSearchModal />}
    </div>
  );
};