// Investor Service - Dashboard and investor-specific operations
import { apiClient } from '../lib/api-client';
import type { 

  Pitch, 
  Investment, 
  InvestorDashboardStats, 
  InvestmentOpportunity, 
  InvestorPortfolio, 
  WatchlistItem,
  DashboardResponse 
} from '@shared/types/api';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? (isDev ? 'http://localhost:8001' : '');

// Export types from centralized types file
export type { 
  Investment, 
  InvestmentOpportunity, 
  InvestorPortfolio, 
  WatchlistItem 
} from '@shared/types/api';

// Keep local types for backward compatibility
export type InvestorStats = InvestorDashboardStats;

export interface ROIMetric {
  category: string;
  avg_roi: number;
  count: number;
  total_profit: number;
}

export interface ROISummary {
  total_investments: number;
  average_roi: number;
  best_roi: number;
  worst_roi: number;
  profitable_count: number;
}

// Types for API responses
interface FinancialSummaryResponse {
  totalInvested: number;
  portfolioValue: number;
  totalReturns: number;
  monthlyChange: number;
  pendingInvestments: number;
}

interface TransactionStatsResponse {
  totalTransactions: number;
  totalVolume: number;
  avgTransactionSize: number;
  transactionsByType: Record<string, number>;
}

interface TaxDocument {
  id: number;
  type: string;
  name: string;
  url: string;
  year: number;
  createdAt: string;
}

interface PerformanceDataPoint {
  date: string;
  value: number;
  invested: number;
  returns: number;
}

