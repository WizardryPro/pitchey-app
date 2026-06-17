import React from 'react';
import { Check } from 'lucide-react';

/**
 * Presentational 3-step progress indicator for the signup journey:
 * Create account → Verify email → Complete profile.
 *
 * Shown on Register, VerifyEmail and the onboarding profile page so the three
 * screens read as one continuous, finite flow rather than disconnected steps.
 * No store dependency — purely driven by the `current` prop.
 */

export type StepperAccent = 'indigo' | 'emerald' | 'amber' | 'purple';

interface OnboardingStepperProps {
  /** 1-based index of the step the user is currently on. */
  current: 1 | 2 | 3;
  /** Portal tint for the active/completed states. Defaults to purple (brand). */
  accent?: StepperAccent;
  className?: string;
}

const STEPS = ['Create account', 'Verify email', 'Complete profile'] as const;

// Tailwind can't compose class names dynamically — map each accent explicitly.
const ACCENT: Record<StepperAccent, { done: string; current: string; label: string }> = {
  indigo: { done: 'bg-indigo-600 text-white', current: 'bg-indigo-600 text-white ring-4 ring-indigo-100', label: 'text-indigo-700' },
  emerald: { done: 'bg-emerald-600 text-white', current: 'bg-emerald-600 text-white ring-4 ring-emerald-100', label: 'text-emerald-700' },
  amber: { done: 'bg-amber-600 text-white', current: 'bg-amber-600 text-white ring-4 ring-amber-100', label: 'text-amber-700' },
  purple: { done: 'bg-purple-600 text-white', current: 'bg-purple-600 text-white ring-4 ring-purple-100', label: 'text-purple-700' },
};

export function OnboardingStepper({ current, accent = 'purple', className = '' }: OnboardingStepperProps) {
  const colors = ACCENT[accent] ?? ACCENT.purple;

  return (
    <nav aria-label="Sign-up progress" className={`w-full ${className}`}>
      <ol className="flex items-center justify-center">
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < current;
          const isCurrent = stepNum === current;
          const isLast = stepNum === STEPS.length;

          const circle = isDone
            ? colors.done
            : isCurrent
              ? colors.current
              : 'bg-gray-200 text-gray-500';

          return (
            <li key={label} className="flex items-center" {...(isLast ? {} : { 'aria-hidden': false })}>
              <div className="flex flex-col items-center" aria-current={isCurrent ? 'step' : undefined}>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${circle}`}
                >
                  {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : stepNum}
                </span>
                <span
                  className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                    isCurrent ? colors.label : isDone ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-0.5 w-8 sm:w-12 self-start mt-4 rounded ${stepNum < current ? 'bg-current opacity-60 ' + colors.label : 'bg-gray-200'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default OnboardingStepper;
