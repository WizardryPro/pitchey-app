import React from 'react';
import LogoLoader from '@/components/LogoLoader';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Kept for API compatibility — the brand film loader is always violet. */
  color?: 'purple' | 'blue' | 'gray' | 'white';
  className?: string;
  text?: string;
}

// Map the legacy spinner sizes onto the film-strip loader sizes.
const SIZE_MAP = { sm: 'sm', md: 'sm', lg: 'md', xl: 'lg' } as const;

/**
 * LoadingSpinner — now renders the Pitchey film-strip loader (LogoLoader) so every
 * data-load loading state across the app shares one branded animation. API preserved
 * (size/text/className + data-testid) for drop-in compatibility.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '', text }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      data-testid="loading-spinner"
    >
      <LogoLoader size={SIZE_MAP[size]} label={text} />
    </div>
  );
};

export default LoadingSpinner;
