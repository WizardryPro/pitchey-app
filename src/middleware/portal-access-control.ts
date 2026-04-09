/**
 * Portal Access Control Middleware - Comprehensive Implementation
 * Enforces strict portal boundaries and validates business rules
 */

import type { Env } from '../db/connection';
import { getDb } from '../db/connection';
import { UserRole, Permission, RBAC, PermissionContext, Visibility } from './rbac';
import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';
import { getCorsHeaders } from '../utils/response';

// Portal types
export type PortalType = 'creator' | 'investor' | 'production';

// Portal access levels
export enum AccessLevel {
  READ_ONLY = 'read_only',
  READ_WRITE = 'read_write',
  ADMIN = 'admin',
  OWNER = 'owner'
}

// Portal configuration
interface PortalConfig {
  allowedUserTypes: UserRole[];
  requiredPermissions: Permission[];
  restrictedEndpoints: string[];
  allowedEndpoints: string[];
  crossPortalAccess: {
    [key in PortalType]?: {
      allowedEndpoints: string[];
      requiredPermissions: Permission[];
    }
  };
}

// Portal access configurations
export const PORTAL_CONFIGS: Record<PortalType, PortalConfig> = {
  creator: {
    allowedUserTypes: [UserRole.CREATOR, UserRole.ADMIN],
    requiredPermissions: [Permission.PITCH_CREATE, Permission.PITCH_READ],
    restrictedEndpoints: [
      '/api/investor/portfolio',
      '/api/investor/investments',
      '/api/production/pipeline',
      '/api/production/talent',
      '/api/admin'
    ],
    allowedEndpoints: [
      '/api/creator',
      '/api/pitches',
      '/api/documents',
      '/api/ndas',
      '/api/messages',
      '/api/analytics',
      '/api/notifications',
      '/api/profile'
    ],
    crossPortalAccess: {
      investor: {
        allowedEndpoints: ['/api/investor/browse', '/api/investor/search'],
        requiredPermissions: [Permission.PITCH_READ]
      },
      production: {
        allowedEndpoints: ['/api/production/browse', '/api/production/search'],
        requiredPermissions: [Permission.PITCH_READ]
      }
    }
  },
  
  investor: {
    allowedUserTypes: [UserRole.INVESTOR, UserRole.ADMIN],
    requiredPermissions: [Permission.INVESTMENT_CREATE, Permission.NDA_REQUEST],
    restrictedEndpoints: [
      '/api/creator/revenue',
      '/api/creator/contracts',
      '/api/production/pipeline',
      '/api/production/crew',
      '/api/admin'
    ],
    allowedEndpoints: [
      '/api/investor',
      '/api/pitches/browse',
      '/api/pitches/search',
      '/api/investments',
      '/api/ndas',
      '/api/messages',
      '/api/portfolio',
      '/api/saved-pitches',
      '/api/profile'
    ],
    crossPortalAccess: {
      creator: {
        allowedEndpoints: ['/api/creator/pitches', '/api/creator/contact'],
        requiredPermissions: [Permission.NDA_SIGN, Permission.INVESTMENT_CREATE]
      }
    }
  },
  
  production: {
    allowedUserTypes: [UserRole.PRODUCTION, UserRole.ADMIN],
    requiredPermissions: [Permission.INVESTMENT_CREATE, Permission.NDA_REQUEST],
    restrictedEndpoints: [
      '/api/creator/revenue',
      '/api/investor/portfolio',
      '/api/investor/investments',
      '/api/admin'
    ],
    allowedEndpoints: [
      '/api/production',
      '/api/pitches/browse',
      '/api/pitches/search',
      '/api/projects',
      '/api/acquisitions',
      '/api/talent',
      '/api/crew',
      '/api/locations',
      '/api/budget',
      '/api/schedule',
      '/api/ndas',
      '/api/messages',
      '/api/profile'
    ],
    crossPortalAccess: {
      creator: {
        allowedEndpoints: ['/api/creator/pitches', '/api/creator/contact'],
        requiredPermissions: [Permission.NDA_SIGN, Permission.INVESTMENT_APPROVE]
      }
    }
  }
};

