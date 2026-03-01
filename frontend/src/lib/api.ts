import axios from 'axios';
import { config } from '../config';

// In production, use '' (empty string) for same-origin requests via Pages Functions proxy
const isDev = import.meta.env.MODE === 'development';
const API_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for all requests
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login for 401 errors on protected routes
    // Don't redirect for public endpoints or certain error scenarios
    const url = error.config?.url || '';
    const isPublicEndpoint = url.includes('/public') || 
                           url.includes('/api/pitches/public') ||
                           url.includes('/api/trending') ||
                           url.includes('/api/search');
    
    // DISABLED: This was causing redirect loops with Better Auth
    // Better Auth handles authentication via cookies, not this interceptor
    // if (error.response?.status === 401 && !isPublicEndpoint) {
    //   localStorage.removeItem('authToken');
    //   window.location.href = '/login';
    // }
    return Promise.reject(error);
  }
);

// Helper to transform pitch data from snake_case (API) to camelCase (frontend)
function transformPitchData(pitch: any): any {
  if (!pitch) return pitch;
  return {
    ...pitch,
    // Map snake_case to camelCase
    userId: pitch.user_id ?? pitch.userId ?? pitch.creator?.id,
    viewCount: pitch.view_count ?? pitch.viewCount ?? 0,
    likeCount: pitch.like_count ?? pitch.likeCount ?? 0,
    views: pitch.view_count ?? pitch.viewCount ?? pitch.views ?? 0,
    likes: pitch.like_count ?? pitch.likeCount ?? pitch.likes ?? 0,
    ndaCount: pitch.nda_count ?? pitch.ndaCount ?? 0,
    createdAt: pitch.created_at ?? pitch.createdAt,
    updatedAt: pitch.updated_at ?? pitch.updatedAt,
    creatorId: pitch.creator_id ?? pitch.creatorId ?? pitch.user_id,
    creatorName: pitch.creator_name ?? pitch.creatorName ?? pitch.creator?.name,
    creatorCompany: pitch.company_name ?? pitch.creatorCompany,
    shortSynopsis: pitch.short_synopsis ?? pitch.shortSynopsis,
    longSynopsis: pitch.long_synopsis ?? pitch.longSynopsis,
    budget: pitch.budget_range ?? pitch.estimated_budget ?? pitch.budget,
    estimatedBudget: pitch.estimated_budget ?? pitch.estimatedBudget,
    productionTimeline: pitch.production_timeline ?? pitch.productionTimeline,
    targetAudience: pitch.target_audience ?? pitch.targetAudience,
    comparableFilms: pitch.comparable_films ?? pitch.comparableFilms,
    budgetBreakdown: pitch.budget_breakdown ?? pitch.budgetBreakdown,
    attachedTalent: pitch.attached_talent ?? pitch.attachedTalent,
    financialProjections: pitch.financial_projections ?? pitch.financialProjections,
    titleImage: pitch.title_image ?? pitch.titleImage,
    thumbnail: pitch.thumbnail_url ?? pitch.title_image ?? pitch.titleImage ?? pitch.thumbnail,
    pitchDeck: pitch.pitch_deck_url ?? pitch.pitchDeck,
    script: pitch.script_url ?? pitch.script,
    trailer: pitch.trailer_url ?? pitch.trailer,
  };
}

export interface User {
  id: number;
  email: string;
  username: string;
  userType: 'creator' | 'production' | 'investor';
  firstName?: string;
  lastName?: string;
  bio?: string;
  profileImage?: string;
  companyName?: string;
  subscriptionTier: string;
  // Production company specific fields (private - for vetting only)
  companyDetails?: {
    registrationNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    companyEmail?: string;
    companyPhone?: string;
    website?: string;
    socials?: {
      linkedin?: string;
      twitter?: string;
      instagram?: string;
      facebook?: string;
    };
    verificationStatus?: 'pending' | 'verified' | 'rejected';
    verifiedAt?: string;
  };
  followingCount?: number;
  followersCount?: number;
}

