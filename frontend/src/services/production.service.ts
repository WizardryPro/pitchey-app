// Production Service - Dashboard and production company-specific operations
import { apiClient } from '../lib/api-client';
import type { Pitch, User } from '../types/api';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? (isDev ? 'http://localhost:8001' : '');

// Types for production dashboard data
export interface ProductionStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  inDevelopment: number;
  totalBudget: number;
  pitchesReviewed: number;
  pitchesContracted: number;
  ndaSigned: number;
}

export interface ProductionProject {
  id: number;
  pitchId: number;
  title: string;
  status: 'development' | 'pre-production' | 'production' | 'post-production' | 'completed' | 'on-hold';
  budget: number;
  spentBudget: number;
  startDate: string;
  endDate?: string;
  estimatedEndDate?: string;
  team: {
    role: string;
    name: string;
    email?: string;
  }[];
  milestones: {
    id: number;
    title: string;
    description: string;
    dueDate: string;
    completed: boolean;
    completedAt?: string;
  }[];
  pitch?: Pitch;
  creator?: User;
}

export interface ProductionDeal {
  id: number;
  pitchId: number;
  creatorId: number;
  status: 'negotiating' | 'signed' | 'active' | 'completed' | 'terminated';
  dealType: 'option' | 'purchase' | 'development' | 'production';
  amount: number;
  royaltyPercentage?: number;
  terms: string;
  contractUrl?: string;
  signedAt?: string;
  expiresAt?: string;
  pitch?: Pitch;
  creator?: User;
}

export interface TalentSearch {
  id: number;
  userId: number;
  name: string;
  role: 'director' | 'writer' | 'actor' | 'producer' | 'cinematographer' | 'other';
  experience: string;
  imdbProfile?: string;
  portfolio?: string;
  availability: 'available' | 'busy' | 'upcoming';
  rate?: string;
  user?: User;
}

export interface ProductionCalendarEvent {
  id: number;
  projectId?: number;
  title: string;
  type: 'meeting' | 'shoot' | 'deadline' | 'screening' | 'release' | 'other';
  startDate: string;
  endDate?: string;
  location?: string;
  attendees: string[];
  notes?: string;
  project?: ProductionProject;
}

// API response types
interface DashboardData {
  stats: ProductionStats;
  activeProjects: ProductionProject[];
  recentDeals: ProductionDeal[];
  upcomingEvents: ProductionCalendarEvent[];
  recommendedPitches: Pitch[];
}

interface DashboardResponseData {
  dashboard: DashboardData;
}

interface ProjectsResponseData {
  projects: ProductionProject[];
  total: number;
}

interface ProjectResponseData {
  project: ProductionProject;
}

interface DealsResponseData {
  deals: ProductionDeal[];
  total: number;
}

interface DealResponseData {
  deal: ProductionDeal;
}

interface TalentResponseData {
  talent: TalentSearch[];
  total: number;
}

interface CalendarEventsResponseData {
  events: ProductionCalendarEvent[];
}

interface CalendarEventResponseData {
  event: ProductionCalendarEvent;
}

interface BudgetBreakdown {
  total: number;
  spent: number;
  remaining: number;
  categories: Array<{
    category: string;
    allocated: number;
    spent: number;
    percentage: number;
  }>;
  timeline: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
}

interface BudgetResponseData {
  budget: BudgetBreakdown;
}

interface AnalyticsData {
  projectPerformance: Array<{
    project: string;
    budget: number;
    spent: number;
    progress: number;
    onSchedule: boolean;
  }>;
  genreDistribution: Array<{
    genre: string;
    count: number;
    avgBudget: number;
    avgROI: number;
  }>;
  dealConversionRate: number;
  avgProductionTime: number;
  successRate: number;
}

interface AnalyticsResponseData {
  analytics: AnalyticsData;
}

interface DistributionChannel {
  id: number;
  platform: string;
  status: 'negotiating' | 'signed' | 'live' | 'ended';
  terms: string;
  revenue: number;
  releaseDate?: string;
}

interface DistributionResponseData {
  channels: DistributionChannel[];
}

// Types for production pitch data (notes, checklist, team)
export interface ProductionNoteResponse {
  id: number;
  content: string;
  category: 'casting' | 'location' | 'budget' | 'schedule' | 'team' | 'general';
  author: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionTeamMember {
  role: string;
  name: string;
  status: 'confirmed' | 'pending' | 'considering';
}

// Helper function to extract error message
function getErrorMessage(error: { message: string } | string | undefined, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    return error.message;
  }
  return error ?? fallback;
}

export class ProductionService {
  // Get production dashboard
  static async getDashboard(): Promise<DashboardData> {
    const response = await apiClient.get<DashboardResponseData>('/api/production/dashboard');

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch dashboard'));
    }

