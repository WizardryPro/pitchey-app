/**
 * Robust TypeScript API client with comprehensive error handling for Pitchey v0.2
 * Prevents frontend crashes from malformed JSON responses
 * Features runtime validation with Zod schemas
 */

import { config } from '../config';
import { sessionCache } from '../store/sessionCache';
import { sessionManager } from './session-manager';
import type { 
  ApiResponse, 
  Pitch, 
  User, 
  NDA, 
  Investment, 
  PitchesResponse,
  CreatePitchInput,
  UpdatePitchInput,
  LoginCredentials,
  RegisterData,
  SearchFilters,
  InfoRequest,
  CreateInfoRequestInput,
  RespondToInfoRequestInput,
  InvestorDashboardStats,
  CreatorDashboardStats,
  ProductionDashboardStats
} from '../types/api';
import { 
  ValidatedPitchesResponse,
  ValidatedSinglePitchResponse,
  ValidatedUserResponse,
  safeValidateApiResponse,
  PitchesResponseSchema,
  PitchSchema,
  UserSchema,
  NDASchema,
  InvestmentSchema,
  LoginCredentialsSchema,
  RegisterDataSchema,
  CreatePitchInputSchema,
  UpdatePitchInputSchema
} from '../types/zod-schemas';

// API URL configuration
// In production: Use same-origin via Pages Functions proxy (no cross-origin issues!)
// In development: Use local backend or VITE_API_URL if set
const isDev = import.meta.env.MODE === 'development';

// IMPORTANT: In production, we use '' (empty string) for same-origin requests
// The Pages Functions proxy at /api/* forwards to the backend Worker
// This eliminates all cross-origin cookie/CORS issues!
const API_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

