// NDA Service - Complete NDA management
import { apiClient } from '../lib/api-client';
import type {
  NDA,
  NDARequest,
  User
} from '@shared/types/api';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? (isDev ? 'http://localhost:8001' : '');

// Type for NDA data from API response
interface NDAResponseData {
  id: number;
  pitchId: number;
  requesterId?: number;
  signerId?: number;
  ownerId?: number;
  status: string;
  ndaType?: string;
  accessGranted?: boolean;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  signedAt?: string;
  documentUrl?: string;
  customNdaUrl?: string;
  message?: string;
}

// Analytics response type
interface NDAAnalyticsData {
  totalRequests?: number;
  approved?: number;
  rejected?: number;
  pending?: number;
  avgResponseTime?: number;
  trends?: Array<{ date: string; count: number }>;
}

// Export types from centralized types file
export type { NDA, NDARequest } from '@shared/types/api';

export interface NDATemplate {
  id: number;
  name: string;
  description?: string;
  content: string;
  variables?: string[];
  isDefault?: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface NDARequestInput {
  pitchId: number;
  message?: string;
  templateId?: number;
  expiryDays?: number;
}

export interface NDASignature {
  ndaId: number;
  signature: string;
  fullName: string;
  title?: string;
  company?: string;
  acceptTerms: boolean;
}

export interface NDAFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  pitchId?: number;
  requesterId?: number;
  creatorId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface NDAStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  revoked: number;
  avgResponseTime?: number;
  approvalRate?: number;
}

// Transform flat snake_case NDA API response to camelCase NDA type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformNDAFromApi(raw: any): NDA {
  // If already transformed (has camelCase fields), pass through
  if (raw.pitchId !== undefined && raw.createdAt !== undefined && raw.pitch_id === undefined) {
    return raw as NDA;
  }

  return {
    id: raw.id,
    pitchId: raw.pitch_id ?? raw.pitchId,
    userId: raw.pitch_owner_id ?? raw.userId ?? 0,
    signerId: raw.signer_id ?? raw.requester_id ?? raw.signerId ?? 0,
    requesterId: raw.requester_id ?? raw.requesterId,
    ndaType: raw.nda_type ?? raw.ndaType ?? 'basic',
    status: raw.status ?? 'pending',
    documentUrl: raw.document_url ?? raw.documentUrl,
    signedDocumentUrl: raw.signed_document_url ?? raw.signedDocumentUrl,
    customNdaText: raw.custom_nda_text ?? raw.customNdaText,
    customTerms: raw.custom_terms ?? raw.customTerms,
    requestMessage: raw.request_message ?? raw.requestMessage ?? raw.message,
    message: raw.message,
    rejectionReason: raw.rejection_reason ?? raw.rejectionReason,
    signedAt: raw.signed_at ?? raw.signedAt,
    expiresAt: raw.expires_at ?? raw.expiresAt,
    revokedAt: raw.revoked_at ?? raw.revokedAt,
    requestedAt: raw.requested_at ?? raw.requestedAt ?? raw.created_at ?? raw.createdAt,
    respondedAt: raw.responded_at ?? raw.respondedAt,
    accessGranted: raw.access_granted ?? raw.accessGranted,
    notes: raw.notes,
    pitchTitle: raw.pitch_title ?? raw.pitchTitle,
    pitchOwner: raw.creator_username ?? raw.creator_name ?? raw.pitchOwner,
    requesterName: raw.requester_username ?? raw.requester_name ?? raw.requesterName,
    signerName: raw.requester_username ?? raw.signerName,
    creatorName: raw.creator_username ?? raw.creator_name ?? raw.creatorName,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? raw.created_at ?? raw.createdAt ?? '',
  } as unknown as NDA;
}

