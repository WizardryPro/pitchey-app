import { describe, it, expect, vi } from 'vitest';
import {
  safeAccess,
  safeGet,
  safeNumber,
  safeString,
  safeBoolean,
  safeArray,
  safeMap,
  safeFilter,
  safeReduce,
  isValidDate,
  safeDate,
  safeTimestamp,
  safeBudgetCalc,
  safePercentage,
  hasRequiredProps,
  safeMerge,
  safeExecute,
  safeExecuteAsync,
  validatePortfolio,
  validateCreatorStats,
  validateProductionStats,
} from '@shared/utils/defensive';

// ============================================================================
// safeAccess
// ============================================================================
describe('safeAccess', () => {
  it('returns value for simple path', () => {
    expect(safeAccess({ a: 1 }, 'a', 0)).toBe(1);
  });

  it('returns value for nested path', () => {
    expect(safeAccess({ a: { b: { c: 42 } } }, 'a.b.c', 0)).toBe(42);
  });

  it('returns fallback for missing key', () => {
    expect(safeAccess({ a: 1 }, 'b', 'fallback')).toBe('fallback');
  });

  it('returns fallback for null object', () => {
    expect(safeAccess(null, 'a', 'fb')).toBe('fb');
  });

  it('returns fallback for undefined object', () => {
    expect(safeAccess(undefined, 'a', 'fb')).toBe('fb');
  });

  it('returns fallback for non-object', () => {
    expect(safeAccess(42, 'a', 'fb')).toBe('fb');
  });

  it('returns fallback when intermediate key is null', () => {
    expect(safeAccess({ a: null }, 'a.b', 'fb')).toBe('fb');
  });

  it('returns fallback when value is null', () => {
    expect(safeAccess({ a: null }, 'a', 'fb')).toBe('fb');
  });

  it('returns fallback when value is undefined', () => {
    expect(safeAccess({ a: undefined }, 'a', 'fb')).toBe('fb');
  });
});

// ============================================================================
// safeGet
// ============================================================================
describe('safeGet', () => {
  it('returns value when validator passes', () => {
    const isNum = (v: unknown): v is number => typeof v === 'number';
    expect(safeGet({ a: 42 }, 'a', isNum, 0)).toBe(42);
  });

  it('returns fallback when validator fails', () => {
    const isNum = (v: unknown): v is number => typeof v === 'number';
    expect(safeGet({ a: 'hello' }, 'a', isNum, 0)).toBe(0);
  });
});

// ============================================================================
// safeNumber
// ============================================================================
describe('safeNumber', () => {
  it('returns number for number input', () => {
    expect(safeNumber(42)).toBe(42);
  });

  it('parses string numbers', () => {
    expect(safeNumber('3.14')).toBeCloseTo(3.14);
  });

  it('trims whitespace from strings', () => {
    expect(safeNumber('  10  ')).toBe(10);
  });

  it('returns fallback for NaN', () => {
    expect(safeNumber(NaN, 5)).toBe(5);
  });

  it('returns fallback for Infinity', () => {
    expect(safeNumber(Infinity, 5)).toBe(5);
  });

  it('returns fallback for non-numeric string', () => {
    expect(safeNumber('abc', 99)).toBe(99);
  });

  it('returns fallback for null', () => {
    expect(safeNumber(null, 7)).toBe(7);
  });

  it('returns fallback for undefined', () => {
    expect(safeNumber(undefined, 7)).toBe(7);
  });

  it('converts boolean true to 1', () => {
    expect(safeNumber(true)).toBe(1);
  });

  it('converts boolean false to 0', () => {
    expect(safeNumber(false)).toBe(0);
  });

  it('returns fallback for object', () => {
    expect(safeNumber({}, 3)).toBe(3);
  });

  it('uses 0 as default fallback', () => {
    expect(safeNumber(null)).toBe(0);
  });
});

// ============================================================================
// safeString
// ============================================================================
describe('safeString', () => {
  it('returns string for string input', () => {
    expect(safeString('hello')).toBe('hello');
  });

  it('converts number to string', () => {
    expect(safeString(42)).toBe('42');
  });

  it('returns fallback for null', () => {
    expect(safeString(null, 'fb')).toBe('fb');
  });

  it('returns fallback for undefined', () => {
    expect(safeString(undefined, 'fb')).toBe('fb');
  });

  it('uses empty string as default fallback', () => {
    expect(safeString(null)).toBe('');
  });

  it('converts boolean to string', () => {
    expect(safeString(true)).toBe('true');
  });
});

