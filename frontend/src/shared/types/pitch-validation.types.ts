/**
 * Frontend types for Pitch Validation components
 * Re-exports from backend types with additional frontend-specific interfaces
 */

// Re-export all backend validation types
export type {
  ValidationScore,
  ValidationCategories,
  CategoryScore,
  ScoreFactor,
  ValidationRecommendation,
  RealTimeValidation,
  ValidationProgress,
  ValidationDashboard,
  ComparableProject,
  BenchmarkData,
  ScoreTrend,
  CompetitivePosition,
  ValidationMilestone,
  AIAnalysisInsights,
  SuccessPrediction,
  MarketTimingAnalysis,
  RiskAssessment
} from '../../../../src/types/pitch-validation.types';

// Frontend-specific component configuration
export interface ValidationComponentConfig {
  pitchId: string;
  showRealTimeValidation?: boolean;
  showDetailedFeedback?: boolean;
  autoAnalyze?: boolean;
  analysisDepth?: 'basic' | 'standard' | 'comprehensive';
}

// Pitch form data structure for React components
export interface PitchFormData {
  title: string;
  logline: string;
  synopsis: string;
  genre: string;
  budget: string;
  director?: string;
  producer?: string;
  cast?: string[];
  targetAudience?: string;
  releaseStrategy?: string;
  scriptPages?: number;
}

// React hook state interface
export interface ValidationHookState {
  validationData: unknown | null; // Using unknown to avoid circular import issues
  loading: boolean;
  error: string | null;
}

// Component prop interfaces
export interface ValidationComponentProps {
  pitchId: string;
  config?: Partial<ValidationComponentConfig>;
  onValidationComplete?: (data: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export interface PitchFormProps {
  pitchId?: string;
  initialData?: Partial<PitchFormData>;
  showValidation?: boolean;
  onSave?: (data: PitchFormData) => void;
  onSubmit?: (data: PitchFormData) => void;
  validationConfig?: ValidationComponentConfig;
  className?: string;
}

export interface DashboardProps {
  pitchId: string;
  showCharts?: boolean;
  showRecommendations?: boolean;
  showComparisons?: boolean;
  onRecommendationClick?: (recommendation: any) => void;
  onAnalyzeClick?: () => void;
  className?: string;
}

// Validation chart configuration
export interface ChartConfiguration {
  chartType: 'category-breakdown' | 'radar-analysis' | 'trend-analysis' | 'competitive-analysis' | 'benchmark-comparison' | 'success-prediction';
  showLegend?: boolean;
  showTooltips?: boolean;
  colorScheme?: 'default' | 'monochrome' | 'colorful';
  height?: number;
}

// Real-time validator configuration
export interface RealTimeValidatorConfig {
  pitchId: string;
  field: string;
  fieldType?: 'title' | 'logline' | 'synopsis' | 'budget' | 'genre' | 'text';
  debounceMs?: number;
  showDetailedFeedback?: boolean;
  onScoreChange?: (score: number) => void;
}

// Validation service response wrapper
export interface ValidationServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  analysisTime?: number;
  dataFreshness?: string;
  recommendationsCount?: number;
}

// Field validation result
export interface FieldValidationResult {
  field: string;
  score: number;
  suggestions: string[];
  warnings: string[];
  metrics: Record<string, any>;
}

// Progress tracking
export interface ValidationProgressData {
  completeness: number;
  fieldScores: Record<string, number>;
  overallTrend: 'improving' | 'declining' | 'stable';
  lastUpdate: string;
}

// Utility types for component state management
export type ValidationTabType = 'overview' | 'categories' | 'trends' | 'recommendations' | 'comparisons';
export type AnalysisDepth = 'basic' | 'standard' | 'comprehensive';
export type ValidationStatus = 'pending' | 'analyzing' | 'complete' | 'error';
export type RecommendationPriority = 'high' | 'medium' | 'low';
export type ScoreRange = 'excellent' | 'good' | 'needs-work' | 'poor';

// Event handler types
export type ValidationEventHandler = (data: any) => void;
export type ErrorEventHandler = (error: string) => void;
export type ScoreChangeHandler = (score: number, field?: string) => void;
export type RecommendationClickHandler = (recommendation: any) => void;

// Theme and styling
export interface ValidationTheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  borderRadius: string;
  spacing: Record<string, string>;
  typography: Record<string, string>;
}

export const defaultValidationTheme: ValidationTheme = {
  colors: {
    primary: '#3B82F6',
    secondary: '#6B7280',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4'
  },
  borderRadius: '0.5rem',
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '400'
  }
};

// Validation context for React context provider
export interface ValidationContextType {
  config: ValidationComponentConfig;
  theme: ValidationTheme;
  setConfig: (config: Partial<ValidationComponentConfig>) => void;
  setTheme: (theme: Partial<ValidationTheme>) => void;
}

// Export utility functions interface
export interface ValidationUtils {
  getScoreColor: (score: number) => string;
  getScoreLabel: (score: number) => string;
  formatBudget: (budget: number) => string;
  getBudgetCategory: (budget: number) => string;
  calculateCompleteness: (formData: PitchFormData) => number;
  getGenreColor: (genre: string) => string;
}