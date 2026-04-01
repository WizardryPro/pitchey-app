/**
 * Worker RBAC Service - Integrates permissions with Better Auth
 */

import { PermissionService, PermissionContext } from './permission.service';
import postgres from 'postgres';
import { neon } from '@neondatabase/serverless';

export interface RBACConfig {
  databaseUrl: string;
  cache?: any;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    userType?: string;
    role?: string;
  };
  permissionCtx?: PermissionContext;
}

/**
 * RBAC handler wrapper for Cloudflare Workers
 */
export class WorkerRBACService {
  private permissionService: PermissionService;
  private sql: ReturnType<typeof neon>;

  constructor(config: RBACConfig) {
    this.sql = neon(config.databaseUrl);
    // Create postgres instance for permission service
    const pgSql = postgres(config.databaseUrl, {
      ssl: 'require',
      max: 1, // Single connection for Workers
    });
    this.permissionService = new PermissionService(pgSql);
  }

  /**
   * Load permissions for authenticated user
   */
  async loadUserPermissions(userId: number, cache?: any): Promise<PermissionContext> {
    return await this.permissionService.getCachedUserPermissions(userId, cache);
  }

  /**
   * Check if request has required permission
   */
  async checkPermission(
    request: AuthenticatedRequest,
    permission: string
  ): Promise<{ allowed: boolean; context?: PermissionContext; error?: string }> {
    if (!request.user) {
      return { allowed: false, error: 'Authentication required' };
    }

    try {
      const context = request.permissionCtx || 
                     await this.loadUserPermissions(request.user.id);
      
      const allowed = this.permissionService.hasPermission(context, permission);
      
      // Log the check
      await this.permissionService.logPermissionCheck(
        request.user.id,
        `${request.method} ${new URL(request.url).pathname}`,
        null,
        null,
        permission,
        allowed,
        request
      );

      return { allowed, context };
    } catch (error) {
      console.error('Permission check failed:', error);
      return { allowed: false, error: 'Permission check failed' };
    }
  }

  /**
   * Check if request has any of the required permissions
   */
  async checkAnyPermission(
    request: AuthenticatedRequest,
    permissions: string[]
  ): Promise<{ allowed: boolean; context?: PermissionContext; error?: string }> {
    if (!request.user) {
      return { allowed: false, error: 'Authentication required' };
    }

    try {
      const context = request.permissionCtx || 
                     await this.loadUserPermissions(request.user.id);
      
      const allowed = this.permissionService.hasAnyPermission(context, permissions);
      
      // Log the check
      await this.permissionService.logPermissionCheck(
        request.user.id,
        `${request.method} ${new URL(request.url).pathname}`,
        null,
        null,
        permissions.join(' OR '),
        allowed,
        request,
        { requiredAny: permissions }
      );

      return { allowed, context };
    } catch (error) {
      console.error('Permission check failed:', error);
      return { allowed: false, error: 'Permission check failed' };
    }
  }

  /**
   * Check if user has required role
   */
  async checkRole(
    request: AuthenticatedRequest,
    role: string
  ): Promise<{ allowed: boolean; context?: PermissionContext; error?: string }> {
    if (!request.user) {
      return { allowed: false, error: 'Authentication required' };
    }

    try {
      const context = request.permissionCtx || 
                     await this.loadUserPermissions(request.user.id);
      
      const allowed = this.permissionService.hasRole(context, role);
      
      // Log the check
      await this.permissionService.logPermissionCheck(
        request.user.id,
        `${request.method} ${new URL(request.url).pathname}`,
        null,
        null,
        `role:${role}`,
        allowed,
        request,
        { requiredRole: role }
      );

      return { allowed, context };
    } catch (error) {
      console.error('Role check failed:', error);
      return { allowed: false, error: 'Role check failed' };
    }
  }

  /**
   * Check content access
   */
  async checkContentAccess(
    request: AuthenticatedRequest,
    contentType: string,
    contentId: number,
    requiredLevel: 'view' | 'edit' | 'admin' = 'view'
  ): Promise<{ allowed: boolean; isOwner?: boolean; error?: string }> {
    if (!request.user) {
      return { allowed: false, error: 'Authentication required' };
    }

    try {
      // Check ownership first
      const isOwner = await this.permissionService.checkContentOwnership(
        request.user.id,
        contentType,
        contentId
      );

      if (isOwner) {
        return { allowed: true, isOwner: true };
      }

      // Check content access
      const hasAccess = await this.permissionService.checkContentAccess(
        request.user.id,
        contentType,
        contentId,
        requiredLevel
      );

      // Log the check
      await this.permissionService.logPermissionCheck(
        request.user.id,
        `${request.method} ${new URL(request.url).pathname}`,
        contentType,
        contentId,
        `content:${contentType}:${requiredLevel}`,
        hasAccess || isOwner,
        request,
        { contentType, contentId, requiredLevel }
      );

      return { allowed: hasAccess, isOwner: false };
    } catch (error) {
      console.error('Content access check failed:', error);
      return { allowed: false, error: 'Content access check failed' };
    }
  }

