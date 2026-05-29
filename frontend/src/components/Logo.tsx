import { BRAND } from '@config/brand';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** 'full' = mark + wordmark logotype, 'mark' = film-strip icon only */
  variant?: 'full' | 'mark';
  className?: string;
  onClick?: () => void;
}

const heightMap = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
} as const;

export default function Logo({ size = 'md', variant = 'full', className = '', onClick }: LogoProps) {
  const src = variant === 'mark' ? BRAND.mark : BRAND.logotype;

  return (
    <div
      className={`flex items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <img src={src} alt={BRAND.logoAlt} className={`${heightMap[size]} w-auto`} />
    </div>
  );
}
