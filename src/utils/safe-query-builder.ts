/**
 * SafeQueryBuilder - Secure SQL Query Construction
 * 
 * Prevents SQL injection by:
 * 1. Using parameterized queries exclusively
 * 2. Whitelisting allowed sort columns
 * 3. Validating all dynamic inputs
 * 4. Never concatenating user input directly
 */

export interface QueryCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';
  value?: any;
  parameterized?: boolean;
}

export interface QueryOptions {
  select?: string[];
  from: string;
  joins?: string[];
  where?: QueryCondition[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
  offset?: number;
  groupBy?: string[];
  having?: QueryCondition[];
}

export class SafeQueryBuilder {
  private params: any[] = [];
  private paramCounter = 0;
  
  // Whitelist of allowed columns for sorting/filtering
  private static readonly ALLOWED_SORT_COLUMNS = new Set([
    'id', 'created_at', 'updated_at', 'published_at',
    'view_count', 'like_count', 'investment_count',
    'title', 'status', 'genre', 'format', 'budget_range',
    'username', 'email', 'role', 'last_login',
    'amount', 'transaction_date', 'priority'
  ]);
  
  // Whitelist of allowed tables
  private static readonly ALLOWED_TABLES = new Set([
    'users', 'pitches', 'investments', 'ndas', 'messages',
    'follows', 'sessions', 'transactions', 'notifications',
    'pitch_views', 'pitch_likes', 'comments', 'files'
  ]);

  constructor() {
    this.params = [];
    this.paramCounter = 0;
  }

  /**
   * Build a SELECT query safely
   */
  buildSelect(options: QueryOptions): { query: string; params: any[] } {
    this.validateTable(options.from);
    
    // Build SELECT clause
    const selectClause = options.select?.length 
      ? `SELECT ${options.select.map(col => this.sanitizeIdentifier(col)).join(', ')}`
      : 'SELECT *';
    
    // Build FROM clause
    const fromClause = `FROM ${this.sanitizeIdentifier(options.from)}`;
    
    // Build JOIN clauses
    const joinClauses = options.joins?.join(' ') || '';
    
    // Build WHERE clause
    const whereClause = this.buildWhereClause(options.where);
    
    // Build GROUP BY clause
    const groupByClause = options.groupBy?.length
      ? `GROUP BY ${options.groupBy.map(col => this.sanitizeIdentifier(col)).join(', ')}`
      : '';
    
    // Build HAVING clause
    const havingClause = options.having?.length
      ? `HAVING ${this.buildConditions(options.having)}`
      : '';
    
    // Build ORDER BY clause
    const orderByClause = this.buildOrderByClause(options.orderBy);
    
    // Build LIMIT/OFFSET
    const limitClause = this.buildLimitClause(options.limit, options.offset);
    
    // Combine all parts
    const query = [
      selectClause,
      fromClause,
      joinClauses,
      whereClause,
      groupByClause,
      havingClause,
      orderByClause,
      limitClause
    ].filter(Boolean).join(' ');
    
    return { query, params: this.params };
  }

  /**
   * Build WHERE clause with parameterized queries
   */
  private buildWhereClause(conditions?: QueryCondition[]): string {
    if (!conditions || conditions.length === 0) return '';
    
    const conditionStrings = this.buildConditions(conditions);
    return conditionStrings ? `WHERE ${conditionStrings}` : '';
  }

