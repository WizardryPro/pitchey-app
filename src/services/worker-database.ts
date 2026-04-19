/**
 * Typed Database Connection Service for Cloudflare Workers
 * Uses Neon PostgreSQL Serverless Driver for HTTP/WebSocket connections
 * Features comprehensive TypeScript support and runtime validation
 */

import { neon, neonConfig, type NeonQueryFunction } from '@neondatabase/serverless';
import { z } from 'zod';
import { annotateQueryWithTrace } from '../db/trace-context';
import type { DatabaseService } from '../types/worker-types';

// CRITICAL: Configure Neon for connection pooling in edge environments
// These settings enable HTTP-based queries and connection caching
// which dramatically reduces connection overhead for concurrent requests
neonConfig.poolQueryViaFetch = true;      // Use HTTP instead of WebSockets (more scalable)
neonConfig.fetchConnectionCache = true;   // Cache connections across requests in same isolate

// Database query parameter types
export type QueryParameters = (string | number | boolean | Date | null)[];

// Database row type - represents a single database record
export interface DatabaseRow {
  [key: string]: unknown;
}

// Query result with row count metadata
export interface QueryResult<T = DatabaseRow> {
  rows: T[];
  rowCount: number;
  fields?: Array<{ name: string; type: string }>;
}

// Configuration interface
export interface DatabaseConfig {
  connectionString: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

// Database error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly detail?: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, detail?: string) {
    super(message, 'CONNECTION_ERROR', detail, true);
    this.name = 'ConnectionError';
  }
}

export class QueryError extends DatabaseError {
  constructor(message: string, code?: string, detail?: string) {
    super(message, code, detail, false);
    this.name = 'QueryError';
  }
}

// CRITICAL: Module-level connection cache for connection reuse across requests
// The neon() function creates an HTTP-based SQL client that can be safely reused
// Caching by connection string allows multiple databases while preventing connection explosion
const sqlClientCache = new Map<string, NeonQueryFunction<false, false>>();

function getOrCreateSqlClient(connectionString: string): NeonQueryFunction<false, false> {
  // Create a cache key from the connection string (hash for privacy in logs)
  const cacheKey = connectionString.substring(0, 50);

  let client = sqlClientCache.get(cacheKey);
  if (!client) {
    console.log('[DB Pool] Creating new Neon SQL client (cache miss)');
    client = neon(connectionString);
    sqlClientCache.set(cacheKey, client);
  }

  return client;
}

export class WorkerDatabase implements DatabaseService {
  private _sql: NeonQueryFunction<false, false>;
  private readonly connectionString: string;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly timeout: number;

  constructor(config: DatabaseConfig) {
    this.validateConfig(config);
    this.connectionString = config.connectionString;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.timeout = config.timeout || 30000;

    // CRITICAL: Reuse cached SQL client instead of creating new one per instance
    // This prevents connection exhaustion under high concurrency
    this._sql =getOrCreateSqlClient(this.connectionString);
  }

  private validateConfig(config: DatabaseConfig): void {
    if (!config.connectionString) {
      throw new Error('Database connection string is required');
    }
    if (config.maxRetries !== undefined && (config.maxRetries < 0 || config.maxRetries > 10)) {
      throw new Error('maxRetries must be between 0 and 10');
    }
    if (config.retryDelay !== undefined && config.retryDelay < 0) {
      throw new Error('retryDelay must be non-negative');
    }
  }

  /**
   * Get the raw SQL client for direct queries
   */
  getSql(): NeonQueryFunction<false, false> {
    return this._sql;
  }

  /**
   * Execute a query with automatic retry logic and proper typing
   */
  async query<T extends DatabaseRow = DatabaseRow>(
    text: string,
    values?: QueryParameters
  ): Promise<T[]> {
    this.validateQuery(text, values);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.executeQuery<T>(text, values);
        return result;
      } catch (error) {
        console.error(`Database query attempt ${attempt + 1} failed:`, error);
        lastError = error as Error;

        // Check if it's a retryable error
        if (!this.isRetryableError(error)) {
          throw this.wrapError(error, text);
        }

        // Wait before retrying with exponential backoff
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new DatabaseError('Query failed after all retries', 'MAX_RETRIES_EXCEEDED');
  }