// Portal access result
interface PortalAccessResult {
  allowed: boolean;
  userType: UserRole;
  portal: PortalType;
  accessLevel: AccessLevel;
  restrictions: string[];
  user: any;
  reason?: string;
}

// Portal access violation types
export enum ViolationType {
  WRONG_USER_TYPE = 'wrong_user_type',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  RESTRICTED_ENDPOINT = 'restricted_endpoint',
  CROSS_PORTAL_DENIED = 'cross_portal_denied',
  BUSINESS_RULE_VIOLATION = 'business_rule_violation'
}

export interface AccessViolation {
  type: ViolationType;
  message: string;
  endpoint: string;
  userType: UserRole;
  requiredType: UserRole[];
  requiredPermissions?: Permission[];
}

export class PortalAccessController {
  private env: Env;
  private db: any;
  private violations: AccessViolation[] = [];

  constructor(env: Env) {
    this.env = env;
    this.db = getDb(env);
  }

  /**
   * Main portal access validation
   */
  async validatePortalAccess(
    request: Request,
    portal: PortalType,
    user: any
  ): Promise<PortalAccessResult> {
    // Ensure request.url is a full URL
    let url: URL;
    try {
      url = new URL(request.url);
    } catch (error) {
      // If URL is relative, prepend a base URL
      const baseUrl = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
      url = new URL(request.url.startsWith('/') ? request.url : `/${request.url}`, baseUrl);
    }
    const endpoint = url.pathname;
    const userType = user.userType || user.user_type || user.role;
    
    // Convert string to UserRole enum
    let userRole: UserRole;
    switch (userType) {
      case 'creator':
        userRole = UserRole.CREATOR;
        break;
      case 'investor':
        userRole = UserRole.INVESTOR;
        break;
      case 'production':
        userRole = UserRole.PRODUCTION;
        break;
      case 'admin':
        userRole = UserRole.ADMIN;
        break;
      default:
        userRole = UserRole.VIEWER;
    }

    const config = PORTAL_CONFIGS[portal];
    
    // 1. Check user type permissions
    if (!config.allowedUserTypes.includes(userRole) && userRole !== UserRole.ADMIN) {
      this.addViolation({
        type: ViolationType.WRONG_USER_TYPE,
        message: `User type '${userType}' cannot access ${portal} portal`,
        endpoint,
        userType: userRole,
        requiredType: config.allowedUserTypes
      });
      
      return this.createDeniedResult(userRole, portal, user);
    }

    // 2. Check endpoint restrictions
    const isRestricted = config.restrictedEndpoints.some(restricted => 
      endpoint.startsWith(restricted)
    );
    
    if (isRestricted) {
      this.addViolation({
        type: ViolationType.RESTRICTED_ENDPOINT,
        message: `Endpoint '${endpoint}' is restricted for ${portal} portal`,
        endpoint,
        userType: userRole,
        requiredType: []
      });
      
      return this.createDeniedResult(userRole, portal, user);
    }

    // 3. Check if endpoint is allowed for this portal
    const isAllowed = config.allowedEndpoints.some(allowed => 
      endpoint.startsWith(allowed)
    );

    // 4. Check cross-portal access
    const crossPortalResult = this.checkCrossPortalAccess(endpoint, portal, userRole, config);
    
    if (!isAllowed && !crossPortalResult.allowed) {
      this.addViolation({
        type: ViolationType.CROSS_PORTAL_DENIED,
        message: `Cross-portal access denied for ${endpoint}`,
        endpoint,
        userType: userRole,
        requiredType: config.allowedUserTypes,
        requiredPermissions: crossPortalResult.requiredPermissions
      });
      
      return this.createDeniedResult(userRole, portal, user);
    }

    // 5. Check required permissions
    const permissionContext: PermissionContext = {
      userId: user.id,
      userRole,
      teamIds: user.teamIds,
      customPermissions: user.customPermissions
    };

    const hasRequiredPermissions = config.requiredPermissions.every(perm =>
      RBAC.hasPermission(permissionContext, perm)
    );

    if (!hasRequiredPermissions) {
      this.addViolation({
        type: ViolationType.INSUFFICIENT_PERMISSIONS,
        message: `Insufficient permissions for ${portal} portal`,
        endpoint,
        userType: userRole,
        requiredType: config.allowedUserTypes,
        requiredPermissions: config.requiredPermissions
      });
      
      return this.createDeniedResult(userRole, portal, user);
    }

    // 6. Validate business rules
    const businessRuleResult = await this.validateBusinessRules(request, portal, user);
    if (!businessRuleResult.valid) {
      this.addViolation({
        type: ViolationType.BUSINESS_RULE_VIOLATION,
        message: businessRuleResult.reason || 'Business rule violation',
        endpoint,
        userType: userRole,
        requiredType: []
      });
      
      return this.createDeniedResult(userRole, portal, user);
    }

    // Access granted
    return {
      allowed: true,
      userType: userRole,
      portal,
      accessLevel: this.determineAccessLevel(userRole, portal, user),
      restrictions: this.getAccessRestrictions(userRole, portal),
      user
    };
  }

