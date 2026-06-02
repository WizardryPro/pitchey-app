import { safeNumber as defensiveSafeNumber, isValidDate, safeDate } from './defensive';
import { getActiveCurrency } from '../../config/currency';

// Safe number formatting utilities to prevent $NaN values
export const safeNumber = defensiveSafeNumber;

// Currency display is locale-aware: it follows the user's active/selected
// currency (getActiveCurrency) rather than a fixed symbol. Pass an explicit
// `currency` to override. NOTE: presentation only — amounts are NOT FX-converted
// (exact for pricing where we hold per-currency prices; symbol-only for stored
// EUR figures). Default base is EUR.
export const formatCurrency = (value: unknown, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  currency?: string;
}): string => {
  const safeValue = safeNumber(value, 0);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: options?.currency ?? getActiveCurrency(),
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(safeValue);
};

/**
 * Compact budget display using Intl compact notation: €12M, £500K, $1.5B
 * (symbol follows the active currency; amounts are not FX-converted).
 */
export const formatBudgetCompact = (value: unknown, currency?: string): string => {
  const n = safeNumber(value, 0);
  if (n === 0) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? getActiveCurrency(),
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n);
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