import { Flame, TrendingUp } from 'lucide-react';

export function getHeatLevel(score: number): 'fire' | 'warm' | null {
  if (score >= 10) return 'fire';
  if (score >= 3) return 'warm';
  return null;
}

export function getHeatScore(pitch: Record<string, unknown>): number {
  return Number(pitch.heat_score) || Number(pitch.heatScore) || 0;
}

interface Props {
  score: number;
  variant?: 'pill' | 'inline';
}

export default function HeatBadge({ score, variant = 'pill' }: Props) {
  const level = getHeatLevel(score);
  if (!level) return null;

  if (variant === 'inline') {
    return level === 'fire' ? (
      <span className="inline-flex items-center gap-1 text-orange-500 text-sm font-medium">
        <Flame className="w-4 h-4" /> Hot
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-amber-500 text-sm font-medium">
        <TrendingUp className="w-4 h-4" /> Trending
      </span>
    );
  }

  return level === 'fire' ? (
    <span className="bg-orange-500/90 backdrop-blur-sm text-white px-2.5 py-0.5 text-xs rounded-full font-medium flex items-center gap-1">
      <Flame className="w-3 h-3" /> Hot
    </span>
  ) : (
    <span className="bg-amber-500/90 backdrop-blur-sm text-white px-2.5 py-0.5 text-xs rounded-full font-medium flex items-center gap-1">
      <TrendingUp className="w-3 h-3" /> Trending
    </span>
  );
}