// Transform flat snake_case NDA request API response to camelCase NDARequest type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformNDARequestFromApi(raw: any): NDARequest {
  // If already transformed, pass through
  if (raw.pitchId !== undefined && raw.requestedAt !== undefined && raw.pitch_id === undefined) {
    return raw as NDARequest;
  }

  return {
    id: raw.id,
    pitchId: raw.pitch_id ?? raw.pitchId,
    requesterId: raw.requester_id ?? raw.signer_id ?? raw.requesterId ?? 0,
    ownerId: raw.owner_id ?? raw.pitch_owner_id ?? raw.ownerId ?? 0,
    ndaType: raw.nda_type ?? raw.ndaType ?? 'basic',
    status: raw.status ?? 'pending',
    requestMessage: raw.request_message ?? raw.requestMessage ?? raw.message,
    rejectionReason: raw.rejection_reason ?? raw.rejectionReason,
    companyInfo: raw.company_info ?? raw.companyInfo,
    requestedAt: raw.requested_at ?? raw.requestedAt ?? raw.created_at ?? raw.createdAt ?? '',
    respondedAt: raw.responded_at ?? raw.respondedAt,
    expiresAt: raw.expires_at ?? raw.expiresAt,
    // Construct nested objects from flat API fields
    requester: raw.requester ?? {
      id: raw.requester_id ?? raw.signer_id ?? 0,
      username: raw.requester_username ?? raw.requester_name ?? '',
      firstName: raw.requester_first_name ?? '',
      lastName: raw.requester_last_name ?? '',
      companyName: raw.requester_company_name ?? '',
      email: raw.requester_email ?? '',
    } as unknown as User,
    owner: raw.owner ?? {
      id: raw.owner_id ?? raw.pitch_owner_id ?? 0,
      username: raw.creator_username ?? raw.creator_name ?? '',
      firstName: raw.creator_first_name ?? '',
      lastName: raw.creator_last_name ?? '',
      companyName: raw.creator_company_name ?? '',
      email: raw.creator_email ?? '',
    } as unknown as User,
    pitch: raw.pitch ?? {
      id: raw.pitch_id ?? raw.pitchId ?? 0,
      title: raw.pitch_title ?? raw.pitchTitle ?? '',
      genre: raw.pitch_genre ?? raw.genre ?? '',
    },
  } as unknown as NDARequest;
}

export class NDAService {
  // Request NDA for a pitch
  static async requestNDA(request: NDARequestInput): Promise<NDA> {
    const response = await apiClient.post<NDAResponseData>(
      '/api/ndas/request',
      request
    );

    if (response.success !== true) {
      // Ensure we always throw an Error with a string message
      // response.error can be either a string or an object with a message property
      let errorMessage = 'Failed to request NDA';

      if (typeof response.error === 'string') {
        errorMessage = response.error;
      } else if (response.error !== null && response.error !== undefined && typeof response.error === 'object' && 'message' in response.error && typeof response.error.message === 'string') {
        errorMessage = response.error.message;
      } else if (response.error !== null && response.error !== undefined && typeof response.error === 'object' && 'code' in response.error && response.error.code === 'INTERNAL_ERROR') {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }

      throw new Error(errorMessage);
    }

    // The API returns the NDA data directly, not nested in an 'nda' property
    // For demo accounts, it returns: { id, status, pitchId, requesterId, ownerId, message, expiresAt, createdAt, success }
    // Map the response to NDA structure
    const ndaData = response.data;

    if (ndaData === undefined || ndaData === null) {
      throw new Error('Invalid response from server');
    }

    return {
      id: ndaData.id,
      pitchId: ndaData.pitchId,
      signerId: ndaData.requesterId, // Map requesterId to signerId for compatibility
      status: ndaData.status,
      ndaType: ndaData.ndaType ?? 'basic',
      accessGranted: ndaData.status === 'approved' || ndaData.accessGranted === true,
      expiresAt: ndaData.expiresAt,
      createdAt: ndaData.createdAt,
      updatedAt: ndaData.updatedAt ?? ndaData.createdAt,
      // Additional fields that may be present
      signedAt: ndaData.signedAt,
      documentUrl: ndaData.documentUrl,
      customNdaUrl: ndaData.customNdaUrl
    } as unknown as NDA;
  }

