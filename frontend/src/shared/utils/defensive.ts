/**
 * Defensive Programming Utilities
 * Comprehensive safeguards against null references, type mismatches, and runtime errors
 */

// ============================================================================
// SAFE PROPERTY ACCESS
// ============================================================================

/**
 * Safely access nested object properties with fallback
 */
export function safeAccess<T>(
  obj: unknown,
  path: string,
  fallback: T
): T {
  if (!obj || typeof obj !== 'object') return fallback;
  
  try {
    const keys = path.split('.');
    let current: any = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return fallback;
      }
      current = current[key];
    }
    
    return current !== null && current !== undefined ? current : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safe deep property access with type validation
 */
export function safeGet<T>(
  obj: unknown,
  path: string,
  validator: (value: unknown) => value is T,
  fallback: T
): T {
  const value = safeAccess(obj, path, fallback);
  return validator(value) ? value : fallback;
}

// ============================================================================
// TYPE COERCION & VALIDATION
// ============================================================================

/**
 * Safe number conversion with fallback
 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  
  // Handle string numbers
  if (typeof value === 'string') {
    const parsed = parseFloat(value.trim());
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  
  // Handle numeric values
  if (typeof value === 'number') {
    return Number.isNaN(value) || !Number.isFinite(value) ? fallback : value;
  }
  
  // Handle boolean (true = 1, false = 0)
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  
  return fallback;
}

/**
 * Safe string conversion with fallback
 */
export function safeString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  
  try {
    return String(value);
  } catch {
    return fallback;
  }
}

/**
 * Safe boolean conversion with fallback
 */
export function safeBoolean(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  
  return fallback;
}

// ============================================================================
// ARRAY OPERATIONS SAFETY
// ============================================================================

/**
 * Ensure value is an array with fallback
 */
export function safeArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value;
  return fallback;
}

/**
 * Safe array map operation
 */
export function safeMap<T, U>(
  array: unknown,
  mapper: (item: T, index: number) => U,
  fallback: U[] = []
): U[] {
  const safeArr = safeArray<T>(array);
  if (safeArr.length === 0) return fallback;
  
  try {
    return safeArr.map(mapper);
  } catch {
    return fallback;
  }
}

/**
 * Safe array filter operation
 */
export function safeFilter<T>(
  array: unknown,
  predicate: (item: T, index: number) => boolean,
  fallback: T[] = []
): T[] {
  const safeArr = safeArray<T>(array);
  if (safeArr.length === 0) return fallback;
  
  try {
    return safeArr.filter(predicate);
  } catch {
    return fallback;
  }
}

/**
 * Safe array reduce operation
 */
export function safeReduce<T, U>(
  array: unknown,
  reducer: (acc: U, item: T, index: number) => U,
  initialValue: U
): U {
  const safeArr = safeArray<T>(array);
  if (safeArr.length === 0) return initialValue;
  
  try {
    return safeArr.reduce(reducer, initialValue);
  } catch {
    return initialValue;
  }
}

// ============================================================================
// DATE VALIDATION
// ============================================================================

/**
 * Validate if a value represents a valid date
 */
export function isValidDate(value: unknown): value is Date | string | number {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  
  return false;
}

/**
 * Safe date parsing with fallback
 */
