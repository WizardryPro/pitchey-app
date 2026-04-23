import type { ComponentType, SVGProps } from 'react';

export type SortPillOption<V extends string = string> = {
  value: V;
  label: string;
  shortLabel?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

interface Props<V extends string> {
  options: ReadonlyArray<SortPillOption<V>>;
  value: V;
  onChange: (value: V) => void;
  ariaLabel: string;
  /** Per-value active background class (overrides defaultActiveBg). */
  activeAccents?: Partial<Record<V, string>>;
  /** Active background class when no per-value accent matches. */
  defaultActiveBg?: string;
}

export default function SortPillRow<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  activeAccents,
  defaultActiveBg = 'bg-brand-anchor',
}: Props<V>) {
  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        const activeBg = (activeAccents && activeAccents[option.value]) || defaultActiveBg;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition ${
              active
                ? `${activeBg} text-white border-transparent shadow-sm`
                : 'bg-white text-gray-700 border-gray-200 hover:border-brand-anchor hover:text-brand-anchor'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{option.shortLabel ?? option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