// Export a singleton instance for new API methods
export const investorApi = {
  // Financial Overview
  getFinancialSummary: (timeframe?: string) =>
    apiClient.get<FinancialSummaryResponse>(`/api/investor/financial/summary${timeframe !== undefined ? `?timeframe=${timeframe}` : ''}`),

  getRecentTransactions: (limit: number = 5) =>
    apiClient.get(`/api/investor/financial/recent-transactions?limit=${limit}`),
  
  // Transaction History
  getTransactions: (params: {
    page?: number;
    limit?: number;
    type?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    return apiClient.get(`/api/investor/transactions?${queryParams}`);
  },
  
  exportTransactions: async () => {
    const response = await fetch(`${API_BASE_URL}/api/investor/transactions/export`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('pitchey:authToken') ?? localStorage.getItem('authToken') ?? ''}`
      }
    });
    if (!response.ok) throw new Error('Failed to export transactions');
    return response.blob();
  },
  
  getTransactionStats: () =>
    apiClient.get<{ stats: TransactionStatsResponse }>('/api/investor/transactions/stats'),
  
  // Budget Allocation
  getBudgetAllocations: () => 
    apiClient.get('/api/investor/budget/allocations'),
  
  createBudgetAllocation: (data: {
    category: string;
    allocated_amount: number;
    period_start?: string;
    period_end?: string;
  }) => apiClient.post('/api/investor/budget/allocations', data),
  
  updateBudgetAllocation: (id: number, amount: number) => 
    apiClient.put(`/api/investor/budget/allocations/${id}`, { allocated_amount: amount }),
  
  // Pending Deals
  getPendingDeals: () => 
    apiClient.get('/api/investor/deals/pending'),
  
  // Completed Projects
  getCompletedProjects: () => 
    apiClient.get('/api/investor/projects/completed'),
  
  // ROI Analysis
  getROISummary: (timeframe?: string) =>
    apiClient.get<{ summary: ROISummary }>(`/api/investor/analytics/roi/summary${timeframe !== undefined ? `?timeframe=${timeframe}` : ''}`),

  getROIByCategory: (timeframe?: string) =>
    apiClient.get<{ categories: ROIMetric[] }>(`/api/investor/analytics/roi/by-category${timeframe !== undefined ? `?timeframe=${timeframe}` : ''}`),

  // Market Trends
  getMarketTrends: (timeframe?: string) =>
    apiClient.get(`/api/investor/analytics/market/trends${timeframe !== undefined ? `?timeframe=${timeframe}` : ''}`),

  // Risk Assessment
  getPortfolioRisk: (timeframe?: string) =>
    apiClient.get(`/api/investor/analytics/risk/portfolio${timeframe !== undefined ? `?timeframe=${timeframe}` : ''}`),

  // Network & Connections
  getNetwork: () =>
    apiClient.get('/api/investor/network'),

  getCoInvestors: () =>
    apiClient.get('/api/investor/co-investors'),

  getCreators: () =>
    apiClient.get('/api/investor/creators'),

  getProductionCompanies: () =>
    apiClient.get('/api/investor/production-companies'),

  // Performance
  getPerformance: (timeframe?: string) =>
    apiClient.get(`/api/investor/performance${timeframe !== undefined ? `?timeframe=${timeframe}` : ''}`),

  // All Investments
  getAllInvestments: (params?: {
    status?: string;
    genre?: string;
    sort?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }
    return apiClient.get(`/api/investor/investments/all?${queryParams}`);
  },
  
  getInvestmentsSummary: () => 
    apiClient.get('/api/investor/investments/summary'),
  
  // Tax Documents
  getTaxDocuments: (year?: number) => {
    const endpoint = year !== undefined
      ? `/api/investor/tax-documents?year=${year}`
      : '/api/investor/tax-documents';
    return apiClient.get<{ documents: TaxDocument[] }>(endpoint);
  },

  // Reports
  getReports: () =>
    apiClient.get('/api/investor/reports'),

  // Settings
  getSettings: () =>
    apiClient.get('/api/investor/settings'),

  saveSettings: (settings: Record<string, unknown>) =>
    apiClient.put('/api/investor/settings', settings),
};

interface Activity {
  id: number;
  type: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class InvestorService {
  // Get investor dashboard
  static async getDashboard(): Promise<{
    stats: InvestorDashboardStats;
    recentOpportunities: InvestmentOpportunity[];
    portfolio: InvestorPortfolio;
    watchlist: WatchlistItem[];
    activities: Activity[];
  }> {
    const response = await apiClient.get<DashboardResponse>('/api/investor/dashboard');

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch dashboard');
    }

    const dashboard = response.data?.dashboard;

    return {
      stats: (dashboard?.stats as InvestorDashboardStats) ?? {
        totalInvestments: 0,
        activeInvestments: 0,
        totalInvested: 0,
        portfolioValue: 0,
        avgROI: 0,
        pitchesViewed: 0,
        pitchesLiked: 0,
        ndaSigned: 0
      },
      recentOpportunities: dashboard?.recentOpportunities ?? [],
      portfolio: dashboard?.portfolio ?? {
        totalValue: 0,
        totalInvested: 0,
        totalReturns: 0,
        investments: [],
        performance: [],
        diversification: []
      },
      watchlist: dashboard?.watchlist ?? [],
      activities: (dashboard?.activities as Activity[]) ?? []
    };
  }

  // Get investment opportunities
  static async getOpportunities(filters?: {
    genre?: string;
    minInvestment?: number;
    maxInvestment?: number;
    riskLevel?: string;
    sortBy?: 'matchScore' | 'deadline' | 'roi' | 'popularity';
    limit?: number;
    offset?: number;
  }): Promise<{ opportunities: InvestmentOpportunity[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.genre !== undefined && filters.genre !== '') params.append('genre', filters.genre);
    if (filters?.minInvestment !== undefined) params.append('minInvestment', filters.minInvestment.toString());
    if (filters?.maxInvestment !== undefined) params.append('maxInvestment', filters.maxInvestment.toString());
    if (filters?.riskLevel !== undefined && filters.riskLevel !== '') params.append('riskLevel', filters.riskLevel);
    if (filters?.sortBy !== undefined) params.append('sortBy', filters.sortBy);
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<{
      opportunities: InvestmentOpportunity[];
      total: number;
    }>(`/api/investor/opportunities?${params}`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch opportunities');
    }

    return {
      opportunities: response.data?.opportunities ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Get portfolio summary with detailed metrics
  static async getPortfolioSummary(): Promise<{
    totalInvestments: number;
    activeDeals: number;
    totalInvested: number;
    currentValue: number;
    averageReturn: number;
    pendingOpportunities: number;
    monthlyGrowth: number;
    quarterlyGrowth: number;
    ytdGrowth: number;
  }> {
    interface PortfolioSummaryData {
      totalInvestments: number;
      activeDeals: number;
      totalInvested: number;
      currentValue: number;
      averageReturn: number;
      pendingOpportunities: number;
      monthlyGrowth: number;
      quarterlyGrowth: number;
      ytdGrowth: number;
    }
    const response = await apiClient.get<{
      data: PortfolioSummaryData;
    }>('/api/investor/portfolio/summary');

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch portfolio summary');
    }

    return response.data?.data ?? {
      totalInvestments: 0,
      activeDeals: 0,
      totalInvested: 0,
      currentValue: 0,
      averageReturn: 0,
      pendingOpportunities: 0,
      monthlyGrowth: 0,
      quarterlyGrowth: 0,
      ytdGrowth: 0
    };
  }

  // Get portfolio performance history
  static async getPortfolioPerformance(timeframe: string = '1y'): Promise<PerformanceDataPoint[]> {
    const response = await apiClient.get<{
      performanceData: PerformanceDataPoint[];
    }>(`/api/investor/portfolio/performance?timeframe=${timeframe}`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch portfolio performance');
    }

    return response.data?.performanceData ?? [];
  }

  // Get portfolio
  static async getPortfolio(options?: {
    status?: 'active' | 'completed' | 'all';
    sortBy?: 'value' | 'returns' | 'date';
  }): Promise<InvestorPortfolio> {
    const params = new URLSearchParams();
    if (options?.status !== undefined) params.append('status', options.status);
    if (options?.sortBy !== undefined) params.append('sortBy', options.sortBy);

    const response = await apiClient.get<{
      portfolio: InvestorPortfolio;
    }>(`/api/investor/portfolio?${params}`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch portfolio');
    }

    return response.data?.portfolio ?? {
      totalValue: 0,
      totalInvested: 0,
      totalReturns: 0,
      investments: [],
      performance: [],
      diversification: []
    };
  }

  // Make investment
  static async invest(data: {
    pitchId: number;
    amount: number;
    terms?: string;
    message?: string;
  }): Promise<Investment> {
    const response = await apiClient.post<{
      investment: Investment;
    }>('/api/investor/invest', data);

    if (response.success !== true || response.data?.investment === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to make investment');
    }

    return response.data.investment;
  }

  // Withdraw investment
  static async withdrawInvestment(investmentId: number, reason?: string): Promise<void> {
    const response = await apiClient.post<void>(
      `/api/investor/investments/${investmentId}/withdraw`,
      { reason }
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to withdraw investment');
    }
  }

  // Get watchlist
  static async getWatchlist(): Promise<WatchlistItem[]> {
    const response = await apiClient.get<{
      watchlist: WatchlistItem[];
    }>('/api/investor/watchlist');

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch watchlist');
    }

    return response.data?.watchlist ?? [];
  }

  // Add to watchlist
  static async addToWatchlist(pitchId: number, notes?: string): Promise<WatchlistItem> {
    const response = await apiClient.post<{
      item: WatchlistItem;
    }>('/api/investor/watchlist', { pitchId, notes });

    if (response.success !== true || response.data?.item === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to add to watchlist');
    }

    return response.data.item;
  }

  // Remove from watchlist
  static async removeFromWatchlist(pitchId: number): Promise<void> {
    const response = await apiClient.delete<void>(
      `/api/investor/watchlist/${pitchId}`
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to remove from watchlist');
    }
  }

  // Get investment analytics
  static async getAnalytics(period?: 'week' | 'month' | 'quarter' | 'year' | 'all'): Promise<{
    performance: PerformanceDataPoint[];
    topPerformers: Investment[];
    riskAnalysis: {
      lowRisk: number;
      mediumRisk: number;
      highRisk: number;
    };
    genrePerformance: {
      genre: string;
      investments: number;
      totalValue: number;
      avgROI: number;
    }[];
  }> {
    interface AnalyticsResponse {
      performance: PerformanceDataPoint[];
      topPerformers: Investment[];
      riskAnalysis: {
        lowRisk: number;
        mediumRisk: number;
        highRisk: number;
      };
      genrePerformance: {
        genre: string;
        investments: number;
        totalValue: number;
        avgROI: number;
      }[];
    }
    const params = new URLSearchParams();
    if (period !== undefined) params.append('period', period);

    const response = await apiClient.get<{
      analytics: AnalyticsResponse;
    }>(`/api/investor/analytics?${params}`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch analytics');
    }

    return response.data?.analytics ?? {
      performance: [],
      topPerformers: [],
      riskAnalysis: {
        lowRisk: 0,
        mediumRisk: 0,
        highRisk: 0
      },
      genrePerformance: []
    };
  }

  // Get recommended pitches (AI-powered)
  static async getRecommendations(options?: {
    limit?: number;
    minScore?: number;
  }): Promise<{
    pitch: Pitch;
    score: number;
    reasons: string[];
  }[]> {
    interface RecommendationItem {
      pitch: Pitch;
      score: number;
      reasons: string[];
    }
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());
    if (options?.minScore !== undefined) params.append('minScore', options.minScore.toString());

    const response = await apiClient.get<{
      recommendations: RecommendationItem[];
    }>(`/api/investor/recommendations?${params}`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch recommendations');
    }

    return response.data?.recommendations ?? [];
  }

  // Get investment documents
  static async getDocuments(investmentId: number): Promise<{
    id: number;
    name: string;
    type: 'contract' | 'report' | 'statement' | 'other';
    url: string;
    uploadedAt: string;
  }[]> {
    interface DocumentItem {
      id: number;
      name: string;
      type: 'contract' | 'report' | 'statement' | 'other';
      url: string;
      uploadedAt: string;
    }
    const response = await apiClient.get<{
      documents: DocumentItem[];
    }>(`/api/investor/investments/${investmentId}/documents`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch documents');
    }

    return response.data?.documents ?? [];
  }

  // Download investment report
  static async downloadReport(investmentId: number, format: 'pdf' | 'excel'): Promise<Blob> {
    const token = localStorage.getItem('pitchey:authToken') ?? localStorage.getItem('authToken') ?? '';
    const response = await fetch(
      `${API_BASE_URL}/api/investor/investments/${investmentId}/report?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download report');
    }

    return response.blob();
  }

  // Set investment alerts
  static async setAlerts(pitchId: number, alerts: {
    onStatusChange?: boolean;
    onPriceChange?: boolean;
    onDeadlineApproaching?: boolean;
    customThreshold?: number;
  }): Promise<void> {
    const response = await apiClient.post<void>(
      `/api/investor/alerts/${pitchId}`,
      alerts
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to set alerts');
    }
  }

  // Get tax documents
  static async getTaxDocuments(year: number): Promise<{
    documents: Array<{
      id: number;
      type: string;
      name: string;
      url: string;
      year: number;
    }>;
    summary: {
      totalInvested: number;
      totalReturns: number;
      netGainLoss: number;
      taxableAmount: number;
    };
  }> {
    interface TaxInfoResponse {
      documents: Array<{
        id: number;
        type: string;
        name: string;
        url: string;
        year: number;
      }>;
      summary: {
        totalInvested: number;
        totalReturns: number;
        netGainLoss: number;
        taxableAmount: number;
      };
    }
    const response = await apiClient.get<{
      taxInfo: TaxInfoResponse;
    }>(`/api/investor/tax/${year}`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch tax documents');
    }

    return response.data?.taxInfo ?? {
      documents: [],
      summary: {
        totalInvested: 0,
        totalReturns: 0,
        netGainLoss: 0,
        taxableAmount: 0
      }
    };
  }
}

// Export singleton instance
export const investorService = InvestorService;
