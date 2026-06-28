/**
 * Advanced Search Modal Component
 * Multi-step search builder with intelligent filters and real-time suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Filter, Sliders, TrendingUp, Target, DollarSign, Award, Lightbulb, BarChart3 } from 'lucide-react';

interface AdvancedSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (filters: AdvancedSearchFilters) => void;
  initialFilters?: Partial<AdvancedSearchFilters>;
}

interface AdvancedSearchFilters {
  // Basic search
  query: string;
  searchType: 'keyword' | 'semantic' | 'hybrid';
  
  // Content filters
  genres: string[];
  formats: string[];
  themes: string[];
  moodTags: string[];
  targetAudience: string[];
  
  // Budget and financial
  budgetMin?: number;
  budgetMax?: number;
  productionScale: string;
  budgetEfficiency: string;
  
  // Timeline filters
  dateFrom?: string;
  dateTo?: string;
  releaseWindow: string;
  seasonalRelevance: string;
  
  // Creator filters
  creatorType: string;
  experienceLevel: string;
  location: string;
  verifiedOnly: boolean;
  teamComposition: string[];
  
  // Market intelligence
  trendingScore: { min?: number; max?: number };
  marketViability: { min?: number; max?: number };
  genrePopularity: string;
  investorInterest: { min?: number; max?: number };
  
  // Content completeness
  hasLookbook: boolean;
  hasScript: boolean;
  hasTrailer: boolean;
  hasPitchDeck: boolean;
  completenessMin?: number;
  
  // Advanced options
  similarToId?: number;
  excludeViewed: boolean;
  sortBy: string;
  sortOrder: string;
}

const SEARCH_STEPS = [
  { id: 'basic', title: 'Search Query', icon: Search },
  { id: 'content', title: 'Content Filters', icon: Filter },
  { id: 'business', title: 'Business Criteria', icon: TrendingUp },
  { id: 'advanced', title: 'Advanced Options', icon: Sliders },
];

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'Horror', 'Musical', 'Mystery',
  'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
];

const FORMATS = [
  'Feature Film', 'Short Film', 'Series', 'Limited Series', 'Documentary',
  'Animation', 'Web Series', 'Music Video', 'Commercial', 'Pilot'
];

const THEMES = [
  'Coming of Age', 'Redemption', 'Revenge', 'Love Story', 'Family',
  'Friendship', 'Betrayal', 'Survival', 'Good vs Evil', 'Identity',
  'Social Justice', 'Power Struggle', 'Time Travel', 'Artificial Intelligence'
];

const MOOD_TAGS = [
  'Dark', 'Uplifting', 'Suspenseful', 'Humorous', 'Emotional', 'Intense',
  'Whimsical', 'Gritty', 'Heartwarming', 'Mind-bending', 'Nostalgic', 'Epic'
];

export const AdvancedSearchModal: React.FC<AdvancedSearchProps> = ({
  isOpen,
  onClose,
  onSearch,
  initialFilters
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [filters, setFilters] = useState<AdvancedSearchFilters>({
    query: '',
    searchType: 'hybrid',
    genres: [],
    formats: [],
    themes: [],
    moodTags: [],
    targetAudience: [],
    productionScale: '',
    budgetEfficiency: '',
    releaseWindow: '',
    seasonalRelevance: '',
    creatorType: '',
    experienceLevel: '',
    location: '',
    verifiedOnly: false,
    teamComposition: [],
    trendingScore: {},
    marketViability: {},
    genrePopularity: '',
    investorInterest: {},
    hasLookbook: false,
    hasScript: false,
    hasTrailer: false,
    hasPitchDeck: false,
    excludeViewed: false,
    sortBy: 'relevance',
    sortOrder: 'desc',
    ...initialFilters
  });

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Real-time search suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&limit=8`);
      const data = await response.json();
      setSuggestions(data.suggestions?.map((s: any) => s.query) || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, []);

  useEffect(() => {
    if (filters.query) {
      const timeoutId = setTimeout(() => {
        void fetchSuggestions(filters.query);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [filters.query, fetchSuggestions]);

  const updateFilter = (field: string, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayFilter = (field: keyof AdvancedSearchFilters, value: string) => {
    setFilters(prev => {
      const currentArray = prev[field] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return { ...prev, [field]: newArray };
    });
  };

  const handleSearch = () => {
    setIsLoading(true);
    onSearch(filters);
    onClose();
    setIsLoading(false);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return filters.query.length >= 2;
      case 1: return filters.genres.length > 0 || filters.formats.length > 0;
      case 2: return true;
      case 3: return true;
      default: return true;
    }
  };

  const resetFilters = () => {
    setFilters({
      query: '',
      searchType: 'hybrid',
      genres: [],
      formats: [],
      themes: [],
      moodTags: [],
      targetAudience: [],
      productionScale: '',
      budgetEfficiency: '',
      releaseWindow: '',
      seasonalRelevance: '',
      creatorType: '',
      experienceLevel: '',
      location: '',
      verifiedOnly: false,
      teamComposition: [],
      trendingScore: {},
      marketViability: {},
      genrePopularity: '',
      investorInterest: {},
      hasLookbook: false,
      hasScript: false,
      hasTrailer: false,
      hasPitchDeck: false,
      excludeViewed: false,
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Advanced Search</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center space-x-1">
            {SEARCH_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => setCurrentStep(index)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <StepIcon className="h-4 w-4" />
                    <span className="font-medium">{step.title}</span>
                  </button>
                  {index < SEARCH_STEPS.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-300"></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Step 0: Basic Search */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-3">
                  What are you looking for?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filters.query}
                    onChange={(e) => updateFilter('query', e.target.value)}
                    placeholder="Search for genres, themes, titles, creators..."
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                </div>
                
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => updateFilter('query', suggestion)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Method
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'keyword', label: 'Keyword Match', desc: 'Exact word matching' },
                    { value: 'semantic', label: 'AI Understanding', desc: 'Meaning-based search' },
                    { value: 'hybrid', label: 'Smart Search', desc: 'Best of both methods' }
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => updateFilter('searchType', type.value)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        filters.searchType === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-gray-600">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Content Filters */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Genres */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-3">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-5 w-5" />
                    <span>Genres</span>
                  </div>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {GENRES.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => toggleArrayFilter('genres', genre)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        filters.genres.includes(genre)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formats */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-3">
                  Formats
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((format) => (
                    <button
                      key={format}
                      onClick={() => toggleArrayFilter('formats', format)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        filters.formats.includes(format)
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-300'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {/* Themes and Moods */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Themes
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {THEMES.map((theme) => (
                      <label key={theme} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.themes.includes(theme)}
                          onChange={() => toggleArrayFilter('themes', theme)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{theme}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mood & Tone
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {MOOD_TAGS.map((mood) => (
                      <label key={mood} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.moodTags.includes(mood)}
                          onChange={() => toggleArrayFilter('moodTags', mood)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm">{mood}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Business Criteria */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Budget Range */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-3">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5" />
                    <span>Budget Range</span>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Budget
                    </label>
                    <select
                      value={filters.budgetMin || ''}
                      onChange={(e) => updateFilter('budgetMin', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No minimum</option>
                      <option value="50000">$50K</option>
                      <option value="100000">$100K</option>
                      <option value="500000">$500K</option>
                      <option value="1000000">$1M</option>
                      <option value="5000000">$5M</option>
                      <option value="10000000">$10M</option>
                      <option value="25000000">$25M</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Budget
                    </label>
                    <select
                      value={filters.budgetMax || ''}
                      onChange={(e) => updateFilter('budgetMax', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No maximum</option>
                      <option value="100000">$100K</option>
                      <option value="500000">$500K</option>
                      <option value="1000000">$1M</option>
                      <option value="5000000">$5M</option>
                      <option value="10000000">$10M</option>
                      <option value="25000000">$25M</option>
                      <option value="50000000">$50M</option>
                      <option value="100000000">$100M+</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Production Scale & Market Intelligence */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Production Scale
                  </label>
                  <select
                    value={filters.productionScale}
                    onChange={(e) => updateFilter('productionScale', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any scale</option>
                    <option value="micro">Micro Budget</option>
                    <option value="indie">Independent</option>
                    <option value="studio">Studio</option>
                    <option value="blockbuster">Blockbuster</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genre Popularity
                  </label>
                  <select
                    value={filters.genrePopularity}
                    onChange={(e) => updateFilter('genrePopularity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any trend</option>
                    <option value="rising">Rising in popularity</option>
                    <option value="stable">Consistently popular</option>
                    <option value="declining">Declining interest</option>
                  </select>
                </div>
              </div>

              {/* Creator Filters */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Creator Experience
                  </label>
                  <select
                    value={filters.experienceLevel}
                    onChange={(e) => updateFilter('experienceLevel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any experience</option>
                    <option value="newcomer">Newcomer (0-2 projects)</option>
                    <option value="emerging">Emerging (3-10 projects)</option>
                    <option value="experienced">Experienced (11-25 projects)</option>
                    <option value="veteran">Veteran (25+ projects)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={filters.location}
                    onChange={(e) => updateFilter('location', e.target.value)}
                    placeholder="City, State, Country"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Verification */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.verifiedOnly}
                    onChange={(e) => updateFilter('verifiedOnly', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Verified creators only
                  </span>
                  <Award className="h-4 w-4 text-yellow-500" />
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Advanced Options */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Content Completeness */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-3">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Content Requirements</span>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.hasLookbook}
                      onChange={(e) => updateFilter('hasLookbook', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Has Lookbook</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.hasScript}
                      onChange={(e) => updateFilter('hasScript', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Has Script</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.hasTrailer}
                      onChange={(e) => updateFilter('hasTrailer', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Has Trailer</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.hasPitchDeck}
                      onChange={(e) => updateFilter('hasPitchDeck', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Has Pitch Deck</span>
                  </label>
                </div>
              </div>

              {/* Scoring Ranges */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Trending Score
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.trendingScore.min || 0}
                    onChange={(e) => updateFilter('trendingScore', { ...filters.trendingScore, min: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-600 mt-1">
                    {filters.trendingScore.min || 0}/100
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Market Viability
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.marketViability.min || 0}
                    onChange={(e) => updateFilter('marketViability', { ...filters.marketViability, min: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-600 mt-1">
                    {filters.marketViability.min || 0}/100
                  </div>
                </div>
              </div>

              {/* Sorting */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="trending">Trending Score</option>
                    <option value="newest">Newest First</option>
                    <option value="views">Most Views</option>
                    <option value="completeness">Most Complete</option>
                    <option value="budget_high">Highest Budget</option>
                    <option value="budget_low">Lowest Budget</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort Order
                  </label>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => updateFilter('sortOrder', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="desc">Highest to Lowest</option>
                    <option value="asc">Lowest to Highest</option>
                  </select>
                </div>
              </div>

              {/* Additional Options */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.excludeViewed}
                    onChange={(e) => updateFilter('excludeViewed', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Exclude pitches I've already viewed
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 bg-gray-50 border-t">
          <div className="flex items-center space-x-3">
            <button
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Reset All Filters
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
            )}

            {currentStep < SEARCH_STEPS.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  canProceed()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Next Step
              </button>
            ) : (
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Lightbulb className="h-4 w-4" />
                  )}
                  <span>Search with AI</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};