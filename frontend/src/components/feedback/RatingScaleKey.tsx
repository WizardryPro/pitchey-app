import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { RATING_LABELS, RATING_COLORS } from '../../constants/pitchey-score';

/** A reference of the Pitchey Score 1-10 scale — colored pill per tier plus
 *  its named label. Lives on the single-pitch view so readers can decode what
 *  "Award Season Material" or "Studio Contender" actually means without
 *  hunting for it. Collapsed by default; toggled open on click. */
export default function RatingScaleKey() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors rounded-lg"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-500" />
          Pitchey Score scale (1–10)
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <ol className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <li key={n} className="flex items-center gap-2 text-sm">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${RATING_COLORS[n]} text-white text-xs font-bold shrink-0`}
              >
                {n}
              </span>
              <span className="text-gray-700">{RATING_LABELS[n]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
