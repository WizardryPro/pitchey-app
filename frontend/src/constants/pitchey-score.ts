/**
 * Pitchey Score — Branded 1-10 Rating Scale
 * Movie-pitch themed labels with color mapping
 */

export const RATING_LABELS = [
  '',                        // 0 (unused)
  'Dead on Arrival',         // 1
  'Straight to Bargain Bin', // 2
  'Needs a Rewrite',         // 3
  'Back to Development',     // 4
  'Has Potential',           // 5
  'Greenlight Curious',      // 6
  'Studio Contender',        // 7
  'Award Season Material',   // 8
  'Box Office Smash',        // 9
  'Pitch Perfect',           // 10
] as const;

export const RATING_COLORS = [
  '',                   // 0
  'bg-red-900',         // 1
  'bg-red-700',         // 2
  'bg-red-500',         // 3
  'bg-orange-500',      // 4
  'bg-yellow-500',      // 5
  'bg-yellow-400',      // 6
  'bg-lime-500',        // 7
  'bg-green-500',       // 8
  'bg-emerald-500',     // 9
  'bg-purple-600',      // 10
] as const;

export const RATING_TEXT_COLORS = [
  '',                   // 0
  'text-red-900',       // 1
  'text-red-700',       // 2
  'text-red-500',       // 3
  'text-orange-500',    // 4
  'text-yellow-500',    // 5
  'text-yellow-400',    // 6
  'text-lime-500',      // 7
  'text-green-500',     // 8
  'text-emerald-500',   // 9
  'text-purple-600',    // 10
] as const;

export function getRatingLabel(score: number): string {
  const clamped = Math.max(1, Math.min(10, Math.round(score)));
  return RATING_LABELS[clamped];
}

export function getRatingColor(score: number): string {
  const clamped = Math.max(1, Math.min(10, Math.round(score)));
  return RATING_COLORS[clamped];
}

export function getRatingTextColor(score: number): string {
  const clamped = Math.max(1, Math.min(10, Math.round(score)));
  return RATING_TEXT_COLORS[clamped];
}
