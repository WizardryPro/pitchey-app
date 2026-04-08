import { ShieldCheck } from 'lucide-react';

type Tier = 'gold' | 'silver' | 'grey' | null | undefined;

const tierConfig = {
  gold: { label: 'Verified', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  silver: { label: 'Verified', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
  grey: { label: 'Pending', color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-100' },
};

interface Props {
  tier: Tier;
  size?: 'sm' | 'md';
}

export default function VerificationBadge({ tier, size = 'sm' }: Props) {
  if (!tier || !tierConfig[tier]) return null;
  const c = tierConfig[tier];
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border ${c.color} ${c.bg} ${c.border}`}
      title={`${tier.charAt(0).toUpperCase() + tier.slice(1)} ${c.label}`}
    >
      <ShieldCheck className={iconSize} />
      {size === 'md' && c.label}
    </span>
  );
}