export interface Pitch {
  id: number;
  userId?: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  formatCategory?: string;
  formatSubtype?: string;
  customFormat?: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  opener?: string;
  premise?: string;
  creator?: {
    id: number;
    username: string;
    userType?: string;
    companyName?: string;
    name?: string;
    profileImage?: string;
  };
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  commentCount?: number;
  shareCount?: number;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  status: string;
  // Media assets
  titleImage?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  lookbookUrl?: string;
  scriptUrl?: string;
  trailerUrl?: string;
  pitchDeckUrl?: string;
  videoUrl?: string;
  additionalVideos?: string[];
  additionalMedia?: any[];
  mediaFiles?: any[];
  // Business/financial
  budget?: any;
  budgetBracket?: string;
  estimatedBudget?: number | string;
  budgetBreakdown?: any;
  budget_breakdown?: any;
  financial_projections?: any;
  revenue_model?: any;
  marketing_strategy?: any;
  distribution_plan?: any;
  attached_talent?: any;
  contact_details?: any;
  private_attachments?: any[];
  targetAudience?: string;
  comparableTitles?: string;
  productionTimeline?: string;
  productionStage?: string;
  attachedTalent?: string;
  distributionStrategy?: string;
  seekingInvestment?: boolean;
  requireNda?: boolean;
  requireNDA?: boolean;
  // Viewer context
  hasSignedNDA?: boolean;
  hasNDA?: boolean;
  ndaStatus?: string;
  isLiked?: boolean;
  canEdit?: boolean;
  isOwner?: boolean;
  isNew?: boolean;
  rating?: number;
  // Tracking
  followersCount?: number;
  isFollowing?: boolean;
  // Characters & themes
  characters?: any;
  themes?: any;
  worldDescription?: string;
  episodeBreakdown?: any;
  visibilitySettings?: any;
  aiUsed?: boolean;
  aiTools?: string[];
  aiDisclosure?: string;
  tags?: string[];
  archived?: boolean;
  metadata?: any;
  // Relations
  ndas?: any[];
  comments?: any[];
  likes?: any[];
}

export interface NDA {
  id: number;
  pitchId: number;
  userId?: number;
  signerId?: number;
  requesterId?: number;
  creatorId?: number;
  ndaType?: string;
  status: string;
  requestedAt?: string;
  respondedAt?: string;
  signedAt?: string;
  expiresAt?: string;
  customTerms?: string;
  requestMessage?: string;
  message?: string;
  rejectionReason?: string;
  documentUrl?: string;
  uploadedNDAUrl?: string;
  accessGranted?: boolean;
  pitchTitle?: string;
  pitchOwner?: string;
  signerName?: string;
  creatorName?: string;
  requesterName?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  // Relations
  pitch?: Pitch;
  user?: User;
  signer?: User;
  requester?: User;
}

export interface Session {
  token: string;
  expiresAt: string;
}

