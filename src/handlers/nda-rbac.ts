/**
 * NDA Handler with RBAC Integration
 * Manages NDA approvals with automatic content access grants
 */

import { WorkerRBACService } from '../services/worker-rbac.service';
import { getCorsHeaders } from '../utils/response';
import { neon } from '@neondatabase/serverless';

export interface NDAApprovalRequest {
  ndaId: number;
  action: 'approve' | 'reject';
  reason?: string;
}

export class NDAWithRBACHandler {
  private rbacService: WorkerRBACService;
  private sql: ReturnType<typeof neon>;

  constructor(databaseUrl: string, cache?: any) {
    this.rbacService = new WorkerRBACService({ databaseUrl, cache });
    this.sql = neon(databaseUrl);
  }

  /**
   * Handle NDA approval with automatic content access grants
   */
  async handleNDAApproval(request: Request): Promise<Response> {
    const user = (request as any).user;
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401, headers: getCorsHeaders(request.headers.get('Origin')) });
    }

    try {
      const body: NDAApprovalRequest = await request.json() as unknown as NDAApprovalRequest;
      const { ndaId, action, reason } = body;

      // Get NDA details
      const [nda] = (await this.sql`
        SELECT n.*, p.user_id, p.id as pitch_id, p.title,
               u.email as requester_email, u.name as requester_name
        FROM ndas n
        JOIN pitches p ON n.pitch_id = p.id
        JOIN users u ON n.requester_id = u.id
        WHERE n.id = ${ndaId}
      `) as any[];

      if (!nda) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'NDA not found' }
        }), { status: 404, headers: getCorsHeaders(request.headers.get('Origin')) });
      }

      // Check if user owns the pitch or has admin permissions
      const ownershipCheck = await this.rbacService.checkContentAccess(
        request as any,
        'pitch',
        nda.pitch_id,
        'admin'
      );

      if (!ownershipCheck.allowed) {
        // Check if user has NDA approval permission
        const permissionCheck = await this.rbacService.checkPermission(
          request as any,
          'nda:approve'
        );

        if (!permissionCheck.allowed || nda.creator_id !== user.id) {
          return new Response(JSON.stringify({
            success: false,
            error: { 
              code: 'FORBIDDEN', 
              message: 'Only the pitch owner can approve NDAs' 
            }
          }), { status: 403, headers: getCorsHeaders(request.headers.get('Origin')) });
        }
      }

      // Check if NDA is already processed
      if (nda.status !== 'pending') {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'CONFLICT', 
            message: `NDA is already ${nda.status}` 
          }
        }), { status: 409, headers: getCorsHeaders(request.headers.get('Origin')) });
      }

      if (action === 'approve') {
        // Update NDA status
        await this.sql`
          UPDATE ndas 
          SET status = 'approved', 
              approved_at = NOW(), 
              approved_by = ${user.id},
              updated_at = NOW()
          WHERE id = ${ndaId}
        `;

        // Grant content access via RBAC service
        await this.rbacService.grantNDAAccess(
          ndaId,
          nda.requester_id,
          nda.pitch_id
        );

        // Create notification for requester
        await this.sql`
          INSERT INTO notifications (
            user_id, type, title, message, metadata, created_at
          ) VALUES (
            ${nda.requester_id},
            'nda_approved',
            'NDA Approved',
            ${`Your NDA request for "${nda.title}" has been approved. You now have access to protected content.`},
            ${JSON.stringify({ ndaId, pitchId: nda.pitch_id })}::jsonb,
            NOW()
          )
        `;

        // Log the approval
        await this.sql`
          INSERT INTO audit_logs (
            user_id, action, entity_type, entity_id, metadata, created_at
          ) VALUES (
            ${user.id},
            'nda.approve',
            'nda',
            ${ndaId},
            ${JSON.stringify({ 
              pitchId: nda.pitch_id,
              requesterId: nda.requester_id,
              requesterEmail: nda.requester_email
            })}::jsonb,
            NOW()
          )
        `;

        return new Response(JSON.stringify({
          success: true,
          data: {
            message: 'NDA approved successfully',
            ndaId,
            pitchId: nda.pitch_id,
            accessGranted: true
          }
        }), { 
          status: 200, 
          headers: getCorsHeaders(request.headers.get('Origin')) 
        });

      } else if (action === 'reject') {
        // Update NDA status
        await this.sql`
          UPDATE ndas 
          SET status = 'rejected', 
              rejected_at = NOW(),
              rejected_by = ${user.id},
              rejection_reason = ${reason || null},
              updated_at = NOW()
          WHERE id = ${ndaId}
        `;

        // Create notification for requester
        await this.sql`
          INSERT INTO notifications (
            user_id, type, title, message, metadata, created_at
          ) VALUES (
            ${nda.requester_id},
            'nda_rejected',
            'NDA Rejected',
            ${`Your NDA request for "${nda.title}" has been rejected.${reason ? ` Reason: ${reason}` : ''}`},
            ${JSON.stringify({ ndaId, pitchId: nda.pitch_id, reason })}::jsonb,
            NOW()
          )
        `;

        // Log the rejection
        await this.sql`
          INSERT INTO audit_logs (
            user_id, action, entity_type, entity_id, metadata, created_at
          ) VALUES (
            ${user.id},
            'nda.reject',
            'nda',
            ${ndaId},
            ${JSON.stringify({ 
              pitchId: nda.pitch_id,
              requesterId: nda.requester_id,
              reason
            })}::jsonb,
            NOW()
          )
        `;

        return new Response(JSON.stringify({
          success: true,
          data: {
            message: 'NDA rejected',
            ndaId,
            reason
          }
        }), { 
          status: 200, 
          headers: getCorsHeaders(request.headers.get('Origin')) 
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid action' }
      }), { status: 400, headers: getCorsHeaders(request.headers.get('Origin')) });

    } catch (error) {
      console.error('NDA approval error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to process NDA' 
        }
      }), { status: 500, headers: getCorsHeaders(request.headers.get('Origin')) });
    }
  }

  /**
   * Handle NDA revocation with access removal
   */
  async handleNDARevocation(request: Request): Promise<Response> {
    const user = (request as any).user;
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401, headers: getCorsHeaders(request.headers.get('Origin')) });
    }

    try {
      const url = new URL(request.url);
      const ndaId = parseInt(url.pathname.split('/').pop() || '0');

      if (!ndaId) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid NDA ID' }
        }), { status: 400, headers: getCorsHeaders(request.headers.get('Origin')) });
      }

      // Get NDA details
      const [nda] = (await this.sql`
        SELECT n.*, p.user_id
        FROM ndas n
        JOIN pitches p ON n.pitch_id = p.id
        WHERE n.id = ${ndaId}
      `) as any[];

      if (!nda) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'NDA not found' }
        }), { status: 404, headers: getCorsHeaders(request.headers.get('Origin')) });
      }

      // Check permission to revoke
      const permissionCheck = await this.rbacService.checkPermission(
        request as any,
        'nda:revoke'
      );

      if (!permissionCheck.allowed || (nda.creator_id !== user.id && !permissionCheck.context?.roles.includes('admin'))) {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'FORBIDDEN', 
            message: 'You do not have permission to revoke this NDA' 
          }
        }), { status: 403, headers: getCorsHeaders(request.headers.get('Origin')) });
      }

      // Update NDA status
      await this.sql`
        UPDATE ndas 
        SET status = 'revoked', 
            revoked_at = NOW(),
            revoked_by = ${user.id},
            updated_at = NOW()
        WHERE id = ${ndaId}
      `;

      // Revoke content access
      await this.rbacService.revokeNDAAccess(ndaId);

      // Create notification
      await this.sql`
        INSERT INTO notifications (
          user_id, type, title, message, metadata, created_at
        ) VALUES (
          ${nda.requester_id},
          'nda_revoked',
          'NDA Revoked',
          'Your NDA access has been revoked by the content owner.',
          ${JSON.stringify({ ndaId, pitchId: nda.pitch_id })}::jsonb,
          NOW()
        )
      `;

      return new Response(JSON.stringify({
        success: true,
        data: {
          message: 'NDA revoked successfully',
          ndaId,
          accessRevoked: true
        }
      }), { 
        status: 200, 
        headers: getCorsHeaders(request.headers.get('Origin')) 
      });

    } catch (error) {
      console.error('NDA revocation error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to revoke NDA' 
        }
      }), { status: 500, headers: getCorsHeaders(request.headers.get('Origin')) });
    }
  }

  /**
   * Check if user has NDA access to content
   */
  async checkNDAAccess(request: Request): Promise<Response> {
    const user = (request as any).user;
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401, headers: getCorsHeaders(request.headers.get('Origin')) });
    }

    try {
      const url = new URL(request.url);
      const pitchId = parseInt(url.searchParams.get('pitchId') || '0');

      if (!pitchId) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Pitch ID required' }
        }), { status: 400, headers: getCorsHeaders(request.headers.get('Origin')) });
      }

      // Check content access
      const accessCheck = await this.rbacService.checkContentAccess(
        request as any,
        'pitch',
        pitchId,
        'view'
      );

      // Get NDA details if exists
      const [nda] = (await this.sql`
        SELECT id, status, approved_at, expires_at
        FROM ndas
        WHERE requester_id = ${user.id}
          AND pitch_id = ${pitchId}
        ORDER BY created_at DESC
        LIMIT 1
      `) as any[];

      return new Response(JSON.stringify({
        success: true,
        data: {
          hasAccess: accessCheck.allowed,
          isOwner: accessCheck.isOwner,
          nda: nda ? {
            id: nda.id,
            status: nda.status,
            approvedAt: nda.approved_at,
            expiresAt: nda.expires_at
          } : null
        }
      }), { 
        status: 200, 
        headers: getCorsHeaders(request.headers.get('Origin')) 
      });

    } catch (error) {
      console.error('NDA access check error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to check NDA access' 
        }
      }), { status: 500, headers: getCorsHeaders(request.headers.get('Origin')) });
    }
  }
}