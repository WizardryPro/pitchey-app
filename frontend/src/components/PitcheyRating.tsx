import { useState } from 'react';
import { RATING_LABELS, RATING_COLORS, RATING_TEXT_COLORS } from '../constants/pitchey-score';

interface InteractiveProps {
  mode: 'interactive';
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

interface DisplayProps {
  mode: 'display';
  value: number;
}

interface CompactProps {
  mode: 'compact';
  value: number;
}

type Props = InteractiveProps | DisplayProps | CompactProps;

/** Compact: colored pill with number — for cards/listings */
function CompactRating({ value }: { value: number }) {
  const rounded = Math.max(1, Math.min(10, Math.round(value)));
  const bg = RATING_COLORS[rounded];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white ${bg}`}>
      {Number(value).toFixed(1)}
    </span>
  );
}

/** Display: colored pill with number + label — for feedback cards */
function DisplayRating({ value }: { value: number }) {
  const rounded = Math.max(1, Math.min(10, Math.round(value)));
  const bg = RATING_COLORS[rounded];
  const label = RATING_LABELS[rounded];
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold text-white ${bg}`}>
      <span>{rounded}</span>
      <span className="font-normal opacity-90">{label}</span>
    </span>
  );
}

/** Interactive: horizontal 1-10 pill selector with hover labels + full-scale legend */
function InteractiveRating({ value, onChange, disabled }: Omit<InteractiveProps, 'mode'>) {
  const [hoverRating, setHoverRating] = useState(0);
  const [showLegend, setShowLegend] = useState(false);
  const active = hoverRating || value;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
          const isActive = n <= active;
          const bg = isActive ? RATING_COLORS[n] : 'bg-gray-200';
          const text = isActive ? 'text-white' : 'text-gray-500';
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              title={RATING_LABELS[n]}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => onChange(n === value ? 0 : n)}
              className={`w-8 h-8 rounded-full ${bg} ${text} text-xs font-bold transition-all
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}
                ${n === value ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {active > 0 && (
        <p className={`text-sm font-medium ${RATING_TEXT_COLORS[active]}`}>
          {RATING_LABELS[active]}
        </p>
      )}
      <div className="text-xs text-gray-500">
        <button
          type="button"
          onClick={() => setShowLegend(v => !v)}
          className="underline decoration-dotted hover:text-gray-700"
        >
          {showLegend ? 'Hide full scale' : 'What do these mean?'}
        </button>
        {showLegend && (
          <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <li key={n} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${RATING_COLORS[n]} text-white text-[10px] font-bold shrink-0`}
                >
                  {n}
                </span>
                <span className="text-gray-700">{RATING_LABELS[n]}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default function PitcheyRating(props: Props) {
  switch (props.mode) {
    case 'compact':
      return <CompactRating value={props.value} />;
    case 'display':
      return <DisplayRating value={props.value} />;
    case 'interactive':
      return <InteractiveRating value={props.value} onChange={props.onChange} disabled={props.disabled} />;
  }
}
