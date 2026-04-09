import { useState } from 'react';
import { Plus, X, ThumbsUp, AlertTriangle, Lightbulb, EyeOff, Send, Trash2 } from 'lucide-react';
import { FeedbackService } from '../../services/feedback.service';
import type { FeedbackEntry } from '../../services/feedback.service';
import PitcheyRating from '../PitcheyRating';

interface Props {
  pitchId: number;
  onSubmitted: () => void;
  existingFeedback?: FeedbackEntry | null;
}

function DynamicList({
  items,
  onChange,
  placeholder,
  icon: Icon,
  iconColor,
  label,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  icon: typeof ThumbsUp;
  iconColor: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {label}
      </label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            maxLength={500}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="p-2 text-gray-400 hover:text-red-500 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {items.length < 10 && (
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 transition"
        >
          <Plus className="w-4 h-4" /> Add {label.toLowerCase().replace(/&.*/, '').trim()}
        </button>
      )}
    </div>
  );
}

export default function StructuredFeedbackForm({ pitchId, onSubmitted, existingFeedback }: Props) {
  const isEditing = !!existingFeedback;
  const [rating, setRating] = useState<number>(existingFeedback?.rating ?? 0);
  const [strengths, setStrengths] = useState<string[]>(existingFeedback?.strengths?.length ? existingFeedback.strengths : ['']);
  const [weaknesses, setWeaknesses] = useState<string[]>(existingFeedback?.weaknesses?.length ? existingFeedback.weaknesses : ['']);
  const [suggestions, setSuggestions] = useState<string[]>(existingFeedback?.suggestions?.length ? existingFeedback.suggestions : ['']);
  const [overallFeedback, setOverallFeedback] = useState(existingFeedback?.overall_feedback ?? '');
  const [isInterested, setIsInterested] = useState(existingFeedback?.is_interested ?? false);
  const [isAnonymous, setIsAnonymous] = useState(existingFeedback?.is_anonymous ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rating labels now handled by PitcheyRating component

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const filteredStrengths = strengths.filter(s => s.trim());
    const filteredWeaknesses = weaknesses.filter(s => s.trim());
    const filteredSuggestions = suggestions.filter(s => s.trim());
    const trimmedOverall = overallFeedback.trim();

    if (!rating && !filteredStrengths.length && !filteredWeaknesses.length && !filteredSuggestions.length && !trimmedOverall) {
      setError('Please provide at least a rating or some feedback');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        rating: rating || undefined,
        strengths: filteredStrengths,
        weaknesses: filteredWeaknesses,
        suggestions: filteredSuggestions,
        overall_feedback: trimmedOverall || undefined,
        is_interested: isInterested,
        is_anonymous: isAnonymous,
      };

      if (isEditing) {
        await FeedbackService.update(pitchId, payload);
      } else {
        await FeedbackService.submit(pitchId, payload);
      }
      onSubmitted();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete your feedback?')) return;
    setSubmitting(true);
    try {
      await FeedbackService.remove(pitchId);
      onSubmitted();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || 'Failed to delete feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Rating — branded 1-10 Pitchey Score */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Rate this Pitch</label>
        <PitcheyRating mode="interactive" value={rating} onChange={setRating} disabled={submitting} />
      </div>

      {/* Hook & Strengths */}
      <DynamicList
        items={strengths}
        onChange={setStrengths}
        placeholder="What works well about this pitch?"
        icon={ThumbsUp}
        iconColor="text-green-500"
        label="Hook & Strengths"
      />

      {/* Viability & Concerns */}
      <DynamicList
        items={weaknesses}
        onChange={setWeaknesses}
        placeholder="What are the main concerns or risks?"
        icon={AlertTriangle}
        iconColor="text-orange-500"
        label="Viability & Concerns"
      />

      {/* Suggestions */}
      <DynamicList
        items={suggestions}
        onChange={setSuggestions}
        placeholder="How could this pitch be improved?"
        icon={Lightbulb}
        iconColor="text-blue-500"
        label="Suggestions"
      />

      {/* Overall Feedback */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Overall Feedback</label>
        <textarea
          value={overallFeedback}
          onChange={(e) => setOverallFeedback(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Any additional thoughts on this pitch..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{overallFeedback.length}/2000</p>
      </div>

      {/* Options row */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isInterested}
            onChange={(e) => setIsInterested(e.target.checked)}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          I'm interested in this project
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <EyeOff className="w-4 h-4 text-gray-400" />
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          Submit anonymously
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Submitting...' : isEditing ? 'Update Feedback' : 'Submit Feedback'}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-50 transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
