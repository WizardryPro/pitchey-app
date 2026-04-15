/**
 * Role-Based Access Control (RBAC) Service
 * Manages permissions and authorization for all user types
 */

export enum UserRole {
  ADMIN = 'admin',
  CREATOR = 'creator',
  INVESTOR = 'investor',
  PRODUCTION = 'production',
  VIEWER = 'viewer'
}

export enum Permission {
  // Pitch permissions
  PITCH_CREATE = 'pitch.create',
  PITCH_EDIT_OWN = 'pitch.edit.own',
  PITCH_EDIT_ANY = 'pitch.edit.any',
  PITCH_DELETE_OWN = 'pitch.delete.own',
  PITCH_DELETE_ANY = 'pitch.delete.any',
  PITCH_VIEW_PUBLIC = 'pitch.view.public',
  PITCH_VIEW_PRIVATE = 'pitch.view.private',
  PITCH_PUBLISH = 'pitch.publish',
  PITCH_MODERATE = 'pitch.moderate',

  // NDA permissions
  NDA_REQUEST = 'nda.request',
  NDA_APPROVE = 'nda.approve',
  NDA_REJECT = 'nda.reject',
  NDA_SIGN = 'nda.sign',
  NDA_REVOKE = 'nda.revoke',
  NDA_VIEW_OWN = 'nda.view.own',
  NDA_VIEW_ANY = 'nda.view.any',
  NDA_UPLOAD_CUSTOM = 'nda.upload.custom',

  // Investment permissions
  INVESTMENT_CREATE = 'investment.create',
  INVESTMENT_VIEW_OWN = 'investment.view.own',
  INVESTMENT_VIEW_ANY = 'investment.view.any',
  INVESTMENT_MANAGE = 'investment.manage',
  INVESTMENT_WITHDRAW = 'investment.withdraw',
  PORTFOLIO_VIEW = 'portfolio.view',
  PORTFOLIO_MANAGE = 'portfolio.manage',

  // Document permissions
  DOCUMENT_UPLOAD = 'document.upload',
  DOCUMENT_VIEW_PUBLIC = 'document.view.public',
  DOCUMENT_VIEW_PRIVATE = 'document.view.private',
  DOCUMENT_DELETE_OWN = 'document.delete.own',
  DOCUMENT_DELETE_ANY = 'document.delete.any',

  // User permissions
  USER_VIEW_OWN = 'user.view.own',
  USER_VIEW_ANY = 'user.view.any',
  USER_EDIT_OWN = 'user.edit.own',
  USER_EDIT_ANY = 'user.edit.any',
  USER_DELETE_ANY = 'user.delete.any',
  USER_BAN = 'user.ban',
  USER_UNBAN = 'user.unban',

  // Analytics permissions
  ANALYTICS_VIEW_OWN = 'analytics.view.own',
  ANALYTICS_VIEW_ANY = 'analytics.view.any',
  ANALYTICS_EXPORT = 'analytics.export',

  // Messaging permissions
  MESSAGE_SEND = 'message.send',
  MESSAGE_RECEIVE = 'message.receive',
  MESSAGE_BROADCAST = 'message.broadcast',

  // Admin permissions
  ADMIN_ACCESS = 'admin.access',
  ADMIN_SETTINGS = 'admin.settings',
  ADMIN_LOGS = 'admin.logs',
  ADMIN_BACKUP = 'admin.backup',

  // Financial permissions
  FINANCIAL_VIEW_OWN = 'financial.view.own',
  FINANCIAL_VIEW_ANY = 'financial.view.any',
  FINANCIAL_EXPORT = 'financial.export',
  PAYMENT_CREATE = 'payment.create',
  PAYMENT_REFUND = 'payment.refund',

  // Production permissions
  PRODUCTION_CREATE_PROJECT = 'production.create.project',
  PRODUCTION_MANAGE_CREW = 'production.manage.crew',
  PRODUCTION_SCHEDULE = 'production.schedule',
  PRODUCTION_BUDGET = 'production.budget'
}

