/**
 * Pitch Validation System Components
 * Export all validation-related components for easy importing
 */

// Core validation components
export { ValidationDashboard } from './ValidationDashboard';
export { RealTimeValidator, ValidationProgressBar } from './RealTimeValidator';
export { ValidationChartsContainer } from './ValidationCharts';
export { EnhancedPitchForm } from './EnhancedPitchForm';

// Re-export validation types for components that need them
export type {
  ValidationScore,
  ValidationCategories,
  CategoryScore,
  ValidationRecommendation,
  RealTimeValidation,
  ValidationProgress,
  ValidationDashboard as ValidationDashboardData,
  ComparableProject,
  BenchmarkData,
  ScoreTrend
} from '@shared/types/pitch-validation.types';

// Component configuration types
export interface ValidationComponentConfig {
  pitchId: string;
  showRealTimeValidation?: boolean;
  showDetailedFeedback?: boolean;
  autoAnalyze?: boolean;
  analysisDepth?: 'basic' | 'standard' | 'comprehensive';
}

interface AnalysisOptions {
  depth?: string;
  include_market_data?: boolean;
  include_comparables?: boolean;
  include_predictions?: boolean;
  [key: string]: unknown;
}

interface RecommendationFilters {
  category?: string;
  priority?: string;
  limit?: number;
}

interface ComparableFilters {
  genre?: string;
  budget_min?: number;
  budget_max?: number;
  year_min?: number;
  year_max?: number;
  limit?: number;
  min_similarity?: number;
}

// Validation service utility functions
export class ValidationService {
  static async analyzePlay(pitchData: unknown, options: AnalysisOptions = {}): Promise<unknown> {
    const response = await fetch('/api/validation/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pitchData,
        options: {
          depth: 'standard',
          include_market_data: true,
          include_comparables: true,
          include_predictions: true,
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error('Validation analysis failed');
    }

    return response.json() as Promise<unknown>;
  }

  static async getScore(pitchId: string): Promise<unknown> {
    const response = await fetch(`/api/validation/score/${pitchId}`);

    if (!response.ok) {
      throw new Error('Failed to get validation score');
    }

    return response.json() as Promise<unknown>;
  }

  static async getRecommendations(pitchId: string, filters: RecommendationFilters = {}): Promise<unknown> {
    const params = new URLSearchParams();

    if (filters.category !== undefined) params.set('category', filters.category);
    if (filters.priority !== undefined) params.set('priority', filters.priority);
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));

    const response = await fetch(`/api/validation/recommendations/${pitchId}?${params}`);

    if (!response.ok) {
      throw new Error('Failed to get recommendations');
    }

    return response.json() as Promise<unknown>;
  }

  static async getComparables(pitchId: string, filters: ComparableFilters = {}): Promise<unknown> {
    const params = new URLSearchParams();

    if (filters.genre !== undefined) params.set('genre', filters.genre);
    if (filters.budget_min !== undefined) params.set('budget_min', String(filters.budget_min));
    if (filters.budget_max !== undefined) params.set('budget_max', String(filters.budget_max));
    if (filters.year_min !== undefined) params.set('year_min', String(filters.year_min));
    if (filters.year_max !== undefined) params.set('year_max', String(filters.year_max));
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters.min_similarity !== undefined) params.set('min_similarity', String(filters.min_similarity));

    const response = await fetch(`/api/validation/comparables/${pitchId}?${params}`);

    if (!response.ok) {
      throw new Error('Failed to get comparable projects');
    }

    return response.json() as Promise<unknown>;
  }

  static async getDashboard(pitchId: string): Promise<unknown> {
    const response = await fetch(`/api/validation/dashboard/${pitchId}`);

    if (!response.ok) {
      throw new Error('Failed to get validation dashboard');
    }

    return response.json() as Promise<unknown>;
  }

  static async realTimeValidate(pitchId: string, field: string, content: string): Promise<unknown> {
    const response = await fetch('/api/validation/realtime', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pitchId,
        field,
        content
      })
    });

    if (!response.ok) {
      throw new Error('Real-time validation failed');
    }

    return response.json() as Promise<unknown>;
  }

  static async benchmark(pitchId: string, categories: string[], comparisonPool: string = 'all'): Promise<unknown> {
    const response = await fetch('/api/validation/benchmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pitchId,
        categories,
        comparison_pool: comparisonPool
      })
    });

    if (!response.ok) {
      throw new Error('Benchmark analysis failed');
    }

    return response.json() as Promise<unknown>;
  }

  static async batchAnalyze(pitches: unknown[]): Promise<unknown> {
    const response = await fetch('/api/validation/batch-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pitches })
    });

    if (!response.ok) {
      throw new Error('Batch analysis failed');
    }

    return response.json() as Promise<unknown>;
  }
}