// Auth API
export const authAPI = {
  async register(data: {
    email: string;
    username: string;
    password: string;
    userType: string;
  }) {
    const response = await api.post<{ user: User; session: Session }>(
      '/auth/register',
      data
    );
    localStorage.setItem('authToken', response.data.session.token);
    return response.data;
  },

  async login(email: string, password: string) {
    const response = await api.post<{ user: User; session: Session }>(
      '/auth/login',
      { email, password }
    );
    localStorage.setItem('authToken', response.data.session.token);
    return response.data;
  },

  async loginCreator(email: string, password: string) {
    const response = await api.post<{ success: boolean; data: { token: string; user: User } }>(
      '/api/auth/creator/login',
      { email, password }
    );
    // API returns data nested in data.data
    if (response.data.data?.token) {
      localStorage.setItem('authToken', response.data.data.token);
    }
    if (response.data.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      localStorage.setItem('userType', response.data.data.user.userType);
    }
    return { data: { user: response.data.data?.user } };
  },

  async loginInvestor(email: string, password: string) {
    const response = await api.post<{ success: boolean; data: { token: string; user: User } }>(
      '/api/auth/investor/login',
      { email, password }
    );
    // API returns data nested in data.data
    if (response.data.data?.token) {
      localStorage.setItem('authToken', response.data.data.token);
    }
    if (response.data.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      localStorage.setItem('userType', response.data.data.user.userType);
    }
    return { data: { user: response.data.data?.user } };
  },

  async loginProduction(email: string, password: string) {
    const response = await api.post<{ success: boolean; data: { token: string; user: User } }>(
      '/api/auth/production/login',
      { email, password }
    );
    // API returns data nested in data.data
    if (response.data.data?.token) {
      localStorage.setItem('authToken', response.data.data.token);
    }
    if (response.data.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      localStorage.setItem('userType', response.data.data.user.userType);
    }
    return { data: { user: response.data.data?.user } };
  },

  async logout() {
    try {
      // Call backend logout endpoint to invalidate server-side session
      await api.post('/api/auth/logout', {});
    } catch (error) {
      // Ignore backend errors, still clear local storage
      console.warn('Backend logout failed, proceeding with local cleanup:', error);
    }
    
    // Clear all authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    
    // Clear any other cached data
    localStorage.removeItem('pitchey_websocket_disabled');
    localStorage.removeItem('pitchey_websocket_loop_detected');
    
    // Clear session storage as well
    sessionStorage.clear();
  },

  async getProfile() {
    const response = await api.get<User>('/api/profile');
    return response.data;
  },

  async updateProfile(data: Partial<User>) {
    const response = await api.put<{ message: string; user: User }>(
      '/api/profile',
      data
    );
    return response.data;
  },

  // Password reset methods
  async requestPasswordReset(email: string) {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token: string, newPassword: string) {
    const response = await api.post('/api/auth/reset-password', { token, newPassword });
    return response.data;
  },

  // Email verification methods
  async verifyEmail(token: string) {
    const response = await api.post('/api/auth/verify-email', { token });
    return response.data;
  },

  async resendVerificationEmail(email: string) {
    const response = await api.post('/api/auth/resend-verification', { email });
    return response.data;
  },
};

