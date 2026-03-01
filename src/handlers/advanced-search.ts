/**
 * Advanced Search API Handlers
 * Handles all advanced search functionality including AI-powered search, suggestions, and analytics
 */

import { ApiResponseBuilder, ErrorCode, errorHandler } from '../utils/api-response';
import { WorkerDatabase } from '../services/worker-database';
import { advancedSearchService } from '../services/advanced-search.service';
import { searchCacheService } from '../services/search-cache.service';
import { intelligentSuggestionService } from '../services/intelligent-suggestion.service';
import { searchAnalyticsService } from '../services/search-analytics.service';
import { marketIntelligenceSearchService } from '../services/market-intelligence-search.service';
import { searchExportService } from '../services/search-export.service';
import { savedSearchService } from '../services/saved-search.service';

export interface SearchParams {
  query?: string;
  filters?: any;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  includeAI?: boolean;
  includeMarketIntelligence?: boolean;
}

/**
 * Main intelligent search endpoint
 * GET/POST /api/search/advanced
 */
export async function advancedSearchHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    // Extract search parameters
    let params: SearchParams;
    
    if (request.method === 'POST') {
      params = await request.json() as Record<string, unknown>;
    } else {
      const url = new URL(request.url);
      params = {
        query: url.searchParams.get('query') || '',
        filters: url.searchParams.get('filters') ? JSON.parse(url.searchParams.get('filters')!) : {},
        sort: url.searchParams.get('sort') || 'relevance',
        order: (url.searchParams.get('order') as 'asc' | 'desc') || 'desc',
        page: parseInt(url.searchParams.get('page') || '1'),
        limit: parseInt(url.searchParams.get('limit') || '20'),
        includeAI: url.searchParams.get('includeAI') === 'true',
        includeMarketIntelligence: url.searchParams.get('includeMarketIntelligence') === 'true'
      };
    }

    // Validate required parameters
    if (!params.query && (!params.filters || Object.keys(params.filters).length === 0)) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Query or filters required');
    }

    // Perform advanced search
    const results = await advancedSearchService.performAdvancedSearch(
      params.query || '',
      params.filters || {},
      {
        sort: params.sort || 'relevance',
        order: params.order || 'desc',
        page: params.page || 1,
        limit: Math.min(params.limit || 20, 100) // Cap at 100 results
      }
    );

    // Enhance with AI insights if requested
    if (params.includeAI) {
      results.ai_insights = await advancedSearchService.generateAIInsights(results.results);
    }

    // Enhance with market intelligence if requested
    if (params.includeMarketIntelligence) {
      results.results = await marketIntelligenceSearchService.enhanceSearchResults(
        results.results,
        params.query || ''
      );
      results.market_context = await marketIntelligenceSearchService.getSearchMarketContext();
    }

    // Track search analytics
    const userAgent = request.headers.get('User-Agent') || '';
    await searchAnalyticsService.trackSearch(
      params.query || '',
      results.total_results,
      results.execution_time_ms,
      userAgent
    );

    return builder.success(results);
  } catch (error) {
    console.error('Advanced search error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Search suggestions endpoint
 * GET /api/search/suggestions
 */
export async function searchSuggestionsHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const includeContextual = url.searchParams.get('includeContextual') === 'true';

    if (!query) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Query parameter required');
    }

    const suggestions = await intelligentSuggestionService.generateSuggestions(
      query,
      {
        includeNaturalLanguage: includeContextual,
        includeSemanticSimilarity: true,
        includeTrendingTerms: true,
        limit
      }
    );

    return builder.success({ suggestions });
  } catch (error) {
    console.error('Search suggestions error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Search analytics endpoint
 * GET /api/search/analytics
 */
export async function searchAnalyticsHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '7d';
    const includePerformance = url.searchParams.get('includePerformance') === 'true';

    const analytics = await searchAnalyticsService.getSearchAnalytics({
      timeRange: timeRange as '1d' | '7d' | '30d',
      includePerformanceMetrics: includePerformance,
      includeTrendData: true,
      includeUserBehavior: true
    });

    return builder.success(analytics);
  } catch (error) {
    console.error('Search analytics error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Export search results endpoint
 * POST /api/search/export
 */
export async function searchExportHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const data = await request.json() as Record<string, unknown>;
    const { 
      searchResults, 
      query, 
      filters, 
      format = 'csv',
      options = {}
    } = data;

    if (!searchResults || !Array.isArray(searchResults)) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'searchResults array required');
    }

    const user = (request as any).user;
    if (!user?.id) {
      return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
    }
    const userId = user.id;

    const exportResult = await searchExportService.exportSearchResults(
      userId,
      searchResults,
      query || '',
      filters || {},
      {
        format,
        ...options
      }
    );

    return builder.success(exportResult);
  } catch (error) {
    console.error('Search export error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Saved searches endpoints
 */

/**
 * Create saved search
 * POST /api/search/saved
 */
export async function createSavedSearchHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const data = await request.json() as Record<string, unknown>;
    const { name, description, search_query, filters, is_public, notify_on_results, alert_frequency } = data;

    if (!name || !search_query) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Name and search_query are required');
    }

    const user = (request as any).user;
    if (!user?.id) {
      return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
    }
    const userId = user.id;

    const savedSearch = await savedSearchService.createSavedSearch(userId, {
      name,
      description,
      search_query,
      filters,
      is_public: is_public || false,
      notify_on_results: notify_on_results || false,
      alert_frequency: alert_frequency || 'never'
    });

    return builder.success(savedSearch);
  } catch (error) {
    console.error('Create saved search error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Get saved searches
 * GET /api/search/saved
 */
export async function getSavedSearchesHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const url = new URL(request.url);
    const includePublic = url.searchParams.get('includePublic') === 'true';

    const user = (request as any).user;
    if (!user?.id) {
      return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
    }
    const userId = user.id;

    const savedSearches = await savedSearchService.getUserSavedSearches(userId, includePublic);

    return builder.success({ savedSearches });
  } catch (error) {
    console.error('Get saved searches error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Execute saved search
 * POST /api/search/saved/:id/execute
 */
export async function executeSavedSearchHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const params = (request as any).params;
    const searchId = parseInt(params.id);

    if (isNaN(searchId)) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Invalid search ID');
    }

    const user = (request as any).user;
    if (!user?.id) {
      return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
    }
    const userId = user.id;

    const result = await savedSearchService.executeSavedSearch(searchId, userId);

    return builder.success(result);
  } catch (error) {
    console.error('Execute saved search error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Update saved search
 * PUT /api/search/saved/:id
 */
export async function updateSavedSearchHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const params = (request as any).params;
    const searchId = parseInt(params.id);
    const updateData = await request.json() as Record<string, unknown>;

    if (isNaN(searchId)) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Invalid search ID');
    }

    const user = (request as any).user;
    if (!user?.id) {
      return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
    }
    const userId = user.id;

    const updatedSearch = await savedSearchService.updateSavedSearch(searchId, userId, updateData);

    if (!updatedSearch) {
      return builder.error(ErrorCode.NOT_FOUND, 'Saved search not found or access denied');
    }

    return builder.success(updatedSearch);
  } catch (error) {
    console.error('Update saved search error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Delete saved search
 * DELETE /api/search/saved/:id
 */
export async function deleteSavedSearchHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const params = (request as any).params;
    const searchId = parseInt(params.id);

    if (isNaN(searchId)) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Invalid search ID');
    }

    const user = (request as any).user;
    if (!user?.id) {
      return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
    }
    const userId = user.id;

    const success = await savedSearchService.deleteSavedSearch(searchId, userId);

    if (!success) {
      return builder.error(ErrorCode.NOT_FOUND, 'Saved search not found or access denied');
    }

    return builder.success({ deleted: true });
  } catch (error) {
    console.error('Delete saved search error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Get popular saved searches
 * GET /api/search/saved/popular
 */
export async function getPopularSavedSearchesHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    const popularSearches = await savedSearchService.getPopularSavedSearches(limit);

    return builder.success({ popularSearches });
  } catch (error) {
    console.error('Get popular saved searches error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Get market trends endpoint
 * GET /api/search/market-trends
 */
export async function getMarketTrendsHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    const trends = await marketIntelligenceSearchService.getMarketTrends(query, limit);

    return builder.success({ trends });
  } catch (error) {
    console.error('Get market trends error:', error);
    return errorHandler(error, request);
  }
}

/**
 * Get search performance metrics
 * GET /api/search/performance
 */
export async function getSearchPerformanceHandler(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);

  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '24h';

    const performance = await searchAnalyticsService.getPerformanceMetrics({
      timeRange: timeRange as '1h' | '24h' | '7d' | '30d',
      includeDetails: true
    });

    return builder.success(performance);
  } catch (error) {
    console.error('Get search performance error:', error);
    return errorHandler(error, request);
  }
}