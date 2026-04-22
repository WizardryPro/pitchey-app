/**
 * Base query utilities and types for Neon serverless SQL
 * Following Neon's best practices for edge environments
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Export the query function type for use in services.
// Runtime reality (Neon serverless client): the call-form
// `sql(queryString, params)` throws; use tagged template or `sql.query(...)`.
// Keeping the old overload here let 26 callers ship broken queries for weeks
// (see #20 + CLAUDE.md "Active error clusters").
export type SqlQuery = {
  (strings: TemplateStringsArray, ...values: any[]): Promise<any[]>;
  query(query: string, params?: any[]): Promise<any[]>;
};

/**
 * Create a SQL connection for a specific request
 * In serverless/edge environments, connections should be created per-request
 */
export function createSqlConnection(databaseUrl: string): SqlQuery {
  return neon(databaseUrl) as unknown as SqlQuery;
}

/**
 * Helper to safely handle null/undefined values in queries
 */
export function sqlParam<T>(value: T | null | undefined, defaultValue: T | null = null): T | null {
  return value !== undefined && value !== null ? value : defaultValue;
}

/**
 * Base error class for database operations
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Helper for building WHERE clauses dynamically
 */
export class WhereBuilder {
  private conditions: string[] = [];
  private params: any[] = [];
  private paramIndex = 1;

  add(condition: string | undefined, param?: any): this {
    if (condition) {
      // Replace placeholder with numbered parameter
      const processedCondition = condition.replace(/\$param/g, `$${this.paramIndex}`);
      this.conditions.push(processedCondition);
      if (param !== undefined) {
        this.params.push(param);
        this.paramIndex++;
      }
    }
    return this;
  }

  addOptional(column: string, operator: string, value: any | undefined): this {
    if (value !== undefined && value !== null) {
      this.conditions.push(`${column} ${operator} $${this.paramIndex}`);
      this.params.push(value);
      this.paramIndex++;
    }
    return this;
  }

  addIn(column: string, values: any[] | undefined): this {
    if (values && values.length > 0) {
      this.conditions.push(`${column} = ANY($${this.paramIndex})`);
      this.params.push(values);
      this.paramIndex++;
    }
    return this;
  }

  build(): { where: string; params: any[] } {
    const where = this.conditions.length > 0 
      ? `WHERE ${this.conditions.join(' AND ')}` 
      : '';
    return { where, params: this.params };
  }
}

/**
 * Helper for pagination
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export function buildPaginationClause(options: PaginationOptions): string {
  const parts: string[] = [];
  
  if (options.orderBy) {
    const direction = options.orderDirection || 'DESC';
    parts.push(`ORDER BY ${options.orderBy} ${direction}`);
  }
  
  if (options.limit !== undefined) {
    parts.push(`LIMIT ${options.limit}`);
  }
  
  if (options.offset !== undefined) {
    parts.push(`OFFSET ${options.offset}`);
  }
  
  return parts.join(' ');
}

/**
 * Type-safe result extractor
 */
export function extractFirst<T>(result: any[]): T | null {
  return result && result.length > 0 ? result[0] as T : null;
}

export function extractMany<T>(result: any[]): T[] {
  return (result || []) as T[];
}

/**
 * Transaction helper (using Neon's transaction support)
 */
export async function withTransaction<T>(
  sql: SqlQuery,
  callback: (sql: SqlQuery) => Promise<T>
): Promise<T> {
  try {
    await sql`BEGIN`;
    const result = await callback(sql);
    await sql`COMMIT`;
    return result;
  } catch (error) {
    await sql`ROLLBACK`;
    throw error;
  }
}