  /**
   * Grant content access when NDA is approved
   */
  async grantNDAAccess(
    ndaId: number,
    requesterId: number,
    pitchId: number
  ): Promise<void> {
    try {
      // Grant access to pitch
      await this.permissionService.grantContentAccess({
        userId: requesterId,
        contentType: 'pitch',
        contentId: pitchId,
        accessLevel: 'view',
        grantedVia: 'nda',
        ndaId
      });

      // Get all documents for this pitch
      const documents = await this.sql`
        SELECT id FROM documents WHERE pitch_id = ${pitchId}
      `;

      // Grant access to all documents
      const documentsArr = documents as any[];
      if (documentsArr.length > 0) {
        const contentItems = documentsArr.map((doc: any) => ({
          type: 'document',
          id: doc.id
        }));

        await this.permissionService.grantBulkContentAccess(
          requesterId,
          contentItems,
          'view',
          'nda',
          ndaId
        );
      }

      console.log(`Granted NDA access for user ${requesterId} to pitch ${pitchId}`);
    } catch (error) {
      console.error('Failed to grant NDA access:', error);
      throw error;
    }
  }

  /**
   * Revoke NDA access
   */
  async revokeNDAAccess(ndaId: number): Promise<void> {
    try {
      await this.permissionService.revokeNDAAccess(ndaId);
      console.log(`Revoked NDA access for NDA ${ndaId}`);
    } catch (error) {
      console.error('Failed to revoke NDA access:', error);
      throw error;
    }
  }

  /**
   * Wrapper function to add RBAC to route handlers
   */
  withPermission(permission: string, handler: (request: AuthenticatedRequest) => Promise<Response>) {
    return async (request: AuthenticatedRequest): Promise<Response> => {
      const check = await this.checkPermission(request, permission);
      
      if (!check.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: check.error || `Missing required permission: ${permission}`,
            required: permission
          }
        }), { 
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Attach permission context to request
      request.permissionCtx = check.context;
      return handler(request);
    };
  }

  /**
   * Wrapper function to add role check to route handlers
   */
  withRole(role: string, handler: (request: AuthenticatedRequest) => Promise<Response>) {
    return async (request: AuthenticatedRequest): Promise<Response> => {
      const check = await this.checkRole(request, role);
      
      if (!check.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: check.error || `Required role: ${role}`,
            requiredRole: role
          }
        }), { 
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Attach permission context to request
      request.permissionCtx = check.context;
      return handler(request);
    };
  }

  /**
   * Wrapper function to check content ownership
   */
  withOwnership(contentType: string, handler: (request: AuthenticatedRequest) => Promise<Response>) {
    return async (request: AuthenticatedRequest): Promise<Response> => {
      if (!request.user) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        }), { 
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Extract ID from URL
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/').filter(p => p);
      const contentId = parseInt(pathParts[pathParts.length - 1]);

      if (!contentId || isNaN(contentId)) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid resource ID'
          }
        }), { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      const check = await this.checkContentAccess(request, contentType, contentId, 'edit');
      
      if (!check.allowed) {
        // Check if user has admin role
        const adminCheck = await this.checkRole(request, 'admin');
        if (!adminCheck.allowed) {
          return new Response(JSON.stringify({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not own this resource'
            }
          }), { 
            status: 403,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
      }

      return handler(request);
    };
  }

  /**
   * Get user permissions endpoint data
   */
  async getUserPermissionsData(userId: number): Promise<any> {
    try {
      const context = await this.loadUserPermissions(userId);
      
      // Get additional user data
      const [user] = (await this.sql`
        SELECT email, user_type, name, username
        FROM users
        WHERE id = ${userId}
      `) as any[];

      return {
        userId,
        email: user?.email,
        userType: user?.user_type,
        roles: context.roles,
        permissions: context.permissions,
        canAccessAdmin: context.permissions.some(p => p.startsWith('admin:')),
        capabilities: {
          canCreatePitch: context.permissions.includes('pitch:create'),
          canInvest: context.permissions.includes('investment:create'),
          canRequestNDA: context.permissions.includes('nda:request'),
          canApproveNDA: context.permissions.includes('nda:approve'),
          canUploadDocuments: context.permissions.includes('document:upload'),
          canSendMessages: context.permissions.includes('message:send'),
          canViewAnalytics: context.permissions.includes('analytics:view_own')
        }
      };
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      throw error;
    }
  }
}