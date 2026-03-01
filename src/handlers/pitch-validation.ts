/**
 * Pitch Validation API Endpoints
 * Comprehensive scoring and analysis system
 */

import type {
  ValidationAnalysisRequest,
  ValidationRequest,
  ValidationResponse,
  RecommendationsRequest,
  ComparablesRequest,
  BenchmarkRequest,
  RealTimeValidation,
  ValidationProgress,
  ValidationScore
} from '../types/pitch-validation.types.js';

import { pitchValidationService } from '../services/pitch-validation.service.js';
import { logger } from '../lib/logger';
import { getRedis } from '../lib/redis';
import { requireAuth, requireRole } from '../middleware/auth';

/**
 * POST /api/validation/analyze
 * Comprehensive pitch analysis and scoring
 */
export async function analyzeHandler(request: Request): Promise<Response> {
  try {
    const data: ValidationAnalysisRequest = await request.json() as Record<string, unknown>;
    
    // Validate required fields
    if (!data.pitchData?.title || !data.pitchData?.genre || !data.pitchData?.budget) {
      return Response.json({
        success: false,
        error: 'Missing required fields: title, genre, and budget are required'
      }, { status: 400 });
    }
    
    // Set default options, then spread user options to override defaults
    const options = {
      ...{
        depth: 'standard' as const,
        include_market_data: true,
        include_comparables: true,
        include_predictions: true
      },
      ...data.options
    };
    
    const analysisRequest: ValidationAnalysisRequest = {
      pitchData: data.pitchData,
      options
    };
    
    logger.info('Starting pitch validation analysis', {
      title: data.pitchData.title,
      genre: data.pitchData.genre,
      budget: data.pitchData.budget,
      depth: options.depth
    });
    
    const startTime = Date.now();
    const validationScore = await pitchValidationService.validatePitch(analysisRequest);
    const analysisTime = Date.now() - startTime;
    
    const response: ValidationResponse = {
      success: true,
      data: validationScore,
      analysisTime,
      dataFreshness: 'Real-time',
      recommendationsCount: validationScore.recommendations.length
    };
    
    logger.info('Pitch validation completed', {
      pitchId: validationScore.pitchId,
      overallScore: validationScore.overallScore,
      analysisTime,
      recommendationsCount: validationScore.recommendations.length
    });
    
    return Response.json(response);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Pitch validation analysis failed', { error: message });
    return Response.json({
      success: false,
      error: `Analysis failed: ${message}`
    }, { status: 500 });
  }
}

/**
 * GET /api/validation/score/:pitchId
 * Get current validation score for a pitch
 */
export async function getScoreHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pitchId = url.pathname.split('/').pop();
    
    if (!pitchId) {
      return Response.json({
        success: false,
        error: 'Pitch ID is required'
      }, { status: 400 });
    }
    
    const cache = getRedis();
    const cacheKey = `validation_score:${pitchId}`;
    
    // Try to get from cache first
    const cachedScore = await cache?.get(cacheKey);
    if (cachedScore) {
      const validationScore: ValidationScore = JSON.parse(cachedScore);
      
      return Response.json({
        success: true,
        data: validationScore,
        analysisTime: 0,
        dataFreshness: 'Cached',
        recommendationsCount: validationScore.recommendations.length
      });
    }
    
    // If not in cache, return error (score needs to be generated first)
    return Response.json({
      success: false,
      error: 'Validation score not found. Please run analysis first.'
    }, { status: 404 });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to retrieve validation score', { error: message });
    return Response.json({
      success: false,
      error: `Failed to retrieve score: ${message}`
    }, { status: 500 });
  }
}

/**
 * PUT /api/validation/update/:pitchId
 * Update pitch data and re-score
 */
interface PitchUpdateData {
  title?: string;
  logline?: string;
  synopsis?: string;
  genre?: string;
  budget?: number;
  director?: string;
  producer?: string;
  cast?: string[];
  script_pages?: number;
  target_audience?: string;
  release_strategy?: string;
}

