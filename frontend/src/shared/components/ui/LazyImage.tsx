import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ImageOff, Loader } from 'lucide-react';
import Skeleton from '@shared/components/feedback/Skeleton';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: boolean; // For above-the-fold images
  sizes?: string; // For responsive images
  loading?: 'lazy' | 'eager';
  quality?: number; // For future optimization
  'data-testid'?: string;
}

/**
 * LazyImage component with intersection observer for performance
 * Features:
 * - Lazy loading with Intersection Observer
 * - Loading states and error handling
 * - Responsive image support
 * - Accessibility optimized
 * - Customizable placeholders and fallbacks
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  placeholder,
  fallback,
  onLoad,
  onError,
  objectFit = 'cover',
  priority = false,
  sizes,
  loading = 'lazy',
  'data-testid': testId = 'lazy-image',
}) => {
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [isInView, setIsInView] = useState(priority); // If priority, load immediately
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return; // Skip observer if priority or already in view

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px', // Start loading 50px before coming into view
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView]);

  const handleLoad = useCallback(() => {
    setImageStatus('loaded');
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setImageStatus('error');
    onError?.();
  }, [onError]);

  const imageStyles: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    objectFit,
  };

  // Default placeholder
  const defaultPlaceholder = (
    <Skeleton
      variant="rectangular"
      width={width || '100%'}
      height={height || '200px'}
      className="flex items-center justify-center bg-gray-100"
    />
  );

  // Default fallback for errors
  const defaultFallback = (
    <div
      className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
      style={imageStyles}
      role="img"
      aria-label={`Failed to load image: ${alt}`}
      data-testid={`${testId}-error`}
    >
      <div className="text-center">
        <ImageOff className="w-8 h-8 mx-auto mb-2" aria-hidden="true" />
        <p className="text-xs">Image unavailable</p>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      data-testid={testId}
    >
      {/* Show placeholder while loading or not in view */}
      {(!isInView || imageStatus === 'loading') && (
        <div className="absolute inset-0">
          {placeholder || defaultPlaceholder}
        </div>
      )}

      {/* Show image when in view */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          style={imageStyles}
          className={`transition-opacity duration-300 ${
            imageStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          loading={loading}
          sizes={sizes}
          data-testid={`${testId}-img`}
        />
      )}

      {/* Show error fallback */}
      {imageStatus === 'error' && (
        <div className="absolute inset-0">
          {fallback || defaultFallback}
        </div>
      )}

      {/* Loading indicator overlay */}
      {isInView && imageStatus === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
          <Loader className="w-6 h-6 text-gray-400 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading image</span>
        </div>
      )}
    </div>
  );
};

// Predefined image components for common use cases
interface AvatarImageProps extends Omit<LazyImageProps, 'width' | 'height' | 'objectFit'> {
  size?: number;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({ 
  size = 40, 
  className = '',
  ...props 
}) => (
  <LazyImage
    {...props}
    width={size}
    height={size}
    objectFit="cover"
    className={`rounded-full ${className}`}
    fallback={
      <div
        className={`flex items-center justify-center bg-gray-200 text-gray-500 rounded-full ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
        aria-label={`Avatar placeholder for ${props.alt}`}
      >
        <span className="text-xs font-medium">
          {props.alt.charAt(0).toUpperCase()}
        </span>
      </div>
    }
  />
);

interface HeroImageProps extends Omit<LazyImageProps, 'loading' | 'priority'> {
  aspectRatio?: 'square' | '16/9' | '4/3' | '3/2' | 'auto';
}

export const HeroImage: React.FC<HeroImageProps> = ({
  aspectRatio = '16/9',
  className = '',
  ...props
}) => {
  const aspectClasses = {
    'square': 'aspect-square',
    '16/9': 'aspect-video',
    '4/3': 'aspect-[4/3]',
    '3/2': 'aspect-[3/2]',
    'auto': '',
  };

  return (
    <LazyImage
      {...props}
      loading="eager"
      priority={true}
      className={`${aspectClasses[aspectRatio]} w-full ${className}`}
    />
  );
};

interface PitchImageProps extends Omit<LazyImageProps, 'objectFit'> {
  showOverlay?: boolean;
}

export const PitchImage: React.FC<PitchImageProps> = ({
  showOverlay = false,
  className = '',
  ...props
}) => (
  <div className="relative group">
    <LazyImage
      {...props}
      objectFit="cover"
      className={`w-full aspect-video rounded-lg ${className}`}
    />
    {showOverlay && (
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
        <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
    )}
  </div>
);

export default LazyImage;