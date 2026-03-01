import { apiClient } from '../lib/api-client';

export interface ConfigurationData {
  genres: string[];
  formats: string[];
  budgetRanges: string[];
  stages: string[];
}

// Fallback constants - used if API fails
const FALLBACK_CONFIG: ConfigurationData = {
  genres: [
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
  ],
  formats: [
    'Feature Film',
    'Short Film', 
    'TV Series',
    'Web Series'
  ],
  budgetRanges: [
    'Under $1M',
    '$1M-$5M',
    '$5M-$15M',
    '$15M-$30M',
    '$30M-$50M',
    '$50M-$100M',
    'Over $100M'
  ],
  stages: [
    'Development',
    'Pre-Production',
    'Production',
    'Post-Production',
    'Distribution'
  ]
};

class ConfigService {
  private config: ConfigurationData | null = null;
  private isLoading = false;
  private loadPromise: Promise<ConfigurationData> | null = null;

  async getConfiguration(): Promise<ConfigurationData> {
    // Return cached config if available
    if (this.config) {
      return this.config;
    }

    // If already loading, return the existing promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.loadPromise = this.loadConfigFromAPI();
    return this.loadPromise;
  }

  private async loadConfigFromAPI(): Promise<ConfigurationData> {
    try {
      this.isLoading = true;
      
      // Try to get all config at once
      const response = await apiClient.get<ConfigurationData>('/api/config/all');
      
      if (response.success && response.data) {
        this.config = response.data;
        return this.config;
      }

      // If /all endpoint fails, try individual endpoints
      return await this.loadConfigIndividually();
      
    } catch (error) {
      console.warn('Failed to load configuration from API, using fallback:', error);
      return this.useFallbackConfig();
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async loadConfigIndividually(): Promise<ConfigurationData> {
    try {
      const [genresRes, formatsRes, budgetRes, stagesRes] = await Promise.allSettled([
        apiClient.get<string[]>('/api/config/genres'),
        apiClient.get<string[]>('/api/config/formats'),
        apiClient.get<string[]>('/api/config/budget-ranges'),
        apiClient.get<string[]>('/api/config/stages')
      ]);

      const config: ConfigurationData = {
        genres: genresRes.status === 'fulfilled' && genresRes.value.success 
          ? genresRes.value.data || FALLBACK_CONFIG.genres 
          : FALLBACK_CONFIG.genres,
        formats: formatsRes.status === 'fulfilled' && formatsRes.value.success 
          ? formatsRes.value.data || FALLBACK_CONFIG.formats 
          : FALLBACK_CONFIG.formats,
        budgetRanges: budgetRes.status === 'fulfilled' && budgetRes.value.success 
          ? budgetRes.value.data || FALLBACK_CONFIG.budgetRanges 
          : FALLBACK_CONFIG.budgetRanges,
        stages: stagesRes.status === 'fulfilled' && stagesRes.value.success 
          ? stagesRes.value.data || FALLBACK_CONFIG.stages 
          : FALLBACK_CONFIG.stages
      };

      this.config = config;
      return this.config;

    } catch (error) {
      console.warn('Failed to load individual configuration endpoints:', error);
      return this.useFallbackConfig();
    }
  }

  private useFallbackConfig(): ConfigurationData {
    this.config = { ...FALLBACK_CONFIG };
    return this.config;
  }

  // Helper methods for specific config types
  async getGenres(): Promise<string[]> {
    const config = await this.getConfiguration();
    return config.genres;
  }

  async getFormats(): Promise<string[]> {
    const config = await this.getConfiguration();
    return config.formats;
  }

  async getBudgetRanges(): Promise<string[]> {
    const config = await this.getConfiguration();
    return config.budgetRanges;
  }

  async getStages(): Promise<string[]> {
    const config = await this.getConfiguration();
    return config.stages;
  }

  // Force refresh configuration (useful for admin updates)
  async refreshConfiguration(): Promise<ConfigurationData> {
    this.config = null;
    this.loadPromise = null;
    return this.getConfiguration();
  }

  // Check if config is loaded
  isConfigLoaded(): boolean {
    return this.config !== null;
  }

  // Get sync config (returns fallback if not loaded)
  getSyncConfig(): ConfigurationData {
    return this.config || FALLBACK_CONFIG;
  }
}

// Export singleton instance
export const configService = new ConfigService();

// Export types for components
export type Genre = string;
export type Format = string;
export type BudgetRange = string;
export type Stage = string;