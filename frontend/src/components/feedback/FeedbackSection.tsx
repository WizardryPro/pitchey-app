import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { FeedbackService } from '../../services/feedback.service';
import type { FeedbackEntry, ConsumptionStatus } from '../../services/feedback.service';
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
  const [consumption, setConsumption] = useState<ConsumptionStatus | null>(null);

  const canLeaveFeedback = isAuthenticated && !isOwner && userType !== 'watcher';

  const loadData = useCallback(async () => {
    if (!canLeaveFeedback) return;
    setLoadingMine(true);
    const [fb, cs] = await Promise.all([
      FeedbackService.getMyFeedback(pitchId),
      FeedbackService.getConsumptionStatus(pitchId),
    ]);
    setMyFeedback(fb);
    setConsumption(cs);
    setLoadingMine(false);
  }, [pitchId, canLeaveFeedback]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitted = () => {
    setShowForm(false);
    setRefreshKey((k) => k + 1);
    loadData();
  };

  const pct = consumption
    ? Math.min(100, Math.round((consumption.viewDuration / consumption.threshold) * 100))
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-purple-600" />
        Feedback
      </h3>

      {/* Leave feedback form (non-owner, authenticated, not watcher) */}
      {canLeaveFeedback && !loadingMine && (
        <div>
          {/* Consumption gating — must view for threshold seconds */}
          {consumption && !consumption.eligible && !myFeedback && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                View this pitch for at least {consumption.threshold}s to unlock feedback
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">{consumption.viewDuration}s / {consumption.threshold}s</p>
            </div>
          )}

          {/* Already left feedback */}
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
          ) : consumption?.eligible ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium transition"
            >
              {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'Leave feedback'}
            </button>
          ) : null}

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
