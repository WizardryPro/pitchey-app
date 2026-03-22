// NDA Service with comprehensive notification workflows
import { db } from '../db/client.ts';
import { z } from 'zod';
import { sendNDARequestEmail, sendNDAResponseEmail } from './email/index.ts';
import type { NotificationService } from './notification.service.ts';

// Validation schemas
const createNDARequestSchema = z.object({
  pitchId: z.number(),
  requesterId: z.number(),
  ndaType: z.enum(['basic', 'enhanced', 'custom']).default('basic'),
  requestMessage: z.string().optional(),
  companyInfo: z.object({
    companyName: z.string(),
    position: z.string(),
    intendedUse: z.string(),
  }).optional(),
});

const signNDASchema = z.object({
  pitchId: z.number(),
  signerId: z.number(),
  ndaType: z.enum(['basic', 'enhanced', 'custom']),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  signatureData: z.any().optional(),
  customNdaUrl: z.string().optional(),
});

export class NDAService {
  private static notificationService: NotificationService | null = null;

  // Initialize notification service
  static setNotificationService(notificationService: NotificationService): void {
    this.notificationService = notificationService;
  }

  // Create NDA request with comprehensive notifications
  static async createRequest(data: z.infer<typeof createNDARequestSchema>) {
    try {
      console.log("NDA Request data received:", data);
      const validatedData = createNDARequestSchema.parse(data);
      console.log("NDA Request data validated:", validatedData);
      
      // Get the pitch owner
      const pitchResult = await db.execute(
        'SELECT id, user_id, title FROM pitches WHERE id = $1 LIMIT 1',
        [validatedData.pitchId]
      );
      
      if (!pitchResult.rows || pitchResult.rows.length === 0) {
        throw new Error('Pitch not found');
      }
      
      const pitch = pitchResult.rows[0];
      
      // Check if an active request already exists
      const existingRequestResult = await db.execute(
        'SELECT id FROM nda_requests WHERE pitch_id = $1 AND requester_id = $2 AND status = $3 LIMIT 1',
        [validatedData.pitchId, validatedData.requesterId, 'pending']
      );
      
      if (existingRequestResult.rows && existingRequestResult.rows.length > 0) {
        throw new Error('An NDA request is already pending for this pitch');
      }
      
      // Create new NDA request
      const newRequestResult = await db.execute(
        `INSERT INTO nda_requests (pitch_id, requester_id, owner_id, nda_type, request_message, company_info, status, requested_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          validatedData.pitchId,
          validatedData.requesterId,
          pitch.user_id,
          validatedData.ndaType,
          validatedData.requestMessage,
          validatedData.companyInfo ? JSON.stringify(validatedData.companyInfo) : null,
          'pending',
          new Date()
        ]
      );
      
      const newRequest = newRequestResult.rows[0];
      
      // Send comprehensive notifications
      if (this.notificationService) {
        // Send immediate notification to pitch owner
        await this.notificationService.sendNotification({
          userId: pitch.user_id,
          type: 'nda_request',
          title: 'New NDA Request',
          message: `You have received a new NDA request for "${pitch.title}". Click to review the details and approve or reject the request.`,
          priority: 'high',
          relatedPitchId: validatedData.pitchId,
          relatedUserId: validatedData.requesterId,
          relatedNdaRequestId: newRequest.id,
          actionUrl: `/creator/nda-requests/${newRequest.id}`,
          channels: {
            email: true,
            inApp: true,
            push: true
          },
          emailOptions: {
            templateType: 'ndaRequest',
            variables: {
              pitchTitle: pitch.title,
              requesterName: 'Investor', // Will be populated from user data
              requestMessage: validatedData.requestMessage,
              actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/creator/nda-requests/${newRequest.id}`
            }
          }
        });

        // Schedule reminder notification if not responded to within 7 days
        await this.scheduleNDAReminder(newRequest.id, pitch.user_id, pitch.title, 7);
      } else {
        // Fallback to legacy notification creation
        await db.execute(
          `INSERT INTO notifications (user_id, type, title, message, related_pitch_id, related_user_id, related_nda_request_id, action_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            pitch.user_id,
            'nda_request',
            'New NDA Request',
            `You have a new NDA request for "${pitch.title}"`,
            validatedData.pitchId,
            validatedData.requesterId,
            newRequest.id,
            `/creator/nda-requests/${newRequest.id}`
          ]
        );
      }
      
      // Send email notification to pitch owner
      try {
        const pitchOwnerResult = await db.execute(
          'SELECT id, email, first_name, username FROM users WHERE id = $1 LIMIT 1',
          [pitch.user_id]
        );
        
        const requesterInfoResult = await db.execute(
          'SELECT id, email, first_name, last_name, username FROM users WHERE id = $1 LIMIT 1',
          [validatedData.requesterId]
        );
        
        if (pitchOwnerResult.rows[0] && requesterInfoResult.rows[0]) {
          const pitchOwner = pitchOwnerResult.rows[0];
          const requesterInfo = requesterInfoResult.rows[0];
          
          await sendNDARequestEmail(pitchOwner.email, {
            recipientName: pitchOwner.first_name || pitchOwner.username,
            senderName: requesterInfo.first_name ? `${requesterInfo.first_name} ${requesterInfo.last_name || ''}`.trim() : requesterInfo.username,
            pitchTitle: pitch.title,
            requestMessage: validatedData.requestMessage,
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/creator/nda-requests/${newRequest.id}`,
            unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/notifications`
          });
        }
      } catch (emailError: any) {
        console.error('Failed to send NDA request email:', emailError);
        // Continue execution even if email fails
      }
      
      return newRequest;
    } catch (error: any) {
      console.error('Error creating NDA request:', error);
      
      // Handle specific database constraint errors
      if (error.message && error.message.includes('violates foreign key constraint')) {
        if (error.message.includes('requester_id_fkey')) {
          throw new Error('User not found or invalid');
        }
        if (error.message.includes('pitch_id_fkey')) {
          throw new Error('Pitch not found');
        }
      }
      
      throw error;
    }
  }
  
  // Get NDA requests for a user (incoming)
  static async getIncomingRequests(userId: number) {
    try {
      const result = await db.execute(
        `SELECT 
           nr.id, nr.pitch_id, nr.requester_id, nr.owner_id, nr.nda_type, 
           nr.request_message, nr.company_info, nr.status, nr.requested_at,
           nr.responded_at, nr.rejection_reason,
           p.id as pitch_id, p.title as pitch_title, p.logline as pitch_logline,
           p.genre as pitch_genre, p.budget as pitch_budget, p.user_id as pitch_user_id,
           u.id as requester_id, u.email as requester_email, u.username as requester_username,
           u.first_name as requester_first_name, u.last_name as requester_last_name,
           u.user_type as requester_user_type
         FROM nda_requests nr
         INNER JOIN pitches p ON nr.pitch_id = p.id
         INNER JOIN users u ON nr.requester_id = u.id
         WHERE nr.owner_id = $1
         ORDER BY nr.requested_at DESC`,
        [userId]
      );
      
      // Transform the results to match the expected structure
      const requests = result.rows.map(row => ({
        request: {
          id: row.id,
          pitchId: row.pitch_id,
          requesterId: row.requester_id,
          ownerId: row.owner_id,
          ndaType: row.nda_type,
          requestMessage: row.request_message,
          companyInfo: row.company_info ? JSON.parse(row.company_info) : null,
          status: row.status,
          requestedAt: row.requested_at,
          respondedAt: row.responded_at,
          rejectionReason: row.rejection_reason
        },
        pitch: {
          id: row.pitch_id,
          title: row.pitch_title,
          logline: row.pitch_logline,
          genre: row.pitch_genre,
          budget: row.pitch_budget,
          userId: row.pitch_user_id
        },
        requester: {
          id: row.requester_id,
          email: row.requester_email,
          username: row.requester_username,
          firstName: row.requester_first_name,
          lastName: row.requester_last_name,
          userType: row.requester_user_type
        }
      }));
      
      return requests;
    } catch (error: any) {
      console.error('Error fetching incoming NDA requests:', error);
      throw error;
    }
  }
  
  // Get NDA requests by a user (outgoing)
  static async getOutgoingRequests(userId: number) {
    try {
      const result = await db.execute(
        `SELECT 
           nr.id, nr.pitch_id, nr.requester_id, nr.owner_id, nr.nda_type, 
           nr.request_message, nr.company_info, nr.status, nr.requested_at,
           nr.responded_at, nr.rejection_reason,
           p.id as pitch_id, p.title as pitch_title, p.logline as pitch_logline,
           p.genre as pitch_genre, p.budget as pitch_budget, p.user_id as pitch_user_id,
           u.id as owner_id, u.email as owner_email, u.username as owner_username,
           u.first_name as owner_first_name, u.last_name as owner_last_name,
           u.user_type as owner_user_type
         FROM nda_requests nr
         INNER JOIN pitches p ON nr.pitch_id = p.id
         INNER JOIN users u ON nr.owner_id = u.id
         WHERE nr.requester_id = $1
         ORDER BY nr.requested_at DESC`,
        [userId]
      );
      
      // Transform the results to match the expected structure
      const requests = result.rows.map(row => ({
        request: {
          id: row.id,
          pitchId: row.pitch_id,
          requesterId: row.requester_id,
          ownerId: row.owner_id,
          ndaType: row.nda_type,
          requestMessage: row.request_message,
          companyInfo: row.company_info ? JSON.parse(row.company_info) : null,
          status: row.status,
          requestedAt: row.requested_at,
          respondedAt: row.responded_at,
          rejectionReason: row.rejection_reason
        },
        pitch: {
          id: row.pitch_id,
          title: row.pitch_title,
          logline: row.pitch_logline,
          genre: row.pitch_genre,
          budget: row.pitch_budget,
          userId: row.pitch_user_id
        },
        owner: {
          id: row.owner_id,
          email: row.owner_email,
          username: row.owner_username,
          firstName: row.owner_first_name,
          lastName: row.owner_last_name,
          userType: row.owner_user_type
        }
      }));
      
      return requests;
    } catch (error: any) {
      console.error('Error fetching outgoing NDA requests:', error);
      throw error;
    }
  }
  
  // Approve NDA request
  static async approveRequest(requestId: number, ownerId: number) {
    try {
      // Verify ownership
      const requestResult = await db.execute(
        'SELECT * FROM nda_requests WHERE id = $1 AND owner_id = $2 AND status = $3 LIMIT 1',
        [requestId, ownerId, 'pending']
      );
      
      if (!requestResult.rows || requestResult.rows.length === 0) {
        throw new Error('NDA request not found or already processed');
      }
      
      const request = requestResult.rows[0];
      
      // Update request status
      await db.execute(
        'UPDATE nda_requests SET status = $1, responded_at = $2 WHERE id = $3',
        ['approved', new Date(), requestId]
      );
      
      // Create NDA record
      const ndaResult = await db.execute(
        `INSERT INTO ndas (pitch_id, signer_id, status, signed_at, document_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          request.pitch_id,
          request.requester_id,
          'signed',
          new Date(),
          `/api/nda/documents/${requestId}/download`
        ]
      );
      
      const nda = ndaResult.rows[0];

      // Update with correct document URL
      await db.execute(
        'UPDATE ndas SET document_url = $1 WHERE id = $2',
        [`/api/nda/documents/${nda.id}/download`, nda.id]
      );
      
      // Send comprehensive approval notifications
      if (this.notificationService) {
        // Get pitch and user details for notification
        const pitchInfo = await db.execute(
          'SELECT title FROM pitches WHERE id = $1',
          [request.pitch_id]
        );
        const pitchTitle = pitchInfo.rows[0]?.title || 'Unknown Pitch';

        // Send immediate notification to requester
        await this.notificationService.sendNotification({
          userId: request.requester_id,
          type: 'nda_approval',
          title: 'NDA Request Approved! 🎉',
          message: `Great news! Your NDA request for "${pitchTitle}" has been approved. You now have full access to the pitch materials and can proceed with your investment evaluation.`,
          priority: 'high',
          relatedPitchId: request.pitch_id,
          relatedUserId: ownerId,
          relatedNdaRequestId: requestId,
          actionUrl: `/pitch/${request.pitch_id}`,
          channels: {
            email: true,
            inApp: true,
            push: true
          },
          emailOptions: {
            templateType: 'ndaApproval',
            variables: {
              pitchTitle,
              pitchUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pitch/${request.pitch_id}`,
              ndaDate: new Date().toLocaleDateString()
            }
          }
        });

        // Schedule NDA expiration reminder (if applicable)
        await this.scheduleNDAExpiration(nda.id, request.requester_id, pitchTitle, 365); // 1 year
      } else {
        // Fallback to legacy notification
        await db.execute(
          `INSERT INTO notifications (user_id, type, title, message, related_pitch_id, related_user_id, related_nda_request_id, action_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            request.requester_id,
            'nda_approved',
            'NDA Request Approved',
            'Your NDA request has been approved',
            request.pitch_id,
            ownerId,
            requestId,
            `/pitch/${request.pitch_id}`
          ]
        );
      }
      
      // Send email notification to requester
      try {
        const requesterInfoResult = await db.execute(
          'SELECT id, email, first_name, last_name, username FROM users WHERE id = $1 LIMIT 1',
          [request.requester_id]
        );
        
        const ownerInfoResult = await db.execute(
          'SELECT id, email, first_name, last_name, username FROM users WHERE id = $1 LIMIT 1',
          [ownerId]
        );
        
        const pitchInfoResult = await db.execute(
          'SELECT id, title FROM pitches WHERE id = $1 LIMIT 1',
          [request.pitch_id]
        );
        
        if (requesterInfoResult.rows[0] && ownerInfoResult.rows[0] && pitchInfoResult.rows[0]) {
          const requesterInfo = requesterInfoResult.rows[0];
          const ownerInfo = ownerInfoResult.rows[0];
          const pitchInfo = pitchInfoResult.rows[0];
          
          await sendNDAResponseEmail(requesterInfo.email, {
            recipientName: requesterInfo.first_name || requesterInfo.username,
            senderName: ownerInfo.first_name ? `${ownerInfo.first_name} ${ownerInfo.last_name || ''}`.trim() : ownerInfo.username,
            pitchTitle: pitchInfo.title,
            approved: true,
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pitch/${request.pitch_id}`,
            unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/notifications`
          });
        }
      } catch (emailError: any) {
        console.error('Failed to send NDA approval email:', emailError);
        // Continue execution even if email fails
      }
      
      // Increment NDA count on pitch
      await db.execute(
        'UPDATE pitches SET nda_count = nda_count + 1 WHERE id = $1',
        [request.pitch_id]
      );
      
      return nda;
    } catch (error: any) {
      console.error('Error approving NDA request:', error);
      throw error;
    }
  }
  
  // Reject NDA request
  static async rejectRequest(requestId: number, ownerId: number, rejectionReason?: string) {
    try {
      // Verify ownership
      const requestResult = await db.execute(
        'SELECT * FROM nda_requests WHERE id = $1 AND owner_id = $2 AND status = $3 LIMIT 1',
        [requestId, ownerId, 'pending']
      );
      
      if (!requestResult.rows || requestResult.rows.length === 0) {
        throw new Error('NDA request not found or already processed');
      }
      
      const request = requestResult.rows[0];
      
      // Update request status
      await db.execute(
        'UPDATE nda_requests SET status = $1, rejection_reason = $2, responded_at = $3 WHERE id = $4',
        ['rejected', rejectionReason, new Date(), requestId]
      );
      
      // Send comprehensive rejection notifications
      if (this.notificationService) {
        // Get pitch details for notification
        const pitchInfo = await db.execute(
          'SELECT title FROM pitches WHERE id = $1',
          [request.pitch_id]
        );
        const pitchTitle = pitchInfo.rows[0]?.title || 'Unknown Pitch';

        // Send notification to requester
        await this.notificationService.sendNotification({
          userId: request.requester_id,
          type: 'nda_rejection',
          title: 'NDA Request Update',
          message: rejectionReason 
            ? `Your NDA request for "${pitchTitle}" was not approved. Reason: ${rejectionReason}. You can explore other opportunities on the platform.`
            : `Your NDA request for "${pitchTitle}" was not approved at this time. You can explore other opportunities on the platform.`,
          priority: 'normal',
          relatedPitchId: request.pitch_id,
          relatedUserId: ownerId,
          relatedNdaRequestId: requestId,
          actionUrl: `/marketplace`,
          channels: {
            email: true,
            inApp: true,
            push: false // Less intrusive for rejections
          },
          emailOptions: {
            templateType: 'ndaRejection',
            variables: {
              pitchTitle,
              reason: rejectionReason,
              browseUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/marketplace`
            }
          }
        });
      } else {
        // Fallback to legacy notification
        await db.execute(
          `INSERT INTO notifications (user_id, type, title, message, related_pitch_id, related_user_id, related_nda_request_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            request.requester_id,
            'nda_rejected',
            'NDA Request Rejected',
            rejectionReason || 'Your NDA request has been rejected',
            request.pitch_id,
            ownerId,
            requestId
          ]
        );
      }
      
      // Send email notification to requester
      try {
        const requesterInfoResult = await db.execute(
          'SELECT id, email, first_name, last_name, username FROM users WHERE id = $1 LIMIT 1',
          [request.requester_id]
        );
        
        const ownerInfoResult = await db.execute(
          'SELECT id, email, first_name, last_name, username FROM users WHERE id = $1 LIMIT 1',
          [ownerId]
        );
        
        const pitchInfoResult = await db.execute(
          'SELECT id, title FROM pitches WHERE id = $1 LIMIT 1',
          [request.pitch_id]
        );
        
        if (requesterInfoResult.rows[0] && ownerInfoResult.rows[0] && pitchInfoResult.rows[0]) {
          const requesterInfo = requesterInfoResult.rows[0];
          const ownerInfo = ownerInfoResult.rows[0];
          const pitchInfo = pitchInfoResult.rows[0];
          
          await sendNDAResponseEmail(requesterInfo.email, {
            recipientName: requesterInfo.first_name || requesterInfo.username,
            senderName: ownerInfo.first_name ? `${ownerInfo.first_name} ${ownerInfo.last_name || ''}`.trim() : ownerInfo.username,
            pitchTitle: pitchInfo.title,
            approved: false,
            reason: rejectionReason,
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/marketplace`,
            unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/notifications`
          });
        }
      } catch (emailError: any) {
        console.error('Failed to send NDA rejection email:', emailError);
        // Continue execution even if email fails
      }
      
      return { success: true, message: 'NDA request rejected' };
    } catch (error: any) {
      console.error('Error rejecting NDA request:', error);
      throw error;
    }
  }
  
  // Check if user has signed NDA for a pitch
  static async hasSignedNDA(userId: number, pitchId: number) {
    try {
      const result = await db.execute(
        'SELECT id FROM ndas WHERE pitch_id = $1 AND signer_id = $2 AND access_granted = $3 LIMIT 1',
        [pitchId, userId, true]
      );
      
      return result.rows && result.rows.length > 0;
    } catch (error: any) {
      console.error('Error checking NDA status:', error);
      return false;
    }
  }
  
  // Get all NDAs signed by a user
  static async getUserSignedNDAs(userId: number) {
    try {
      const result = await db.execute(
        `SELECT 
           n.id, n.pitch_id, n.signer_id, n.status, n.signed_at, n.document_url,
           n.access_granted, n.access_revoked_at,
           p.id as pitch_id, p.title as pitch_title, p.logline as pitch_logline,
           p.genre as pitch_genre, p.budget as pitch_budget, p.user_id as pitch_user_id
         FROM ndas n
         INNER JOIN pitches p ON n.pitch_id = p.id
         WHERE n.signer_id = $1
         ORDER BY n.signed_at DESC`,
        [userId]
      );
      
      // Transform the results to match the expected structure
      const ndaRecords = result.rows.map(row => ({
        nda: {
          id: row.id,
          pitchId: row.pitch_id,
          signerId: row.signer_id,
          status: row.status,
          signedAt: row.signed_at,
          documentUrl: row.document_url,
          accessGranted: row.access_granted,
          accessRevokedAt: row.access_revoked_at
        },
        pitch: {
          id: row.pitch_id,
          title: row.pitch_title,
          logline: row.pitch_logline,
          genre: row.pitch_genre,
          budget: row.pitch_budget,
          userId: row.pitch_user_id
        }
      }));
      
      return ndaRecords;
    } catch (error: any) {
      console.error('Error fetching user NDAs:', error);
      throw error;
    }
  }
  
  // Get all NDAs for a pitch
  static async getPitchNDAs(pitchId: number, ownerId: number) {
    try {
      // Verify ownership
      const pitchResult = await db.execute(
        'SELECT id FROM pitches WHERE id = $1 AND user_id = $2 LIMIT 1',
        [pitchId, ownerId]
      );
      
      if (!pitchResult.rows || pitchResult.rows.length === 0) {
        throw new Error('Pitch not found or unauthorized');
      }
      
      const result = await db.execute(
        `SELECT 
           n.id, n.pitch_id, n.signer_id, n.status, n.signed_at, n.document_url,
           n.access_granted, n.access_revoked_at,
           u.id as signer_id, u.email as signer_email, u.username as signer_username,
           u.first_name as signer_first_name, u.last_name as signer_last_name,
           u.user_type as signer_user_type
         FROM ndas n
         INNER JOIN users u ON n.signer_id = u.id
         WHERE n.pitch_id = $1
         ORDER BY n.signed_at DESC`,
        [pitchId]
      );
      
      // Transform the results to match the expected structure
      const ndaRecords = result.rows.map(row => ({
        nda: {
          id: row.id,
          pitchId: row.pitch_id,
          signerId: row.signer_id,
          status: row.status,
          signedAt: row.signed_at,
          documentUrl: row.document_url,
          accessGranted: row.access_granted,
          accessRevokedAt: row.access_revoked_at
        },
        signer: {
          id: row.signer_id,
          email: row.signer_email,
          username: row.signer_username,
          firstName: row.signer_first_name,
          lastName: row.signer_last_name,
          userType: row.signer_user_type
        }
      }));
      
      return ndaRecords;
    } catch (error: any) {
      console.error('Error fetching pitch NDAs:', error);
      throw error;
    }
  }
  
  // Revoke NDA access
  static async revokeAccess(ndaId: number, ownerId: number) {
    try {
      // Get NDA details
      const result = await db.execute(
        `SELECT 
           n.id, n.pitch_id, n.signer_id, n.status, n.signed_at,
           p.id as pitch_id, p.title as pitch_title, p.user_id as pitch_user_id
         FROM ndas n
         INNER JOIN pitches p ON n.pitch_id = p.id
         WHERE n.id = $1 AND p.user_id = $2
         LIMIT 1`,
        [ndaId, ownerId]
      );
      
      if (!result.rows || result.rows.length === 0) {
        throw new Error('NDA not found or unauthorized');
      }
      
      const nda = result.rows[0];
      
      // Revoke access
      await db.execute(
        'UPDATE ndas SET access_granted = $1, access_revoked_at = $2 WHERE id = $3',
        [false, new Date(), ndaId]
      );
      
      // Create notification for signer
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, message, related_pitch_id, related_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          nda.signer_id,
          'nda_revoked',
          'NDA Access Revoked',
          `Access to "${nda.pitch_title}" has been revoked`,
          nda.pitch_id,
          ownerId
        ]
      );
      
      return { success: true, message: 'NDA access revoked' };
    } catch (error: any) {
      console.error('Error revoking NDA access:', error);
      throw error;
    }
  }
  
  // Sign NDA directly (without request)
  static async signNDA(data: z.infer<typeof signNDASchema>) {
    try {
      const validatedData = signNDASchema.parse(data);
      
      // Check if already signed
      const existingResult = await db.execute(
        'SELECT id FROM ndas WHERE pitch_id = $1 AND signer_id = $2 LIMIT 1',
        [validatedData.pitchId, validatedData.signerId]
      );
      
      if (existingResult.rows && existingResult.rows.length > 0) {
        throw new Error('NDA already signed for this pitch');
      }
      
      // Create NDA record
      const ndaResult = await db.execute(
        `INSERT INTO ndas (pitch_id, signer_id, status, signed_at, document_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          validatedData.pitchId,
          validatedData.signerId,
          'signed',
          new Date(),
          validatedData.customNdaUrl || `/api/nda/documents/temp/download`
        ]
      );
      
      const nda = ndaResult.rows[0];

      // Update with correct document URL if not custom
      if (!validatedData.customNdaUrl) {
        await db.execute(
          'UPDATE ndas SET document_url = $1 WHERE id = $2',
          [`/api/nda/documents/${nda.id}/download`, nda.id]
        );
      }
      
      // Increment NDA count
      await db.execute(
        'UPDATE pitches SET nda_count = nda_count + 1 WHERE id = $1',
        [validatedData.pitchId]
      );
      
      // Get pitch details for notification
      const pitchResult = await db.execute(
        'SELECT id, user_id, title FROM pitches WHERE id = $1 LIMIT 1',
        [validatedData.pitchId]
      );
      
      const pitch = pitchResult.rows[0];
      
      // Notify pitch owner
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, message, related_pitch_id, related_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          pitch.user_id,
          'nda_signed',
          'New NDA Signed',
          `Someone signed an NDA for "${pitch.title}"`,
          validatedData.pitchId,
          validatedData.signerId
        ]
      );
      
      return nda;
    } catch (error: any) {
      console.error('Error signing NDA:', error);
      throw error;
    }
  }
  
  // Get NDA statistics for a user
  static async getUserNDAStats(userId: number) {
    try {
      const result = await db.execute(
        `SELECT 
           COUNT(DISTINCT nr.id) as total_requests,
           COUNT(DISTINCT CASE WHEN nr.status = 'pending' THEN nr.id END) as pending_requests,
           COUNT(DISTINCT CASE WHEN nr.status = 'approved' THEN nr.id END) as approved_requests,
           COUNT(DISTINCT CASE WHEN nr.status = 'rejected' THEN nr.id END) as rejected_requests,
           (SELECT COUNT(*) FROM ndas WHERE signer_id = $1) as signed_ndas
         FROM nda_requests nr
         WHERE nr.requester_id = $1 OR nr.owner_id = $1`,
        [userId]
      );
      
      const row = result.rows[0];
      
      return {
        totalRequests: parseInt(row.total_requests) || 0,
        pendingRequests: parseInt(row.pending_requests) || 0,
        approvedRequests: parseInt(row.approved_requests) || 0,
        rejectedRequests: parseInt(row.rejected_requests) || 0,
        signedNDAs: parseInt(row.signed_ndas) || 0
      };
    } catch (error: any) {
      console.error('Error fetching NDA stats:', error);
      throw error;
    }
  }

  // ============================================================================
  // NOTIFICATION HELPER METHODS
  // ============================================================================

  /**
   * Schedule NDA reminder notification
   */
  static async scheduleNDAReminder(
    ndaRequestId: number,
    userId: number,
    pitchTitle: string,
    daysFromNow: number
  ): Promise<void> {
    try {
      if (!this.notificationService) return;

      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + daysFromNow);

      // Check if request is still pending before scheduling
      const requestResult = await db.execute(
        'SELECT status FROM nda_requests WHERE id = $1',
        [ndaRequestId]
      );

      if (requestResult.rows[0]?.status === 'pending') {
        await this.notificationService.sendNotification({
          userId,
          type: 'nda_reminder',
          title: 'Pending NDA Request Reminder',
          message: `You have a pending NDA request for "${pitchTitle}" that requires your attention. Please review and respond to maintain good relationships with potential investors.`,
          priority: 'normal',
          relatedNdaRequestId: ndaRequestId,
          actionUrl: `/creator/nda-requests/${ndaRequestId}`,
          channels: {
            email: true,
            inApp: true,
            push: true
          },
          emailOptions: {
            templateType: 'ndaReminder',
            variables: {
              pitchTitle,
              daysWaiting: daysFromNow,
              actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/creator/nda-requests/${ndaRequestId}`
            }
          }
        });
      }
    } catch (error: any) {
      console.error('Error scheduling NDA reminder:', error);
    }
  }

  /**
   * Schedule NDA expiration notification
   */
  static async scheduleNDAExpiration(
    ndaId: number,
    userId: number,
    pitchTitle: string,
    daysFromNow: number
  ): Promise<void> {
    try {
      if (!this.notificationService) return;

      // Schedule expiration warning (30 days before expiration)
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + daysFromNow - 30);

      await this.notificationService.sendNotification({
        userId,
        type: 'nda_expiration',
        title: 'NDA Expiration Notice',
        message: `Your NDA for "${pitchTitle}" will expire in 30 days. Please ensure you complete your review before the expiration date.`,
        priority: 'normal',
        actionUrl: `/investor/ndas/${ndaId}`,
        channels: {
          email: true,
          inApp: true,
          push: false
        },
        emailOptions: {
          templateType: 'ndaExpiration',
          variables: {
            pitchTitle,
            daysUntilExpiration: 30,
            ndaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/investor/ndas/${ndaId}`
          }
        }
      });

      // Schedule final expiration notification
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysFromNow);

      await this.notificationService.sendNotification({
        userId,
        type: 'nda_expiration',
        title: 'NDA Has Expired',
        message: `Your NDA for "${pitchTitle}" has expired. Your access to confidential materials has been revoked.`,
        priority: 'high',
        channels: {
          email: true,
          inApp: true,
          push: true
        },
        emailOptions: {
          templateType: 'ndaExpired',
          variables: {
            pitchTitle,
            contactUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/contact`
          }
        }
      });
    } catch (error: any) {
      console.error('Error scheduling NDA expiration:', error);
    }
  }

  /**
   * Send bulk NDA expiration reminders (called by cron job)
   */
  static async sendExpirationReminders(): Promise<void> {
    try {
      if (!this.notificationService) return;

      // Get NDAs expiring in 30 days
      const expiringNDAs = await db.execute(`
        SELECT 
          n.id, n.signer_id, n.expires_at,
          p.title as pitch_title,
          u.email, u.first_name
        FROM ndas n
        INNER JOIN pitches p ON n.pitch_id = p.id
        INNER JOIN users u ON n.signer_id = u.id
        WHERE n.expires_at BETWEEN NOW() + INTERVAL '29 days' AND NOW() + INTERVAL '31 days'
        AND n.access_granted = true
        AND n.expiration_reminder_sent = false
      `);

      for (const nda of expiringNDAs.rows) {
        await this.notificationService.sendNotification({
          userId: nda.signer_id,
          type: 'nda_expiration',
          title: 'NDA Expiring Soon',
          message: `Your NDA for "${nda.pitch_title}" will expire in approximately 30 days. Please complete your review before the expiration date.`,
          priority: 'normal',
          channels: {
            email: true,
            inApp: true,
            push: false
          },
          emailOptions: {
            templateType: 'ndaExpiration',
            variables: {
              recipientName: nda.first_name,
              pitchTitle: nda.pitch_title,
              expirationDate: new Date(nda.expires_at).toLocaleDateString(),
              daysUntilExpiration: 30
            }
          }
        });

        // Mark reminder as sent
        await db.execute(
          'UPDATE ndas SET expiration_reminder_sent = true WHERE id = $1',
          [nda.id]
        );
      }

      console.log(`Sent ${expiringNDAs.rows.length} NDA expiration reminders`);
    } catch (error: any) {
      console.error('Error sending NDA expiration reminders:', error);
    }
  }

  /**
   * Process expired NDAs (called by cron job)
   */
  static async processExpiredNDAs(): Promise<void> {
    try {
      if (!this.notificationService) return;

      // Get expired NDAs
      const expiredNDAs = await db.execute(`
        SELECT 
          n.id, n.signer_id,
          p.title as pitch_title,
          u.email, u.first_name
        FROM ndas n
        INNER JOIN pitches p ON n.pitch_id = p.id
        INNER JOIN users u ON n.signer_id = u.id
        WHERE n.expires_at < NOW()
        AND n.access_granted = true
      `);

      for (const nda of expiredNDAs.rows) {
        // Revoke access and mark as expired
        await db.execute(
          `UPDATE ndas SET access_granted = false, access_revoked_at = NOW(), status = 'expired', updated_at = NOW() WHERE id = $1`,
          [nda.id]
        );

        // Send notification
        await this.notificationService.sendNotification({
          userId: nda.signer_id,
          type: 'nda_expiration',
          title: 'NDA Access Revoked',
          message: `Your NDA for "${nda.pitch_title}" has expired and access has been revoked. Contact the pitch owner if you need extended access.`,
          priority: 'high',
          channels: {
            email: true,
            inApp: true,
            push: true
          },
          emailOptions: {
            templateType: 'ndaExpired',
            variables: {
              recipientName: nda.first_name,
              pitchTitle: nda.pitch_title
            }
          }
        });
      }

      console.log(`Processed ${expiredNDAs.rows.length} expired NDAs`);
    } catch (error: any) {
      console.error('Error processing expired NDAs:', error);
    }
  }

  /**
   * Send weekly NDA digest to creators
   */
  static async sendWeeklyNDADigest(): Promise<void> {
    try {
      if (!this.notificationService) return;

      // Get creators with NDA activity in the last week
      const creatorsWithActivity = await db.execute(`
        SELECT 
          p.user_id,
          u.email, u.first_name,
          COUNT(DISTINCT nr.id) as pending_requests,
          COUNT(DISTINCT CASE WHEN nr.status = 'approved' THEN nr.id END) as approved_requests,
          COUNT(DISTINCT CASE WHEN nr.status = 'rejected' THEN nr.id END) as rejected_requests,
          COUNT(DISTINCT n.id) as signed_ndas
        FROM pitches p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN nda_requests nr ON p.id = nr.pitch_id 
          AND nr.requested_at >= NOW() - INTERVAL '7 days'
        LEFT JOIN ndas n ON p.id = n.pitch_id 
          AND n.signed_at >= NOW() - INTERVAL '7 days'
        WHERE (nr.id IS NOT NULL OR n.id IS NOT NULL)
        GROUP BY p.user_id, u.email, u.first_name
        HAVING COUNT(DISTINCT nr.id) > 0 OR COUNT(DISTINCT n.id) > 0
      `);

      for (const creator of creatorsWithActivity.rows) {
        await this.notificationService.sendNotification({
          userId: creator.user_id,
          type: 'system',
          title: 'Weekly NDA Activity Summary',
          message: `Here's your NDA activity for this week: ${creator.pending_requests} pending requests, ${creator.approved_requests} approved, ${creator.rejected_requests} rejected, ${creator.signed_ndas} new signatures.`,
          priority: 'low',
          actionUrl: '/creator/nda-requests',
          channels: {
            email: true,
            inApp: false,
            push: false
          },
          emailOptions: {
            templateType: 'weeklyDigest',
            variables: {
              recipientName: creator.first_name,
              pendingRequests: creator.pending_requests,
              approvedRequests: creator.approved_requests,
              rejectedRequests: creator.rejected_requests,
              signedNDAs: creator.signed_ndas,
              dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/creator/nda-requests`
            }
          }
        });
      }

      console.log(`Sent weekly NDA digest to ${creatorsWithActivity.rows.length} creators`);
    } catch (error: any) {
      console.error('Error sending weekly NDA digest:', error);
    }
  }
}

export default NDAService;