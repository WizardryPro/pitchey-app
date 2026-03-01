import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'purple' | 'blue' | 'gray' | 'white';
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'purple',
  className = '',
  text
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    purple: 'text-purple-600',
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    white: 'text-white'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  return (
    <div 
      className={`flex flex-col items-center justify-center ${className}`}
      data-testid="loading-spinner"
      role="status"
      aria-live="polite"
    >
      <Loader2 
        className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin`}
        aria-hidden="true"
      />
      {text && (
        <p className={`mt-2 ${textSizeClasses[size]} ${colorClasses[color]} font-medium`}>
          {text}
        </p>
      )}
      {!text && (
        <span className="sr-only">Loading...</span>
      )}
    </div>
  );
};

export { LoadingSpinner };
export default LoadingSpinner;