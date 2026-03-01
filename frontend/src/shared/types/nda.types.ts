// NDA Types - Enhanced type definitions for NDA workflow
import type { User, Pitch } from './api';

export type NDStatus = 'pending' | 'approved' | 'rejected' | 'signed' | 'expired' | 'revoked';
export type NDAType = 'basic' | 'enhanced' | 'custom';

export interface NDARequest {
  id: number;
  pitchId: number;
  requesterId: number;
  ownerId: number;
  ndaType: string;
  status: NDStatus;
  requestMessage?: string;
  rejectionReason?: string;
  companyInfo?: {
    name?: string;
    website?: string;
    description?: string;
    address?: string;
  };
  requestedAt: string;
  respondedAt?: string;
  expiresAt?: string;
  
  // Related data from joins
  requester?: User;
  owner?: User;
  pitch?: Pitch;
}

export interface NDA {
  id: number;
  pitchId: number;
  userId: number; // NDA creator (pitch owner)
  signerId: number; // NDA signer
  ndaType: string;
  status: NDStatus;
  documentUrl?: string;
  signedDocumentUrl?: string;
  customNdaText?: string;
  customNdaUrl?: string; // For uploaded custom NDAs
  requestMessage?: string;
  rejectionReason?: string;
  signedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Related data from joins
  requester?: User;
  signer?: User;
  pitch?: Pitch;
  pitchOwner?: User; // For display purposes
  accessGranted?: boolean; // Computed field
}

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
  customNdaFile?: File; // For uploading custom NDA documents
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
  status?: NDStatus;
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
  recent?: {
    requests: number;
    approvals: number;
    approvalRate: number;
  };
}

export interface NDADashboardData {
  stats: NDAStats;
  recentNDAs: NDA[];
  pendingRequests?: NDARequest[];
  signedNDAs?: NDA[];
}

export interface NDAWorkflowState {
  step: 'request' | 'pending' | 'review' | 'signed' | 'active' | 'rejected';
  canProgress: boolean;
  nextAction?: string;
  actionBy?: 'requester' | 'owner';
}

export interface UploadedNDAFile {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

// Utility types for API responses
export interface NDARequestResponse {
  ndaRequests: NDARequest[];
  total: number;
}

export interface NDAResponse {
  ndas: NDA[];
  total: number;
}

export interface NDAStatusCheck {
  hasNDA: boolean;
  nda?: NDA;
  canAccess: boolean;
  error?: string;
}

export interface NDARequestEligibility {
  canRequest: boolean;
  reason?: string;
  existingNDA?: NDA;
  error?: string;
}

// Form validation types
export interface NDARequestFormData {
  ndaType: 'standard' | 'upload';
  customTerms: string;
  customNdaFile?: File;
  acceptTerms: boolean;
}

export interface NDAApprovalFormData {
  action: 'approve' | 'reject';
  notes?: string;
  reason?: string; // For rejections
}

// Component prop types
export interface NDAModalProps {
  isOpen: boolean;
  onClose: () => void;
  pitchId: number;
  pitchTitle: string;
  creatorType: 'creator' | 'production' | 'investor';
  onNDASigned: () => void;
}

export interface NDADashboardProps {
  userId: number;
  userRole: 'creator' | 'investor' | 'production';
}

export interface NDAStatusProps {
  pitchId: number;
  userId: number;
  userRole: 'creator' | 'investor' | 'production';
  onStatusChange?: (status: NDStatus) => void;
}

// Error types
export interface NDAError {
  code: string;
  message: string;
  details?: unknown;
}