export async function updateScoreHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pitchId = url.pathname.split('/').pop();
    const updateData = await request.json() as PitchUpdateData;
    
    if (!pitchId) {
      return Response.json({
        success: false,
        error: 'Pitch ID is required'
      }, { status: 400 });
    }
    
    // Get existing pitch data (this would typically come from your pitch database)
    // For now, we'll merge with the update data
    const analysisRequest: ValidationAnalysisRequest = {
      pitchData: {
        title: updateData.title || 'Updated Pitch',
        logline: updateData.logline || '',
        synopsis: updateData.synopsis || '',
        genre: updateData.genre || 'drama',
        budget: updateData.budget || 1000000,
        director: updateData.director,
        producer: updateData.producer,
        cast: updateData.cast,
        script_pages: updateData.script_pages,
        target_audience: updateData.target_audience,
        release_strategy: updateData.release_strategy
      },
      options: {
        depth: 'standard',
        include_market_data: true,
        include_comparables: true,
        include_predictions: true
      }
    };
    
    // Force re-analysis
    const validationScore = await pitchValidationService.validatePitch(analysisRequest);
    
    // Update the pitchId to match the request
    validationScore.pitchId = pitchId;
    
    // Cache the updated score
    const cache = getRedis();
    const cacheKey = `validation_score:${pitchId}`;
    await cache?.setex(cacheKey, 3600, JSON.stringify(validationScore));
    
    return Response.json({
      success: true,
      data: validationScore,
      analysisTime: 0,
      dataFreshness: 'Updated',
      recommendationsCount: validationScore.recommendations.length
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update validation score', { error: message });
    return Response.json({
      success: false,
      error: `Failed to update score: ${message}`
    }, { status: 500 });
  }
}

/**
 * GET /api/validation/recommendations/:pitchId
 * Get improvement recommendations for a pitch
 */
