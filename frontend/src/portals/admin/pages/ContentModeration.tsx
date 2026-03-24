import React, { useState, useEffect } from 'react';
import { adminService } from '../services/admin.service';

interface Pitch {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  budget: number;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  createdAt: string;
  moderationNotes?: string;
  flaggedReasons?: string[];
  documents?: Array<{
    id: string;
    filename: string;
    type: string;
  }>;
}

interface ModerationFilters {
  status: string;
  genre: string;
  sortBy: 'createdAt' | 'title' | 'budget';
  sortOrder: 'asc' | 'desc';
}

const ContentModeration: React.FC = () => {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ModerationFilters>({
    status: 'pending',
    genre: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [selectedPitch, setSelectedPitch] = useState<Pitch | null>(null);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [moderationNotes, setModerationNotes] = useState('');

  const genres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Documentary', 'Animation'
  ];

  useEffect(() => {
    loadPitches();
  }, [filters]);

  const loadPitches = async () => {
    try {
      setLoading(true);
      const data = await adminService.getPitches(filters) as any;
      const list = Array.isArray(data) ? data : (data?.content ?? data?.pitches ?? data?.data ?? []);
      setPitches(list);
    } catch (err) {
      setError('Failed to load pitches');
      console.error('Pitches error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePitch = async (pitchId: string, notes?: string) => {
    try {
      setActionLoading(pitchId);
      await adminService.approvePitch(pitchId, notes);
      await loadPitches();
      setShowPitchModal(false);
      setModerationNotes('');
    } catch (err) {
      console.error('Approve pitch error:', err);
      alert('Failed to approve pitch');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPitch = async (pitchId: string, reason: string) => {
    try {
      setActionLoading(pitchId);
      await adminService.rejectPitch(pitchId, reason);
      await loadPitches();
      setShowPitchModal(false);
      setModerationNotes('');
    } catch (err) {
      console.error('Reject pitch error:', err);
      alert('Failed to reject pitch');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFlagPitch = async (pitchId: string, reasons: string[], notes: string) => {
    try {
      setActionLoading(pitchId);
      await adminService.flagPitch(pitchId, reasons, notes);
      await loadPitches();
      setShowPitchModal(false);
      setModerationNotes('');
    } catch (err) {
      console.error('Flag pitch error:', err);
      alert('Failed to flag pitch');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      flagged: 'bg-orange-100 text-orange-800'
    };
    return `px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const PitchModal = ({ pitch }: { pitch: Pitch }) => {
    const [flagReasons, setFlagReasons] = useState<string[]>([]);

    const flagOptions = [
      'Inappropriate content',
      'Copyright violation',
      'Misleading information',
      'Spam or duplicate',
      'Budget inconsistencies',
      'Poor quality submission',
      'Incomplete information'
    ];

    const toggleFlagReason = (reason: string) => {
      setFlagReasons(prev =>
        prev.includes(reason)
          ? prev.filter(r => r !== reason)
          : [...prev, reason]
      );
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Moderate Pitch</h2>
              <button
                onClick={() => {
                  setShowPitchModal(false);
                  setModerationNotes('');
                  setFlagReasons([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Pitch Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Pitch Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <p className="text-gray-900">{pitch.title}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Genre</label>
                    <p className="text-gray-900">{pitch.genre}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Budget</label>
                    <p className="text-gray-900">{formatCurrency(pitch.budget)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={getStatusBadge(pitch.status)}>
                      {pitch.status}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Creator Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{pitch.creator.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{pitch.creator.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Submitted</label>
                    <p className="text-gray-900">{new Date(pitch.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Synopsis */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Synopsis</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-900 whitespace-pre-wrap">{pitch.synopsis}</p>
              </div>
            </div>

            {/* Documents */}
            {pitch.documents && pitch.documents.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Documents</h3>
                <div className="space-y-2">
                  {pitch.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                      <div className="text-blue-500">📄</div>
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-sm text-gray-500">{doc.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Moderation */}
            {pitch.moderationNotes && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Previous Moderation Notes</h3>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-gray-900">{pitch.moderationNotes}</p>
                </div>
              </div>
            )}

            {/* Flag Reasons (if flagged) */}
            {pitch.flaggedReasons && pitch.flaggedReasons.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Flag Reasons</h3>
                <div className="flex flex-wrap gap-2">
                  {pitch.flaggedReasons.map((reason, index) => (
                    <span key={index} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Moderation Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moderation Notes
              </label>
              <textarea
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Add notes about your moderation decision..."
              />
            </div>

            {/* Flag Options */}
            {pitch.status === 'pending' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flag Reasons (if flagging)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {flagOptions.map((option) => (
                    <label key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={flagReasons.includes(option)}
                        onChange={() => toggleFlagReason(option)}
                        className="mr-2"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPitchModal(false);
                  setModerationNotes('');
                  setFlagReasons([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              {pitch.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleApprovePitch(pitch.id, moderationNotes)}
                    disabled={actionLoading === pitch.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>

                  <button
                    onClick={() => handleFlagPitch(pitch.id, flagReasons, moderationNotes)}
                    disabled={actionLoading === pitch.id || flagReasons.length === 0}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                  >
                    Flag
                  </button>

                  <button
                    onClick={() => handleRejectPitch(pitch.id, moderationNotes || 'Rejected by moderator')}
                    disabled={actionLoading === pitch.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}

              {(pitch.status === 'flagged' || pitch.status === 'rejected') && (
                <button
                  onClick={() => handleApprovePitch(pitch.id, moderationNotes)}
                  disabled={actionLoading === pitch.id}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Moderation</h1>
          <p className="text-gray-600">Review and moderate pitch submissions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">
              {pitches.filter(p => p.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-600">Pending Review</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {pitches.filter(p => p.status === 'approved').length}
            </div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">
              {pitches.filter(p => p.status === 'rejected').length}
            </div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600">
              {pitches.filter(p => p.status === 'flagged').length}
            </div>
            <div className="text-sm text-gray-600">Flagged</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="flagged">Flagged</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Genre
              </label>
              <select
                value={filters.genre}
                onChange={(e) => setFilters({ ...filters, genre: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Genres</option>
                {genres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="createdAt">Created Date</option>
                <option value="title">Title</option>
                <option value="budget">Budget</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as any })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pitches Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pitch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      <div className="animate-pulse">Loading pitches...</div>
                    </td>
                  </tr>
                ) : pitches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No pitches found
                    </td>
                  </tr>
                ) : (
                  pitches.map((pitch) => (
                    <tr key={pitch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{pitch.title}</div>
                          <div className="text-sm text-gray-500">{pitch.genre}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{pitch.creator.name}</div>
                          <div className="text-sm text-gray-500">{pitch.creator.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(pitch.status)}>
                          {pitch.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(pitch.budget)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(pitch.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedPitch(pitch);
                            setShowPitchModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pitch Modal */}
        {showPitchModal && selectedPitch && (
          <PitchModal pitch={selectedPitch} />
        )}

        {error && (
          <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentModeration;