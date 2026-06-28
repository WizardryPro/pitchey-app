import apiClient from '@/lib/api-client';

export interface Investment {
  id: number;
  investorId: number;
  pitchId: number;
  amount: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  terms?: unknown;
  currentValue: number;
  documents?: unknown[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Extended fields for UI
  pitchTitle?: string;
  pitchGenre?: string;
  creatorName?: string;
  // String at runtime (ISO date from API); consumers wrap in `new Date(...)`.
  investmentDate?: string;
  returnAmount?: number;
  returnPercentage?: number;
  daysInvested?: number;
}

export interface PortfolioMetrics {
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  returnPercentage: number;
  activeInvestments: number;
  completedInvestments: number;
  roi: number;
  monthlyGrowth?: number;
  quarterlyGrowth?: number;
  ytdGrowth?: number;
}

export interface FundingMetrics {
  totalRaised: number;
  fundingGoal?: number;
  activeInvestors: number;
  averageInvestment: number;
  fundingProgress: number;
  monthlyGrowth?: number;
  recentInvestments?: {
    id: number;
    amount: number;
    investorName: string;
    date: Date;
  }[];
  topInvestor?: {
    name: string;
    amount: number;
  };
}

export interface InvestmentOpportunity {
  id: number;
  title: string;
  logline: string;
  genre: string;
  estimatedBudget: number;
  seekingAmount?: number;
  productionStage: string;
  creator: {
    id: number;
    username: string;
    companyName?: string;
  };
  viewCount: number;
  likeCount: number;
  ratingAverage?: number;
  matchScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  expectedROI?: number;
  timeline?: string;
  publishedAt: Date;
}

// Raw API payload shapes (snake_case + camelCase coexist). Boundary claims that
// keep response member-access typed instead of `any`. See the lint teardown plan.
interface RawPortfolioSummary {
  total_invested?: number; totalInvested?: number;
  portfolio_value?: number; currentValue?: number;
  total_returns?: number; totalReturn?: number;
  average_roi?: number; returnPercentage?: number; roi?: number;
  active_investments?: number; activeInvestments?: number;
  completed_investments?: number; completedInvestments?: number;
  monthly_growth?: number; monthlyGrowth?: number;
  quarterly_growth?: number; quarterlyGrowth?: number;
  ytd_growth?: number; ytdGrowth?: number;
  [key: string]: unknown;
}

interface RawInvestmentRow {
  id?: number;
  investor_id?: number; investorId?: number;
  pitch_id?: number; pitchId?: number;
  amount?: number | string;
  status?: Investment['status'];
  terms?: unknown;
  current_value?: number | string; currentValue?: number | string;
  documents?: unknown[];
  notes?: string;
  created_at?: string; createdAt?: string;
  updated_at?: string; updatedAt?: string;
  pitch_title?: string; pitchTitle?: string;
  genre?: string; pitchGenre?: string;
  creator_name?: string; creatorName?: string;
  invested_at?: string; investmentDate?: string;
  roi_percentage?: number | string; returnPercentage?: number | string;
  [key: string]: unknown;
}

interface InvestmentHistoryResponse {
  investments?: RawInvestmentRow[];
  total?: number;
  totalPages?: number; total_pages?: number;
  currentPage?: number; current_page?: number;
  summary?: {
    totalInvested: number;
    totalCurrentValue: number;
    activeCount: number;
    completedCount: number;
  };
}

export class InvestmentService {
  // Get investor's portfolio summary
  static async getInvestorPortfolio(_investorId?: number): Promise<{
    success: boolean;
    data?: PortfolioMetrics;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<{ summary?: RawPortfolioSummary } & RawPortfolioSummary>('/api/investor/portfolio/summary');
      if (!response.success || !response.data) {
        return {
          success: response.success,
          data: undefined,
          error: response.error?.message
        };
      }

      // Transform snake_case API response to camelCase PortfolioMetrics
      const raw = response.data.summary ?? response.data;
      const data: PortfolioMetrics = {
        totalInvested: raw.total_invested ?? raw.totalInvested ?? 0,
        currentValue: raw.portfolio_value ?? raw.currentValue ?? 0,
        totalReturn: raw.total_returns ?? raw.totalReturn ?? 0,
        returnPercentage: raw.average_roi ?? raw.returnPercentage ?? 0,
        activeInvestments: raw.active_investments ?? raw.activeInvestments ?? 0,
        completedInvestments: raw.completed_investments ?? raw.completedInvestments ?? 0,
        roi: raw.average_roi ?? raw.roi ?? 0,
        monthlyGrowth: raw.monthly_growth ?? raw.monthlyGrowth,
        quarterlyGrowth: raw.quarterly_growth ?? raw.quarterlyGrowth,
        ytdGrowth: raw.ytd_growth ?? raw.ytdGrowth,
      };

      return { success: true, data };
    } catch (error: unknown) {
      console.error('Error fetching investor portfolio:', error);
      return {
        success: false,
        error: 'Failed to fetch portfolio data'
      };
    }
  }

