const isDev = String(import.meta.env.MODE ?? '') === 'development';
const API_BASE_URL = String(import.meta.env.VITE_API_URL ?? '') || (isDev ? 'http://localhost:8001' : '');

// Helper function to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' })) as { message?: string };
    throw new Error(errorData.message ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export interface DashboardStats {
  totalUsers: number;
  totalPitches: number;
  totalRevenue: number;
  pendingNDAs: number;
  activeUsers: number;
  recentSignups: number;
  approvedPitches: number;
  rejectedPitches: number;
}

export interface RecentActivity {
  id: string;
  type: 'user_signup' | 'pitch_created' | 'nda_signed' | 'payment_received';
  description: string;
  timestamp: string;
  user?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  userType: 'creator' | 'investor' | 'production' | 'admin';
  credits: number;
  status: 'active' | 'banned' | 'suspended';
  createdAt: string;
  lastLogin: string | null;
  pitchCount: number;
  investmentCount: number;
  adminAccess?: boolean;
  adminInvitePending?: boolean;
}

export interface AdminPitch {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  budget: number;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  createdAt: string;
  moderationNotes?: string;
  flaggedReasons?: string[];
  documents?: Array<{
    id: string;
    filename: string;
    type: string;
  }>;
}

export interface AdminTransaction {
  id: string;
  type: 'payment' | 'refund' | 'credit_purchase' | 'subscription' | 'commission';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed';
  user: {
    id: string;
    name: string;
    email: string;
    userType: string;
  };
  description: string;
  paymentMethod?: string;
  stripeTransactionId?: string;
  createdAt: string;
  updatedAt: string;
  refundableAmount?: number;
  metadata?: {
    pitchId?: string;
    pitchTitle?: string;
    subscriptionPlan?: string;
  };
}

export interface SystemSettings {
  maintenance: {
    enabled: boolean;
    message: string;
    scheduledStart?: string;
    scheduledEnd?: string;
  };
  features: {
    userRegistration: boolean;
    pitchSubmission: boolean;
    payments: boolean;
    messaging: boolean;
    ndaWorkflow: boolean;
    realTimeUpdates: boolean;
  };
  limits: {
    maxPitchesPerUser: number;
    maxFileUploadSize: number;
    maxDocumentsPerPitch: number;
    sessionTimeout: number;
  };
  pricing: {
    creditPrices: {
      single: number;
      pack5: number;
      pack10: number;
      pack25: number;
    };
    subscriptionPlans: {
      basic: { monthly: number; yearly: number };
      premium: { monthly: number; yearly: number };
      enterprise: { monthly: number; yearly: number };
    };
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    weeklyDigest: boolean;
  };
  security: {
    enforceStrongPasswords: boolean;
    twoFactorRequired: boolean;
    sessionSecurity: 'normal' | 'strict';
    apiRateLimit: number;
  };
}

export interface UserFilters {
  search?: string;
  userType?: string;
  status?: string;
  sortBy?: 'createdAt' | 'lastLogin' | 'name' | 'credits';
  sortOrder?: 'asc' | 'desc';
}

export interface PitchFilters {
  status?: string;
  genre?: string;
  sortBy?: 'createdAt' | 'title' | 'budget';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilters {
  type?: string;
  status?: string;
  userType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

class AdminService {
  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<DashboardStats>(response);
  }

  async getRecentActivity(): Promise<RecentActivity[]> {
    const response = await fetch(`${API_BASE_URL}/api/admin/moderation-log`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<RecentActivity[]>(response);
  }

  // User Management
  async getUsers(filters: UserFilters = {}): Promise<AdminUser[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/users${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<AdminUser[]>(response);
  }

  async updateUser(userId: string, updates: Partial<AdminUser>): Promise<AdminUser> {
    const response = await fetch(`${API_BASE_URL}/api/admin/user/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
      credentials: 'include'
    });
    return handleResponse<AdminUser>(response);
  }

  // Content Moderation
  async getPitches(filters: PitchFilters = {}): Promise<AdminPitch[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/content${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<AdminPitch[]>(response);
  }

  async approvePitch(pitchId: string, notes?: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/content/${pitchId}/feature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  async rejectPitch(pitchId: string, reason: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/content/${pitchId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  async flagPitch(pitchId: string, reasons: string[], notes: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/flags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  // Transaction Management
  async getTransactions(filters: TransactionFilters = {}): Promise<AdminTransaction[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/reports${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<AdminTransaction[]>(response);
  }

  async processRefund(transactionId: string, amount: number, reason: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/bulk-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund', targetId: transactionId, amount, reason }),
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings> {
    const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<SystemSettings>(response);
  }

  async updateSystemSettings(settings: SystemSettings): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  // Analytics
  async getAnalytics(timeframe: '24h' | '7d' | '30d' | '90d' = '30d'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/admin/analytics?period=${timeframe}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<any>(response);
  }

  // System Health
  async getSystemHealth(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/admin/system/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<any>(response);
  }

  // Bulk Operations
  async bulkUpdateUsers(userIds: string[], updates: Partial<AdminUser>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/bulk-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_users', userIds, updates }),
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  async bulkModeratePitches(pitchIds: string[], action: 'approve' | 'reject' | 'flag', data?: any): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/bulk-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: `moderate_${action}`, pitchIds, data }),
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  // Audit Log
  async getAuditLog(filters: { action?: string; userId?: string; page?: number; limit?: number } = {}): Promise<{ data: any[]; total: number }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/audit/logs${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<{ data: any[]; total: number }>(response);
  }

  async getAuditLogStats(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/audit/statistics`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<any>(response);
  }

  async exportAuditLog(): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/audit/logs/export`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to export audit log');
    return response.blob();
  }

  // GDPR
  async getGDPRMetrics(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/gdpr/metrics`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<any>(response);
  }

  async getGDPRRequests(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/gdpr/requests`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<any[]>(response);
  }

  async createGDPRRequest(data: { userId: string; type: string; details?: string }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/gdpr/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    return handleResponse<any>(response);
  }

  async getConsentMetrics(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/gdpr/consent-metrics`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<any>(response);
  }

  // Reports
  async getReports(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<any[]>(response);
  }

  async generateReport(type: string, filters: Record<string, any> = {}): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, filters }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to generate report');
    return response.blob();
  }

  // Moderation Log
  async getModerationLog(filters: { action?: string; page?: number; limit?: number } = {}): Promise<any[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/admin/moderation-log${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<any[]>(response);
  }

  // Admin Invite
  async inviteAsAdmin(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/invite/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  async revokeAdmin(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/invite/${userId}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    await handleResponse<void>(response);
  }

  async acceptAdminInvite(): Promise<{ adminAccess: boolean; adminInvitePending: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/invite/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<{ adminAccess: boolean; adminInvitePending: boolean }>(response);
  }

  async checkAdminInviteStatus(): Promise<{ adminAccess: boolean; adminInvitePending: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/invite/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    return handleResponse<{ adminAccess: boolean; adminInvitePending: boolean }>(response);
  }

  // Export Data
  async exportUsers(filters: UserFilters = {}): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'users', filters }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to export users');
    }

    return response.blob();
  }

  async exportTransactions(filters: TransactionFilters = {}): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/admin/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'transactions', filters }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to export transactions');
    }

    return response.blob();
  }
}

export const adminService = new AdminService();
