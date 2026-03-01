// Legacy constants - now fetched from API via configService
// These are kept as fallbacks and for type compatibility

import { configService } from '../services/config.service';
import type { Genre, Format, BudgetRange, Stage } from '../services/config.service';

// Fallback constants (used if API is unavailable)
export const FALLBACK_GENRES = [
  'Abstract / Non-Narrative',
  'Action',
  'Action-Comedy',
  'Action-Thriller',
  'Adventure',
  'Animation',
  'Avant-Garde',
  'Biographical Documentary',
  'Biographical Drama (Biopic)',
  'Comedy',
  'Coming-of-Age',
  'Crime Drama',
  'Crime Thriller',
  'Dramedy',
  'Documentary',
  'Docudrama',
  'Essay Film',
  'Experimental Documentary',
  'Family / Kids',
  'Fantasy',
  'Fantasy Adventure',
  'Historical Drama',
  'Historical Fiction',
  'Horror',
  'Hybrid Experimental',
  'Meta-Cinema',
  'Mockumentary',
  'Musical',
  'Musical Drama',
  'Mystery Thriller',
  'Noir / Neo-Noir',
  'Parody / Spoof',
  'Performance Film',
  'Period Piece',
  'Political Drama',
  'Political Thriller',
  'Psychological Thriller',
  'Reality-Drama',
  'Romance',
  'Romantic Comedy (Rom-Com)',
  'Romantic Drama',
  'Satire',
  'Science Fiction (Sci-Fi)',
  'Sci-Fi Horror',
  'Slow Cinema',
  'Sports Drama',
  'Superhero',
  'Surrealist',
  'Thriller',
  'True Crime',
  'Visual Poetry',
  'War',
  'Western'
] as const;

export const FALLBACK_FORMATS = [
  'Feature Film',
  'Short Film', 
  'TV Series',
  'Web Series'
] as const;

export const FALLBACK_BUDGET_RANGES = [
  'Under $1M',
  '$1M-$5M',
  '$5M-$15M',
  '$15M-$30M',
  '$30M-$50M',
  '$50M-$100M',
  'Over $100M'
] as const;

export const FALLBACK_STAGES = [
  'Development',
  'Pre-Production',
  'Production',
  'Post-Production',
  'Distribution'
] as const;

// API-backed getters
export const getGenres = () => configService.getGenres();
export const getFormats = () => configService.getFormats();
export const getBudgetRanges = () => configService.getBudgetRanges();
export const getStages = () => configService.getStages();

// Synchronous getters (use cached or fallback)
export const getGenresSync = () => {
  const config = configService.getSyncConfig();
  return (config && config.genres) ? config.genres : FALLBACK_GENRES;
};

export const getFormatsSync = () => {
  const config = configService.getSyncConfig();
  return (config && config.formats) ? config.formats : FALLBACK_FORMATS;
};

export const getBudgetRangesSync = () => {
  const config = configService.getSyncConfig();
  return (config && config.budgetRanges) ? config.budgetRanges : FALLBACK_BUDGET_RANGES;
};

export const getStagesSync = () => {
  const config = configService.getSyncConfig();
  return (config && config.stages) ? config.stages : FALLBACK_STAGES;
};

// Legacy exports for backward compatibility
export const GENRES = FALLBACK_GENRES;
export const FORMATS = FALLBACK_FORMATS;

// Re-export types
export type { Genre, Format, BudgetRange, Stage };