  // Get investor's investment history
  static async getInvestmentHistory(params?: {
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    success: boolean;
    data?: {
      investments: Investment[];
      total: number;
      totalPages: number;
      currentPage: number;
      summary?: {
        totalInvested: number;
        totalCurrentValue: number;
        activeCount: number;
        completedCount: number;
      };
    };
    error?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get<InvestmentHistoryResponse>(`/api/investor/investments?${queryParams.toString()}`);
      if (!response.success || !response.data) {
        return {
          success: response.success,
          data: undefined,
          error: response.error?.message
        };
      }

      // Transform snake_case investment rows to camelCase
      const rawInvestments: RawInvestmentRow[] = response.data.investments ?? [];
      const investments: Investment[] = rawInvestments.map((row): Investment => ({
        id: row.id ?? 0,
        investorId: row.investor_id ?? row.investorId ?? 0,
        pitchId: row.pitch_id ?? row.pitchId ?? 0,
        amount: Number(row.amount) || 0,
        status: row.status ?? 'pending',
        terms: row.terms,
        currentValue: Number(row.current_value ?? row.currentValue ?? row.amount) || 0,
        documents: row.documents,
        notes: row.notes,
        createdAt: row.created_at ?? row.createdAt ?? '',
        updatedAt: row.updated_at ?? row.updatedAt ?? '',
        pitchTitle: row.pitch_title ?? row.pitchTitle,
        pitchGenre: row.genre ?? row.pitchGenre,
        creatorName: row.creator_name ?? row.creatorName,
        investmentDate: row.invested_at ?? row.investmentDate ?? row.created_at ?? row.createdAt,
        returnPercentage: Number(row.roi_percentage ?? row.returnPercentage) || 0,
      }));

      return {
        success: true,
        data: {
          investments,
          total: response.data.total ?? investments.length,
          totalPages: response.data.totalPages ?? response.data.total_pages ?? 1,
          currentPage: response.data.currentPage ?? response.data.current_page ?? 1,
          summary: response.data.summary,
        },
      };
    } catch (error: unknown) {
      console.error('Error fetching investment history:', error);
      return {
        success: false,
        error: 'Failed to fetch investment history'
      };
    }
  }

