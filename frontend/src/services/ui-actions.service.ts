/**
 * UI Actions Service
 * Handles all UI actions that were previously dead-ends
 */

import apiClient from '../lib/api-client';

export class UIActionsService {
  /**
   * Schedule a meeting with calendar integration
   */
  static async scheduleMeeting(data: {
    recipientId: string;
    subject: string;
    proposedTimes?: string[];
    message?: string;
    meetingType: 'pitch' | 'investment' | 'production' | 'demo';
  }) {
    try {
      // Create calendar event
      const response = await apiClient.post<any>('/api/meetings/schedule', {
        ...data,
        duration: 60, // Default 60 minutes
        platform: 'zoom', // Default to Zoom
      });

      // Open calendar integration if available
      if (response.data?.calendarUrl) {
        window.open(response.data.calendarUrl as string, '_blank');
      }

      return {
        success: true,
        meetingId: response.data?.meetingId as string | undefined,
        calendarUrl: response.data?.calendarUrl as string | undefined,
        message: 'Meeting request sent successfully',
      };
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      
      // Fallback to email
      const mailtoLink = `mailto:?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.message || 'I would like to schedule a meeting to discuss further.')}`;
      window.open(mailtoLink);
      
      return {
        success: false,
        error: 'Calendar integration unavailable. Opening email client instead.',
      };
    }
  }

  /**
   * Request a demo of the platform or pitch
   */
  static async requestDemo(data: {
    pitchId?: string;
    requestType: 'platform' | 'pitch';
    name: string;
    email: string;
    company?: string;
    message?: string;
    preferredTime?: string;
  }) {
    try {
      const response = await apiClient.post<any>('/api/demos/request', data);

      // Track the demo request
      if ((window as any).gtag) {
        (window as any).gtag('event', 'demo_requested', {
          type: data.requestType,
          pitch_id: data.pitchId,
        });
      }

      return {
        success: true,
        demoId: response.data?.demoId as string | undefined,
        scheduledTime: response.data?.scheduledTime as string | undefined,
        message: 'Demo request submitted. We\'ll contact you within 24 hours.',
      };
    } catch (error) {
      console.error('Error requesting demo:', error);
      
      return {
        success: false,
        message: 'Failed to submit demo request. Please try again later.',
        offline: true,
      };
    }
  }

  /**
   * Share content on social media
   */
  static async shareContent(data: {
    type: 'pitch' | 'profile' | 'investment';
    id: string;
    platform?: 'twitter' | 'linkedin' | 'facebook' | 'copy';
    title?: string;
    description?: string;
    url?: string;
  }) {
    const shareUrl = data.url || `${window.location.origin}/${data.type}/${data.id}`;
    const shareTitle = data.title || 'Check out this on Pitchey';
    const shareText = data.description || '';

    // Platform-specific sharing
    const shareLinks: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    };

