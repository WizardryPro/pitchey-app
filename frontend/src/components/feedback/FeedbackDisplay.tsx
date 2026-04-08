import { useState, useEffect } from 'react';
import { Star, ThumbsUp, AlertTriangle, Lightbulb, Briefcase, User, Sparkles } from 'lucide-react';
import { FeedbackService } from '../../services/feedback.service';
import type { FeedbackEntry, RatingStats } from '../../services/feedback.service';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6 text-gray-500 text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-gray-400 text-right">{count}</span>
    </div>
  );
}

function ReviewerBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string; icon: typeof User }> = {
    investor: { label: 'Investor', color: 'bg-green-100 text-green-700', icon: Briefcase },
    production: { label: 'Production', color: 'bg-blue-100 text-blue-700', icon: Briefcase },
    peer: { label: 'Creator', color: 'bg-purple-100 text-purple-700', icon: User },
  };
  const c = config[type] || config.peer;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
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

      {entry.rating && <StarRating rating={entry.rating} />}

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

function RatingSummary({ ratings }: { ratings: RatingStats }) {
  return (
    <div className="flex items-start gap-6">
      <div className="text-center">
        <p className="text-3xl font-bold text-gray-900">{Number(ratings.avg_rating).toFixed(1)}</p>
        <StarRating rating={Math.round(Number(ratings.avg_rating))} />
        <p className="text-xs text-gray-400 mt-1">{ratings.total_reviews} review{ratings.total_reviews !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 space-y-1">
        <RatingBar label="5" count={ratings.five_star} total={ratings.total_reviews} />
        <RatingBar label="4" count={ratings.four_star} total={ratings.total_reviews} />
        <RatingBar label="3" count={ratings.three_star} total={ratings.total_reviews} />
        <RatingBar label="2" count={ratings.two_star} total={ratings.total_reviews} />
        <RatingBar label="1" count={ratings.one_star} total={ratings.total_reviews} />
      </div>
    </div>
  );
}

export default function FeedbackDisplay({ pitchId }: { pitchId: number }) {
  const [ratings, setRatings] = useState<RatingStats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await FeedbackService.getFeedback(pitchId);
    setRatings(data.ratings);
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

  if (!feedback.length) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">No feedback yet. Be the first to share your thoughts!</p>
    );
  }

  return (
    <div className="space-y-4">
      {ratings && ratings.total_reviews > 0 && <RatingSummary ratings={ratings} />}
      <div className="space-y-3">
        {feedback.map((entry) => (
          <FeedbackCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

// Export load function for parent components to trigger refresh
export { FeedbackDisplay };
