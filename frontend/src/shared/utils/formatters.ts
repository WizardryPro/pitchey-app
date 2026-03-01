import { safeNumber as defensiveSafeNumber, isValidDate, safeDate } from './defensive';

// Safe number formatting utilities to prevent $NaN values
export const safeNumber = defensiveSafeNumber;

export const formatCurrency = (value: unknown, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  const safeValue = safeNumber(value, 0);
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(safeValue);
};

export const formatPercentage = (value: unknown, fallback = 0): string => {
  const safeValue = safeNumber(value, fallback);
  return `${safeValue.toFixed(1)}%`;
};

export const formatNumber = (value: unknown, fallback = 0): string => {
  const safeValue = safeNumber(value, fallback);
  return new Intl.NumberFormat('en-US').format(safeValue);
};

/**
 * Safe date formatting with validation
 */
export const formatDate = (value: unknown, fallback = 'Invalid Date'): string => {
  if (!isValidDate(value)) return fallback;
  
  const date = safeDate(value);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

/**
 * Safe relative time formatting
 */
export const formatRelativeTime = (value: unknown, fallback = 'Unknown'): string => {
  if (!isValidDate(value)) return fallback;
  
  const date = safeDate(value);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  
  return `${Math.floor(diffInDays / 365)} years ago`;
};

/**
 * Format duration safely
 */
export const formatDuration = (minutes: unknown, _fallback = '0 min'): string => {
  const safeMinutes = safeNumber(minutes, 0);
  
  if (safeMinutes < 60) {
    return `${safeMinutes} min`;
  }
  
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}min`;
};