  // Sign NDA
  static async signNDA(signature: NDASignature): Promise<{
    nda: NDA;
    conversation?: { creatorId: number; creatorName: string; pitchTitle: string };
  }> {
    interface SignNDAResponse {
      nda: NDA;
      conversation?: { creatorId: number; creatorName: string; pitchTitle: string };
    }
    const response = await apiClient.post<SignNDAResponse>(
      `/api/ndas/${signature.ndaId}/sign`,
      signature
    );

    if (response.success !== true || response.data?.nda === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to sign NDA');
    }

    return { nda: response.data.nda, conversation: response.data.conversation };
  }

  // Approve NDA request (for creators)
  static async approveNDA(ndaId: number, notes?: string, customTerms?: string, expiryDays?: number): Promise<NDA> {
    interface ApproveNDAResponse { nda: NDA }
    const response = await apiClient.post<ApproveNDAResponse>(
      `/api/ndas/${ndaId}/approve`,
      { notes, customTerms, expiryDays }
    );

    if (response.success !== true || response.data?.nda === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to approve NDA');
    }

    return response.data.nda;
  }

  // Reject NDA request (for creators)
  static async rejectNDA(ndaId: number, reason: string): Promise<NDA> {
    interface RejectNDAResponse { nda: NDA }
    const response = await apiClient.post<RejectNDAResponse>(
      `/api/ndas/${ndaId}/reject`,
      { reason }
    );

    if (response.success !== true || response.data?.nda === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to reject NDA');
    }

    return response.data.nda;
  }

  // Revoke NDA (for creators)
  static async revokeNDA(ndaId: number, reason?: string): Promise<NDA> {
    interface RevokeNDAResponse { nda: NDA }
    const response = await apiClient.post<RevokeNDAResponse>(
      `/api/ndas/${ndaId}/revoke`,
      { reason }
    );

    if (response.success !== true || response.data?.nda === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to revoke NDA');
    }

    return response.data.nda;
  }

  // Get NDA by ID
  static async getNDAById(ndaId: number): Promise<NDA> {
    interface GetNDAResponse { nda: NDA }
    const response = await apiClient.get<GetNDAResponse>(
      `/api/ndas/${ndaId}`
    );

    if (response.success !== true || response.data?.nda === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'NDA not found');
    }