interface TypedApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  cached?: boolean;
}

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private maxRetries: number = 2; // Reduced to prevent excessive retries
  private retryDelay: number = 1000; // 1 second

  // Namespaced localStorage helpers to avoid cross-environment token collisions
  private nsKey(key: string): string {
    try {
      const host = new URL(API_URL).host;
      return `pitchey:${host}:${key}`;
    } catch {
      return `pitchey:${key}`;
    }
  }
  private getItem(key: string): string | null {
    try {
      return localStorage.getItem(this.nsKey(key)) ?? localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  private setItem(key: string, value: string): void {
    try {
      localStorage.setItem(this.nsKey(key), value);
      // keep legacy key for backward compatibility
      localStorage.setItem(key, value);
    } catch {}
  }
  private removeItem(key: string): void {
    try {
      localStorage.removeItem(this.nsKey(key));
      localStorage.removeItem(key);
    } catch {}
  }

  constructor(baseURL?: string) {
    // Lazy initialization to avoid temporal dead zone issues
    this.baseURL = baseURL || this.getBaseURL();
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private getBaseURL(): string {
    try {
      // In production, API_URL is '' for same-origin requests via Pages Functions proxy
      // In development, use localhost or VITE_API_URL
      return API_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:8001';
    } catch (error) {
      console.warn('Config not available during initialization, using fallback URL');
      return import.meta.env.VITE_API_URL ?? 'http://localhost:8001';
    }
  }

  private getAuthToken(): string | null {
    try {
      return this.getItem('authToken');
    } catch (error) {
      console.warn('Failed to get auth token from localStorage:', error);
      return null;
    }
  }

  private getCSRFToken(): string | null {
    try {
      // First try to get from meta tag
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) {
        return metaTag.getAttribute('content');
      }
      
      // Fall back to cookie
      const cookies = document.cookie.split(';').map(c => c.trim());
      const csrfCookie = cookies.find(c => c.startsWith('csrf-token='));
      
      if (csrfCookie) {
        return csrfCookie.split('=')[1];
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to get CSRF token:', error);
      return null;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async safeJsonParse(text: string): Promise<unknown> {
    try {
      if (!text || text.trim() === '') {
        return { error: 'Empty response body' };
      }
      return JSON.parse(text);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('JSON parse error:', error);
      console.error('Response text:', text);
      return {
        error: 'Invalid JSON response',
        details: {
          parseError: errorMessage,
          responseText: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        }
      };
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<TypedApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const token = this.getAuthToken();
      
      const headers: Record<string, string> = {
        ...this.defaultHeaders,
        ...(options.headers as Record<string, string> || {}),
      };

      // CRITICAL: Better Auth uses session cookies, not JWT tokens
      // Only add Authorization header if token exists (for backward compatibility)
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Add CSRF token for mutation methods
      const method = options.method?.toUpperCase() || 'GET';
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const csrfToken = this.getCSRFToken();
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
      }

      const fetchOptions: RequestInit = {
        ...options,
        headers,
        credentials: 'include', // Enable cookies for all requests
      };

      
      const response = await fetch(url, fetchOptions);
      
      // Add null checking for response
      if (!response) {
        console.error('Fetch returned null response');
        return {
          success: false,
          error: {
            message: 'Network request failed - no response received',
            status: 500,
            code: 'NULL_RESPONSE'
          }
        };
      }
      
      const responseText = await response.text();
      
      
      // Handle non-JSON responses
      if (!response.headers.get('content-type')?.includes('application/json')) {
        return {
          success: false,
          error: {
            message: 'Server returned non-JSON response',
            status: response?.status || 500,
            details: {
              contentType: response.headers?.get('content-type') || 'unknown',
              responseText: responseText.substring(0, 200)
            }
          }
        };
      }

      const data = await this.safeJsonParse(responseText) as any;

      // Handle parsing errors
      if (data.error && typeof data.error === 'string' && data.error.includes('Invalid JSON')) {
        return {
          success: false,
          error: {
            message: 'Server response parsing failed',
            status: response?.status || 500,
            code: 'PARSE_ERROR',
            details: data.details
          }
        };
      }

      // Handle HTTP errors
      if (!response.ok) {
        // Handle 401 specifically — clear all auth state so UI stops showing "logged in"
        if (response?.status === 401) {
          try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            localStorage.removeItem('userType');
            sessionCache.clear();
            sessionManager.clearCache();

            // Lazily import the store to avoid circular deps, then clear auth state.
            // This ensures Zustand's isAuthenticated flips to false, which triggers
            // route guards to redirect to login on the next render cycle.
            import('../store/betterAuthStore').then(({ useBetterAuthStore }) => {
              useBetterAuthStore.getState().setUser(null);
            }).catch(() => {});
          } catch (error) {
            console.warn('Failed to handle auth error:', error);
          }
        }

        return {
          success: false,
          error: {
            message: (typeof data.error === 'string' ? data.error : (data.error as any)?.message) || data.message || `HTTP ${response?.status || 'unknown'}: ${response?.statusText || 'unknown'}`,
            status: response?.status || 500,
            code: data.code,
            details: data.details
          }
        };
      }

      // Successful response
      return {
        success: true,
        data: (data.data || data) as T
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Network request failed';
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const errorStack = error instanceof Error ? error.stack?.split('\n')[0] : undefined;
      
      console.error('API request failed:', error);
      
      // Retry logic for network errors
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        await this.delay(this.retryDelay * (retryCount + 1)); // Exponential backoff
        return this.makeRequest<T>(endpoint, options, retryCount + 1);
      }

      return {
        success: false,
        error: {
          message: errorMessage,
          code: 'NETWORK_ERROR',
          details: {
            name: errorName,
            stack: errorStack
          }
        }
      };
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    // DO NOT retry on CORS errors - they will never succeed
    if (error.message?.includes('Failed to fetch') || 
        error.message?.includes('CORS') ||
        error.message?.includes('Cross-Origin') ||
        error.message?.includes('Access-Control')) {
      return false;
    }
    
    // Retry on network errors, timeouts, DNS resolution failures, and server errors (5xx)
    return (
      error.name === 'NetworkError' ||
      error.message?.includes('ERR_NAME_NOT_RESOLVED') ||
      error.message?.includes('getaddrinfo ENOTFOUND') ||
      error.message?.includes('DNS lookup failed') ||
      ('code' in error && (error.code === 'ENOTFOUND' || error.code === 'EAI_NONAME'))
    );
  }

  // HTTP Methods with proper typing
  async get<T>(endpoint: string): Promise<TypedApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  async post<T, D = unknown>(endpoint: string, data?: D): Promise<TypedApiResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest<T>(endpoint, { 
      method: 'POST', 
      body 
    });
  }

  async put<T, D = unknown>(endpoint: string, data?: D): Promise<TypedApiResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest<T>(endpoint, { 
      method: 'PUT', 
      body 
    });
  }

  async delete<T>(endpoint: string, options?: { data?: unknown }): Promise<TypedApiResponse<T>> {
    const body = options?.data ? JSON.stringify(options.data) : undefined;
    return this.makeRequest<T>(endpoint, { 
      method: 'DELETE',
      body 
    });
  }

  async patch<T, D = unknown>(endpoint: string, data?: D): Promise<TypedApiResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest<T>(endpoint, { 
      method: 'PATCH', 
      body 
    });
  }

  // File upload with multipart/form-data
  async uploadFile<T>(endpoint: string, formData: FormData): Promise<TypedApiResponse<T>> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers
    });
  }

  // Validation helper method
  async getValidated<T>(endpoint: string, schema: any): Promise<TypedApiResponse<T>> {
    const response = await this.get<T>(endpoint);
    
    if (response.success && response.data) {
      const validation = safeValidateApiResponse(schema, response);
      if (!validation.success) {
        console.warn('API response validation failed:', validation.error);
        return {
          success: false,
          error: {
            message: 'Invalid response format',
            code: 'VALIDATION_ERROR',
            details: validation.error.issues
          }
        };
      }
      return { ...response, data: validation.data as T | undefined };
    }

    return response;
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Typed NDA-specific API functions
export const ndaAPI = {
  async requestNDA(pitchId: number, data: {
    ndaType?: 'basic' | 'enhanced' | 'custom';
    requestMessage?: string;
    companyInfo?: string;
  }): Promise<TypedApiResponse<NDA>> {
    return apiClient.post<NDA>(`/api/ndas/request`, {
      pitchId,
      ...data
    });
  },

  async getRequests(type: 'incoming' | 'outgoing' = 'outgoing'): Promise<TypedApiResponse<NDA[]>> {
    return apiClient.get<NDA[]>(`/api/ndas/request?type=${type}`);
  },

  async approveRequest(requestId: number): Promise<TypedApiResponse<NDA>> {
    return apiClient.post<NDA>(`/api/ndas/${requestId}/approve`);
  },

  async rejectRequest(requestId: number, rejectionReason?: string): Promise<TypedApiResponse<NDA>> {
    return apiClient.post<NDA>(`/api/ndas/${requestId}/reject`, {
      rejectionReason
    });
  },

  async getSignedNDAs(): Promise<TypedApiResponse<NDA[]>> {
    return apiClient.get<NDA[]>('/api/ndas/signed');
  },

  async getNDAById(ndaId: number): Promise<TypedApiResponse<NDA>> {
    return apiClient.get<NDA>(`/api/ndas/${ndaId}`);
  },

  // NEW ENDPOINTS - Updated to match backend structure
  async getActiveNDAs(): Promise<TypedApiResponse<NDA[]>> {
    return apiClient.get<NDA[]>('/api/ndas/active');
  },

  async getIncomingRequests(): Promise<TypedApiResponse<NDA[]>> {
    return apiClient.get<NDA[]>('/api/ndas/incoming-requests');
  },

  async getOutgoingRequests(): Promise<TypedApiResponse<NDA[]>> {
    return apiClient.get<NDA[]>('/api/ndas/outgoing-requests');
  }
};

// Typed Saved Pitches API functions
interface SavedPitch {
  id: number;
  pitchId: number;
  userId: number;
  notes?: string;
  addedAt: string;
  pitch?: Pitch;
}

interface SavedPitchStats {
  total: number;
  byGenre: Record<string, number>;
  byFormat: Record<string, number>;
}

export const savedPitchesAPI = {
  async getSavedPitches(params?: SearchFilters): Promise<TypedApiResponse<SavedPitch[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.genre) searchParams.append('genre', params.genre);
    if (params?.format) searchParams.append('format', params.format);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/api/saved-pitches?${queryString}` : '/api/saved-pitches';
    
    return apiClient.get<SavedPitch[]>(endpoint);
  },

  async savePitch(pitchId: number, notes?: string): Promise<TypedApiResponse<SavedPitch>> {
    return apiClient.post<SavedPitch>('/api/saved-pitches', {
      pitchId,
      notes
    });
  },

  async unsavePitch(savedPitchId: number): Promise<TypedApiResponse<{ success: boolean }>> {
    return apiClient.delete<{ success: boolean }>(`/api/saved-pitches/${savedPitchId}`);
  },

  async isPitchSaved(pitchId: number): Promise<TypedApiResponse<{ isSaved: boolean; savedPitchId?: number }>> {
    return apiClient.get<{ isSaved: boolean; savedPitchId?: number }>(`/api/saved-pitches/check/${pitchId}`);
  },

  async updateSavedPitchNotes(savedPitchId: number, notes: string): Promise<TypedApiResponse<SavedPitch>> {
    return apiClient.put<SavedPitch>(`/api/saved-pitches/${savedPitchId}`, {
      notes
    });
  },

  async getSavedPitchStats(): Promise<TypedApiResponse<SavedPitchStats>> {
    return apiClient.get<SavedPitchStats>('/api/saved-pitches/stats');
  }
};

// Typed Auth API
interface AuthResponse {
  user: User;
  token?: string;
  message?: string;
}

export const authAPI = {
  async login(email: string, password: string): Promise<TypedApiResponse<AuthResponse>> {
    const credentials: LoginCredentials = { email, password };
    const validation = LoginCredentialsSchema.safeParse(credentials);
    if (!validation.success) {
      return {
        success: false,
        error: {
          message: 'Invalid credentials format',
          code: 'VALIDATION_ERROR',
          details: validation.error.issues
        }
      };
    }
    
    const response = await apiClient.post<AuthResponse>('/api/auth/creator/login', credentials);
    if (response.success && response.data?.token) {
      (apiClient as any).setItem?.('authToken', response.data.token);
    }
    return response;
  },

  async loginCreator(email: string, password: string): Promise<TypedApiResponse<AuthResponse>> {
    const credentials: LoginCredentials = { email, password };
    const response = await apiClient.post<AuthResponse>('/api/auth/creator/login', credentials);
    if (response.success && response.data?.token) {
      (apiClient as any).setItem?.('authToken', response.data.token);
    }
    return response;
  },

  async loginInvestor(email: string, password: string): Promise<TypedApiResponse<AuthResponse>> {
    const credentials: LoginCredentials = { email, password };
    const response = await apiClient.post<AuthResponse>('/api/auth/investor/login', credentials);
    if (response.success && response.data?.token) {
      (apiClient as any).setItem?.('authToken', response.data.token);
    }
    return response;
  },

  async loginProduction(email: string, password: string): Promise<TypedApiResponse<AuthResponse>> {
    const credentials: LoginCredentials = { email, password };
    const response = await apiClient.post<AuthResponse>('/api/auth/production/login', credentials);
    if (response.success && response.data?.token) {
      (apiClient as any).setItem?.('authToken', response.data.token);
    }
    return response;
  },

  async register(data: RegisterData): Promise<TypedApiResponse<AuthResponse>> {
    const validation = RegisterDataSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: {
          message: 'Invalid registration data',
          code: 'VALIDATION_ERROR',
          details: validation.error.issues
        }
      };
    }

    const response = await apiClient.post<AuthResponse>('/api/auth/register', data);
    if (response.success && response.data?.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response;
  },

  async logout(): Promise<TypedApiResponse<{ success: boolean }>> {
    try {
      // Call backend logout endpoint for Better Auth
      const response = await apiClient.post<{ success: boolean }>('/api/auth/sign-out');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('userType');
      return response.success ? response : { success: true, data: { success: true } };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Logout failed' 
        } 
      };
    }
  },

  async getProfile(): Promise<TypedApiResponse<User>> {
    return apiClient.get<User>('/api/user/profile');
  },

  async updateProfile(data: Partial<User>): Promise<TypedApiResponse<User>> {
    return apiClient.put<User>('/api/user/profile', data);
  },

  async getSession(): Promise<TypedApiResponse<{ user: User; session: any }>> {
    return apiClient.get<{ user: User; session: any }>('/api/auth/session');
  }
};

// Typed Pitch API
export const pitchAPI = {
  async getAll(params?: SearchFilters): Promise<TypedApiResponse<PitchesResponse>> {
    const queryString = params 
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([_, value]) => value != null && value !== '')
            .map(([key, value]) => [key, String(value)])
        ).toString()
      : '';
    
    return apiClient.getValidated<PitchesResponse>(`/api/pitches${queryString}`, ValidatedPitchesResponse);
  },

  async getById(id: number): Promise<TypedApiResponse<Pitch>> {
    return apiClient.getValidated<Pitch>(`/api/pitches/${id}`, ValidatedSinglePitchResponse);
  },

  async getPublic(): Promise<TypedApiResponse<PitchesResponse>> {
    return apiClient.getValidated<PitchesResponse>('/api/pitches/public', ValidatedPitchesResponse);
  },

  async getPublicById(id: number): Promise<TypedApiResponse<Pitch>> {
    return apiClient.getValidated<Pitch>(`/api/pitches/public/${id}`, ValidatedSinglePitchResponse);
  },

  async create(data: CreatePitchInput): Promise<TypedApiResponse<Pitch>> {
    const validation = CreatePitchInputSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: {
          message: 'Invalid pitch data',
          code: 'VALIDATION_ERROR',
          details: validation.error.issues
        }
      };
    }

    return apiClient.post<Pitch>('/api/pitches', data);
  },

  async update(id: number, data: UpdatePitchInput): Promise<TypedApiResponse<Pitch>> {
    const validation = UpdatePitchInputSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: {
          message: 'Invalid pitch update data',
          code: 'VALIDATION_ERROR',
          details: validation.error.issues
        }
      };
    }

    return apiClient.put<Pitch>(`/api/pitches/${id}`, data);
  },

  async delete(id: number): Promise<TypedApiResponse<{ success: boolean }>> {
    return apiClient.delete<{ success: boolean }>(`/api/pitches/${id}`);
  },

  async recordView(pitchId: number): Promise<TypedApiResponse<{ viewCount: number }>> {
    return apiClient.post<{ viewCount: number }>('/api/views/track', { pitchId });
  },

  async like(pitchId: number): Promise<TypedApiResponse<{ liked: boolean; likeCount: number }>> {
    return apiClient.post<{ liked: boolean; likeCount: number }>(`/api/creator/pitches/${pitchId}/like`);
  },

  async unlike(pitchId: number): Promise<TypedApiResponse<{ liked: boolean; likeCount: number }>> {
    return apiClient.delete<{ liked: boolean; likeCount: number }>(`/api/creator/pitches/${pitchId}/like`);
  }
};

// Info Request API
export const infoRequestAPI = {
  async create(data: CreateInfoRequestInput): Promise<TypedApiResponse<InfoRequest>> {
    return apiClient.post<InfoRequest>('/api/info-requests', data);
  },

  async getAll(): Promise<TypedApiResponse<{ incoming: InfoRequest[]; outgoing: InfoRequest[] }>> {
    return apiClient.get<{ incoming: InfoRequest[]; outgoing: InfoRequest[] }>('/api/info-requests');
  },

  async respond(data: RespondToInfoRequestInput): Promise<TypedApiResponse<InfoRequest>> {
    return apiClient.post<InfoRequest>(`/api/info-requests/${data.infoRequestId}/respond`, {
      response: data.response
    });
  },

  async close(infoRequestId: number): Promise<TypedApiResponse<InfoRequest>> {
    return apiClient.patch<InfoRequest>(`/api/info-requests/${infoRequestId}`, {
      status: 'closed'
    });
  }
};

// Dashboard API
export const dashboardAPI = {
  async getInvestorStats(): Promise<TypedApiResponse<InvestorDashboardStats>> {
    return apiClient.get<InvestorDashboardStats>('/api/investor/dashboard');
  },

  async getCreatorStats(): Promise<TypedApiResponse<CreatorDashboardStats>> {
    return apiClient.get<CreatorDashboardStats>('/api/creator/dashboard');
  },

  async getProductionStats(): Promise<TypedApiResponse<ProductionDashboardStats>> {
    return apiClient.get<ProductionDashboardStats>('/api/production/dashboard');
  }
};

export { apiClient };
export default apiClient;