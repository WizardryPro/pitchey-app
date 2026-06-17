/**
 * Permission Helper Utilities
 * Common functions for permission checking and role management
 */

import { PermissionService } from "../services/permission.service.ts";

// Permission constants for easy reference
export const PERMISSIONS = {
  // Pitch Management
  PITCH_CREATE: 'pitch_create',
  PITCH_READ: 'pitch_read',
  PITCH_UPDATE: 'pitch_update',
  PITCH_DELETE: 'pitch_delete',
  PITCH_PUBLISH: 'pitch_publish',
  PITCH_MODERATE: 'pitch_moderate',
  PITCH_FEATURE: 'pitch_feature',
  
  // NDA Management
  NDA_REQUEST: 'nda_request',
  NDA_APPROVE: 'nda_approve',
  NDA_REJECT: 'nda_reject',
  NDA_SIGN: 'nda_sign',
  NDA_MANAGE: 'nda_manage',
  NDA_VIEW_ALL: 'nda_view_all',
  
  // User Management
  USER_CREATE: 'user_create',
  USER_READ: 'user_read',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_MODERATE: 'user_moderate',
  USER_ASSIGN_ROLES: 'user_assign_roles',
  
  // Content Moderation
  CONTENT_REVIEW: 'content_review',
  CONTENT_APPROVE: 'content_approve',
  CONTENT_REJECT: 'content_reject',
  CONTENT_FLAG: 'content_flag',
  CONTENT_MODERATE: 'content_moderate',
  
  // Financial Operations
  FINANCE_VIEW: 'finance_view',
  FINANCE_PROCESS: 'finance_process',
  FINANCE_MANAGE: 'finance_manage',
  PAYMENT_PROCESS: 'payment_process',
  INVESTMENT_VIEW: 'investment_view',
  INVESTMENT_MANAGE: 'investment_manage',
  
  // Analytics Access
  ANALYTICS_VIEW: 'analytics_view',
  ANALYTICS_EXPORT: 'analytics_export',
  ANALYTICS_MANAGE: 'analytics_manage',
  REPORT_GENERATE: 'report_generate',
  
  // System Administration
  SYSTEM_CONFIG: 'system_config',
  SYSTEM_BACKUP: 'system_backup',
  SYSTEM_MONITOR: 'system_monitor',
  PERMISSION_MANAGE: 'permission_manage',
  ROLE_MANAGE: 'role_manage',
  
  // Communication
  MESSAGE_SEND: 'message_send',
  MESSAGE_READ: 'message_read',
  MESSAGE_MODERATE: 'message_moderate',
  NOTIFICATION_SEND: 'notification_send',
  
  // File Management
  FILE_UPLOAD: 'file_upload',
  FILE_DOWNLOAD: 'file_download',
  FILE_DELETE: 'file_delete',
  FILE_MODERATE: 'file_moderate'
};

// Role constants
export const ROLES = {
  // Core roles
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  
  // Creator roles
  CREATOR: 'creator',
  CREATOR_PREMIUM: 'creator_premium',
  CREATOR_VERIFIED: 'creator_verified',
  CONTENT_MANAGER: 'content_manager',
  
  // Investor roles
  INVESTOR: 'investor',
  INVESTOR_ACCREDITED: 'investor_accredited',
  INVESTOR_INSTITUTIONAL: 'investor_institutional',
  FUND_MANAGER: 'fund_manager',
  INVESTMENT_ADVISOR: 'investment_advisor',
  
  // Production roles
  PRODUCTION_COMPANY: 'production_company',
  PRODUCER: 'producer',
  EXECUTIVE_PRODUCER: 'executive_producer',
  LINE_PRODUCER: 'line_producer',
  PRODUCTION_MANAGER: 'production_manager',
  DISTRIBUTOR: 'distributor',
  SALES_AGENT: 'sales_agent',
  
  // Platform roles
  MODERATOR: 'moderator',
  CONTENT_REVIEWER: 'content_reviewer',
  SUPPORT_AGENT: 'support_agent',
  ANALYST: 'analyst',
  
  // External roles
  TALENT_AGENT: 'talent_agent',
  ENTERTAINMENT_LAWYER: 'entertainment_lawyer',
  CONSULTANT: 'consultant',
  VIEWER: 'viewer',
  GUEST: 'guest'
};

// Resource types
export const RESOURCE_TYPES = {
  PITCH: 'pitch',
  NDA: 'nda',
  USER: 'user',
  INVESTMENT: 'investment',
  MESSAGE: 'message',
  DOCUMENT: 'document',
  ANALYTICS: 'analytics',
  SYSTEM: 'system',
  NOTIFICATION: 'notification',
  COMMENT: 'comment'
};

// Common permission check helpers
export class PermissionHelpers {
  