    return response.data.nda;
  }

  // Get NDAs with filters
  static async getNDAs(filters?: NDAFilters): Promise<{ ndas: NDA[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status !== undefined) params.append('status', filters.status);
    if (filters?.pitchId !== undefined) params.append('pitchId', filters.pitchId.toString());
    if (filters?.requesterId !== undefined) params.append('requesterId', filters.requesterId.toString());
    if (filters?.creatorId !== undefined) params.append('creatorId', filters.creatorId.toString());
    if (filters?.dateFrom !== undefined && filters.dateFrom !== '') params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo !== undefined && filters.dateTo !== '') params.append('dateTo', filters.dateTo);
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

    interface GetNDAsResponse {
      ndas: NDA[];
      total: number;
    }
    const response = await apiClient.get<GetNDAsResponse>(`/api/ndas?${params}`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch NDAs');
    }

    const rawNdas = response.data?.ndas ?? [];
    return {
      ndas: rawNdas.map(transformNDAFromApi),
      total: response.data?.total ?? 0
    };
  }

  // Get NDA status for a pitch with enhanced error handling
  static async getNDAStatus(pitchId: number): Promise<{
    hasNDA: boolean;
    nda?: NDA;
    canAccess: boolean;
    error?: string;
  }> {
    try {
      interface NDAStatusResponse {
        hasNDA: boolean;
        nda?: NDA;
        canAccess: boolean;
      }
      const response = await apiClient.get<NDAStatusResponse>(`/api/ndas/pitch/${pitchId}/status`);

      if (response.success !== true) {
        // Handle specific error cases
        // response.error can be either a string or an object with a message property
        let errorMessage = 'Failed to fetch NDA status';
        let errorStatus: number | undefined;

        if (typeof response.error === 'string') {
          errorMessage = response.error;
        } else if (response.error !== null && response.error !== undefined && typeof response.error === 'object') {
          errorMessage = response.error.message ?? errorMessage;
          errorStatus = response.error.status;
        }

        // Don't throw for business rule violations, return them as part of response
        if (errorStatus === 404 || errorMessage.includes('not found')) {
          return {
            hasNDA: false,
            canAccess: false,
            error: 'No NDA relationship found'
          };
        }

        if (errorStatus === 403 || errorMessage.includes('forbidden')) {
          return {
            hasNDA: false,
            canAccess: false,
            error: 'Access denied'
          };
        }

        // For other errors, include error message but don't throw
        return {
          hasNDA: false,
          canAccess: false,
          error: errorMessage
        };
      }

      return {
        hasNDA: response.data?.hasNDA ?? false,
        nda: response.data?.nda,
        canAccess: response.data?.canAccess ?? false
      };
    } catch (error: unknown) {
      console.error('NDA status check failed:', error);

      // Return error in response instead of throwing
      const errorMessage = error instanceof Error ? error.message : 'Network error while checking NDA status';
      return {
        hasNDA: false,
        canAccess: false,
        error: errorMessage
      };
    }
  }

  // Get NDA history for user
  static async getNDAHistory(userId?: number): Promise<NDA[]> {
    const endpoint = userId !== undefined ? `/api/ndas/history/${userId}` : '/api/ndas/history';
    interface NDAHistoryResponse { ndas: NDA[] }
    const response = await apiClient.get<NDAHistoryResponse>(endpoint);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch NDA history');
    }

    return response.data?.ndas ?? [];
  }

  // Download NDA document
  static async downloadNDA(ndaId: number, signed: boolean = false): Promise<Blob> {
    const endpoint = signed ? 
      `/api/ndas/${ndaId}/download-signed` : 
      `/api/ndas/${ndaId}/download`;

    try {
      const response = await fetch(
        `${API_BASE_URL}${endpoint}`, {
          method: 'GET',
          credentials: 'include', // Include cookies for Better Auth session
          headers: {
            'Accept': 'application/pdf, application/octet-stream'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to download NDA document: ${response.status} ${errorText}`);
      }

      return response.blob();
    } catch (error) {
      console.error('NDA download failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to download NDA document');
    }
  }

  // Generate NDA preview
  static async generatePreview(pitchId: number, templateId?: number): Promise<string> {
    interface PreviewResponse { preview: string }
    const response = await apiClient.post<PreviewResponse>(
      '/api/ndas/preview',
      { pitchId, templateId }
    );

    if (response.success !== true || response.data?.preview === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to generate NDA preview');
    }

    return response.data.preview;
  }

  // Get NDA templates
  static async getNDATemplates(): Promise<{ templates: NDATemplate[] }> {
    interface TemplatesResponse { templates: NDATemplate[] }
    const response = await apiClient.get<TemplatesResponse>('/api/ndas/templates');

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch NDA templates');
    }

    return {
      templates: response.data?.templates ?? []
    };
  }

  // Legacy method for backward compatibility
  static async getTemplates(): Promise<NDATemplate[]> {
    const result = await this.getNDATemplates();
    return result.templates;
  }

  // Get NDA template by ID
  static async getNDATemplate(templateId: number): Promise<NDATemplate> {
    interface TemplateResponse { template: NDATemplate }
    const response = await apiClient.get<TemplateResponse>(`/api/ndas/templates/${templateId}`);

    if (response.success !== true || response.data?.template === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Template not found');
    }

    return response.data.template;
  }

  // Legacy method for backward compatibility
  static async getTemplateById(templateId: number): Promise<NDATemplate> {
    return this.getNDATemplate(templateId);
  }

  // Create NDA template (for admins/creators)
  static async createNDATemplate(template: Omit<NDATemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<NDATemplate> {
    interface CreateTemplateResponse { template: NDATemplate }
    const response = await apiClient.post<CreateTemplateResponse>(
      '/api/ndas/templates',
      template
    );

    if (response.success !== true || response.data?.template === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to create NDA template');
    }

    return response.data.template;
  }

  // Legacy method for backward compatibility
  static async createTemplate(template: Omit<NDATemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<NDATemplate> {
    return this.createNDATemplate(template);
  }

  // Update NDA template
  static async updateNDATemplate(
    templateId: number,
    updates: Partial<Omit<NDATemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ): Promise<NDATemplate> {
    interface UpdateTemplateResponse { template: NDATemplate }
    const response = await apiClient.put<UpdateTemplateResponse>(
      `/api/ndas/templates/${templateId}`,
      updates
    );

    if (response.success !== true || response.data?.template === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to update NDA template');
    }

    return response.data.template;
  }

  // Legacy method for backward compatibility
  static async updateTemplate(
    templateId: number, 
    updates: Partial<Omit<NDATemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ): Promise<NDATemplate> {
    return this.updateNDATemplate(templateId, updates);
  }

  // Delete NDA template
  static async deleteNDATemplate(templateId: number): Promise<void> {
    const response = await apiClient.delete<void>(`/api/ndas/templates/${templateId}`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to delete NDA template');
    }
  }

  // Legacy method for backward compatibility
  static async deleteTemplate(templateId: number): Promise<void> {
    return this.deleteNDATemplate(templateId);
  }

  // Get NDA statistics
  static async getNDAStats(pitchId?: number): Promise<NDAStats> {
    const endpoint = pitchId !== undefined ? `/api/ndas/stats/${pitchId}` : '/api/ndas/stats';
    interface StatsResponse extends NDAStats { stats?: NDAStats }
    const response = await apiClient.get<StatsResponse>(endpoint);

    if (response.success !== true || response.data === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch NDA statistics');
    }

    // Handle both formats: data.stats (old) and direct data (new)
    return response.data.stats ?? response.data;
  }

  // Get NDA analytics with timeframe
  static async getNDAAnalytics(timeframe: string = '30d', pitchId?: number): Promise<NDAAnalyticsData> {
    const params = new URLSearchParams();
    params.append('timeframe', timeframe);
    if (pitchId !== undefined) params.append('pitchId', pitchId.toString());

    interface AnalyticsResponse extends NDAAnalyticsData { analytics?: NDAAnalyticsData }
    const response = await apiClient.get<AnalyticsResponse>(`/api/ndas/analytics?${params}`);

    if (response.success !== true || response.data === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch NDA analytics');
    }

    return response.data.analytics ?? response.data;
  }

  // Check if user can request NDA for pitch with business rule validation
  static async canRequestNDA(pitchId: number): Promise<{
    canRequest: boolean;
    reason?: string;
    existingNDA?: NDA;
    error?: string;
  }> {
    try {
      interface CanRequestResponse {
        canRequest: boolean;
        reason?: string;
        existingNDA?: NDA;
      }
      const response = await apiClient.get<CanRequestResponse>(`/api/ndas/pitch/${pitchId}/can-request`);

      if (response.success !== true) {
        // Handle business rule violations gracefully
        // response.error can be either a string or an object with a message property
        let errorMessage = 'Failed to check NDA request status';

        if (typeof response.error === 'string') {
          errorMessage = response.error;
        } else if (response.error !== null && response.error !== undefined && typeof response.error === 'object' && 'message' in response.error && typeof response.error.message === 'string') {
          errorMessage = response.error.message;
        }

        return {
          canRequest: false,
          reason: errorMessage,
          error: errorMessage
        };
      }

      return {
        canRequest: response.data?.canRequest ?? false,
        reason: response.data?.reason,
        existingNDA: response.data?.existingNDA
      };
    } catch (error: unknown) {
      console.error('NDA request check failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Network error';
      return {
        canRequest: false,
        reason: 'Unable to verify NDA request eligibility',
        error: errorMessage
      };
    }
  }

  // Bulk approve NDAs (for creators)
  static async bulkApprove(ndaIds: number[]): Promise<{
    successful: number[];
    failed: { id: number; error: string }[]
  }> {
    interface BulkApproveResponse {
      successful: number[];
      failed: { id: number; error: string }[];
    }
    const response = await apiClient.post<BulkApproveResponse>('/api/ndas/bulk-approve', { ndaIds });

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to bulk approve NDAs');
    }

    return {
      successful: response.data?.successful ?? [],
      failed: response.data?.failed ?? []
    };
  }

  // Bulk reject NDAs (for creators)
  static async bulkReject(ndaIds: number[], reason: string): Promise<{
    successful: number[];
    failed: { id: number; error: string }[]
  }> {
    interface BulkRejectResponse {
      successful: number[];
      failed: { id: number; error: string }[];
    }
    const response = await apiClient.post<BulkRejectResponse>('/api/ndas/bulk-reject', { ndaIds, reason });

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to bulk reject NDAs');
    }

    return {
      successful: response.data?.successful ?? [],
      failed: response.data?.failed ?? []
    };
  }

  // Send NDA reminder
  static async sendReminder(ndaId: number): Promise<void> {
    const response = await apiClient.post<void>(
      `/api/ndas/${ndaId}/remind`,
      {}
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to send NDA reminder');
    }
  }

  // Verify NDA signature
  static async verifySignature(ndaId: number): Promise<{
    valid: boolean;
    signedBy?: User;
    signedAt?: string;
  }> {
    interface VerifyResponse {
      valid: boolean;
      signedBy?: User;
      signedAt?: string;
    }
    const response = await apiClient.get<VerifyResponse>(`/api/ndas/${ndaId}/verify`);

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to verify NDA signature');
    }

    return {
      valid: response.data?.valid ?? false,
      signedBy: response.data?.signedBy,
      signedAt: response.data?.signedAt
    };
  }

  // Get active NDAs - NEW ENDPOINT
  static async getActiveNDAs(): Promise<{
    ndaRequests: NDARequest[];
    total: number;
  }> {
    interface ActiveNDAsResponse {
      ndaRequests: NDARequest[];
      total?: number;
    }
    const response = await apiClient.get<ActiveNDAsResponse>('/api/ndas/active');

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch active NDAs');
    }

    const rawRequests = response.data?.ndaRequests ?? [];
    const ndaRequests = rawRequests.map(transformNDARequestFromApi);
    return {
      ndaRequests,
      total: response.data?.total ?? ndaRequests.length
    };
  }

  // Get signed NDAs - NEW ENDPOINT
  static async getSignedNDAs(): Promise<{
    ndaRequests: NDARequest[];
    total: number;
  }> {
    interface SignedNDAsResponse {
      ndaRequests: NDARequest[];
      total?: number;
    }
    const response = await apiClient.get<SignedNDAsResponse>('/api/ndas/signed');

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch signed NDAs');
    }

    const rawRequests = response.data?.ndaRequests ?? [];
    const ndaRequests = rawRequests.map(transformNDARequestFromApi);
    return {
      ndaRequests,
      total: response.data?.total ?? ndaRequests.length
    };
  }

  // Get incoming NDA requests - NEW ENDPOINT
  static async getIncomingRequests(): Promise<{
    ndaRequests: NDARequest[];
    total: number;
  }> {
    interface IncomingRequestsResponse {
      ndaRequests: NDARequest[];
      total?: number;
    }
    const response = await apiClient.get<IncomingRequestsResponse>('/api/ndas/incoming-requests');

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch incoming NDA requests');
    }

    const rawRequests = response.data?.ndaRequests ?? [];
    const ndaRequests = rawRequests.map(transformNDARequestFromApi);
    return {
      ndaRequests,
      total: response.data?.total ?? ndaRequests.length
    };
  }

  // Get outgoing NDA requests - NEW ENDPOINT
  static async getOutgoingRequests(): Promise<{
    ndaRequests: NDARequest[];
    total: number;
  }> {
    interface OutgoingRequestsResponse {
      ndaRequests: NDARequest[];
      total?: number;
    }
    const response = await apiClient.get<OutgoingRequestsResponse>('/api/ndas/outgoing-requests');

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch outgoing NDA requests');
    }

    const rawRequests = response.data?.ndaRequests ?? [];
    const ndaRequests = rawRequests.map(transformNDARequestFromApi);
    return {
      ndaRequests,
      total: response.data?.total ?? ndaRequests.length
    };
  }
}

// Export singleton instance
export const ndaService = NDAService;