  // Get investment opportunities for investor
  static async getInvestmentOpportunities(params?: {
    limit?: number;
    genre?: string;
    stage?: string;
    sortBy?: string;
  }): Promise<{
    success: boolean;
    data?: InvestmentOpportunity[];
    error?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.genre) queryParams.append('genre', params.genre);
      if (params?.stage) queryParams.append('stage', params.stage);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);

      const response = await apiClient.get<InvestmentOpportunity[]>(`/api/investor/recommendations?${queryParams.toString()}`);
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error fetching investment opportunities:', error);
      return {
        success: false,
        error: 'Failed to fetch investment opportunities'
      };
    }
  }

  // Get creator's funding overview
  static async getCreatorFunding(_creatorId?: number): Promise<{
    success: boolean;
    data?: FundingMetrics;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<FundingMetrics>('/api/creator/funding/overview');
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error fetching creator funding:', error);
      return {
        success: false,
        error: 'Failed to fetch funding data'
      };
    }
  }

  // Get creator's investor relationships
  static async getCreatorInvestors(_creatorId?: number): Promise<{
    success: boolean;
    data?: {
      investors: Array<{
        id: number;
        name: string;
        totalInvested: number;
        investments: Investment[];
        joinedDate: Date;
      }>;
      totalInvestors: number;
      totalRaised: number;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get<{
        investors: Array<{
          id: number;
          name: string;
          totalInvested: number;
          investments: Investment[];
          joinedDate: Date;
        }>;
        totalInvestors: number;
        totalRaised: number;
      }>('/api/creator/investors');
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error fetching creator investors:', error);
      return {
        success: false,
        error: 'Failed to fetch investor data'
      };
    }
  }

  // Get production company investment metrics
  static async getProductionInvestments(): Promise<{
    success: boolean;
    data?: {
      totalInvestments: number;
      activeDeals: number;
      pipelineValue: number;
      monthlyGrowth: number;
      topOpportunities: InvestmentOpportunity[];
      recentActivity: Array<{
        type: 'investment' | 'opportunity' | 'partnership';
        title: string;
        amount?: number;
        date: Date;
      }>;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get<{
        totalInvestments: number;
        activeDeals: number;
        pipelineValue: number;
        monthlyGrowth: number;
        topOpportunities: InvestmentOpportunity[];
        recentActivity: Array<{
          type: 'investment' | 'opportunity' | 'partnership';
          title: string;
          amount?: number;
          date: Date;
        }>;
      }>('/api/production/investments/overview');
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error fetching production investments:', error);
      return {
        success: false,
        error: 'Failed to fetch production investment data'
      };
    }
  }

  // Create a new investment
  static async createInvestment(data: {
    pitchId: number;
    amount: number;
    terms?: unknown;
  }): Promise<{
    success: boolean;
    data?: Investment;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<Investment>('/api/investments', data);
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error creating investment:', error);
      return {
        success: false,
        error: 'Failed to create investment'
      };
    }
  }

  // Update investment status or details
  static async updateInvestment(investmentId: number, data: {
    status?: string;
    currentValue?: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    data?: Investment;
    error?: string;
  }> {
    try {
      const response = await apiClient.put<Investment>(`/api/investor/investments/${investmentId}`, data);
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error updating investment:', error);
      return {
        success: false,
        error: 'Failed to update investment'
      };
    }
  }

  // Get detailed investment information
  static async getInvestmentDetails(investmentId: number): Promise<{
    success: boolean;
    data?: Investment & {
      pitch: {
        title: string;
        genre: string;
        creator: { name: string; };
      };
      documents: Array<{
        id: number;
        name: string;
        url: string;
        uploadedAt: Date;
      }>;
      timeline: Array<{
        id: number;
        eventType: string;
        description: string;
        date: Date;
      }>;
      roi: number;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get<Investment & {
        pitch: {
          title: string;
          genre: string;
          creator: { name: string; };
        };
        documents: Array<{
          id: number;
          name: string;
          url: string;
          uploadedAt: Date;
        }>;
        timeline: Array<{
          id: number;
          eventType: string;
          description: string;
          date: Date;
        }>;
        roi: number;
      }>(`/api/investor/investments/${investmentId}`);
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error fetching investment details:', error);
      return {
        success: false,
        error: 'Failed to fetch investment details'
      };
    }
  }

  // Calculate portfolio analytics
  static async getPortfolioAnalytics(_investorId?: number): Promise<{
    success: boolean;
    data?: {
      totalROI: number;
      bestPerforming: Investment;
      worstPerforming: Investment;
      diversification: {
        byGenre: Record<string, number>;
        byStage: Record<string, number>;
      };
      monthlyPerformance: Array<{
        month: string;
        value: number;
        change: number;
      }>;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get<{
        totalROI: number;
        bestPerforming: Investment;
        worstPerforming: Investment;
        diversification: {
          byGenre: Record<string, number>;
          byStage: Record<string, number>;
        };
        monthlyPerformance: Array<{
          month: string;
          value: number;
          change: number;
        }>;
      }>('/api/investor/portfolio/performance');
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error fetching portfolio analytics:', error);
      return {
        success: false,
        error: 'Failed to fetch portfolio analytics'
      };
    }
  }

  // Get investment preferences
  static async getInvestmentPreferences(): Promise<{
    success: boolean;
    data?: {
      investmentCriteria: {
        preferredGenres: string[];
        budgetRange: {
          min: number;
          max: number;
          label: string;
        };
        riskTolerance: 'Low' | 'Medium' | 'High';
        minROI: number;
      };
      investmentHistory: {
        totalInvestments: number;
        averageInvestment: number;
        successRate: number;
      };
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get<{
        investmentCriteria: {
          preferredGenres: string[];
          budgetRange: {
            min: number;
            max: number;
            label: string;
          };
          riskTolerance: 'Low' | 'Medium' | 'High';
          minROI: number;
        };
        investmentHistory: {
          totalInvestments: number;
          averageInvestment: number;
          successRate: number;
        };
      }>('/api/investor/preferences');
      return {
        success: response.success,
        data: response.data ?? undefined,
        error: response.error?.message
      };
    } catch (error: unknown) {
      console.error('Error fetching investment preferences:', error);
      return {
        success: false,
        error: 'Failed to fetch investment preferences'
      };
    }
  }
}