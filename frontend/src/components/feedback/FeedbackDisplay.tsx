import { useState, useEffect } from 'react';
import { ThumbsUp, AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';
import { FeedbackService } from '../../services/feedback.service';
import type { FeedbackEntry, RatingStats, RoleBreakdown as RoleBreakdownData } from '../../services/feedback.service';
import PitcheyRating from '../PitcheyRating';
import { getRatingLabel } from '../../constants/pitchey-score';
import { ReviewerBadge } from './ReviewerBadge';
import { RoleBreakdown } from './RoleBreakdown';

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6 text-gray-500 text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-gray-400 text-right">{count}</span>
    </div>
  );
}

function FeedbackCard({ entry }: { entry: FeedbackEntry }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">{entry.reviewer_name}</span>
          <ReviewerBadge type={entry.reviewer_type} />
          {entry.is_interested && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
              <Sparkles className="w-3 h-3" /> Interested
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleDateString()}</span>
      </div>

      {entry.rating && <PitcheyRating mode="display" value={entry.rating} />}

      {entry.strengths?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-green-600 flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" /> Strengths
          </p>
          <ul className="space-y-1">
            {entry.strengths.map((s, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-green-400 mt-1">+</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.weaknesses?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-orange-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Concerns
          </p>
          <ul className="space-y-1">
            {entry.weaknesses.map((w, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-orange-400 mt-1">-</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.suggestions?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-blue-600 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> Suggestions
          </p>
          <ul className="space-y-1">
            {entry.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-400 mt-1">&bull;</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.overall_feedback && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{entry.overall_feedback}</p>
      )}
    </div>
  );
}

function DualScoreSummary({ ratings }: { ratings: RatingStats }) {
  const pitcheyScore = Number(ratings.pitchey_score);
  const viewerScore = Number(ratings.viewer_score);
  const dist = ratings.distribution || [];

  return (
    <div className="space-y-4">
      {/* Dual score cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pitchey Score — gold/prominent */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Pitchey Score</p>
          <p className="text-3xl font-bold text-amber-900">
            {pitcheyScore > 0 ? pitcheyScore.toFixed(1) : '—'}
          </p>
          {pitcheyScore > 0 && (
            <p className="text-xs text-amber-600 mt-1">{getRatingLabel(pitcheyScore)}</p>
          )}
          <p className="text-xs text-amber-500 mt-1">Industry</p>
        </div>
        {/* Viewer Score — grey/secondary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Viewer Score</p>
          <p className="text-3xl font-bold text-gray-700">
            {viewerScore > 0 ? viewerScore.toFixed(1) : '—'}
          </p>
          {viewerScore > 0 && (
            <p className="text-xs text-gray-500 mt-1">{getRatingLabel(viewerScore)}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Audience</p>
        </div>
      </div>

      {/* Distribution bars */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-500 mb-2">
          {ratings.total_reviews} rating{ratings.total_reviews !== 1 ? 's' : ''} total
        </p>
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
          <RatingBar key={n} label={String(n)} count={dist[n - 1] || 0} total={ratings.total_reviews} />
        ))}
      </div>
    </div>
  );
}

export default function FeedbackDisplay({ pitchId }: { pitchId: number }) {
  const [ratings, setRatings] = useState<RatingStats | null>(null);
  const [breakdown, setBreakdown] = useState<RoleBreakdownData | undefined>(undefined);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await FeedbackService.getFeedback(pitchId);
    setRatings(data.ratings);
    setBreakdown(data.breakdown);
    setFeedback(data.feedback);
    setLoading(false);
  };

  useEffect(() => { load(); }, [pitchId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-gray-100 rounded w-1/3" />
        <div className="h-20 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!feedback.length && (!ratings || ratings.total_reviews === 0)) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">No feedback yet. Be the first to share your thoughts!</p>
    );
  }

  return (
    <div className="space-y-4">
      {ratings && ratings.total_reviews > 0 && <DualScoreSummary ratings={ratings} />}
      <RoleBreakdown breakdown={breakdown} />
      <div className="space-y-3">
        {feedback.map((entry) => (
          <FeedbackCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

export { FeedbackDisplay };