  /**
   * Check cross-portal access permissions
   */
  private checkCrossPortalAccess(
    endpoint: string,
    currentPortal: PortalType,
    userRole: UserRole,
    config: PortalConfig
  ): { allowed: boolean; requiredPermissions: Permission[] } {
    for (const [targetPortal, crossConfig] of Object.entries(config.crossPortalAccess || {})) {
      const isTargetEndpoint = crossConfig.allowedEndpoints.some(allowed =>
        endpoint.startsWith(allowed)
      );
      
      if (isTargetEndpoint) {
        const permissionContext: PermissionContext = {
          userId: 0, // Will be set later
          userRole,
          teamIds: [],
          customPermissions: []
        };

        const hasPermissions = crossConfig.requiredPermissions.every(perm =>
          RBAC.hasPermission(permissionContext, perm)
        );

        return {
          allowed: hasPermissions,
          requiredPermissions: crossConfig.requiredPermissions
        };
      }
    }

    return { allowed: false, requiredPermissions: [] };
  }

  /**
   * Validate business rules for portal access
   */
  private async validateBusinessRules(
    request: Request,
    portal: PortalType,
    user: any
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!this.db) return { valid: true };

    try {
      const url = new URL(request.url);
      const endpoint = url.pathname;
      const method = request.method;

      // Rule 1: Investors can only access creator content after NDA approval
      if (portal === 'investor' && endpoint.includes('/creator/') && endpoint.includes('/private')) {
        const ndaCheck = await this.db`
          SELECT n.id, n.access_granted
          FROM ndas n
          JOIN pitches p ON n.pitch_id = p.id
          WHERE n.signer_id = ${user.id}
          AND p.user_id = ${url.searchParams.get('creatorId')}
          AND n.access_granted = true
          AND n.access_granted = true
        `;

        if (ndaCheck.length === 0) {
          return { valid: false, reason: 'NDA approval required to access creator private content' };
        }
      }

      // Rule 2: Production companies need verification for high-value deals
      if (portal === 'production' && endpoint.includes('/investment') && method === 'POST') {
        const userVerification = await this.db`
          SELECT company_verified, subscription_tier
          FROM users
          WHERE id = ${user.id}
        `;

        if (!userVerification[0]?.company_verified && 
            url.searchParams.get('amount') && 
            Number(url.searchParams.get('amount')) > 100000) {
          return { valid: false, reason: 'Company verification required for investments over €100,000' };
        }
      }

      // Rule 3: Creators cannot access other creators' revenue data
      if (portal === 'creator' && endpoint.includes('/revenue') && method === 'GET') {
        const targetUserId = url.searchParams.get('userId') || url.pathname.split('/')[3];
        if (targetUserId && targetUserId !== user.id.toString()) {
          return { valid: false, reason: 'Cannot access other creators\' revenue data' };
        }
      }

      // Rule 4: Rate limiting for cross-portal interactions
      if (this.isCrossPortalEndpoint(endpoint, portal)) {
        const rateLimitResult = await this.checkCrossPortalRateLimit(user.id, endpoint);
        if (!rateLimitResult.allowed) {
          return { valid: false, reason: 'Rate limit exceeded for cross-portal access' };
        }
      }

      return { valid: true };

    } catch (error) {
      console.error('Business rule validation error:', error);
      return { valid: true }; // Fail open for now
    }
  }

  /**
   * Check if endpoint is cross-portal
   */
  private isCrossPortalEndpoint(endpoint: string, currentPortal: PortalType): boolean {
    const otherPortals = Object.keys(PORTAL_CONFIGS).filter(p => p !== currentPortal);
    return otherPortals.some(portal => endpoint.includes(`/${portal}/`));
  }

  /**
   * Rate limit cross-portal access
   */
  private async checkCrossPortalRateLimit(
    userId: number,
    endpoint: string
  ): Promise<{ allowed: boolean; resetTime?: Date }> {
    if (!this.env.KV) return { allowed: true };

    try {
      const key = `cross_portal_rate_limit:${userId}:${endpoint}`;
      const current = await this.env.KV.get(key);
      const limit = 10; // 10 requests per hour
      const window = 3600; // 1 hour in seconds

      if (!current) {
        await this.env.KV.put(key, '1', { expirationTtl: window });
        return { allowed: true };
      }

      const count = parseInt(current);
      if (count >= limit) {
        return { 
          allowed: false, 
          resetTime: new Date(Date.now() + window * 1000) 
        };
      }

      await this.env.KV.put(key, (count + 1).toString(), { expirationTtl: window });
      return { allowed: true };

    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true }; // Fail open
    }
  }

  /**
   * Determine access level based on user role and portal
   */
  private determineAccessLevel(
    userRole: UserRole,
    portal: PortalType,
    user: any
  ): AccessLevel {
    if (userRole === UserRole.ADMIN) {
      return AccessLevel.ADMIN;
    }

    // Check if user owns resources in this portal
    if (this.isResourceOwner(userRole, portal, user)) {
      return AccessLevel.OWNER;
    }

    // Check subscription tier for enhanced access
    if (user.subscription_tier === 'pro' || user.subscription_tier === 'investor') {
      return AccessLevel.READ_WRITE;
    }

    return AccessLevel.READ_ONLY;
  }

  /**
   * Check if user owns resources in portal
   */
  private isResourceOwner(userRole: UserRole, portal: PortalType, user: any): boolean {
    // This would be expanded with actual ownership checks
    switch (portal) {
      case 'creator':
        return userRole === UserRole.CREATOR;
      case 'investor':
        return userRole === UserRole.INVESTOR && user.verified;
      case 'production':
        return userRole === UserRole.PRODUCTION && user.company_verified;
      default:
        return false;
    }
  }

  /**
   * Get access restrictions for user
   */
  private getAccessRestrictions(userRole: UserRole, portal: PortalType): string[] {
    const restrictions: string[] = [];

    if (userRole === UserRole.VIEWER) {
      restrictions.push('read_only_access');
    }

    switch (portal) {
      case 'creator':
        if (userRole !== UserRole.CREATOR) {
          restrictions.push('cannot_create_pitches', 'cannot_access_revenue_data');
        }
        break;
      case 'investor':
        if (userRole !== UserRole.INVESTOR) {
          restrictions.push('cannot_create_investments', 'cannot_access_portfolio');
        }
        break;
      case 'production':
        if (userRole !== UserRole.PRODUCTION) {
          restrictions.push('cannot_manage_projects', 'cannot_access_production_tools');
        }
        break;
    }

    return restrictions;
  }

  /**
   * Add access violation
   */
  private addViolation(violation: AccessViolation): void {
    this.violations.push(violation);
    
    // Log violation for monitoring
    console.warn('Portal Access Violation:', {
      type: violation.type,
      endpoint: violation.endpoint,
      userType: violation.userType,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create denied access result
   */
  private createDeniedResult(
    userType: UserRole,
    portal: PortalType,
    user: any
  ): PortalAccessResult {
    return {
      allowed: false,
      userType,
      portal,
      accessLevel: AccessLevel.READ_ONLY,
      restrictions: ['access_denied', ...this.getAccessRestrictions(userType, portal)],
      user
    };
  }

  /**
   * Get all violations for this request
   */
  public getViolations(): AccessViolation[] {
    return this.violations;
  }

  /**
   * Clear violations
   */
  public clearViolations(): void {
    this.violations = [];
  }
}

/**
 * Portal access middleware factory
 */
export function createPortalAccessMiddleware(portal: PortalType) {
  return async (request: Request, env: Env, user: any): Promise<Response | null> => {
    const controller = new PortalAccessController(env);
    const result = await controller.validatePortalAccess(request, portal, user);

    if (!result.allowed) {
      const violations = controller.getViolations();
      const builder = new ApiResponseBuilder(request);

      return builder.error(ErrorCode.FORBIDDEN, 'Portal access denied', {
        portal,
        violations,
        allowedUserTypes: PORTAL_CONFIGS[portal].allowedUserTypes,
        userType: result.userType
      });
    }

    // Attach portal context to request
    (request as any).portalAccess = result;
    return null; // Continue processing
  };
}

/**
 * Portal route protection decorator
 */
export function requirePortalAccess(portal: PortalType) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(request: Request, ...args: any[]) {
      const env = (this as any).env; // Assume env is available in context
      const user = (request as any).user; // Assume user is attached by auth middleware

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        }), {
          status: 401,
          headers: getCorsHeaders(request.headers.get('Origin'))
        });
      }

      const middleware = createPortalAccessMiddleware(portal);
      const accessResult = await middleware(request, env, user);

      if (accessResult) {
        return accessResult; // Access denied
      }

      return method.call(this, request, ...args);
    };

    return descriptor;
  };
}