  private async executeQuery<T extends DatabaseRow>(
    text: string,
    values?: QueryParameters
  ): Promise<T[]> {
    try {
      // Append SQLCommenter trace context (no-op if no active trace)
      const annotatedText = annotateQueryWithTrace(text);
      let raw: any;

      if (values && values.length > 0) {
        raw = await (this._sql as any).query(annotatedText, values);
      } else {
        raw = await (this._sql as any).query(annotatedText);
      }

      // Neon's .query() returns { rows: [...], rowCount, ... } — unwrap to plain array
      const result: T[] = Array.isArray(raw) ? raw : (raw?.rows ?? []);
      return result;
    } catch (error) {
      throw this.wrapError(error, text);
    }
  }

  private validateQuery(text: string, values?: QueryParameters): void {
    if (!text || typeof text !== 'string') {
      throw new QueryError('Query text must be a non-empty string');
    }

    if (values && !Array.isArray(values)) {
      throw new QueryError('Query parameters must be an array');
    }

    // Basic SQL injection protection - check for common dangerous patterns
    const dangerousPatterns = [
      /--\s*$/m,  // SQL comments at end of line
      /;\s*drop\s+/i,  // DROP statements
      /;\s*delete\s+/i,  // DELETE statements
      /;\s*truncate\s+/i,  // TRUNCATE statements
      /union\s+select/i,  // UNION SELECT
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) {
        throw new QueryError('Query contains potentially dangerous SQL patterns');
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    // Network/connection errors - retryable
    const retryablePatterns = [
      /network/i,
      /connection/i,
      /timeout/i,
      /socket/i,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ENOTFOUND/,
    ];

    // SQL syntax/logic errors - not retryable
    const nonRetryablePatterns = [
      /syntax error/i,
      /does not exist/i,
      /invalid/i,
      /permission denied/i,
      /duplicate key/i,
      /constraint violation/i,
      /null value/i,
    ];

    // Check for non-retryable errors first
    for (const pattern of nonRetryablePatterns) {
      if (pattern.test(error.message)) {
        return false;
      }
    }

    // Check for retryable errors
    for (const pattern of retryablePatterns) {
      if (pattern.test(error.message)) {
        return true;
      }
    }

    // Default to not retrying unknown errors
    return false;
  }

  private wrapError(error: unknown, query: string): DatabaseError {
    if (error instanceof DatabaseError) {
      return error;
    }

    const err = error instanceof Error ? error : new Error('Unknown database error');

    if (this.isRetryableError(error)) {
      return new ConnectionError(err.message, query);
    } else {
      return new QueryError(err.message, 'QUERY_ERROR', query);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a query and return a single row
   */
  async queryOne<T extends DatabaseRow = DatabaseRow>(
    text: string,
    values?: QueryParameters
  ): Promise<T | null> {
    const results = await this.query<T>(text, values);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute a query that doesn't return results (INSERT, UPDATE, DELETE)
   */
  async execute(
    text: string,
    values?: QueryParameters
  ): Promise<{ rowCount: number }> {
    const results = await this.query(text, values);
    // For modification queries, Neon returns affected rows info
    return { rowCount: results.length };
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW() as time');
      return result.length > 0;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Execute a query with validation schema
   */
  async queryValidated<T extends DatabaseRow>(
    text: string,
    schema: z.ZodSchema<T>,
    values?: QueryParameters
  ): Promise<T[]> {
    const results = await this.query<T>(text, values);

    try {
      return results.map(row => schema.parse(row));
    } catch (error) {
      throw new QueryError(
        'Query result validation failed',
        'VALIDATION_ERROR',
        error instanceof Error ? error.message : 'Unknown validation error'
      );
    }
  }

  /**
   * Execute a query and return a single validated row
   */
  async queryOneValidated<T extends DatabaseRow>(
    text: string,
    schema: z.ZodSchema<T>,
    values?: QueryParameters
  ): Promise<T | null> {
    const results = await this.queryValidated(text, schema, values);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Start a transaction (for future implementation)
   */
  async transaction<T>(
    callback: (sql: NeonQueryFunction<false, false>) => Promise<T>
  ): Promise<T> {
    // Note: Neon serverless doesn't support traditional transactions
    // This is a placeholder for future implementation or alternative patterns
    throw new DatabaseError('Transactions not supported in serverless mode', 'NOT_SUPPORTED');
  }

  /**
   * Get user by email - implements DatabaseService interface
   */
  async getUserByEmail(email: string): Promise<any | null> {
    try {
      const result = await this.query(
        'SELECT * FROM users WHERE email = $1 LIMIT 1',
        [email]
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw this.wrapError(error, `getUserByEmail: ${email}`);
    }
  }

  /**
   * Get all users with optional limit - implements DatabaseService interface
   */
  async getAllUsers(limit: number = 100): Promise<any[]> {
    try {
      const result = await this.query(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      return result;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw this.wrapError(error, `getAllUsers: limit=${limit}`);
    }
  }

  /**
   * Create a typed query builder for common operations
   */
  createQueryBuilder<T extends DatabaseRow = DatabaseRow>(): QueryBuilder<T> {
    return new QueryBuilder<T>(this);
  }
}

/**
 * Typed Query Builder for common database operations
 */
export class QueryBuilder<T extends DatabaseRow = DatabaseRow> {
  constructor(private db: WorkerDatabase) { }

  /**
   * Build a SELECT query with type safety
   */
  select(
    table: string,
    columns: string[] = ['*'],
    where?: { [key: string]: unknown },
    orderBy?: string,
    limit?: number
  ): {
    execute: () => Promise<T[]>;
    executeOne: () => Promise<T | null>;
  } {
    let query = `SELECT ${columns.join(', ')} FROM ${table}`;
    const values: QueryParameters = [];

    if (where) {
      const conditions: string[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(where)) {
        conditions.push(`${key} = $${paramIndex}`);
        values.push(value as string | number | boolean | Date | null);
        paramIndex++;
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    return {
      execute: () => this.db.query<T>(query, values),
      executeOne: () => this.db.queryOne<T>(query, values)
    };
  }

  /**
   * Build an INSERT query with type safety
   */
  insert(
    table: string,
    data: Partial<T>,
    returning: string[] = ['*']
  ): { execute: () => Promise<T[]> } {
    const columns = Object.keys(data);
    const values = Object.values(data) as QueryParameters;
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${table} (${columns.join(', ')}) 
      VALUES (${placeholders}) 
      RETURNING ${returning.join(', ')}
    `;

    return {
      execute: () => this.db.query<T>(query, values)
    };
  }

  /**
   * Build an UPDATE query with type safety
   */
  update(
    table: string,
    data: Partial<T>,
    where: { [key: string]: unknown },
    returning: string[] = ['*']
  ): { execute: () => Promise<T[]> } {
    const setColumns = Object.keys(data);
    const setValues = Object.values(data) as QueryParameters;
    const whereValues: QueryParameters = [];

    let paramIndex = setValues.length + 1;
    const setClause = setColumns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const whereConditions: string[] = [];
    for (const [key, value] of Object.entries(where)) {
      whereConditions.push(`${key} = $${paramIndex}`);
      whereValues.push(value as string | number | boolean | Date | null);
      paramIndex++;
    }

    const query = `
      UPDATE ${table} 
      SET ${setClause}
      WHERE ${whereConditions.join(' AND ')}
      RETURNING ${returning.join(', ')}
    `;

    return {
      execute: () => this.db.query<T>(query, [...setValues, ...whereValues])
    };
  }

  /**
   * Build a DELETE query with type safety
   */
  delete(
    table: string,
    where: { [key: string]: unknown },
    returning: string[] = ['*']
  ): { execute: () => Promise<T[]> } {
    const whereValues: QueryParameters = [];
    const whereConditions: string[] = [];

    let paramIndex = 1;
    for (const [key, value] of Object.entries(where)) {
      whereConditions.push(`${key} = $${paramIndex}`);
      whereValues.push(value as string | number | boolean | Date | null);
      paramIndex++;
    }

    const query = `
      DELETE FROM ${table}
      WHERE ${whereConditions.join(' AND ')}
      RETURNING ${returning.join(', ')}
    `;

    return {
      execute: () => this.db.query<T>(query, whereValues)
    };
  }
}

// Export default factory function
export const createDatabase = (config: DatabaseConfig): WorkerDatabase => {
  return new WorkerDatabase(config);
};

// Export commonly used schemas for validation
export const DatabaseSchemas = {
  timestamp: z.string().datetime(),
  id: z.number().int().positive(),
  email: z.string().email(),
  url: z.string().url(),
  jsonObject: z.record(z.string(), z.unknown()),
};