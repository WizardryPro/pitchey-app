import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDate,
  formatRelativeTime,
  formatDuration,
} from '@shared/utils/formatters';

// ============================================================================
// formatCurrency
// ============================================================================
describe('formatCurrency', () => {
  it('formats positive integer', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats negative number', () => {
    expect(formatCurrency(-500)).toBe('-$500');
  });

  it('formats large number', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000');
  });

  it('formats with custom fraction digits', () => {
    const result = formatCurrency(1234.567, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(result).toBe('$1,234.57');
  });

  it('formats null as $0', () => {
    expect(formatCurrency(null)).toBe('$0');
  });

  it('formats undefined as $0', () => {
    expect(formatCurrency(undefined)).toBe('$0');
  });

  it('formats NaN as $0', () => {
    expect(formatCurrency(NaN)).toBe('$0');
  });

  it('formats string number', () => {
    expect(formatCurrency('2500')).toBe('$2,500');
  });
});

// ============================================================================
// formatPercentage
// ============================================================================
describe('formatPercentage', () => {
  it('formats percentage with one decimal', () => {
    expect(formatPercentage(75)).toBe('75.0%');
  });

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('formats decimal value', () => {
    expect(formatPercentage(33.33)).toBe('33.3%');
  });

  it('formats negative percentage', () => {
    expect(formatPercentage(-5.5)).toBe('-5.5%');
  });

  it('uses fallback for null', () => {
    expect(formatPercentage(null, 50)).toBe('50.0%');
  });

  it('uses 0 as default fallback', () => {
    expect(formatPercentage(undefined)).toBe('0.0%');
  });
});

// ============================================================================
// formatNumber
// ============================================================================
describe('formatNumber', () => {
  it('formats integer with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('uses fallback for null', () => {
    expect(formatNumber(null, 100)).toBe('100');
  });

  it('formats string number', () => {
    expect(formatNumber('9999')).toBe('9,999');
  });
});

// ============================================================================
// formatDate
// ============================================================================
describe('formatDate', () => {
  it('formats valid date string', () => {
    const result = formatDate('2024-06-15');
    expect(result).toContain('Jun');
    expect(result).toContain('2024');
  });

  it('formats Date object', () => {
    const result = formatDate(new Date('2024-01-01'));
    expect(result).toContain('Jan');
    expect(result).toContain('2024');
  });

  it('returns fallback for invalid string', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });

  it('returns fallback for null', () => {
    expect(formatDate(null)).toBe('Invalid Date');
  });

  it('returns custom fallback', () => {
    expect(formatDate(null, 'N/A')).toBe('N/A');
  });
});

// ============================================================================
// formatRelativeTime
// ============================================================================
describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Today" for same day', () => {
    expect(formatRelativeTime('2024-06-15T10:00:00Z')).toBe('Today');
  });

  it('returns "Yesterday" for one day ago', () => {
    expect(formatRelativeTime('2024-06-14T10:00:00Z')).toBe('Yesterday');
  });

  it('returns "X days ago" for 2-6 days', () => {
    expect(formatRelativeTime('2024-06-12T10:00:00Z')).toBe('3 days ago');
  });

  it('returns "X weeks ago" for 7-29 days', () => {
    expect(formatRelativeTime('2024-06-01T10:00:00Z')).toBe('2 weeks ago');
  });

  it('returns "X months ago" for 30-364 days', () => {
    expect(formatRelativeTime('2024-03-15T10:00:00Z')).toBe('3 months ago');
  });

  it('returns "X years ago" for 365+ days', () => {
    expect(formatRelativeTime('2022-06-15T10:00:00Z')).toBe('2 years ago');
  });

  it('returns fallback for invalid date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('Unknown');
  });

  it('returns custom fallback for null', () => {
    expect(formatRelativeTime(null, 'N/A')).toBe('N/A');
  });
});

// ============================================================================
// formatDuration
// ============================================================================
describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(30)).toBe('30 min');
  });

  it('formats zero minutes', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('formats exact hours', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30min');
  });

  it('formats large duration', () => {
    expect(formatDuration(1440)).toBe('24h');
  });

  it('uses fallback for null', () => {
    expect(formatDuration(null)).toBe('0 min');
  });

  it('uses custom fallback for invalid input', () => {
    expect(formatDuration('abc', 'unknown')).toBe('0 min');
  });
});