    if (data.platform === 'copy') {
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        return { success: true, message: 'Link copied to clipboard!' };
      } catch (error) {
        return { success: false, error: 'Failed to copy link' };
      }
    } else if (data.platform && shareLinks[data.platform]) {
      // Open social media share dialog
      window.open(shareLinks[data.platform], '_blank', 'width=600,height=400');
      
      // Track share event
      try {
        await apiClient.post('/api/analytics/share', {
          contentType: data.type,
          contentId: data.id,
          platform: data.platform,
        });
      } catch (error) {
        console.error('Failed to track share:', error);
      }
      
      return { success: true, message: `Shared on ${data.platform}` };
    } else {
      // Use native Web Share API if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl,
          });
          return { success: true, message: 'Content shared successfully' };
        } catch (error: unknown) {
          if ((error as any)?.name !== 'AbortError') {
            console.error('Share failed:', error);
          }
          return { success: false, error: 'Share cancelled' };
        }
      } else {
        // Fallback: show share modal with options
        return {
          success: false,
          showModal: true,
          shareUrl,
          shareTitle,
          shareText,
        };
      }
    }
  }

  /**
   * Export data to PDF or CSV
   */
  static async exportData(data: {
    type: 'analytics' | 'report' | 'pitches' | 'investments';
    format: 'pdf' | 'csv' | 'excel';
    filters?: Record<string, any>;
    dateRange?: { start: string; end: string };
  }) {
    try {
      const response = await apiClient.post<Blob>('/api/export', data);

      // Create download link
      const blob = new Blob([response.data as BlobPart], {
        type: data.format === 'pdf' ? 'application/pdf' : 
              data.format === 'csv' ? 'text/csv' : 
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.type}-export-${new Date().toISOString().split('T')[0]}.${data.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, message: 'Export completed successfully' };
    } catch (error) {
      console.error('Export failed:', error);
      
      // Generate client-side fallback for CSV
      if (data.format === 'csv') {
        return this.generateCSVFallback(data);
      }
      
      return { success: false, error: 'Export failed. Please try again.' };
    }
  }

  /**
   * Generate CSV on client-side as fallback
   */
  private static generateCSVFallback(data: any) {
    try {
      // Get data from localStorage or current view
      const exportData = this.getExportDataFromCache(data.type);
      
      if (!exportData || exportData.length === 0) {
        return { success: false, error: 'No data available to export' };
      }

      // Convert to CSV
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') 
              ? `"${value}"` 
              : value;
          }).join(',')
        )
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.type}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      return { success: true, message: 'Data exported successfully' };
    } catch (error) {
      console.error('CSV generation failed:', error);
      return { success: false, error: 'Failed to generate export' };
    }
  }

  /**
   * Get cached data for export
   */
  private static getExportDataFromCache(_type: string): any[] {
    // No client-side cache — data must be fetched from API at export time
    return [];
  }

  /**
   * Enable Two-Factor Authentication
   */
  static async enableTwoFactor(data: {
    method: 'sms' | 'totp' | 'email';
    phoneNumber?: string;
    email?: string;
  }) {
    try {
      // Request 2FA setup
      const response = await apiClient.post<any>('/api/auth/2fa/setup', data);

      if (response.data?.qrCode) {
        // For TOTP, return QR code
        return {
          success: true,
          qrCode: response.data.qrCode as string,
          secret: response.data.secret as string,
          backupCodes: response.data.backupCodes as string[],
        };
      } else {
        // For SMS/Email, verification code sent
        return {
          success: true,
          message: `Verification code sent to ${data.method === 'sms' ? 'phone' : 'email'}`,
          verificationRequired: true,
        };
      }
    } catch (error) {
      console.error('2FA setup failed:', error);
      return {
        success: false,
        error: '2FA setup failed. Please try again.',
      };
    }
  }

  /**
   * Verify 2FA code
   */
  static async verifyTwoFactor(code: string) {
    try {
      const response = await apiClient.post<any>('/api/auth/2fa/verify', { code });

      return response.data;
    } catch (error) {
      return {
        success: false,
        error: 'Invalid verification code',
      };
    }
  }

  /**
   * Start verification process for verified badge
   */
  static async startVerification(data: {
    type: 'creator' | 'investor' | 'production';
    documents?: File[];
    socialProfiles?: { platform: string; url: string }[];
    companyInfo?: {
      name: string;
      website?: string;
      taxId?: string;
    };
  }) {
    try {
      const formData = new FormData();
      formData.append('type', data.type);
      
      // Add documents
      if (data.documents) {
        data.documents.forEach(doc => {
          formData.append('documents', doc);
        });
      }
      
      // Add other data
      if (data.socialProfiles) {
        formData.append('socialProfiles', JSON.stringify(data.socialProfiles));
      }
      if (data.companyInfo) {
        formData.append('companyInfo', JSON.stringify(data.companyInfo));
      }

      const response = await apiClient.post<any>('/api/verification/start', formData);

      return {
        success: true,
        verificationId: response.data?.verificationId as string | undefined,
        status: response.data?.status as string | undefined,
        message: 'Verification process started. We\'ll review your submission within 48 hours.',
      };
    } catch (error) {
      console.error('Verification failed:', error);
      return {
        success: false,
        error: 'Failed to start verification process',
      };
    }
  }

  /**
   * Perform bulk actions on multiple items
   */
  static async performBulkAction(data: {
    type: 'nda' | 'pitch' | 'investment' | 'message';
    action: 'approve' | 'reject' | 'delete' | 'archive' | 'export';
    ids: string[];
    reason?: string;
  }) {
    try {
      const response = await apiClient.post<any>(`/api/${data.type}/bulk`, {
        action: data.action,
        ids: data.ids,
        reason: data.reason,
      });

      return {
        success: true,
        processed: (response.data?.processed as number) || data.ids.length,
        failed: (response.data?.failed as any[]) || [],
        message: `${(response.data?.processed as number) || data.ids.length} items processed successfully`,
      };
    } catch (error) {
      console.error('Bulk action failed:', error);
      
      // Process individually as fallback
      const results = await this.processBulkIndividually(data);
      return results;
    }
  }

  /**
   * Process bulk actions individually as fallback
   */
  private static async processBulkIndividually(data: any) {
    const results: { success: string[]; failed: string[] } = {
      success: [],
      failed: [],
    };

    for (const id of data.ids) {
      try {
        await apiClient.post(`/api/${data.type}/${id}/${data.action}`, {
          reason: data.reason,
        });
        results.success.push(id as string);
      } catch (error) {
        results.failed.push(id as string);
      }
    }

    return {
      success: results.success.length > 0,
      processed: results.success.length,
      failed: results.failed,
      message: `Processed ${results.success.length} of ${data.ids.length} items`,
    };
  }

  /**
   * Reorder items using drag and drop
   */
  static async reorderItems(data: {
    type: 'pipeline' | 'playlist' | 'gallery';
    items: { id: string; position: number }[];
  }) {
    try {
      const response = await apiClient.post(`/api/${data.type}/reorder`, {
        items: data.items,
      });

      return {
        success: true,
        message: 'Order updated successfully',
      };
    } catch (error) {
      console.error('Reorder failed:', error);
      
      // Save order locally
      localStorage.setItem(`${data.type}_order`, JSON.stringify(data.items));
      
      return {
        success: false,
        message: 'Failed to save order. Please try again.',
        offline: true,
      };
    }
  }

  /**
   * Add payment method via Stripe
   */
  static async addPaymentMethod(data: {
    type: 'card' | 'bank' | 'paypal';
    token?: string;
    returnUrl?: string;
  }) {
    try {
      const response = await apiClient.post<any>('/api/payments/methods/add', data);

      if (response.data?.setupUrl) {
        // Redirect to Stripe setup
        window.location.href = response.data.setupUrl as string;
      } else if (response.data?.clientSecret) {
        // Return client secret for Stripe Elements
        return {
          success: true,
          clientSecret: response.data.clientSecret as string,
          requiresAction: true,
        };
      } else {
        return {
          success: true,
          paymentMethodId: response.data?.paymentMethodId as string | undefined,
          message: 'Payment method added successfully',
        };
      }
    } catch (error) {
      console.error('Failed to add payment method:', error);
      return {
        success: false,
        error: 'Failed to add payment method. Please try again.',
      };
    }
  }
}

export default UIActionsService;