    return response.data?.dashboard ?? {
      stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        inDevelopment: 0,
        totalBudget: 0,
        pitchesReviewed: 0,
        pitchesContracted: 0,
        ndaSigned: 0
      },
      activeProjects: [],
      recentDeals: [],
      upcomingEvents: [],
      recommendedPitches: []
    };
  }

  // Get all projects
  static async getProjects(filters?: {
    status?: string;
    sortBy?: 'startDate' | 'budget' | 'title';
    limit?: number;
    offset?: number;
  }): Promise<{ projects: ProductionProject[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status !== undefined && filters.status !== '') params.append('status', filters.status);
    if (filters?.sortBy && (filters.sortBy === 'title' || filters.sortBy === 'budget' || filters.sortBy === 'startDate')) params.append('sortBy', filters.sortBy);
    if (filters?.limit !== undefined && filters.limit !== 0) params.append('limit', filters.limit.toString());
    if (filters?.offset !== undefined && filters.offset !== 0) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<ProjectsResponseData>(
      `/api/production/projects?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch projects'));
    }

    return {
      projects: response.data?.projects ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Create new project from pitch
  static async createProject(data: {
    pitchId: number;
    budget: number;
    startDate: string;
    estimatedEndDate?: string;
    team?: Array<{ role: string; name: string; email?: string }>;
  }): Promise<ProductionProject> {
    const response = await apiClient.post<ProjectResponseData>(
      '/api/production/projects',
      data
    );

    if (response.success !== true || response.data?.project === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to create project'));
    }

    return response.data.project;
  }

  // Update project
  static async updateProject(projectId: number, updates: Partial<ProductionProject>): Promise<ProductionProject> {
    const response = await apiClient.put<ProjectResponseData>(
      `/api/production/projects/${projectId.toString()}`,
      updates
    );

    if (response.success !== true || response.data?.project === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to update project'));
    }

    return response.data.project;
  }

  // Get deals
  static async getDeals(filters?: {
    status?: string;
    creatorId?: number;
    sortBy?: 'signedAt' | 'amount' | 'expiresAt';
  }): Promise<{ deals: ProductionDeal[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status !== undefined && filters.status !== '') params.append('status', filters.status);
    if (filters?.creatorId !== undefined && filters.creatorId !== 0) params.append('creatorId', filters.creatorId.toString());
    if (filters?.sortBy && (filters.sortBy === 'signedAt' || filters.sortBy === 'amount' || filters.sortBy === 'expiresAt')) params.append('sortBy', filters.sortBy);

    const response = await apiClient.get<DealsResponseData>(
      `/api/production/deals?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch deals'));
    }

    return {
      deals: response.data?.deals ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Propose deal
  static async proposeDeal(data: {
    pitchId: number;
    dealType: 'option' | 'purchase' | 'development' | 'production';
    amount: number;
    royaltyPercentage?: number;
    terms: string;
    expiresAt?: string;
  }): Promise<ProductionDeal> {
    const response = await apiClient.post<DealResponseData>(
      '/api/production/deals',
      data
    );

    if (response.success !== true || response.data?.deal === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to propose deal'));
    }

    return response.data.deal;
  }

  // Search for talent
  static async searchTalent(filters?: {
    role?: string;
    availability?: string;
    maxRate?: number;
    experience?: string;
    search?: string;
  }): Promise<{ talent: TalentSearch[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.role !== undefined && filters.role !== '') params.append('role', filters.role);
    if (filters?.availability !== undefined && filters.availability !== '') params.append('availability', filters.availability);
    if (filters?.maxRate !== undefined && filters.maxRate !== 0) params.append('maxRate', filters.maxRate.toString());
    if (filters?.experience !== undefined && filters.experience !== '') params.append('experience', filters.experience);
    if (filters?.search !== undefined && filters.search !== '') params.append('search', filters.search);

    const response = await apiClient.get<TalentResponseData>(
      `/api/production/talent/search?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to search talent'));
    }

    return {
      talent: response.data?.talent ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Get calendar events
  static async getCalendarEvents(options?: {
    startDate?: string;
    endDate?: string;
    projectId?: number;
    type?: string;
  }): Promise<ProductionCalendarEvent[]> {
    const params = new URLSearchParams();
    if (options?.startDate !== undefined && options.startDate !== '') params.append('startDate', options.startDate);
    if (options?.endDate !== undefined && options.endDate !== '') params.append('endDate', options.endDate);
    if (options?.projectId !== undefined && options.projectId !== 0) params.append('projectId', options.projectId.toString());
    if (options?.type !== undefined && options.type !== '') params.append('type', options.type);

    const response = await apiClient.get<CalendarEventsResponseData>(
      `/api/production/calendar?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch calendar events'));
    }

    return response.data?.events ?? [];
  }

  // Create calendar event
  static async createCalendarEvent(event: Omit<ProductionCalendarEvent, 'id'>): Promise<ProductionCalendarEvent> {
    const response = await apiClient.post<CalendarEventResponseData>(
      '/api/production/calendar',
      event
    );

    if (response.success !== true || response.data?.event === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to create event'));
    }

    return response.data.event;
  }

  // Get budget breakdown
  static async getBudgetBreakdown(projectId: number): Promise<BudgetBreakdown> {
    const response = await apiClient.get<BudgetResponseData>(
      `/api/production/budget/${projectId.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch budget breakdown'));
    }

    return response.data?.budget ?? {
      total: 0,
      spent: 0,
      remaining: 0,
      categories: [],
      timeline: []
    };
  }

  // Submit milestone update
  static async updateMilestone(projectId: number, milestoneId: number, data: {
    completed?: boolean;
    notes?: string;
  }): Promise<void> {
    const response = await apiClient.put<Record<string, unknown>>(
      `/api/production/projects/${projectId.toString()}/milestones/${milestoneId.toString()}`,
      data
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to update milestone'));
    }
  }

  // Get production analytics
  static async getAnalytics(period?: 'month' | 'quarter' | 'year'): Promise<AnalyticsData> {
    const params = new URLSearchParams();
    if (period !== undefined) params.append('period', period);

    const response = await apiClient.get<AnalyticsResponseData>(
      `/api/production/analytics?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch analytics'));
    }

    return response.data?.analytics ?? {
      projectPerformance: [],
      genreDistribution: [],
      dealConversionRate: 0,
      avgProductionTime: 0,
      successRate: 0
    };
  }

  // Generate contract
  static async generateContract(dealId: number, template?: string): Promise<Blob> {
    const templateParam = template ?? 'standard';
    const response = await fetch(
      `${API_BASE_URL}/api/production/deals/${dealId.toString()}/contract?template=${templateParam}`,
      {
        credentials: 'include'
      }
    );

    if (!response.ok) {
      throw new Error('Failed to generate contract');
    }

    return response.blob();
  }

  // Get distribution channels
  static async getDistributionChannels(projectId: number): Promise<DistributionChannel[]> {
    const response = await apiClient.get<DistributionResponseData>(
      `/api/production/projects/${projectId.toString()}/distribution`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch distribution channels'));
    }

    return response.data?.channels ?? [];
  }

  // Export project data
  static async exportProjectData(projectId: number, format: 'pdf' | 'excel'): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/api/production/projects/${projectId.toString()}/export?format=${format}`,
      {
        credentials: 'include'
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export project data');
    }

    return response.blob();
  }

  // Get revenue data
  static async getRevenue(): Promise<Record<string, unknown>> {
    const response = await apiClient.get<Record<string, unknown>>('/api/production/revenue');
    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch revenue data'));
    }
    return response.data ?? {};
  }

  // --- Production Pitch Data (notes, checklist, team) ---

  static async getPitchNotes(pitchId: number): Promise<ProductionNoteResponse[]> {
    const response = await apiClient.get<{ notes: ProductionNoteResponse[] }>(
      `/api/production/pitches/${pitchId}/notes`
    );
    return response.data?.notes ?? [];
  }

  static async createPitchNote(pitchId: number, data: {
    content: string;
    category: string;
    author?: string;
  }): Promise<ProductionNoteResponse> {
    const response = await apiClient.post<{ note: ProductionNoteResponse }>(
      `/api/production/pitches/${pitchId}/notes`,
      data
    );
    if (response.success !== true || !response.data?.note) {
      throw new Error(getErrorMessage(response.error, 'Failed to create note'));
    }
    return response.data.note;
  }

  static async deletePitchNote(pitchId: number, noteId: number): Promise<void> {
    const response = await apiClient.delete<Record<string, unknown>>(
      `/api/production/pitches/${pitchId}/notes/${noteId}`
    );
    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to delete note'));
    }
  }

  static async getPitchChecklist(pitchId: number): Promise<Record<string, boolean>> {
    const response = await apiClient.get<{ checklist: Record<string, boolean> }>(
      `/api/production/pitches/${pitchId}/checklist`
    );
    return response.data?.checklist ?? {};
  }

  static async updatePitchChecklist(pitchId: number, checklist: Record<string, boolean>): Promise<void> {
    await apiClient.put<Record<string, unknown>>(
      `/api/production/pitches/${pitchId}/checklist`,
      { checklist }
    );
  }

  static async getPitchTeam(pitchId: number): Promise<ProductionTeamMember[]> {
    const response = await apiClient.get<{ team: ProductionTeamMember[] }>(
      `/api/production/pitches/${pitchId}/team`
    );
    return response.data?.team ?? [];
  }

  static async updatePitchTeam(pitchId: number, team: ProductionTeamMember[]): Promise<void> {
    await apiClient.put<Record<string, unknown>>(
      `/api/production/pitches/${pitchId}/team`,
      { team }
    );
  }
}

// Export singleton instance
export const productionService = ProductionService;
