import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { FeedbackService } from '../../services/feedback.service';
import type { FeedbackEntry } from '../../services/feedback.service';
import StructuredFeedbackForm from './StructuredFeedbackForm';
import FeedbackDisplay from './FeedbackDisplay';

interface Props {
  pitchId: number;
  isOwner: boolean;
  isAuthenticated: boolean;
  userType: string;
}

export default function FeedbackSection({ pitchId, isOwner, isAuthenticated, userType }: Props) {
  const [myFeedback, setMyFeedback] = useState<FeedbackEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canLeaveFeedback = isAuthenticated && !isOwner && userType !== 'watcher';

  const loadMyFeedback = useCallback(async () => {
    if (!canLeaveFeedback) return;
    setLoadingMine(true);
    const data = await FeedbackService.getMyFeedback(pitchId);
    setMyFeedback(data);
    setLoadingMine(false);
  }, [pitchId, canLeaveFeedback]);

  useEffect(() => { loadMyFeedback(); }, [loadMyFeedback]);

  const handleSubmitted = () => {
    setShowForm(false);
    setRefreshKey((k) => k + 1);
    loadMyFeedback();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-purple-600" />
        Feedback
      </h3>

      {/* Leave feedback form (non-owner, authenticated, not watcher) */}
      {canLeaveFeedback && !loadingMine && (
        <div>
          {myFeedback ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">You've already left feedback on this pitch.</p>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium transition"
              >
                {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showForm ? 'Cancel editing' : 'Edit your feedback'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium transition"
            >
              {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'Leave feedback'}
            </button>
          )}

          {showForm && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <StructuredFeedbackForm
                pitchId={pitchId}
                onSubmitted={handleSubmitted}
                existingFeedback={myFeedback}
              />
            </div>
          )}
        </div>
      )}

      {/* Feedback display for everyone */}
      <FeedbackDisplay key={refreshKey} pitchId={pitchId} />
    </div>
  );
}