  /**
   * Check if user can create pitches
   */
  static async canCreatePitch(userId: number): Promise<boolean> {
    return PermissionService.hasPermission(userId, PERMISSIONS.PITCH_CREATE);
  }
  
  /**
   * Check if user can edit a specific pitch
   */
  static async canEditPitch(userId: number, pitchId: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      PERMISSIONS.PITCH_UPDATE,
      {
        resourceType: RESOURCE_TYPES.PITCH,
        resourceId: pitchId,
        checkOwnership: true
      }
    );
  }
  
  /**
   * Check if user can moderate content
   */
  static async canModerateContent(userId: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      [PERMISSIONS.CONTENT_MODERATE, PERMISSIONS.PITCH_MODERATE],
      { requireAny: true }
    );
  }
  
  /**
   * Check if user can manage NDAs
   */
  static async canManageNDAs(userId: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      [PERMISSIONS.NDA_MANAGE, PERMISSIONS.NDA_APPROVE, PERMISSIONS.NDA_REJECT],
      { requireAny: true }
    );
  }
  
  /**
   * Check if user can approve NDA for specific pitch
   */
  static async canApproveNDA(userId: number, pitchId: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      PERMISSIONS.NDA_APPROVE,
      {
        resourceType: RESOURCE_TYPES.PITCH,
        resourceId: pitchId,
        checkOwnership: true
      }
    );
  }
  
  /**
   * Check if user has admin access
   */
  static async isAdmin(userId: number): Promise<boolean> {
    const userRoles = await PermissionService.getUserRoles({ userId });
    return userRoles.some(ur => 
      ur.role?.name === ROLES.ADMIN || 
      ur.role?.name === ROLES.SUPER_ADMIN ||
      ur.role?.category === 'admin'
    );
  }
  
  /**
   * Check if user can access analytics
   */
  static async canAccessAnalytics(userId: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      [PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_MANAGE],
      { requireAny: true }
    );
  }
  
  /**
   * Check if user can manage other users
   */
  static async canManageUsers(userId: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      [PERMISSIONS.USER_MODERATE, PERMISSIONS.USER_ASSIGN_ROLES, PERMISSIONS.USER_DELETE],
      { requireAny: true }
    );
  }
  
  /**
   * Check if user can process financial operations
   */
  static async canProcessFinancials(userId: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      [PERMISSIONS.FINANCE_PROCESS, PERMISSIONS.PAYMENT_PROCESS, PERMISSIONS.INVESTMENT_MANAGE],
      { requireAny: true }
    );
  }
  
  /**
   * Check if user can upload files
   */
  static async canUploadFiles(userId: number, resourceType?: string, resourceId?: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      PERMISSIONS.FILE_UPLOAD,
      { resourceType, resourceId }
    );
  }
  
  /**
   * Check if user can send messages
   */
  static async canSendMessages(userId: number, targetUserId?: number): Promise<boolean> {
    return PermissionService.hasPermission(
      userId,
      PERMISSIONS.MESSAGE_SEND,
      {
        resourceType: RESOURCE_TYPES.USER,
        resourceId: targetUserId
      }
    );
  }
  
  /**
   * Get user's effective permissions (combines role and direct permissions)
   */
  static async getUserEffectivePermissions(userId: number): Promise<string[]> {
    try {
      // Get user's role-based permissions
      const userRoles = await PermissionService.getUserRoles({ userId, active: true });
      const rolePermissions: string[] = [];
      
      for (const userRole of userRoles) {
        if (userRole.roleId) {
          const permissions = await PermissionService.getRolePermissions(userRole.roleId);
          rolePermissions.push(...permissions.filter(rp => rp.granted).map(rp => rp.permission?.name || ''));
        }
      }
      
      // Get user's direct resource permissions
      const resourcePermissions = await PermissionService.getResourcePermissions({ userId });
      const directPermissions = resourcePermissions
        .filter(rp => rp.granted)
        .map(rp => rp.permission?.name || '');
      
      // Combine and deduplicate
      const allPermissions = [...new Set([...rolePermissions, ...directPermissions])];
      return allPermissions.filter(p => p.length > 0);
    } catch (error) {
      console.error('Error getting user effective permissions:', error);
      return [];
    }
  }
  
  /**
   * Check if user has any of the specified roles
   */
  static async hasAnyRole(userId: number, roles: string[]): Promise<boolean> {
    try {
      const userRoles = await PermissionService.getUserRoles({ userId, active: true });
      return userRoles.some(ur => 
        ur.role?.name && roles.includes(ur.role.name)
      );
    } catch (error) {
      console.error('Error checking user roles:', error);
      return false;
    }
  }
  
  /**
   * Get user's highest role level
   */
  static async getUserMaxRoleLevel(userId: number): Promise<number> {
    try {
      const userRoles = await PermissionService.getUserRoles({ userId, active: true });
      // Guard the empty case: Math.max(...[]) === -Infinity, which would be a
      // poison value in hierarchy comparisons. A user with no roles has level 0.
      if (userRoles.length === 0) return 0;
      return Math.max(...userRoles.map(ur => ur.role?.level || 0));
    } catch (error) {
      console.error('Error getting user role level:', error);
      return 0;
    }
  }
  
  /**
   * Check if user can access resource based on role hierarchy
   */
  static async canAccessByHierarchy(
    userId: number, 
    targetUserId: number, 
    requiredLevelDifference: number = 1
  ): Promise<boolean> {
    try {
      const userLevel = await this.getUserMaxRoleLevel(userId);
      const targetLevel = await this.getUserMaxRoleLevel(targetUserId);
      
      return userLevel >= (targetLevel + requiredLevelDifference);
    } catch (error) {
      console.error('Error checking hierarchy access:', error);
      return false;
    }
  }
  
  /**
   * Check if operation is allowed based on time-based permissions
   */
  static async isTimePermissionValid(
    userId: number,
    permission: string,
    resourceType?: string,
    resourceId?: number
  ): Promise<boolean> {
    try {
      // Get resource permissions with time constraints
      const filters = {
        userId,
        resourceType,
        resourceId
      };
      
      const resourcePermissions = await PermissionService.getResourcePermissions(filters);
      const relevantPermission = resourcePermissions.find(rp => 
        rp.permission?.name === permission && rp.granted
      );
      
      if (!relevantPermission) {
        return false;
      }
      
      // Check expiration
      if (relevantPermission.expiresAt) {
        const now = new Date();
        const expiresAt = new Date(relevantPermission.expiresAt);
        if (now > expiresAt) {
          return false;
        }
      }
      
      // Check time-based conditions
      const conditions = relevantPermission.conditions || {};
      if (conditions.timeRestrictions) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();
        
        if (conditions.timeRestrictions.allowedHours) {
          const allowedHours = conditions.timeRestrictions.allowedHours;
          if (!allowedHours.includes(currentHour)) {
            return false;
          }
        }
        
        if (conditions.timeRestrictions.allowedDays) {
          const allowedDays = conditions.timeRestrictions.allowedDays;
          if (!allowedDays.includes(currentDay)) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking time permission:', error);
      return false;
    }
  }
  
  /**
   * Get permission summary for user
   */
  static async getPermissionSummary(userId: number): Promise<{
    roles: string[];
    permissions: string[];
    level: number;
    isAdmin: boolean;
    canModerate: boolean;
    canManageFinances: boolean;
  }> {
    try {
      const [roles, permissions, level, isAdmin, canModerate, canManageFinances] = await Promise.all([
        this.getUserRoles(userId),
        this.getUserEffectivePermissions(userId),
        this.getUserMaxRoleLevel(userId),
        this.isAdmin(userId),
        this.canModerateContent(userId),
        this.canProcessFinancials(userId)
      ]);
      
      return {
        roles,
        permissions,
        level,
        isAdmin,
        canModerate,
        canManageFinances
      };
    } catch (error) {
      console.error('Error getting permission summary:', error);
      return {
        roles: [],
        permissions: [],
        level: 0,
        isAdmin: false,
        canModerate: false,
        canManageFinances: false
      };
    }
  }
  
  /**
   * Helper to get user role names
   */
  private static async getUserRoles(userId: number): Promise<string[]> {
    try {
      const userRoles = await PermissionService.getUserRoles({ userId, active: true });
      return userRoles.map(ur => ur.role?.name || '').filter(name => name.length > 0);
    } catch (error) {
      console.error('Error getting user roles:', error);
      return [];
    }
  }
}

// Quick permission check functions for common use cases
export const QuickChecks = {
  isCreator: (userId: number) => PermissionHelpers.hasAnyRole(userId, [ROLES.CREATOR, ROLES.CREATOR_PREMIUM, ROLES.CREATOR_VERIFIED]),
  isInvestor: (userId: number) => PermissionHelpers.hasAnyRole(userId, [ROLES.INVESTOR, ROLES.INVESTOR_ACCREDITED, ROLES.INVESTOR_INSTITUTIONAL]),
  isProducer: (userId: number) => PermissionHelpers.hasAnyRole(userId, [ROLES.PRODUCER, ROLES.EXECUTIVE_PRODUCER, ROLES.PRODUCTION_COMPANY]),
  isModerator: (userId: number) => PermissionHelpers.hasAnyRole(userId, [ROLES.MODERATOR, ROLES.CONTENT_REVIEWER, ROLES.ADMIN]),
  isAdmin: (userId: number) => PermissionHelpers.isAdmin(userId),
  canCreateContent: (userId: number) => PermissionHelpers.canCreatePitch(userId),
  canModerate: (userId: number) => PermissionHelpers.canModerateContent(userId)
};

export default PermissionHelpers;