// Utility functions for validation scores
export const ValidationUtils = {
  getScoreColor: (score: number): string => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  },

  getScoreLabel: (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Requires Attention';
  },

  getOverallRating: (categories: Record<string, { score: number; weight: number }>): string => {
    const overallScore = Object.values(categories).reduce((sum: number, cat) =>
      sum + (cat.score * cat.weight / 100), 0
    );
    return ValidationUtils.getScoreLabel(overallScore);
  },

  getTopRecommendations: (recommendations: Array<{ priority: string; estimatedImpact: number }>, count: number = 3): Array<{ priority: string; estimatedImpact: number }> => {
    return recommendations
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] ?? 0;
        const bPriority = priorityOrder[b.priority] ?? 0;
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        return b.estimatedImpact - a.estimatedImpact;
      })
      .slice(0, count);
  },

  calculateCompleteness: (formData: Record<string, unknown>): number => {
    const requiredFields = ['title', 'logline', 'synopsis', 'genre', 'budget'];
    const completedFields = requiredFields.filter(field => {
      const value = formData[field];
      return value !== undefined && value !== null && String(value).trim().length > 0;
    });
    return Math.round((completedFields.length / requiredFields.length) * 100);
  },

  formatBudget: (budget: number): string => {
    if (budget >= 1000000000) {
      return `$${(budget / 1000000000).toFixed(1)}B`;
    }
    if (budget >= 1000000) {
      return `$${(budget / 1000000).toFixed(1)}M`;
    }
    if (budget >= 1000) {
      return `$${(budget / 1000).toFixed(0)}K`;
    }
    return `$${budget.toLocaleString()}`;
  },

  getBudgetCategory: (budget: number): string => {
    if (budget < 1000000) return 'Micro Budget';
    if (budget < 5000000) return 'Low Budget';
    if (budget < 25000000) return 'Medium Budget';
    if (budget < 100000000) return 'High Budget';
    return 'Blockbuster';
  },

  getGenreColor: (genre: string): string => {
    const genreColors: Record<string, string> = {
      action: '#FF6B6B',
      comedy: '#4ECDC4',
      drama: '#45B7D1',
      horror: '#8B5CF6',
      thriller: '#F39C12',
      romance: '#E74C3C',
      scifi: '#2ECC71',
      fantasy: '#9B59B6',
      documentary: '#95A5A6'
    };
    return genreColors[genre.toLowerCase()] || '#6C757D';
  }
};

// Custom hooks for validation functionality
import { useState } from 'react';

export const useValidation = (pitchId: string) => {
  const [validationData, setValidationData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (pitchData: unknown, options: AnalysisOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await ValidationService.analyzePlay(pitchData, options);
      const resultRecord = result as Record<string, unknown>;
      setValidationData(resultRecord.data);
      return result;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await ValidationService.getDashboard(pitchId);
      const resultRecord = result as Record<string, unknown>;
      setValidationData(resultRecord.data);
      return result;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return {
    validationData,
    loading,
    error,
    analyze,
    refresh
  };
};

// Component prop interfaces for external usage
export interface ValidationComponentProps {
  pitchId: string;
  config?: Partial<ValidationComponentConfig>;
  onValidationComplete?: (data: unknown) => void;
  onError?: (error: string) => void;
  className?: string;
}

export interface PitchFormProps {
  pitchId?: string;
  initialData?: Record<string, unknown>;
  showValidation?: boolean;
  onSave?: (data: Record<string, unknown>) => void;
  onSubmit?: (data: Record<string, unknown>) => void;
  validationConfig?: ValidationComponentConfig;
}

export interface DashboardProps {
  pitchId: string;
  showCharts?: boolean;
  showRecommendations?: boolean;
  showComparisons?: boolean;
  onRecommendationClick?: (recommendation: Record<string, unknown>) => void;
}