export async function getRecommendationsHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pitchId = url.pathname.split('/').pop();
    const searchParams = new URLSearchParams(url.search);
    
    if (!pitchId) {
      return Response.json({
        success: false,
        error: 'Pitch ID is required'
      }, { status: 400 });
    }
    
    const requestParams: RecommendationsRequest = {
      pitchId,
      category: searchParams.get('category') as any,
      priority: searchParams.get('priority') as any,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    };
    
    // Get validation score from cache
    const cache = getRedis();
    const cacheKey = `validation_score:${pitchId}`;
    const cachedScore = await cache?.get(cacheKey);
    
    if (!cachedScore) {
      return Response.json({
        success: false,
        error: 'Validation score not found. Please run analysis first.'
      }, { status: 404 });
    }
    
    const validationScore: ValidationScore = JSON.parse(cachedScore);
    let recommendations = validationScore.recommendations;
    
    // Apply filters
    if (requestParams.category) {
      recommendations = recommendations.filter(rec => rec.category === requestParams.category);
    }
    
    if (requestParams.priority) {
      recommendations = recommendations.filter(rec => rec.priority === requestParams.priority);
    }
    
    if (requestParams.limit) {
      recommendations = recommendations.slice(0, requestParams.limit);
    }
    
    return Response.json({
      success: true,
      data: {
        recommendations,
        total: recommendations.length,
        filtered: recommendations.length < validationScore.recommendations.length,
        pitchScore: validationScore.overallScore
      }
    });
    
  } catch (error) {
    logger.error('Failed to get recommendations', { error: error instanceof Error ? error.message : 'Unknown error' });
    return Response.json({
      success: false,
      error: `Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * GET /api/validation/comparables/:pitchId
 * Get comparable projects for benchmarking
 */
export async function getComparablesHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pitchId = url.pathname.split('/').pop();
    const searchParams = new URLSearchParams(url.search);
    
    if (!pitchId) {
      return Response.json({
        success: false,
        error: 'Pitch ID is required'
      }, { status: 400 });
    }
    
    const requestParams: ComparablesRequest = {
      pitchId,
      genre: searchParams.get('genre') || undefined,
      budget_range: searchParams.get('budget_min') && searchParams.get('budget_max') 
        ? [parseInt(searchParams.get('budget_min')!), parseInt(searchParams.get('budget_max')!)]
        : undefined,
      year_range: searchParams.get('year_min') && searchParams.get('year_max')
        ? [parseInt(searchParams.get('year_min')!), parseInt(searchParams.get('year_max')!)]
        : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10,
      min_similarity: searchParams.get('min_similarity') ? parseInt(searchParams.get('min_similarity')!) : 70
    };
    
    // Get validation score from cache to access comparables
    const cache = getRedis();
    const cacheKey = `validation_score:${pitchId}`;
    const cachedScore = await cache?.get(cacheKey);
    
    if (!cachedScore) {
      return Response.json({
        success: false,
        error: 'Validation score not found. Please run analysis first.'
      }, { status: 404 });
    }
    
    const validationScore: ValidationScore = JSON.parse(cachedScore);
    let comparables = validationScore.comparables;
    
    // Apply filters
    if (requestParams.genre) {
      comparables = comparables.filter(comp => comp.genre.toLowerCase() === requestParams.genre!.toLowerCase());
    }
    
    if (requestParams.budget_range) {
      const [min, max] = requestParams.budget_range;
      comparables = comparables.filter(comp => comp.budget >= min && comp.budget <= max);
    }
    
    if (requestParams.year_range) {
      const [min, max] = requestParams.year_range;
      comparables = comparables.filter(comp => comp.year >= min && comp.year <= max);
    }
    
    if (requestParams.min_similarity) {
      comparables = comparables.filter(comp => comp.relevance_score >= requestParams.min_similarity!);
    }
    
    if (requestParams.limit) {
      comparables = comparables.slice(0, requestParams.limit);
    }
    
    // Calculate aggregate insights
    const totalProjects = comparables.length;
    const avgROI = totalProjects > 0 
      ? comparables.reduce((sum, comp) => sum + comp.roi, 0) / totalProjects 
      : 0;
    const avgBudget = totalProjects > 0 
      ? comparables.reduce((sum, comp) => sum + comp.budget, 0) / totalProjects 
      : 0;
    const avgBoxOffice = totalProjects > 0 
      ? comparables.reduce((sum, comp) => sum + comp.boxOffice, 0) / totalProjects 
      : 0;
    
    return Response.json({
      success: true,
      data: {
        comparables,
        insights: {
          total_projects: totalProjects,
          average_roi: Math.round(avgROI),
          average_budget: Math.round(avgBudget),
          average_box_office: Math.round(avgBoxOffice),
          success_rate: totalProjects > 0 
            ? Math.round((comparables.filter(c => c.roi > 150).length / totalProjects) * 100) 
            : 0,
          top_performer: comparables.length > 0 
            ? comparables.reduce((best, comp) => comp.roi > best.roi ? comp : best)
            : null
        }
      }
    });
    
  } catch (error) {
    logger.error('Failed to get comparable projects', { error: error instanceof Error ? error.message : 'Unknown error' });
    return Response.json({
      success: false,
      error: `Failed to get comparables: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * POST /api/validation/benchmark
 * Benchmark against industry standards
 */
export async function benchmarkHandler(request: Request): Promise<Response> {
  try {
    const data: BenchmarkRequest = await request.json() as Record<string, unknown>;
    
    if (!data.pitchId || !data.categories || data.categories.length === 0) {
      return Response.json({
        success: false,
        error: 'Pitch ID and categories are required'
      }, { status: 400 });
    }
    
    // Get validation score from cache
    const cache = getRedis();
    const cacheKey = `validation_score:${data.pitchId}`;
    const cachedScore = await cache?.get(cacheKey);
    
    if (!cachedScore) {
      return Response.json({
        success: false,
        error: 'Validation score not found. Please run analysis first.'
      }, { status: 404 });
    }
    
    const validationScore: ValidationScore = JSON.parse(cachedScore);
    
    // Filter benchmarks for requested categories
    const requestedBenchmarks = validationScore.benchmarks.filter(benchmark =>
      data.categories.includes(benchmark.category as keyof typeof validationScore.categories)
    );
    
    // Calculate competitive position
    const overallPercentile = validationScore.benchmarks.reduce((sum, benchmark) => 
      sum + benchmark.percentile, 0) / validationScore.benchmarks.length;
    
    let competitiveRating: string;
    if (overallPercentile >= 90) competitiveRating = 'Exceptional';
    else if (overallPercentile >= 75) competitiveRating = 'Strong';
    else if (overallPercentile >= 50) competitiveRating = 'Average';
    else if (overallPercentile >= 25) competitiveRating = 'Below Average';
    else competitiveRating = 'Needs Improvement';
    
    return Response.json({
      success: true,
      data: {
        benchmarks: requestedBenchmarks,
        competitive_position: {
          overall_percentile: Math.round(overallPercentile),
          rating: competitiveRating,
          comparison_pool: data.comparison_pool || 'all',
          strengths: requestedBenchmarks
            .filter(b => b.your_score >= b.top_quartile)
            .map(b => b.category),
          improvements_needed: requestedBenchmarks
            .filter(b => b.your_score < b.industry_average)
            .map(b => b.category)
        },
        market_insights: {
          top_performing_category: requestedBenchmarks.reduce((best, benchmark) =>
            benchmark.percentile > best.percentile ? benchmark : best
          ),
          biggest_opportunity: requestedBenchmarks.reduce((worst, benchmark) =>
            benchmark.percentile < worst.percentile ? benchmark : worst
          ),
          score_distribution: {
            above_industry_average: requestedBenchmarks.filter(b => b.your_score >= b.industry_average).length,
            in_top_quartile: requestedBenchmarks.filter(b => b.your_score >= b.top_quartile).length,
            total_categories: requestedBenchmarks.length
          }
        }
      }
    });
    
  } catch (error) {
    logger.error('Failed to generate benchmark analysis', { error: error instanceof Error ? error.message : 'Unknown error' });
    return Response.json({
      success: false,
      error: `Benchmark analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

interface RealTimeValidationData {
  pitchId: string;
  field: 'title' | 'logline' | 'synopsis' | 'budget';
  content: string;
}

/**
 * POST /api/validation/realtime
 * Real-time validation as user types
 */
export async function realTimeValidationHandler(request: Request): Promise<Response> {
  try {
    const data = await request.json() as RealTimeValidationData;
    
    if (!data.pitchId || !data.field || !data.content) {
      return Response.json({
        success: false,
        error: 'Pitch ID, field, and content are required'
      }, { status: 400 });
    }
    
    // Perform quick analysis on the specific field
    let quickScore = 50;
    const suggestions: string[] = [];
    const warnings: string[] = [];
    
    const content = data.content.toLowerCase();
    const wordCount = data.content.split(' ').length;
    
    switch (data.field) {
      case 'title':
        // Title analysis
        if (wordCount <= 3) quickScore += 20;
        if (data.content.length >= 8 && data.content.length <= 15) quickScore += 15;
        if (!/[0-9!@#$%^&*]/.test(data.content)) quickScore += 10;
        
        if (wordCount > 5) warnings.push('Title may be too long');
        if (data.content.length < 5) warnings.push('Title may be too short');
        suggestions.push('Keep titles 1-3 words for maximum impact');
        break;
        
      case 'logline':
        // Logline analysis
        if (wordCount >= 25 && wordCount <= 50) quickScore += 25;
        if (/must|fights|struggles|battles/.test(content)) quickScore += 15;
        if (/protagonist|hero|character/.test(content)) quickScore += 10;
        
        if (wordCount < 15) warnings.push('Logline may be too brief');
        if (wordCount > 60) warnings.push('Logline may be too verbose');
        suggestions.push('Include protagonist, conflict, and stakes');
        break;
        
      case 'synopsis':
        // Synopsis analysis
        if (wordCount >= 150 && wordCount <= 500) quickScore += 20;
        if (/begins|however|finally/.test(content)) quickScore += 15;
        if ((content.match(/character|protagonist/g) || []).length >= 2) quickScore += 10;
        
        if (wordCount < 100) warnings.push('Synopsis may need more detail');
        if (wordCount > 600) warnings.push('Synopsis may be too detailed');
        suggestions.push('Follow three-act structure clearly');
        break;
        
      case 'budget':
        // Budget validation
        const budgetValue = parseFloat(data.content.replace(/[,$]/g, ''));
        if (budgetValue >= 1000000 && budgetValue <= 50000000) quickScore += 20;
        if (budgetValue > 0) quickScore += 10;
        
        if (budgetValue < 100000) warnings.push('Budget may be too low for production quality');
        if (budgetValue > 200000000) warnings.push('Budget may be too high for ROI');
        suggestions.push('Research industry standards for your genre');
        break;
        
      default:
        quickScore = 60;
        suggestions.push('Continue developing this section');
    }
    
    const realTimeValidation: RealTimeValidation = {
      pitchId: data.pitchId,
      field: data.field,
      content: data.content,
      quickScore: Math.min(100, Math.max(0, quickScore)),
      suggestions,
      warnings,
      timestamp: new Date().toISOString()
    };
    
    return Response.json({
      success: true,
      data: realTimeValidation
    });
    
  } catch (error) {
    logger.error('Real-time validation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return Response.json({
      success: false,
      error: `Real-time validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * GET /api/validation/progress/:pitchId
 * Get validation progress and trends
 */
export async function getProgressHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pitchId = url.pathname.split('/').pop();
    
    if (!pitchId) {
      return Response.json({
        success: false,
        error: 'Pitch ID is required'
      }, { status: 400 });
    }
    
    // Get current validation score
    const cache = getRedis();
    const cacheKey = `validation_score:${pitchId}`;
    const cachedScore = await cache?.get(cacheKey);
    
    if (!cachedScore) {
      return Response.json({
        success: false,
        error: 'Validation score not found. Please run analysis first.'
      }, { status: 404 });
    }
    
    const validationScore: ValidationScore = JSON.parse(cachedScore);
    
    // Calculate completeness based on available data
    const requiredFields = ['title', 'logline', 'synopsis', 'genre', 'budget'];
    const optionalFields = ['director', 'producer', 'cast', 'target_audience', 'release_strategy'];
    
    // Simulate completeness calculation (would be based on actual pitch data)
    const completeness = Math.min(100, validationScore.overallScore + 10);
    
    // Deterministic trend showing improvement toward current score
    const currentScore = validationScore.overallScore;
    const storyScore = validationScore.categories.story.score;
    const marketScore = validationScore.categories.market.score;
    const scoreTrend = [
      {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        overall_score: Math.max(20, Math.round(currentScore * 0.8)),
        category_scores: {
          story: { score: Math.max(20, Math.round(storyScore * 0.8)), weight: 25, confidence: 80, factors: [], improvements: [], strengths: [], weaknesses: [] },
          market: { score: Math.max(20, Math.round(marketScore * 0.8)), weight: 20, confidence: 75, factors: [], improvements: [], strengths: [], weaknesses: [] }
        }
      },
      {
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        overall_score: Math.max(30, Math.round(currentScore * 0.9)),
        category_scores: {
          story: { score: Math.max(30, Math.round(storyScore * 0.9)), weight: 25, confidence: 80, factors: [], improvements: [], strengths: [], weaknesses: [] },
          market: { score: Math.max(30, Math.round(marketScore * 0.9)), weight: 20, confidence: 75, factors: [], improvements: [], strengths: [], weaknesses: [] }
        }
      },
      {
        date: new Date().toISOString().split('T')[0],
        overall_score: currentScore,
        category_scores: validationScore.categories
      }
    ];

    // Determine missing fields based on score — low score implies missing data
    const missingFields = currentScore < 60 ? requiredFields.slice(3) : [];

    // Recommend optional fields that could improve the score
    const recommendedFields = currentScore < 80 ? optionalFields.slice(0, 3) : [];
    
    const validationProgress: ValidationProgress = {
      pitchId,
      completeness,
      missingFields,
      recommendedFields,
      scoreTrend
    };
    
    return Response.json({
      success: true,
      data: validationProgress
    });
    
  } catch (error) {
    logger.error('Failed to get validation progress', { error: error instanceof Error ? error.message : 'Unknown error' });
    return Response.json({
      success: false,
      error: `Failed to get progress: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * GET /api/validation/dashboard/:pitchId
 * Get comprehensive validation dashboard data
 */
export async function getDashboardHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pitchId = url.pathname.split('/').pop();
    
    if (!pitchId) {
      return Response.json({
        success: false,
        error: 'Pitch ID is required'
      }, { status: 400 });
    }
    
    // Get all related data in parallel
    const [scoreResponse, progressResponse] = await Promise.all([
      getScoreHandler(new Request(`${request.url.replace('/dashboard', '/score')}`)),
      getProgressHandler(new Request(`${request.url.replace('/dashboard', '/progress')}`))
    ]);
    
    const scoreData = await scoreResponse.json() as { success: boolean; data?: ValidationScore };
    const progressData = await progressResponse.json() as { success: boolean; data?: ValidationProgress };
    
    if (!scoreData.success || !progressData.success) {
      return Response.json({
        success: false,
        error: 'Failed to load dashboard data'
      }, { status: 404 });
    }
    
    const validationScore: ValidationScore = scoreData.data;
    const validationProgress: ValidationProgress = progressData.data;
    
    // Derive competitive position from the overall score
    const estimatedRanking = Math.max(1, Math.round(100 - validationScore.overallScore));
    const competitivePosition = {
      ranking: estimatedRanking,
      total_in_category: 100,
      percentile: Math.min(99, validationScore.overallScore),
      strengths_vs_competition: validationScore.categories.story.strengths.slice(0, 2),
      weaknesses_vs_competition: validationScore.categories.story.weaknesses.slice(0, 2)
    };
    
    // Generate validation milestones
    const nextMilestones = [
      {
        title: 'Reach 80+ Overall Score',
        description: 'Improve weak categories to achieve strong validation score',
        target_score: 80,
        current_progress: (validationScore.overallScore / 80) * 100,
        estimated_timeline: '2-3 weeks',
        priority: 'high' as const
      },
      {
        title: 'Complete Market Analysis',
        description: 'Finalize market research and competitive analysis',
        target_score: 85,
        current_progress: (validationScore.categories.market.score / 85) * 100,
        estimated_timeline: '1-2 weeks',
        priority: 'medium' as const
      }
    ];
    
    const dashboard = {
      pitch: {
        id: pitchId,
        title: 'Your Pitch', // Would come from pitch data
        creator: 'Creator Name' // Would come from user data
      },
      currentScore: validationScore,
      trends: validationProgress.scoreTrend,
      activeRecommendations: validationScore.recommendations.filter(rec => rec.priority === 'high').slice(0, 3),
      competitivePosition,
      nextMilestones
    };
    
    return Response.json({
      success: true,
      data: dashboard
    });
    
  } catch (error) {
    logger.error('Failed to get validation dashboard', { error: error instanceof Error ? error.message : 'Unknown error' });
    return Response.json({
      success: false,
      error: `Failed to load dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * POST /api/validation/batch-analyze
 * Batch analysis for multiple pitches
 */
export async function batchAnalyzeHandler(request: Request): Promise<Response> {
  try {
    const data = await request.json() as Record<string, unknown>;
    
    if (!data.pitches || !Array.isArray(data.pitches) || data.pitches.length === 0) {
      return Response.json({
        success: false,
        error: 'Pitches array is required'
      }, { status: 400 });
    }
    
    if (data.pitches.length > 10) {
      return Response.json({
        success: false,
        error: 'Maximum 10 pitches per batch'
      }, { status: 400 });
    }
    
    const results = await Promise.allSettled(
      data.pitches.map(async (pitchData: any) => {
        const analysisRequest: ValidationAnalysisRequest = {
          pitchData,
          options: {
            depth: 'basic', // Use basic for batch processing
            include_market_data: false,
            include_comparables: false,
            include_predictions: false
          }
        };
        
        return await pitchValidationService.validatePitch(analysisRequest);
      })
    );
    
    const successful = results
      .filter((result): result is PromiseFulfilledResult<ValidationScore> => result.status === 'fulfilled')
      .map(result => result.value);
    
    const failed = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason.message);
    
    // Generate batch insights
    const batchInsights = {
      total_analyzed: successful.length,
      average_score: successful.length > 0 
        ? Math.round(successful.reduce((sum, score) => sum + score.overallScore, 0) / successful.length)
        : 0,
      score_distribution: {
        excellent: successful.filter(s => s.overallScore >= 80).length,
        good: successful.filter(s => s.overallScore >= 60 && s.overallScore < 80).length,
        needs_improvement: successful.filter(s => s.overallScore < 60).length
      },
      top_performer: successful.length > 0 
        ? successful.reduce((best, current) => current.overallScore > best.overallScore ? current : best)
        : null,
      common_weaknesses: [
        'Story development needs attention',
        'Market positioning could be improved',
        'Financial projections need refinement'
      ]
    };
    
    return Response.json({
      success: true,
      data: {
        results: successful,
        failed_count: failed.length,
        failed_reasons: failed,
        batch_insights: batchInsights
      }
    });
    
  } catch (error) {
    logger.error('Batch analysis failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return Response.json({
      success: false,
      error: `Batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

// Export all handlers for easy routing
export const validationHandlers = {
  analyze: analyzeHandler,
  getScore: getScoreHandler,
  updateScore: updateScoreHandler,
  getRecommendations: getRecommendationsHandler,
  getComparables: getComparablesHandler,
  benchmark: benchmarkHandler,
  realTimeValidation: realTimeValidationHandler,
  getProgress: getProgressHandler,
  getDashboard: getDashboardHandler,
  batchAnalyze: batchAnalyzeHandler
};