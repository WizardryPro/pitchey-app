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
}: {
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  showNumber?: boolean;
}) {
  if (!value || value <= 0) return null;
  const rounded = Math.max(1, Math.min(10, Math.round(value)));
  const label = RATING_LABELS[rounded];
  const segH = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const num = size === 'sm' ? 'text-sm' : 'text-lg';

  return (
    <div
      className="flex items-center gap-3"
      role="img"
      aria-label={`Pitchey Score ${Number(value).toFixed(1)} out of 10 — ${label}`}
    >
      {showNumber && (
        <div className="flex items-baseline gap-0.5 shrink-0">
          <span className={`${num} font-bold text-gray-900 tabular-nums leading-none`}>{Number(value).toFixed(1)}</span>
          <span className="text-[11px] text-gray-400 font-medium">/10</span>
        </div>
      )}
      <div className="flex-1 flex items-center gap-[2px] min-w-[80px]" aria-hidden="true">
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