// Role-Permission mappings
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Admin has all permissions
    ...Object.values(Permission)
  ],

  [UserRole.CREATOR]: [
    // Pitch permissions
    Permission.PITCH_CREATE,
    Permission.PITCH_EDIT_OWN,
    Permission.PITCH_DELETE_OWN,
    Permission.PITCH_VIEW_PUBLIC,
    Permission.PITCH_VIEW_PRIVATE,
    Permission.PITCH_PUBLISH,

    // NDA permissions (for their own pitches)
    Permission.NDA_APPROVE,
    Permission.NDA_REJECT,
    Permission.NDA_REVOKE,
    Permission.NDA_VIEW_OWN,
    Permission.NDA_UPLOAD_CUSTOM,

    // Document permissions
    Permission.DOCUMENT_UPLOAD,
    Permission.DOCUMENT_VIEW_PUBLIC,
    Permission.DOCUMENT_VIEW_PRIVATE,
    Permission.DOCUMENT_DELETE_OWN,

    // User permissions
    Permission.USER_VIEW_OWN,
    Permission.USER_EDIT_OWN,

    // Analytics permissions
    Permission.ANALYTICS_VIEW_OWN,
    Permission.ANALYTICS_EXPORT,

    // Messaging permissions
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_RECEIVE,

    // Financial permissions
    Permission.FINANCIAL_VIEW_OWN,
    Permission.PAYMENT_CREATE
  ],

  [UserRole.INVESTOR]: [
    // Pitch permissions
    Permission.PITCH_VIEW_PUBLIC,
    Permission.PITCH_VIEW_PRIVATE, // with NDA

    // NDA permissions
    Permission.NDA_REQUEST,
    Permission.NDA_SIGN,
    Permission.NDA_VIEW_OWN,

    // Investment permissions
    Permission.INVESTMENT_CREATE,
    Permission.INVESTMENT_VIEW_OWN,
    Permission.INVESTMENT_MANAGE,
    Permission.INVESTMENT_WITHDRAW,
    Permission.PORTFOLIO_VIEW,
    Permission.PORTFOLIO_MANAGE,

    // Document permissions
    Permission.DOCUMENT_VIEW_PUBLIC,
    Permission.DOCUMENT_VIEW_PRIVATE, // with NDA

    // User permissions
    Permission.USER_VIEW_OWN,
    Permission.USER_EDIT_OWN,

    // Analytics permissions
    Permission.ANALYTICS_VIEW_OWN,
    Permission.ANALYTICS_EXPORT,

    // Messaging permissions
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_RECEIVE,

    // Financial permissions
    Permission.FINANCIAL_VIEW_OWN,
    Permission.FINANCIAL_EXPORT,
    Permission.PAYMENT_CREATE
  ],

  [UserRole.PRODUCTION]: [
    // Pitch permissions
    Permission.PITCH_CREATE,
    Permission.PITCH_EDIT_OWN,
    Permission.PITCH_DELETE_OWN,
    Permission.PITCH_VIEW_PUBLIC,
    Permission.PITCH_VIEW_PRIVATE, // with NDA
    Permission.PITCH_PUBLISH,

    // NDA permissions
    Permission.NDA_REQUEST,
    Permission.NDA_SIGN,
    Permission.NDA_VIEW_OWN,

    // Investment permissions (production companies can also invest)
    Permission.INVESTMENT_CREATE,
    Permission.INVESTMENT_VIEW_OWN,
    Permission.PORTFOLIO_VIEW,

    // Document permissions
    Permission.DOCUMENT_VIEW_PUBLIC,
    Permission.DOCUMENT_VIEW_PRIVATE, // with NDA
    Permission.DOCUMENT_UPLOAD,

    // User permissions
    Permission.USER_VIEW_OWN,
    Permission.USER_EDIT_OWN,

    // Analytics permissions
    Permission.ANALYTICS_VIEW_OWN,

    // Messaging permissions
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_RECEIVE,

    // Financial permissions
    Permission.FINANCIAL_VIEW_OWN,
    Permission.PAYMENT_CREATE,

    // Production-specific permissions
    Permission.PRODUCTION_CREATE_PROJECT,
    Permission.PRODUCTION_MANAGE_CREW,
    Permission.PRODUCTION_SCHEDULE,
    Permission.PRODUCTION_BUDGET
  ],

  [UserRole.VIEWER]: [
    // Watchers are an audience-only tier: browse, like, save, and comment.
    // They cannot create pitches — creating/publishing requires signing up
    // as a Creator, Investor, or Production account.
    Permission.PITCH_VIEW_PUBLIC,
    Permission.DOCUMENT_VIEW_PUBLIC,
    Permission.USER_VIEW_OWN,
    Permission.USER_EDIT_OWN
  ]
};

