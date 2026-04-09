import { Fingerprint } from 'lucide-react';

const DISCLAIMER = 'Pitchey verifies this declaration. If AI-generated content is discovered, this badge will be removed.';

interface Props {
  aiUsed?: boolean;
  variant?: 'inline' | 'pill';
}

export default function HumanMadeBadge({ aiUsed, variant = 'inline' }: Props) {
  // Only show when explicitly marked as not AI-generated
  if (aiUsed !== false) return null;

  if (variant === 'pill') {
    return (
      <span
        className="bg-emerald-500/90 backdrop-blur-sm text-white px-2.5 py-0.5 text-xs rounded-full font-medium flex items-center gap-1"
        title={DISCLAIMER}
      >
        <Fingerprint className="w-3 h-3" />
        100% Human Made
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
      title={DISCLAIMER}
    >
      <Fingerprint className="w-3 h-3" />
      100% Human Made
    </span>
  );
}
