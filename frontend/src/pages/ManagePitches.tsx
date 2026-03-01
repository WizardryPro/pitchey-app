import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Eye, Edit3, Trash2, BarChart3, Search, Filter, RefreshCw } from 'lucide-react';
import { pitchService } from '../services/pitch.service';
import type { Pitch } from '@shared/types/api';
import FormatDisplay from '../components/FormatDisplay';

export default function ManagePitches() {
  const navigate = useNavigate();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingStates, setLoadingStates] = useState<{[key: number]: string}>({});
  const [notifications, setNotifications] = useState<{message: string, type: 'success' | 'error', id: number}[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void fetchPitches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        void fetchPitches(true); // Silent refresh
      }, 30000); // Refresh every 30 seconds
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const addNotification = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { message, type, id }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const setLoadingState = (pitchId: number, action: string) => {
    setLoadingStates(prev => ({ ...prev, [pitchId]: action }));
  };

  const clearLoadingState = (pitchId: number) => {
    setLoadingStates(prev => {
      const newState = { ...prev };
      delete newState[pitchId];
      return newState;
    });
  };

  const fetchPitches = async (silent = false) => {
    if (!silent) {
      setIsRefreshing(true);
    }
    
    try {
      const pitches = await pitchService.getMyPitches();
      setPitches(pitches);
      setLastUpdated(new Date());
      
      if (silent) {
        addNotification('Data refreshed automatically', 'success');
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to fetch pitches:', error);
      if (!silent) {
        addNotification(error.message || 'Failed to refresh data', 'error');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    void fetchPitches(false);
  };

  const handleDelete = async (pitchId: number) => {
    if (!confirm('Are you sure you want to delete this pitch? This action cannot be undone.')) {
      return;
    }

    setLoadingState(pitchId, 'deleting');

    try {
      await pitchService.delete(pitchId);
      
      // Remove from local state immediately
      setPitches(prev => prev.filter(pitch => pitch.id !== pitchId));
      
      // Force refresh to ensure consistency
      setTimeout(() => {
        void fetchPitches(true); // Force refresh from server
      }, 500);
      
      addNotification('Pitch deleted successfully', 'success');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to delete pitch:', error);

      // Show more specific error messages
      let errorMessage = 'Failed to delete pitch';
      if (error.message.includes('foreign key constraint') || error.message.includes('related records')) {
        errorMessage = 'Cannot delete pitch: it has active investments or NDAs. Please resolve these first.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      addNotification(errorMessage, 'error');

      // Refresh the list in case of partial deletion
      void fetchPitches(true);
    } finally {
      clearLoadingState(pitchId);
    }
  };

  const toggleStatus = async (pitchId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    const actionText = newStatus === 'published' ? 'publishing' : 'archiving';
    
    setLoadingState(pitchId, actionText);
    
    try {
      let updatedPitch;
      if (newStatus === 'published') {
        updatedPitch = await pitchService.publish(pitchId);
      } else {
        updatedPitch = await pitchService.archive(pitchId);
      }
      
      setPitches(prev => prev.map(pitch => 
        pitch.id === pitchId ? updatedPitch : pitch
      ));
      addNotification(`Pitch ${newStatus === 'published' ? 'published' : 'archived'} successfully`, 'success');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to update pitch status:', error);
      addNotification(error.message || 'Failed to update pitch status', 'error');
    } finally {
      clearLoadingState(pitchId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-700';
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredPitches = pitches.filter(pitch => {
    const matchesSearch = pitch.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pitch.genre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pitch.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => void navigate('/creator/dashboard')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Pitches</h1>
                <p className="text-sm text-gray-500">View and manage all your pitch submissions</p>
              </div>
            </div>
            
            <button
              onClick={() => void navigate('/creator/pitch/new')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              New Pitch
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Notifications */}
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
                notification.type === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-sm font-medium">{notification.message}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search pitches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition ${
                isRefreshing 
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Auto-refresh
            </label>
          </div>
        </div>

        {/* Real-time status */}
        <div className="flex items-center justify-between bg-white rounded-lg p-3 mb-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span>
              {autoRefresh ? 'Live updates enabled' : 'Live updates disabled'} • 
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {autoRefresh && 'Next refresh in 30s'}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{pitches.length}</div>
            <div className="text-sm text-gray-500">Total Pitches</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {pitches.filter(p => p.status === 'published').length}
            </div>
            <div className="text-sm text-gray-500">Published</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">
              {pitches.reduce((sum, p) => sum + p.viewCount, 0)}
            </div>
            <div className="text-sm text-gray-500">Total Views</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-purple-600">
              {pitches.reduce((sum, p) => sum + p.likeCount, 0)}
            </div>
            <div className="text-sm text-gray-500">Total Likes</div>
          </div>
        </div>

        {/* Pitches Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredPitches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pitches found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by creating your first pitch'
              }
            </p>
            <button
              onClick={() => void navigate('/creator/pitch/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Plus className="w-4 h-4" />
              Create Your First Pitch
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPitches.map((pitch) => (
              <div key={pitch.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden">
                {/* Thumbnail */}
                <div className="h-40 relative">
                  {pitch.titleImage != null && pitch.titleImage !== '' ? (
                    <img
                      src={pitch.titleImage}
                      alt={pitch.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-600" />
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{pitch.title}</h3>
                      <p className="text-sm text-gray-500">
                        {pitch.genre} • {' '}
                        <FormatDisplay 
                          formatCategory={pitch.formatCategory}
                          formatSubtype={pitch.formatSubtype}
                          format={pitch.format}
                          variant="compact"
                        />
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(pitch.status)}`}>
                      {pitch.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pitch.logline}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {pitch.viewCount}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>💜</span>
                        {pitch.likeCount}
                      </div>
                    </div>
                    <div className="text-xs">
                      Updated {new Date(pitch.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void navigate(`/creator/pitches/${pitch.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    
                    <button
                      onClick={() => void navigate(`/creator/pitches/${pitch.id}/edit`)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                      title="Edit pitch"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => {
                        const slug = pitch.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        void navigate(`/creator/pitches/${pitch.id}/${slug}/analytics`);
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm"
                      title="View analytics"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => void toggleStatus(pitch.id, pitch.status)}
                      disabled={loadingStates[pitch.id] === 'publishing' || loadingStates[pitch.id] === 'unpublishing'}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition text-sm min-w-[90px] ${
                        loadingStates[pitch.id] === 'publishing' || loadingStates[pitch.id] === 'unpublishing'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : pitch.status === 'published' 
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {loadingStates[pitch.id] === 'publishing' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                          Publishing...
                        </>
                      ) : loadingStates[pitch.id] === 'unpublishing' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                          Unpublishing...
                        </>
                      ) : (
                        pitch.status === 'published' ? 'Unpublish' : 'Publish'
                      )}
                    </button>
                    
                    <button
                      onClick={() => void handleDelete(pitch.id)}
                      disabled={loadingStates[pitch.id] === 'deleting'}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition text-sm ${
                        loadingStates[pitch.id] === 'deleting'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                      title="Delete pitch"
                    >
                      {loadingStates[pitch.id] === 'deleting' ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}