// ============================================================================
// safeBoolean
// ============================================================================
describe('safeBoolean', () => {
  it('returns boolean for boolean input', () => {
    expect(safeBoolean(true)).toBe(true);
    expect(safeBoolean(false)).toBe(false);
  });

  it('converts non-zero number to true', () => {
    expect(safeBoolean(1)).toBe(true);
    expect(safeBoolean(-1)).toBe(true);
  });

  it('converts zero to false', () => {
    expect(safeBoolean(0)).toBe(false);
  });

  it('converts string "true" to true', () => {
    expect(safeBoolean('true')).toBe(true);
    expect(safeBoolean('TRUE')).toBe(true);
  });

  it('converts string "1" and "yes" to true', () => {
    expect(safeBoolean('1')).toBe(true);
    expect(safeBoolean('yes')).toBe(true);
  });

  it('converts other strings to false', () => {
    expect(safeBoolean('false')).toBe(false);
    expect(safeBoolean('no')).toBe(false);
    expect(safeBoolean('abc')).toBe(false);
  });

  it('returns fallback for null', () => {
    expect(safeBoolean(null, true)).toBe(true);
  });

  it('returns fallback for undefined', () => {
    expect(safeBoolean(undefined)).toBe(false);
  });

  it('returns fallback for object', () => {
    expect(safeBoolean({}, true)).toBe(true);
  });
});