// Pitch API
export const pitchAPI = {
  async getPublic() {
    const response = await api.get('/api/pitches/public');
    // Handle both current backend format (items) and future expected format (data.pitches)
    return response.data.items || response.data.data?.pitches || [];
  },

  async getPublicById(id: number) {
    const response = await api.get(`/api/pitches/public/${id}`);
    // Axios returns the response in response.data
    // The API structure is { success: true, data: { ...pitchData } }
    // Transform snake_case to camelCase for frontend compatibility
    return transformPitchData(response.data.data);
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    genre?: string;
    format?: string;
    search?: string;
  }) {
    try {
      // Use the public endpoint which is what the marketplace needs
      const response = await api.get('/api/pitches/public', { params });
      
      // Handle various response formats from the backend
      // The backend may return data in different structures
      let pitches = [];
      
      if (response.data) {
        // First check for the actual format: {success: true, data: [...]}
        if (response.data.success && Array.isArray(response.data.data)) {
          pitches = response.data.data;
        } else if (Array.isArray(response.data)) {
          // Direct array response
          pitches = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // Nested data structure
          pitches = response.data.data;
        } else if (response.data.items && Array.isArray(response.data.items)) {
          // Items structure
          pitches = response.data.items;
        } else if (response.data.pitches && Array.isArray(response.data.pitches)) {
          // Pitches structure
          pitches = response.data.pitches;
        }
      }
      
      // Transform each pitch to ensure camelCase fields
      const transformedPitches = Array.isArray(pitches)
        ? pitches.map(transformPitchData)
        : [];

      return transformedPitches;
    } catch (error) {
      console.error('Failed to fetch pitches:', error);
      return [];
    }
  },

  async browse(tab: string, params?: { page?: number; limit?: number }) {
    try {
      const response = await api.get('/api/browse', {
        params: { tab, ...params }
      });

      const data = response.data?.data || response.data;
      const items = data?.items || data?.data || [];

      return {
        items: Array.isArray(items) ? items.map(transformPitchData) : [],
        total: data?.total || 0,
        page: data?.page || 1,
        hasMore: data?.hasMore || false,
        tab: data?.tab || tab
      };
    } catch (error) {
      console.error('Failed to browse pitches:', error);
      return { items: [], total: 0, page: 1, hasMore: false, tab };
    }
  },

  async getById(id: number) {
    const response = await api.get<Pitch>(`/api/pitches/${id}`);
    // Transform snake_case to camelCase
    return transformPitchData(response.data);
  },

  async create(data: {
    title: string;
    logline: string;
    genre: string;
    format: string;
    shortSynopsis?: string;
    longSynopsis?: string;
  }) {
    const response = await api.post<{ success: boolean; data: { data: Pitch } }>('/api/creator/pitches', data);
    return response.data.data.data;
  },

  async update(id: number, data: Partial<Pitch>) {
    const response = await api.put<Pitch>(`/api/pitches/${id}`, data);
    return response.data;
  },

  async delete(id: number) {
    await api.delete(`/api/pitches/${id}`);
  },

  async search(query: string) {
    const response = await api.get<{ results: Pitch[] }>('/api/search', {
      params: { q: query },
    });
    return response.data.results;
  },

  async getTrending() {
    try {
      const response = await api.get<any>('/api/trending');
      const data = response.data;
      // Handle various response formats
      if (Array.isArray(data)) {
        return data as Pitch[];
      } else if (data?.data && Array.isArray(data.data)) {
        return data.data as Pitch[];
      } else if (data?.items && Array.isArray(data.items)) {
        return data.items as Pitch[];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch trending pitches:', error);
      return [];
    }
  },

  async signNDA(pitchId: number, ndaType: 'basic' | 'enhanced' = 'basic') {
    const response = await api.post(`/api/pitches/${pitchId}/nda`, { ndaType });
    return response.data;
  },

  async recordView(pitchId: number) {
    const response = await api.post(`/api/pitches/${pitchId}/view`);
    return response.data;
  },

  async getAnalytics(pitchId: number) {
    const response = await api.get(`/api/pitches/${pitchId}/analytics`);
    return response.data;
  },

  async like(pitchId: number) {
    const response = await api.post(`/api/pitches/${pitchId}/like`);
    return response.data;
  },

  async unlike(pitchId: number) {
    const response = await api.delete(`/api/pitches/${pitchId}/like`);
    return response.data;
  },

  async save(pitchId: number) {
    const response = await api.post(`/api/pitches/${pitchId}/save`);
    return response.data;
  },

  async unsave(pitchId: number) {
    const response = await api.delete(`/api/pitches/${pitchId}/save`);
    return response.data;
  },

  async share(pitchId: number, platform: string, message?: string) {
    const response = await api.post(`/api/pitches/${pitchId}/share`, { platform, message });
    return response.data;
  },

  async requestNDA(pitchId: number, message?: string, requestType?: string) {
    const response = await api.post(`/api/pitches/${pitchId}/request-nda`, { message, requestType });
    return response.data;
  },
};

// NDA API
export const ndaAPI = {
  async requestNDA(pitchId: number, customTerms?: string) {
    const response = await api.post<NDA>(`/api/pitches/${pitchId}/nda/request`, {
      customTerms
    });
    return response.data;
  },

  async signNDA(ndaId: number) {
    const response = await api.post<NDA>(`/api/ndas/${ndaId}/sign`);
    return response.data;
  },

  async uploadNDA(pitchId: number, file: File) {
    const formData = new FormData();
    formData.append('nda', file);
    const response = await api.post<NDA>(`/api/pitches/${pitchId}/nda/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async getMyNDAs() {
    const response = await api.get<NDA[]>('/api/ndas/signed');
    return response.data;
  },

  async getPendingNDAs() {
    const response = await api.get<NDA[]>('/api/ndas/incoming-requests');
    return response.data;
  },
};

export default api;