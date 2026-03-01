import { useState, useEffect } from 'react';
import { 
  Bookmark, 
  BookmarkPlus,
  Trash2, 
  Edit2, 
  Star, 
  StarOff,
  Save,
  X,
  Check,
  Plus,
  Filter,
  ChevronDown,
  Clock,
  TrendingUp
} from 'lucide-react';
import { API_URL } from '../config';
import { useToast } from '@shared/components/feedback/ToastProvider';
import type { FilterState } from './FilterBar';
import { useBetterAuthStore } from '../store/betterAuthStore';

interface SavedFilter {
  id: number;
  name: string;
  description?: string;
  filters: FilterState;
  isDefault: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SavedFiltersProps {
  currentFilters: FilterState;
  onLoadFilter: (filters: FilterState) => void;
  className?: string;
}

export default function SavedFilters({ 
  currentFilters, 
  onLoadFilter,
  className = '' 
}: SavedFiltersProps) {
  const { user } = useBetterAuthStore();
  const toast = useToast();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (user) {
      loadSavedFilters();
    }
  }, [user]);

  const loadSavedFilters = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/api/filters/saved`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        const data = await response.json();
        setSavedFilters(data.filters || []);
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveFilter = async () => {
    if (!filterName.trim()) {
      toast.error('Please enter a name for your filter');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const payload = {
        name: filterName,
        description: filterDescription,
        filters: currentFilters,
        isDefault
      };

      const url = editingFilter 
        ? `${API_URL}/api/filters/saved/${editingFilter.id}`
        : `${API_URL}/api/filters/saved`;
      
      const method = editingFilter ? 'PUT' : 'POST';
      
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(editingFilter ? 'Filter updated!' : 'Filter saved!');
        await loadSavedFilters();
        resetSaveDialog();
      } else {
        throw new Error('Failed to save filter');
      }
    } catch (error) {
      console.error('Failed to save filter:', error);
      toast.error('Failed to save filter');
    } finally {
      setLoading(false);
    }
  };

  const deleteFilter = async (filterId: number) => {
    if (!confirm('Are you sure you want to delete this filter?')) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
    const response = await fetch(`${API_URL}/api/filters/saved/${filterId}`, {
      method: 'DELETE',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        toast.success('Filter deleted');
        await loadSavedFilters();
      } else {
        throw new Error('Failed to delete filter');
      }
    } catch (error) {
      console.error('Failed to delete filter:', error);
      toast.error('Failed to delete filter');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = async (filter: SavedFilter) => {
    onLoadFilter(filter.filters);
    
    // Track usage
    try {
      await fetch(`${API_URL}/api/filters/saved/${filter.id}/track`, {
        method: 'POST',
        credentials: 'include' // Send cookies for Better Auth session
      });
    } catch (error) {
      console.error('Failed to track filter usage:', error);
    }
    
    toast.success(`Applied filter: ${filter.name}`);
  };

  const toggleDefault = async (filter: SavedFilter) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
    const response = await fetch(`${API_URL}/api/filters/saved/${filter.id}/default`, {
      method: 'PUT',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        await loadSavedFilters();
        toast.success(filter.isDefault ? 'Removed as default' : 'Set as default filter');
      }
    } catch (error) {
      console.error('Failed to toggle default:', error);
      toast.error('Failed to update default filter');
    } finally {
      setLoading(false);
    }
  };

  const resetSaveDialog = () => {
    setShowSaveDialog(false);
    setEditingFilter(null);
    setFilterName('');
    setFilterDescription('');
    setIsDefault(false);
  };

  const openEditDialog = (filter: SavedFilter) => {
    setEditingFilter(filter);
    setFilterName(filter.name);
    setFilterDescription(filter.description || '');
    setIsDefault(filter.isDefault);
    setShowSaveDialog(true);
  };

  const hasActiveFilters = () => {
    return (
      currentFilters.genres.length > 0 ||
      currentFilters.formats.length > 0 ||
      currentFilters.developmentStages.length > 0 ||
      currentFilters.creatorTypes.length > 0 ||
      (currentFilters.budgetMin && currentFilters.budgetMin > 0) ||
      (currentFilters.budgetMax && currentFilters.budgetMax < 999999999) ||
      currentFilters.searchQuery ||
      currentFilters.hasNDA ||
      currentFilters.seekingInvestment
    );
  };

  if (!user) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Buttons */}
      <div className="flex items-center gap-2">
        {/* Save Current Filter Button */}
        {hasActiveFilters() && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            disabled={loading}
          >
            <BookmarkPlus className="w-4 h-4" />
            Save Filter
          </button>
        )}

        {/* Saved Filters Dropdown */}
        {savedFilters.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowManageDialog(!showManageDialog)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <Bookmark className="w-4 h-4" />
              <span>Saved Filters ({savedFilters.length})</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showManageDialog && (
              <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[320px] max-h-[400px] overflow-y-auto z-50">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  Your Saved Filters
                </h3>
                
                <div className="space-y-2">
                  {savedFilters.map(filter => (
                    <div
                      key={filter.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{filter.name}</h4>
                            {filter.isDefault && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                Default
                              </span>
                            )}
                          </div>
                          {filter.description && (
                            <p className="text-sm text-gray-600 mt-1">{filter.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(filter.createdAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Used {filter.usageCount} times
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => applyFilter(filter)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Apply Filter"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleDefault(filter)}
                            className={`p-1.5 rounded transition-colors ${
                              filter.isDefault 
                                ? 'text-yellow-600 hover:bg-yellow-50' 
                                : 'text-gray-400 hover:bg-gray-50'
                            }`}
                            title={filter.isDefault ? 'Remove as Default' : 'Set as Default'}
                          >
                            {filter.isDefault ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEditDialog(filter)}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                            title="Edit Filter"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteFilter(filter.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Filter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingFilter ? 'Edit Filter' : 'Save Filter'}
              </h3>
              <button
                onClick={resetSaveDialog}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter Name *
                </label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="e.g., High Budget Action Films"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={filterDescription}
                  onChange={(e) => setFilterDescription(e.target.value)}
                  placeholder="Describe what this filter is for..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="setDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="setDefault" className="text-sm text-gray-700">
                  Set as my default filter
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={resetSaveDialog}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveFilter}
                disabled={!filterName.trim() || loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {editingFilter ? 'Update' : 'Save'} Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showManageDialog && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowManageDialog(false)}
        />
      )}
    </div>
  );
}