  /**
   * Build conditions safely
   */
  private buildConditions(conditions: QueryCondition[]): string {
    return conditions.map(condition => {
      const field = this.sanitizeIdentifier(condition.field);
      
      // Handle NULL checks
      if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
        return `${field} ${condition.operator}`;
      }
      
      // Handle IN/NOT IN
      if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
        if (!Array.isArray(condition.value)) {
          throw new Error(`${condition.operator} requires array value`);
        }
        const placeholders = condition.value.map(() => {
          this.paramCounter++;
          this.params.push(condition.value[this.params.length]);
          return `$${this.paramCounter}`;
        }).join(', ');
        return `${field} ${condition.operator} (${placeholders})`;
      }
      
      // Handle LIKE/ILIKE
      if (condition.operator === 'LIKE' || condition.operator === 'ILIKE') {
        this.paramCounter++;
        this.params.push(condition.value);
        return `${field} ${condition.operator} $${this.paramCounter}`;
      }
      
      // Standard operators
      this.paramCounter++;
      this.params.push(condition.value);
      return `${field} ${condition.operator} $${this.paramCounter}`;
    }).join(' AND ');
  }

  /**
   * Build ORDER BY clause safely
   */
  private buildOrderByClause(orderBy?: { field: string; direction: 'ASC' | 'DESC' }[]): string {
    if (!orderBy || orderBy.length === 0) return '';
    
    const orderClauses = orderBy.map(order => {
      // Validate sort column against whitelist
      if (!SafeQueryBuilder.ALLOWED_SORT_COLUMNS.has(order.field)) {
        throw new Error(`Invalid sort column: ${order.field}`);
      }
      
      // Validate direction
      if (order.direction !== 'ASC' && order.direction !== 'DESC') {
        throw new Error(`Invalid sort direction: ${order.direction}`);
      }
      
      return `${this.sanitizeIdentifier(order.field)} ${order.direction}`;
    });
    
    return `ORDER BY ${orderClauses.join(', ')}`;
  }

  /**
   * Build LIMIT/OFFSET clause
   */
  private buildLimitClause(limit?: number, offset?: number): string {
    const parts = [];
    
    if (limit !== undefined) {
      if (!Number.isInteger(limit) || limit < 0) {
        throw new Error('Invalid limit value');
      }
      this.paramCounter++;
      this.params.push(limit);
      parts.push(`LIMIT $${this.paramCounter}`);
    }
    
    if (offset !== undefined) {
      if (!Number.isInteger(offset) || offset < 0) {
        throw new Error('Invalid offset value');
      }
      this.paramCounter++;
      this.params.push(offset);
      parts.push(`OFFSET $${this.paramCounter}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Sanitize identifiers (table/column names)
   */
  private static readonly DANGEROUS_KEYWORDS = new Set([
    'drop', 'delete', 'insert', 'update', 'alter', 'exec', 'script',
    'truncate', 'union', 'select', 'grant', 'revoke',
  ]);

  private sanitizeIdentifier(identifier: string): string {
    // Remove any quotes and special characters
    const cleaned = identifier.replace(/[^a-zA-Z0-9_.]/g, '');

    // Check for SQL keyword injection on a per-token basis. Splitting on the
    // legal identifier separators (`_` and `.`) means a whole-word keyword
    // (`drop`, `user_drop`, `id; DROP` → cleaned `idDROP`... see below) is
    // rejected, while legitimate snake_case columns whose tokens merely
    // *contain* a keyword as a substring (`updated_at` → ["updated", "at"])
    // are allowed. Pure-concatenation forms with no separator (e.g.
    // "dropusers") are already blocked upstream by the ALLOWED_SORT_COLUMNS /
    // ALLOWED_TABLES whitelists, so they never reach a real query.
    const tokens = cleaned.toLowerCase().split(/[_.]/).filter(Boolean);
    for (const token of tokens) {
      if (SafeQueryBuilder.DANGEROUS_KEYWORDS.has(token)) {
        throw new Error(`Suspicious identifier detected: ${identifier}`);
      }
    }

    // Quote the identifier for PostgreSQL
    return `"${cleaned}"`;
  }

  /**
   * Validate table name against whitelist
   */
  private validateTable(table: string): void {
    const cleanTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    if (!SafeQueryBuilder.ALLOWED_TABLES.has(cleanTable)) {
      throw new Error(`Invalid table name: ${table}`);
    }
  }

  /**
   * Create a safe search query for pitches
   */
  static buildPitchSearchQuery(
    filters: {
      search?: string;
      genre?: string;
      format?: string;
      status?: string;
      minBudget?: number;
      maxBudget?: number;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    }
  ): { query: string; params: any[] } {
    const builder = new SafeQueryBuilder();
    
    const conditions: QueryCondition[] = [];
    
    // Always filter by published status unless specified
    if (!filters.status) {
      conditions.push({ field: 'status', operator: '=', value: 'published' });
    } else {
      conditions.push({ field: 'status', operator: '=', value: filters.status });
    }
    
    // Add search condition
    if (filters.search) {
      conditions.push({
        field: 'title',
        operator: 'ILIKE',
        value: `%${filters.search}%`
      });
    }
    
    // Add genre filter
    if (filters.genre && filters.genre !== 'all') {
      conditions.push({ field: 'genre', operator: '=', value: filters.genre });
    }
    
    // Add format filter
    if (filters.format && filters.format !== 'all') {
      conditions.push({ field: 'format', operator: '=', value: filters.format });
    }
    
    // Add budget filters
    if (filters.minBudget) {
      conditions.push({ field: 'budget_range', operator: '>=', value: filters.minBudget });
    }
    if (filters.maxBudget) {
      conditions.push({ field: 'budget_range', operator: '<=', value: filters.maxBudget });
    }
    
    // Determine sort column
    let sortColumn = 'created_at'; // default
    if (filters.sortBy) {
      const sortMap: Record<string, string> = {
        'date': 'created_at',
        'views': 'view_count',
        'likes': 'like_count',
        'investments': 'investment_count',
        'title': 'title'
      };
      sortColumn = sortMap[filters.sortBy] || 'created_at';
    }
    
    return builder.buildSelect({
      from: 'pitches',
      where: conditions,
      orderBy: [{
        field: sortColumn,
        direction: filters.sortOrder || 'DESC'
      }],
      limit: filters.limit || 20,
      offset: filters.offset || 0
    });
  }
}

/**
 * Helper function to escape LIKE patterns
 */
export function escapeLikePattern(pattern: string): string {
  return pattern
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Validate and sanitize user input
 */
export function validateInput(input: any, type: 'string' | 'number' | 'boolean' | 'email'): any {
  switch (type) {
    case 'string':
      if (typeof input !== 'string') {
        throw new Error('Invalid string input');
      }
      // Remove any SQL keywords
      const sqlKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'EXEC', 'SCRIPT', 'UNION', 'SELECT'];
      const upperInput = input.toUpperCase();
      for (const keyword of sqlKeywords) {
        if (upperInput.includes(keyword)) {
          throw new Error(`Invalid input contains SQL keyword: ${keyword}`);
        }
      }
      return input.trim();
      
    case 'number':
      const num = Number(input);
      if (isNaN(num)) {
        throw new Error('Invalid number input');
      }
      return num;
      
    case 'boolean':
      return Boolean(input);
      
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input)) {
        throw new Error('Invalid email format');
      }
      return input.toLowerCase().trim();
      
    default:
      throw new Error(`Unknown validation type: ${type}`);
  }
}