/**
 * Extract portal from URL path
 */
export function extractPortalFromPath(pathname: string): PortalType | null {
  if (pathname.includes('/creator/') || pathname.includes('/api/creator')) {
    return 'creator';
  } else if (pathname.includes('/investor/') || pathname.includes('/api/investor')) {
    return 'investor';
  } else if (pathname.includes('/production/') || pathname.includes('/api/production')) {
    return 'production';
  }
  return null;
}

/**
 * Validate portal consistency
 */
export async function validatePortalConsistency(
  env: Env,
  userId: number,
  targetPortal: PortalType
): Promise<{ valid: boolean; reason?: string }> {
  const db = getDb(env);
  if (!db) return { valid: true };

  try {
    const user = await db`
      SELECT user_type, subscription_tier, email_verified, company_verified
      FROM users
      WHERE id = ${userId}
    `;

    if (user.length === 0) {
      return { valid: false, reason: 'User not found' };
    }

    const userType = user[0].user_type;
    const expectedUserType = targetPortal;

    if (userType !== expectedUserType) {
      return {
        valid: false,
        reason: `User type '${userType}' does not match portal '${targetPortal}'`
      };
    }

    // Additional validation based on portal
    switch (targetPortal) {
      case 'production':
        if (!user[0].company_verified) {
          return {
            valid: false,
            reason: 'Company verification required for production portal'
          };
        }
        break;
      
      case 'investor':
        if (!user[0].email_verified) {
          return {
            valid: false,
            reason: 'Email verification required for investor portal'
          };
        }
        break;
    }

    return { valid: true };

  } catch (error) {
    console.error('Portal consistency validation error:', error);
    return { valid: false, reason: 'Validation error' };
  }
}