// ============================================================================
// safeArray
// ============================================================================
describe('safeArray', () => {
  it('returns array for array input', () => {
    expect(safeArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('returns empty array fallback for null', () => {
    expect(safeArray(null)).toEqual([]);
  });

  it('returns empty array fallback for undefined', () => {
    expect(safeArray(undefined)).toEqual([]);
  });

  it('returns empty array fallback for non-array', () => {
    expect(safeArray('hello')).toEqual([]);
  });

  it('returns custom fallback', () => {
    expect(safeArray(null, [1])).toEqual([1]);
  });
});

// ============================================================================
// safeMap
// ============================================================================
describe('safeMap', () => {
  it('maps over valid array', () => {
    expect(safeMap([1, 2, 3], (x: number) => x * 2)).toEqual([2, 4, 6]);
  });

  it('returns fallback for null input', () => {
    expect(safeMap(null, (x: number) => x * 2, [-1])).toEqual([-1]);
  });

  it('returns fallback for empty array', () => {
    expect(safeMap([], (x: number) => x * 2, [-1])).toEqual([-1]);
  });

  it('returns fallback when mapper throws', () => {
    expect(safeMap([1], () => { throw new Error('fail'); }, [-1])).toEqual([-1]);
  });
});

// ============================================================================
// safeFilter
// ============================================================================
describe('safeFilter', () => {
  it('filters valid array', () => {
    expect(safeFilter([1, 2, 3, 4], (x: number) => x > 2)).toEqual([3, 4]);
  });

  it('returns fallback for null input', () => {
    expect(safeFilter(null, () => true, [0])).toEqual([0]);
  });

  it('returns fallback for empty array', () => {
    expect(safeFilter([], () => true, [0])).toEqual([0]);
  });

  it('returns fallback when predicate throws', () => {
    expect(safeFilter([1], () => { throw new Error('fail'); }, [0])).toEqual([0]);
  });
});

// ============================================================================
// safeReduce
// ============================================================================
describe('safeReduce', () => {
  it('reduces valid array', () => {
    expect(safeReduce([1, 2, 3], (acc: number, x: number) => acc + x, 0)).toBe(6);
  });

  it('returns initial value for null input', () => {
    expect(safeReduce(null, (acc: number) => acc, 10)).toBe(10);
  });

  it('returns initial value for empty array', () => {
    expect(safeReduce([], (acc: number) => acc, 10)).toBe(10);
  });

  it('returns initial value when reducer throws', () => {
    expect(safeReduce([1], () => { throw new Error('fail'); }, 10)).toBe(10);
  });
});

// ============================================================================
// isValidDate
// ============================================================================
describe('isValidDate', () => {
  it('returns true for valid Date object', () => {
    expect(isValidDate(new Date())).toBe(true);
  });

  it('returns false for invalid Date object', () => {
    expect(isValidDate(new Date('invalid'))).toBe(false);
  });

  it('returns true for valid date string', () => {
    expect(isValidDate('2024-01-15')).toBe(true);
  });

  it('returns false for invalid date string', () => {
    expect(isValidDate('not-a-date')).toBe(false);
  });

  it('returns true for epoch number', () => {
    expect(isValidDate(1700000000000)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidDate(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidDate(undefined)).toBe(false);
  });

  it('returns false for object', () => {
    expect(isValidDate({})).toBe(false);
  });
});

// ============================================================================
// safeDate
// ============================================================================
describe('safeDate', () => {
  it('returns Date for valid Date input', () => {
    const d = new Date('2024-06-15');
    expect(safeDate(d)).toEqual(d);
  });

  it('parses valid date string', () => {
    const result = safeDate('2024-06-15');
    expect(result.getFullYear()).toBe(2024);
  });

  it('parses epoch number', () => {
    const ts = 1700000000000;
    const result = safeDate(ts);
    expect(result.getTime()).toBe(ts);
  });

  it('returns fallback for invalid Date', () => {
    const fb = new Date('2000-01-01');
    expect(safeDate(new Date('invalid'), fb)).toEqual(fb);
  });

  it('returns fallback for invalid string', () => {
    const fb = new Date('2000-01-01');
    expect(safeDate('not-a-date', fb)).toEqual(fb);
  });

  it('returns fallback for null', () => {
    const fb = new Date('2000-01-01');
    expect(safeDate(null, fb)).toEqual(fb);
  });
});

// ============================================================================
// safeTimestamp
// ============================================================================
describe('safeTimestamp', () => {
  it('returns timestamp for valid date', () => {
    const ts = safeTimestamp('2024-01-01T00:00:00Z');
    expect(ts).toBe(new Date('2024-01-01T00:00:00Z').getTime());
  });

  it('returns a valid number for null', () => {
    const ts = safeTimestamp(null);
    expect(typeof ts).toBe('number');
    expect(Number.isNaN(ts)).toBe(false);
  });
});

// ============================================================================
// safeBudgetCalc
// ============================================================================
describe('safeBudgetCalc', () => {
  it('adds two numbers', () => {
    expect(safeBudgetCalc(10, 5, 'add')).toBe(15);
  });

  it('subtracts two numbers', () => {
    expect(safeBudgetCalc(10, 3, 'subtract')).toBe(7);
  });

  it('multiplies two numbers', () => {
    expect(safeBudgetCalc(4, 5, 'multiply')).toBe(20);
  });

  it('divides two numbers', () => {
    expect(safeBudgetCalc(10, 4, 'divide')).toBe(2.5);
  });

  it('returns 0 for division by zero', () => {
    expect(safeBudgetCalc(10, 0, 'divide')).toBe(0);
  });

  it('handles string inputs', () => {
    expect(safeBudgetCalc('10', '5', 'add')).toBe(15);
  });

  it('handles null inputs', () => {
    expect(safeBudgetCalc(null, null, 'add')).toBe(0);
  });

  it('returns 0 for unknown operation', () => {
    expect(safeBudgetCalc(1, 2, 'unknown' as any)).toBe(0);
  });
});

// ============================================================================
// safePercentage
// ============================================================================
describe('safePercentage', () => {
  it('calculates correct percentage', () => {
    expect(safePercentage(25, 100)).toBe(25);
  });

  it('returns 0 when total is 0', () => {
    expect(safePercentage(5, 0)).toBe(0);
  });

  it('returns 0 when both are null', () => {
    expect(safePercentage(null, null)).toBe(0);
  });

  it('handles string inputs', () => {
    expect(safePercentage('50', '200')).toBe(25);
  });
});

// ============================================================================
// hasRequiredProps
// ============================================================================
describe('hasRequiredProps', () => {
  it('returns true when all props exist', () => {
    expect(hasRequiredProps({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
  });

  it('returns false when a prop is missing', () => {
    expect(hasRequiredProps({ a: 1 }, ['a', 'b'])).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasRequiredProps(null, ['a'])).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(hasRequiredProps(42, ['a'])).toBe(false);
  });

  it('returns true for empty required props', () => {
    expect(hasRequiredProps({}, [])).toBe(true);
  });
});

// ============================================================================
// safeMerge
// ============================================================================
describe('safeMerge', () => {
  it('merges source into target', () => {
    const result = safeMerge({ a: 1, b: 2 }, { a: 10 });
    expect(result).toEqual({ a: 10, b: 2 });
  });

  it('ignores keys not in target', () => {
    const result = safeMerge({ a: 1 }, { a: 10, c: 99 });
    expect(result).toEqual({ a: 10 });
  });

  it('ignores null values in source', () => {
    const result = safeMerge({ a: 1 }, { a: null });
    expect(result).toEqual({ a: 1 });
  });

  it('returns target for non-object source', () => {
    const target = { a: 1 };
    expect(safeMerge(target, null)).toEqual(target);
    expect(safeMerge(target, 42)).toEqual(target);
  });

  it('restores required props from target if missing', () => {
    const result = safeMerge({ a: 1, b: 2 }, { a: null }, ['a']);
    expect(result.a).toBe(1);
  });
});

// ============================================================================
// safeExecute
// ============================================================================
describe('safeExecute', () => {
  it('returns function result on success', () => {
    expect(safeExecute(() => 42, 0)).toBe(42);
  });

  it('returns fallback on error', () => {
    expect(safeExecute(() => { throw new Error('fail'); }, 99)).toBe(99);
  });

  it('calls error callback on error', () => {
    const cb = vi.fn();
    safeExecute(() => { throw new Error('oops'); }, 0, cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not call error callback on non-Error throw', () => {
    const cb = vi.fn();
    safeExecute(() => { throw 'string error'; }, 0, cb);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ============================================================================
// safeExecuteAsync
// ============================================================================
describe('safeExecuteAsync', () => {
  it('returns resolved value on success', async () => {
    expect(await safeExecuteAsync(async () => 42, 0)).toBe(42);
  });

  it('returns fallback on rejection', async () => {
    expect(await safeExecuteAsync(async () => { throw new Error('fail'); }, 99)).toBe(99);
  });

  it('calls error callback on rejection', async () => {
    const cb = vi.fn();
    await safeExecuteAsync(async () => { throw new Error('oops'); }, 0, cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ============================================================================
// validatePortfolio
// ============================================================================
describe('validatePortfolio', () => {
  it('returns defaults for null', () => {
    const result = validatePortfolio(null);
    expect(result.total_value).toBe(0);
    expect(result.active_investments).toBe(0);
    expect(result.projects).toEqual([]);
  });

  it('returns defaults for non-object', () => {
    const result = validatePortfolio('string');
    expect(result.total_value).toBe(0);
  });

  it('extracts valid data', () => {
    const result = validatePortfolio({
      total_value: 100000,
      active_investments: 5,
      completed_projects: 3,
      roi_percentage: 12.5,
      performance_score: 85,
      projects: [{ id: '1', title: 'Test' }],
    });
    expect(result.total_value).toBe(100000);
    expect(result.active_investments).toBe(5);
    expect(result.projects).toHaveLength(1);
  });

  it('coerces string numbers', () => {
    const result = validatePortfolio({ total_value: '5000' });
    expect(result.total_value).toBe(5000);
  });
});

// ============================================================================
// validateCreatorStats
// ============================================================================
describe('validateCreatorStats', () => {
  it('returns defaults for null', () => {
    const result = validateCreatorStats(null);
    expect(result.total_pitches).toBe(0);
    expect(result.average_rating).toBe(0);
  });

  it('extracts valid data', () => {
    const result = validateCreatorStats({
      total_pitches: 10,
      active_pitches: 3,
      views_count: 500,
      interest_count: 25,
      funding_received: 50000,
      success_rate: 30,
      average_rating: 4.5,
    });
    expect(result.total_pitches).toBe(10);
    expect(result.average_rating).toBe(4.5);
  });

  it('returns defaults for non-object', () => {
    expect(validateCreatorStats(42).total_pitches).toBe(0);
  });
});

// ============================================================================
// validateProductionStats
// ============================================================================
describe('validateProductionStats', () => {
  it('returns defaults for null', () => {
    const result = validateProductionStats(null);
    expect(result.total_projects).toBe(0);
    expect(result.upcoming_releases).toBe(0);
  });

  it('extracts valid data', () => {
    const result = validateProductionStats({
      total_projects: 20,
      active_projects: 5,
      completed_projects: 15,
      total_revenue: 1000000,
      average_budget: 50000,
      success_rate: 75,
      upcoming_releases: 3,
    });
    expect(result.total_projects).toBe(20);
    expect(result.success_rate).toBe(75);
  });

  it('returns defaults for non-object', () => {
    expect(validateProductionStats('bad').total_projects).toBe(0);
  });
});