export function safeDate(value: unknown, fallback: Date = new Date()): Date {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  
  if (typeof value === 'string' || typeof value === 'number') {
    try {
      const parsed = new Date(value);
      return !isNaN(parsed.getTime()) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  
  return fallback;
}

/**
 * Safe timestamp validation and parsing
 */
export function safeTimestamp(value: unknown): number {
  const date = safeDate(value);
  return date.getTime();
}

// ============================================================================
// BUDGET & FINANCIAL CALCULATIONS
// ============================================================================

/**
 * Safe budget calculation with proper type coercion
 */
export function safeBudgetCalc(
  value1: unknown,
  value2: unknown,
  operation: 'add' | 'subtract' | 'multiply' | 'divide'
): number {
  const num1 = safeNumber(value1, 0);
  const num2 = safeNumber(value2, 0);
  
  switch (operation) {
    case 'add':
      return num1 + num2;
    case 'subtract':
      return num1 - num2;
    case 'multiply':
      return num1 * num2;
    case 'divide':
      return num2 !== 0 ? num1 / num2 : 0;
    default:
      return 0;
  }
}

/**
 * Safe percentage calculation
 */
export function safePercentage(part: unknown, total: unknown): number {
  const safePart = safeNumber(part, 0);
  const safeTotal = safeNumber(total, 0);
  
  if (safeTotal === 0) return 0;
  return (safePart / safeTotal) * 100;
}

// ============================================================================
// OBJECT VALIDATION
// ============================================================================

/**
 * Check if object has required properties
 */
export function hasRequiredProps<T extends Record<string, any>>(
  obj: unknown,
  requiredProps: (keyof T)[]
): obj is T {
  if (!obj || typeof obj !== 'object') return false;
  
  return requiredProps.every(prop => prop in obj);
}

/**
 * Safe object merge with fallbacks
 */
export function safeMerge<T extends Record<string, any>>(
  target: T,
  source: unknown,
  requiredProps: (keyof T)[] = []
): T {
  if (!source || typeof source !== 'object') return target;
  
  const result = { ...target };
  
  for (const [key, value] of Object.entries(source)) {
    if (key in target && value !== null && value !== undefined) {
      (result as any)[key] = value;
    }
  }
  
  // Ensure required props exist
  requiredProps.forEach(prop => {
    if (!(prop in result) || result[prop] === null || result[prop] === undefined) {
      result[prop] = target[prop];
    }
  });
  
  return result;
}

// ============================================================================
// ERROR BOUNDARIES
// ============================================================================

/**
 * Safe execution wrapper with error handling
 */
export function safeExecute<T>(
  fn: () => T,
  fallback: T,
  errorCallback?: (error: Error) => void
): T {
  try {
    return fn();
  } catch (error) {
    if (errorCallback && error instanceof Error) {
      errorCallback(error);
    }
    return fallback;
  }
}

/**
 * Safe async execution wrapper
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorCallback?: (error: Error) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorCallback && error instanceof Error) {
      errorCallback(error);
    }
    return fallback;
  }
}

// ============================================================================
// USER PORTFOLIO/STATS VALIDATION
// ============================================================================

/**
 * Validate user portfolio data structure
 */
export interface SafePortfolio {
  total_value: number;
  active_investments: number;
  completed_projects: number;
  roi_percentage: number;
  performance_score: number;
  projects: Array<{
    id: string;
    title: string;
    status: string;
    investment_amount: number;
    current_value: number;
  }>;
}

export function validatePortfolio(data: unknown): SafePortfolio {
  const defaultPortfolio: SafePortfolio = {
    total_value: 0,
    active_investments: 0,
    completed_projects: 0,
    roi_percentage: 0,
    performance_score: 0,
    projects: []
  };
  
  if (!data || typeof data !== 'object') return defaultPortfolio;
  
  return {
    total_value: safeNumber(safeAccess(data, 'total_value', 0)),
    active_investments: safeNumber(safeAccess(data, 'active_investments', 0)),
    completed_projects: safeNumber(safeAccess(data, 'completed_projects', 0)),
    roi_percentage: safeNumber(safeAccess(data, 'roi_percentage', 0)),
    performance_score: safeNumber(safeAccess(data, 'performance_score', 0)),
    projects: safeArray(safeAccess(data, 'projects', []))
  };
}

/**
 * Validate creator stats data structure
 */
export interface SafeCreatorStats {
  total_pitches: number;
  active_pitches: number;
  views_count: number;
  interest_count: number;
  funding_received: number;
  success_rate: number;
  average_rating: number;
}

export function validateCreatorStats(data: unknown): SafeCreatorStats {
  const defaultStats: SafeCreatorStats = {
    total_pitches: 0,
    active_pitches: 0,
    views_count: 0,
    interest_count: 0,
    funding_received: 0,
    success_rate: 0,
    average_rating: 0
  };
  
  if (!data || typeof data !== 'object') return defaultStats;
  
  return {
    total_pitches: safeNumber(safeAccess(data, 'total_pitches', 0)),
    active_pitches: safeNumber(safeAccess(data, 'active_pitches', 0)),
    views_count: safeNumber(safeAccess(data, 'views_count', 0)),
    interest_count: safeNumber(safeAccess(data, 'interest_count', 0)),
    funding_received: safeNumber(safeAccess(data, 'funding_received', 0)),
    success_rate: safeNumber(safeAccess(data, 'success_rate', 0)),
    average_rating: safeNumber(safeAccess(data, 'average_rating', 0))
  };
}

/**
 * Validate production company stats
 */
export interface SafeProductionStats {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  total_revenue: number;
  average_budget: number;
  success_rate: number;
  upcoming_releases: number;
}

export function validateProductionStats(data: unknown): SafeProductionStats {
  const defaultStats: SafeProductionStats = {
    total_projects: 0,
    active_projects: 0,
    completed_projects: 0,
    total_revenue: 0,
    average_budget: 0,
    success_rate: 0,
    upcoming_releases: 0
  };
  
  if (!data || typeof data !== 'object') return defaultStats;
  
  return {
    total_projects: safeNumber(safeAccess(data, 'total_projects', 0)),
    active_projects: safeNumber(safeAccess(data, 'active_projects', 0)),
    completed_projects: safeNumber(safeAccess(data, 'completed_projects', 0)),
    total_revenue: safeNumber(safeAccess(data, 'total_revenue', 0)),
    average_budget: safeNumber(safeAccess(data, 'average_budget', 0)),
    success_rate: safeNumber(safeAccess(data, 'success_rate', 0)),
    upcoming_releases: safeNumber(safeAccess(data, 'upcoming_releases', 0))
  };
}