export interface RBACContext {
  userId: number;
  userRole: UserRole;
  userType?: string;
  additionalPermissions?: Permission[];
  resourceOwnerId?: number;
  resourceId?: number;
  metadata?: Record<string, any>;
}

export class RBACService {
  /**
   * Check if a user has a specific permission
   */
  static hasPermission(
    context: RBACContext,
    permission: Permission
  ): boolean {
    // Get base permissions for role
    const basePermissions = rolePermissions[context.userRole] || [];
    
    // Add any additional permissions
    const allPermissions = [
      ...basePermissions,
      ...(context.additionalPermissions || [])
    ];

    return allPermissions.includes(permission);
  }

  /**
   * Check if a user can perform an action on a resource
   */
  static canAccess(
    context: RBACContext,
    permission: Permission,
    options?: {
      checkOwnership?: boolean;
      requireNDA?: boolean;
      requirePublished?: boolean;
    }
  ): boolean {
    // First check basic permission
    if (!this.hasPermission(context, permission)) {
      return false;
    }

    // Check ownership if required
    if (options?.checkOwnership) {
      const isOwner = context.userId === context.resourceOwnerId;
      
      // If permission is for "own" resources, must be owner
      if (permission.includes('.own') && !isOwner) {
        return false;
      }
      
      // If permission is for "any" resources, allowed regardless of ownership
      if (permission.includes('.any')) {
        return true;
      }
      
      // For other permissions, ownership grants access
      return isOwner;
    }

    // Check NDA requirement
    if (options?.requireNDA && context.metadata?.hasNDA !== true) {
      return false;
    }

    // Check published status
    if (options?.requirePublished && context.metadata?.isPublished !== true) {
      return false;
    }

    return true;
  }

  /**
   * Get all permissions for a user
   */
  static getUserPermissions(context: RBACContext): Permission[] {
    const basePermissions = rolePermissions[context.userRole] || [];
    return [
      ...basePermissions,
      ...(context.additionalPermissions || [])
    ];
  }

  /**
   * Check multiple permissions (all must pass)
   */
  static hasAllPermissions(
    context: RBACContext,
    permissions: Permission[]
  ): boolean {
    return permissions.every(permission => 
      this.hasPermission(context, permission)
    );
  }

  /**
   * Check multiple permissions (at least one must pass)
   */
  static hasAnyPermission(
    context: RBACContext,
    permissions: Permission[]
  ): boolean {
    return permissions.some(permission => 
      this.hasPermission(context, permission)
    );
  }

  /**
   * Filter a list of resources based on permissions
   */
  static filterByPermission<T extends { id: number; ownerId?: number }>(
    context: RBACContext,
    resources: T[],
    permission: Permission
  ): T[] {
    return resources.filter(resource => {
      const resourceContext = {
        ...context,
        resourceId: resource.id,
        resourceOwnerId: resource.ownerId
      };
      
      return this.canAccess(resourceContext, permission, {
        checkOwnership: true
      });
    });
  }

  /**
   * Get role from user type (backward compatibility)
   */
  static getRoleFromUserType(userType?: string): UserRole {
    switch (userType?.toLowerCase()) {
      case 'creator':
        return UserRole.CREATOR;
      case 'investor':
        return UserRole.INVESTOR;
      case 'production':
        return UserRole.PRODUCTION;
      case 'admin':
        return UserRole.ADMIN;
      default:
        return UserRole.VIEWER;
    }
  }

  /**
   * Generate permission error message
   */
  static getPermissionError(permission: Permission): string {
    const action = permission.split('.').pop();
    const resource = permission.split('.')[0];
    
    return `You don't have permission to ${action} ${resource}s`;
  }

  /**
   * Check if user is admin
   */
  static isAdmin(context: RBACContext): boolean {
    return context.userRole === UserRole.ADMIN;
  }

  /**
   * Check if user can moderate content
   */
  static canModerate(context: RBACContext): boolean {
    return this.hasPermission(context, Permission.PITCH_MODERATE);
  }
}

// Export for use in middleware
export const rbac = RBACService;