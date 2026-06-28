import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Clock, Send, TrendingUp, Pencil } from 'lucide-react';
import { FeedbackService } from '../../services/feedback.service';
import type { FeedbackEntry, ConsumptionStatus, CommentEntry, FeedbackProgress } from '../../services/feedback.service';
import StructuredFeedbackForm from './StructuredFeedbackForm';
import FeedbackDisplay from './FeedbackDisplay';
import PitcheyRating from '../PitcheyRating';
import { useToast } from '@shared/components/feedback/ToastProvider';

interface Props {
  pitchId: number;
  isOwner: boolean;
  isAuthenticated: boolean;
  userType: string;
  /** Forwarded to FeedbackDisplay — off when the host page shows the scores elsewhere. */
  showScoreSummary?: boolean;
}

export default function FeedbackSection({ pitchId, isOwner, isAuthenticated, userType, showScoreSummary = true }: Props) {
  const { success, error } = useToast();
  const [myFeedback, setMyFeedback] = useState<FeedbackEntry | null>(null);
  const [feedbackProgress, setFeedbackProgress] = useState<FeedbackProgress | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [consumption, setConsumption] = useState<ConsumptionStatus | null>(null);

  // Quick rate state (for anyone who can rate)
  const [quickRating, setQuickRating] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  // Comments state
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(true);

  // Who can do what
  const canLeaveFeedback = isAuthenticated && !isOwner && userType !== 'watcher';
  const canRate = !isOwner; // anyone except owner (including anonymous + watchers)

  const loadData = useCallback(async () => {
    if (canLeaveFeedback) {
      setLoadingMine(true);
      const [fb, cs] = await Promise.all([
        FeedbackService.getMyFeedback(pitchId),
        FeedbackService.getConsumptionStatus(pitchId),
      ]);
      setMyFeedback(fb);
      setConsumption(cs);
      setLoadingMine(false);
      // If the viewer has left feedback, surface whether the pitch has moved since.
      if (fb) {
        const progress = await FeedbackService.getFeedbackProgress(pitchId);
        setFeedbackProgress(progress);
      } else {
        setFeedbackProgress(null);
      }
    }
    // Load existing rating status for quick-rate
    if (canRate) {
      const existing = await FeedbackService.getRatingStatus(pitchId);
      if (existing) {
        setQuickRating(existing);
        setRatingDone(true);
      }
    }
  }, [pitchId, canLeaveFeedback, canRate]);

  const loadComments = useCallback(async () => {
    const data = await FeedbackService.getComments(pitchId);
    setComments(data);
  }, [pitchId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadComments(); }, [loadComments]);

  // Poll consumption status every 10s until the gate opens — keeps the progress bar live
  // as the backend heartbeat accumulates view_duration.
  useEffect(() => {
    if (!canLeaveFeedback || consumption?.eligible) return;
    const iv = setInterval(async () => {
      const cs = await FeedbackService.getConsumptionStatus(pitchId);
      setConsumption(cs);
    }, 10000);
    return () => clearInterval(iv);
  }, [pitchId, canLeaveFeedback, consumption?.eligible]);

  const handleSubmitted = () => {
    setShowForm(false);
    setRefreshKey((k) => k + 1);
    void loadData();
  };

  const handleQuickRate = async (rating: number) => {
    if (!rating || ratingSubmitting) return;
    setQuickRating(rating);
    setRatingSubmitting(true);
    const ok = await FeedbackService.submitRating(pitchId, rating);
    setRatingSubmitting(false);
    if (ok) {
      setRatingDone(true);
      setRefreshKey((k) => k + 1);
      success('Rating saved', `You rated this pitch ${rating} star${rating === 1 ? '' : 's'}.`);
      // Refresh myFeedback so the structured form seeds with this rating instead of
      // opening with empty stars and forcing the user to pick it again.
      void loadData();
    } else {
      error('Couldn\'t save your rating', 'Please try again.');
    }
  };

  const handleCommentSubmit = async (isAnonymous = false) => {
    if (!commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    const ok = await FeedbackService.submitComment(pitchId, commentText.trim(), isAnonymous);
    setCommentSubmitting(false);
    if (ok) {
      setCommentText('');
      void loadComments();
      success(
        isAnonymous ? 'Comment posted anonymously' : 'Comment posted',
        isAnonymous ? 'Your name is hidden from other viewers.' : undefined,
      );
    } else {
      error('Couldn\'t post your comment', 'Please try again.');
    }
  };

  const pct = consumption
    ? Math.min(100, Math.round((consumption.viewDuration / consumption.threshold) * 100))
    : 0;

  // A quick-rate writes a pitch_feedback row with only a rating. Treat that as
  // "not yet written feedback" so the UI still invites the deeper form rather
  // than claiming they've "already left feedback".
  const hasStructuredFeedback = !!myFeedback && (
    (myFeedback.strengths?.length ?? 0) > 0 ||
    (myFeedback.weaknesses?.length ?? 0) > 0 ||
    (myFeedback.suggestions?.length ?? 0) > 0 ||
    !!myFeedback.overall_feedback?.trim()
  );

  return (
    <div className="space-y-6">
      {/* Feedback & Ratings Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-600" />
          Feedback & Ratings
        </h3>

        {/* Quick Rate — available to everyone except owner. Logged-in users
            also get the structured form below as the optional deeper path;
            both write to the same pitch_feedback row keyed by reviewer_id. */}
        {/* Hide the standalone quick-rate row while the written-feedback form is
            open — the StructuredFeedbackForm renders its OWN rating selector, so
            showing both at once made the rating appear twice ("double rating"). */}
        {canRate && !showForm && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">
              {ratingDone ? 'Your rating' : 'Rate this Pitch'}
            </p>
            <PitcheyRating
              mode="interactive"
              value={quickRating}
              onChange={handleQuickRate}
              disabled={ratingSubmitting}
            />
            {ratingDone && (
              <p className="text-xs text-green-600">Rating submitted! You can update it anytime.</p>
            )}
          </div>
        )}

        {/* Structured feedback form (non-owner, authenticated, not watcher) */}
        {canLeaveFeedback && !loadingMine && (
          <div>
            {/* Consumption gating */}
            {consumption && !consumption.eligible && !hasStructuredFeedback && (
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

            {/* Progress from feedback (WS-5): show the reviewer that the pitch moved
                since they weighed in — edits made and/or score delta. */}
            {feedbackProgress && (feedbackProgress.editedSinceFeedback || feedbackProgress.scoreDelta != null) && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Progress since your feedback
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-emerald-700">
                  {feedbackProgress.editedSinceFeedback && (
                    <span className="flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" />
                      {feedbackProgress.editCount > 0
                        ? `Updated ${feedbackProgress.editCount} time${feedbackProgress.editCount === 1 ? '' : 's'}`
                        : 'Updated'} since your feedback
                    </span>
                  )}
                  {feedbackProgress.scoreDelta != null && feedbackProgress.scoreDelta !== 0 && (
                    <span className="font-semibold">
                      Pitchey Score {feedbackProgress.scoreAtFeedback?.toFixed(1)} → {feedbackProgress.scoreNow?.toFixed(1)}
                      <span className={feedbackProgress.scoreDelta > 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {' '}({feedbackProgress.scoreDelta > 0 ? '+' : ''}{feedbackProgress.scoreDelta.toFixed(1)})
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {hasStructuredFeedback ? (
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
                {showForm ? 'Cancel' : myFeedback ? 'Add written feedback' : 'Leave feedback'}
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

        {/* Rating display + structured feedback list */}
        <FeedbackDisplay key={refreshKey} pitchId={pitchId} showScoreSummary={showScoreSummary} />
      </div>

      {/* Comments Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center justify-between w-full"
        >
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-500" />
            Comments {comments.length > 0 && <span className="text-sm text-gray-400">({comments.length})</span>}
          </h3>
          {showComments ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {showComments && (
          <>
            {/* Comment input — two send options: post with your username shown, or anonymously */}
            {!isOwner && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit(false)}
                  placeholder="Add a comment..."
                  maxLength={2000}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCommentSubmit(false)}
                    disabled={!commentText.trim() || commentSubmitting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Send className="w-4 h-4" />
                    Comment
                  </button>
                  <button
                    onClick={() => handleCommentSubmit(true)}
                    disabled={!commentText.trim() || commentSubmitting}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Comment anonymously
                  </button>
                </div>
              </div>
            )}

            {/* Comment list */}
            {comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                      {c.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{c.display_name}</span>
                        {c.is_anonymous && (
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            Anonymous
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
