import { RATING_COLORS, RATING_LABELS } from '../../constants/pitchey-score';

/**
 * Pitchey Score as a 10-segment thermometer — reads as position + magnitude on
 * the 1-10 scale at a glance, not just a tier chip. Each filled segment carries
 * its own gradient color (red→orange→yellow→lime→green→purple), so the bar
 * literally shows how far up the scale the score climbed, ending on the tier color.
 */
export function ScoreMeter({
  value,
  size = 'md',
  showLabel = true,
  showNumber = true,
  compact = false,
}: {
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  showNumber?: boolean;
  /** Tight, fixed-width inline form for dense surfaces (marketplace card footers):
   *  small number, no "/10", a 64px bar — sits inline with view/like counts. */
  compact?: boolean;
}) {
  if (!value || value <= 0) return null;
  const rounded = Math.max(1, Math.min(10, Math.round(value)));
  const label = RATING_LABELS[rounded];
  const segH = compact ? 'h-1.5' : size === 'sm' ? 'h-1.5' : 'h-2.5';
  const num = compact ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-lg';
  const barWidth = compact ? 'w-16' : 'flex-1 min-w-[80px]';
  const segGap = compact ? 'gap-px' : 'gap-[2px]';

  return (
    <div
      className={`flex items-center ${compact ? 'gap-1.5' : 'gap-3'}`}
      role="img"
      aria-label={`Pitchey Score ${Number(value).toFixed(1)} out of 10 — ${label}`}
    >
      {showNumber && (
        <div className="flex items-baseline gap-0.5 shrink-0">
          <span className={`${num} font-bold text-gray-900 tabular-nums leading-none`}>{Number(value).toFixed(1)}</span>
          {!compact && <span className="text-[11px] text-gray-400 font-medium">/10</span>}
        </div>
      )}
      <div className={`${barWidth} flex items-center ${segGap}`} aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const on = n <= rounded;
          return <span key={n} className={`flex-1 ${segH} rounded-[2px] ${on ? RATING_COLORS[n] : 'bg-gray-200'}`} />;
        })}
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-600 whitespace-nowrap shrink-0">{label}</span>
      )}
    </div>
  );
}

export default ScoreMeter;
