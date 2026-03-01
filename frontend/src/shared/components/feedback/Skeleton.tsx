import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1
}) => {
  const baseClasses = 'animate-pulse bg-gray-200';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  // For text variant with multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div className={className}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${variantClasses[variant]} h-4 ${
              index < lines - 1 ? 'mb-2' : ''
            } ${index === lines - 1 ? 'w-3/4' : 'w-full'}`}
            style={index === 0 ? style : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      role="status"
      aria-label="Loading content"
      aria-hidden="true"
      data-testid="skeleton"
    />
  );
};

// Pre-built skeleton components for common use cases
export const PitchCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-lg shadow-md overflow-hidden border-2 border-gray-100 ${className}`}>
    {/* Image placeholder */}
    <Skeleton variant="rectangular" className="aspect-video w-full" />
    
    <div className="p-6">
      {/* Title */}
      <Skeleton variant="text" className="h-6 w-3/4 mb-2" />
      
      {/* Description */}
      <Skeleton variant="text" lines={2} className="mb-3" />
      
      {/* Genre */}
      <Skeleton variant="text" className="h-4 w-1/3 mb-3" />
      
      {/* Stats */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-3">
          <Skeleton variant="text" className="h-3 w-8" />
          <Skeleton variant="text" className="h-3 w-8" />
        </div>
        <Skeleton variant="text" className="h-3 w-16" />
      </div>
      
      {/* Action buttons */}
      <div className="mt-4 pt-4 border-t flex gap-2">
        <Skeleton variant="rectangular" className="flex-1 h-8" />
        <Skeleton variant="rectangular" className="flex-1 h-8" />
      </div>
    </div>
  </div>
);

export const UserProfileSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center space-x-3 ${className}`}>
    <Skeleton variant="circular" width={40} height={40} />
    <div className="flex-1">
      <Skeleton variant="text" className="h-4 w-24 mb-1" />
      <Skeleton variant="text" className="h-3 w-16" />
    </div>
  </div>
);

export const DashboardStatSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
    <div className="flex items-center justify-between">
      <div>
        <Skeleton variant="text" className="h-4 w-20 mb-2" />
        <Skeleton variant="text" className="h-8 w-16" />
      </div>
      <Skeleton variant="circular" width={48} height={48} />
    </div>
  </div>
);

export const MessageSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex space-x-3 p-4 ${className}`}>
    <Skeleton variant="circular" width={40} height={40} />
    <div className="flex-1">
      <div className="flex items-center space-x-2 mb-2">
        <Skeleton variant="text" className="h-4 w-20" />
        <Skeleton variant="text" className="h-3 w-12" />
      </div>
      <Skeleton variant="text" lines={2} />
    </div>
  </div>
);

export const TableRowSkeleton: React.FC<{ columns: number; className?: string }> = ({ 
  columns, 
  className = '' 
}) => (
  <tr className={className}>
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index} className="px-6 py-4">
        <Skeleton variant="text" className="h-4" />
      </td>
    ))}
  </tr>
);

export default Skeleton;