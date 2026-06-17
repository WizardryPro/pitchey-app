// Phase 3: Search and Filters Handler
// Advanced search functionality with saved searches

export class SearchFiltersHandler {
  constructor(private db: any) {}

  // Basic search
  async search(userId: number, query: string, filters: any = {}) {
    try {
      const {
        type = 'all', // all, pitches, users, companies
        genre = null,
        minBudget = null,
        maxBudget = null,
        status = null,
        sortBy = 'relevance',
        limit = 20,
        offset = 0
      } = filters;

      const results: { pitches: any[]; users: any[]; companies: any[] } = { pitches: [], users: [], companies: [] };
      const hasQuery = query && query.trim().length > 0;

      // Search pitches
      if (type === 'all' || type === 'pitches') {
        const params: any[] = [];
        let paramIdx = 1;
        const conditions = [`p.status = 'published'`];

        if (hasQuery) {
          const tsq = query.trim().replace(/\s+/g, ' & ');
          params.push(tsq, `%${query}%`);
          conditions.push(`(
            to_tsvector('english', p.title || ' ' || COALESCE(p.logline, ''))
            @@ to_tsquery('english', $${paramIdx})
            OR p.title ILIKE $${paramIdx + 1}
            OR p.logline ILIKE $${paramIdx + 1}
          )`);
          paramIdx += 2;
        }

        if (genre) {
          params.push(genre);
          conditions.push(`p.genre = $${paramIdx++}`);
        }
        if (minBudget) {
          params.push(minBudget);
          conditions.push(`p.budget >= $${paramIdx++}`);
        }
        if (maxBudget) {
          params.push(maxBudget);
          conditions.push(`p.budget <= $${paramIdx++}`);
        }
        if (status) {
          params.push(status);
          conditions.push(`p.status = $${paramIdx++}`);
        }

        params.push(limit, offset);
        const orderClause = hasQuery && sortBy === 'relevance' ? 'p.created_at DESC' : this.getSortClause(sortBy);

        const pitchQuery = `
          SELECT p.*, u.name as creator_name, u.avatar_url,
            COUNT(DISTINCT s.id) as save_count,
            COUNT(DISTINCT v.id) as view_count
          FROM pitches p
          LEFT JOIN users u ON u.id = p.user_id
          LEFT JOIN saved_pitches s ON s.pitch_id = p.id
          LEFT JOIN pitch_views v ON v.pitch_id = p.id
          WHERE ${conditions.join(' AND ')}
          GROUP BY p.id, u.name, u.avatar_url
          ORDER BY ${orderClause}
          LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;

        results.pitches = await this.db.query(pitchQuery, params);
      }

      // Search users
      if (type === 'all' || type === 'users') {
        if (hasQuery) {
          const userQuery = `
            SELECT u.id, u.name, u.email, u.role, u.avatar_url,
              COUNT(DISTINCT p.id) as pitch_count,
              COUNT(DISTINCT f.id) as follower_count
            FROM users u
            LEFT JOIN pitches p ON p.user_id = u.id
            LEFT JOIN follows f ON f.following_id = u.id
            WHERE u.name ILIKE $1 OR u.email ILIKE $1
            GROUP BY u.id
            ORDER BY follower_count DESC, u.created_at DESC
            LIMIT $2 OFFSET $3`;

          results.users = await this.db.query(userQuery, [`%${query}%`, limit, offset]);
        }
      }

      // Search companies
      if (type === 'all' || type === 'companies') {
        if (hasQuery) {
          const companyQuery = `
            SELECT c.*, COUNT(DISTINCT u.id) as member_count
            FROM companies c
            LEFT JOIN users u ON u.company_id = c.id
            WHERE c.name ILIKE $1 OR c.description ILIKE $1
            GROUP BY c.id
            ORDER BY member_count DESC, c.created_at DESC
            LIMIT $2 OFFSET $3`;

          results.companies = await this.db.query(companyQuery, [`%${query}%`, limit, offset]);
        }
      }

      // Track search
      await this.db.query(
        `INSERT INTO search_history (user_id, query, filters, result_count)
         VALUES ($1, $2, $3, $4)`,
        [userId, query, JSON.stringify(filters), 
         results.pitches.length + results.users.length + results.companies.length]
      );

      return { success: true, data: results };
    } catch (error) {
      console.error('Search error:', error);
      return { success: true, data: { pitches: [], users: [], companies: [] } };
    }
  }

  // Advanced search with more options
  async advancedSearch(userId: number, criteria: any) {
    try {
      const {
        keywords = '',
        title = '',
        creator = '',
        genre = [],
        tags = [],
        budgetMin = null,
        budgetMax = null,
        dateFrom = null,
        dateTo = null,
        hasNDA = null,
        hasInvestment = null,
        minViews = null,
        minRating = null,
        sortBy = 'relevance',
        limit = 20,
        offset = 0
      } = criteria;

      let query = `
        SELECT DISTINCT p.*, 
          u.name as creator_name,
          u.avatar_url,
          AVG(pf.rating) as avg_rating,
          COUNT(DISTINCT pv.id) as view_count,
          COUNT(DISTINCT i.id) as investment_count,
          COUNT(DISTINCT nr.id) as nda_count
        FROM pitches p
        LEFT JOIN users u ON u.id = p.user_id
        LEFT JOIN pitch_feedback pf ON pf.pitch_id = p.id
        LEFT JOIN pitch_views pv ON pv.pitch_id = p.id
        LEFT JOIN investments i ON i.pitch_id = p.id
        LEFT JOIN nda_requests nr ON nr.pitch_id = p.id
        WHERE p.status = 'published'`;

      const conditions = [];
      const params = [];
      let paramCount = 0;

      // Build dynamic conditions
      if (keywords) {
        paramCount++;
        conditions.push(`(p.title ILIKE $${paramCount} OR p.logline ILIKE $${paramCount})`);
        params.push(`%${keywords}%`);
      }

      if (title) {
        paramCount++;
        conditions.push(`p.title ILIKE $${paramCount}`);
        params.push(`%${title}%`);
      }

      if (creator) {
        paramCount++;
        conditions.push(`u.name ILIKE $${paramCount}`);
        params.push(`%${creator}%`);
      }

      if (genre.length > 0) {
        paramCount++;
        conditions.push(`p.genre = ANY($${paramCount})`);
        params.push(genre);
      }

      if (budgetMin) {
        paramCount++;
        conditions.push(`p.budget >= $${paramCount}`);
        params.push(budgetMin);
      }

      if (budgetMax) {
        paramCount++;
        conditions.push(`p.budget <= $${paramCount}`);
        params.push(budgetMax);
      }

      if (dateFrom) {
        paramCount++;
        conditions.push(`p.created_at >= $${paramCount}`);
        params.push(dateFrom);
      }

      if (dateTo) {
        paramCount++;
        conditions.push(`p.created_at <= $${paramCount}`);
        params.push(dateTo);
      }

      // Add conditions to query
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      // Add GROUP BY
      query += ` GROUP BY p.id, u.name, u.avatar_url`;

      // Add HAVING clause for aggregates
      const havingConditions = [];
      
      if (minViews) {
        havingConditions.push(`COUNT(DISTINCT pv.id) >= ${minViews}`);
      }

      if (minRating) {
        havingConditions.push(`AVG(pf.rating) >= ${minRating}`);
      }

      if (hasNDA === true) {
        havingConditions.push(`COUNT(DISTINCT nr.id) > 0`);
      }

      if (hasInvestment === true) {
        havingConditions.push(`COUNT(DISTINCT i.id) > 0`);
      }

      if (havingConditions.length > 0) {
        query += ' HAVING ' + havingConditions.join(' AND ');
      }

      // Add sorting
      query += ` ORDER BY ${this.getSortClause(sortBy)}`;

      // Add pagination
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(limit);
      
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);

      const results = await this.db.query(query, params);

      return { success: true, data: { results, totalCount: results.length } };
    } catch (error) {
      console.error('Advanced search error:', error);
      return { success: true, data: { results: [], totalCount: 0 } };
    }
  }

  // Get available filters
  async getFilters(userId: number) {
    try {
      // Get genres
      const genres = await this.db.query(
        `SELECT DISTINCT genre, COUNT(*) as count
         FROM pitches 
         WHERE status = 'published' AND genre IS NOT NULL
         GROUP BY genre
         ORDER BY count DESC`
      );

      // Get budget ranges
      const budgetRanges = await this.db.query(
        `SELECT 
          MIN(budget) as min_budget,
          MAX(budget) as max_budget,
          AVG(budget) as avg_budget,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY budget) as q1,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY budget) as median,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY budget) as q3
         FROM pitches 
         WHERE status = 'published' AND budget IS NOT NULL`
      );

      // Get popular tags
      const tags = await this.db.query(
        `SELECT tag, COUNT(*) as count
         FROM (
           SELECT unnest(tags) as tag
           FROM pitches
           WHERE status = 'published' AND tags IS NOT NULL
         ) t
         GROUP BY tag
         ORDER BY count DESC
         LIMIT 50`
      );

      return { 
        success: true, 
        data: { 
          genres,
          budgetRanges: budgetRanges[0] || {},
          tags,
          sortOptions: [
            { value: 'relevance', label: 'Most Relevant' },
            { value: 'recent', label: 'Most Recent' },
            { value: 'popular', label: 'Most Popular' },
            { value: 'rating', label: 'Highest Rated' },
            { value: 'budget_high', label: 'Highest Budget' },
            { value: 'budget_low', label: 'Lowest Budget' }
          ]
        } 
      };
    } catch (error) {
      console.error('Get filters error:', error);
      return { 
        success: true, 
        data: { 
          genres: [], 
          budgetRanges: {}, 
          tags: [], 
          sortOptions: [] 
        } 
      };
    }
  }

  // Save search
  // ── Saved searches ─────────────────────────────────────────────────────────
  // The LIVE table (migration 012) stores: search_query JSONB ({"query":"..."}),
  // search_filters JSONB, notification_enabled BOOLEAN. Migration 107 adds
  // description, is_public, alert_frequency, execution_count, last_executed_at.
  // This maps a row to the shape SavedSearches.tsx reads (search_query as a STRING,
  // use_count, notify_on_results).
  private toSavedSearch(row: any) {
    // search_query is jsonb {"query": "..."} — extract the string; tolerate legacy
    // bare-string/stringified values.
    let sq: any = row?.search_query;
    if (typeof sq === 'string') { try { sq = JSON.parse(sq); } catch { sq = { query: sq }; } }
    const queryStr = (sq && typeof sq === 'object') ? (sq.query ?? '') : (sq ?? '');
    let filters: any = row?.search_filters ?? {};
    if (typeof filters === 'string') { try { filters = JSON.parse(filters); } catch { filters = {}; } }
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      search_query: queryStr,
      filters: filters ?? {},
      is_public: row.is_public ?? false,
      notify_on_results: row.notification_enabled ?? false,
      alert_frequency: row.alert_frequency ?? 'never',
      use_count: row.execution_count ?? 0,
      created_at: row.created_at,
    };
  }

  async saveSearch(userId: number, data: any) {
    try {
      const name = (data?.name ?? '').toString().trim();
      if (!name) return { success: false, error: 'Name is required' };
      const queryStr = (data?.search_query ?? data?.query ?? '').toString();
      const filters = data?.filters ?? {};
      const description = (data?.description ?? '').toString();
      const isPublic = data?.is_public === true;
      const notify = data?.notify_on_results === true;
      const alertFrequency = (data?.alert_frequency ?? 'never').toString();

      const rows = await this.db.query(
        `INSERT INTO saved_searches
           (user_id, name, description, search_query, search_filters, is_public, notification_enabled, alert_frequency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        // search_query is jsonb {"query": "..."} to match the existing data model.
        [userId, name, description, JSON.stringify({ query: queryStr }), JSON.stringify(filters), isPublic, notify, alertFrequency]
      );
      return { success: true, data: this.toSavedSearch(rows[0]) };
    } catch (error) {
      console.error('Save search error:', error);
      return { success: false, error: 'Failed to save search' };
    }
  }

  async getSavedSearches(userId: number) {
    try {
      const rows = await this.db.query(
        `SELECT * FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      return { success: true, data: rows.map((r: any) => this.toSavedSearch(r)) };
    } catch (error) {
      console.error('Get saved searches error:', error);
      return { success: true, data: [] };
    }
  }

  // Anonymized community trending: the most-executed PUBLIC saved searches,
  // one card per distinct query text, with no saver identity exposed.
  async getPopularSearches(limit = 10) {
    try {
      const lim = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 50);
      const rows = await this.db.query(
        `SELECT DISTINCT ON (search_query->>'query') *
           FROM saved_searches
          WHERE is_public = TRUE
            AND search_query->>'query' IS NOT NULL
            AND search_query->>'query' <> ''
          ORDER BY search_query->>'query', execution_count DESC, created_at DESC`,
        []
      );
      const ranked = rows
        .map((r: any) => this.toSavedSearch(r))
        .sort((a: any, b: any) => b.use_count - a.use_count)
        .slice(0, lim);
      return { success: true, data: ranked };
    } catch (error) {
      console.error('Get popular searches error:', error);
      return { success: true, data: [] };
    }
  }

  async executeSavedSearch(userId: number, searchId: number) {
    try {
      const rows = await this.db.query(
        `UPDATE saved_searches
            SET execution_count = execution_count + 1, last_executed_at = NOW()
          WHERE id = $1 AND user_id = $2
          RETURNING *`,
        [searchId, userId]
      );
      if (!rows || rows.length === 0) return { success: false, error: 'Saved search not found' };
      return { success: true, data: this.toSavedSearch(rows[0]) };
    } catch (error) {
      console.error('Execute saved search error:', error);
      return { success: false, error: 'Failed to execute search' };
    }
  }

  async deleteSavedSearch(userId: number, searchId: number) {
    try {
      await this.db.query(
        `DELETE FROM saved_searches WHERE id = $1 AND user_id = $2`,
        [searchId, userId]
      );
      return { success: true, data: { message: 'Search deleted successfully' } };
    } catch (error) {
      console.error('Delete saved search error:', error);
      return { success: false, error: 'Failed to delete search' };
    }
  }

  // Helper: Get sort clause
  private getSortClause(sortBy: string): string {
    switch (sortBy) {
      case 'recent':
        return 'p.created_at DESC';
      case 'popular':
        return 'view_count DESC';
      case 'rating':
        return 'avg_rating DESC NULLS LAST';
      case 'budget_high':
        return 'p.budget DESC NULLS LAST';
      case 'budget_low':
        return 'p.budget ASC NULLS LAST';
      case 'relevance':
      default:
        return 'relevance DESC';
    }
  }
}