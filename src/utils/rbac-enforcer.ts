/**
 * RBAC Enforcer Utility
 * Unified permission checking for all route handlers
 */

import { RBACService, Permission, UserRole, RBACContext } from '../services/rbac.service';
import { getCorsHeaders } from './response';

export interface AuthenticatedUser {
  id: string | number;
  email?: string;
  name?: string;
  user_type?: string;
  userType?: string;
  role?: string;
}

export interface RBACResult {
  authorized: boolean;
  user?: AuthenticatedUser;
  context?: RBACContext;
  response?: Response;
  errorMessage?: string;
}

/**
 * Portal configuration - maps portals to required user types
 */
export const PortalAccessMap: Record<string, string[]> = {
  creator: ['creator', 'admin'],
  investor: ['investor', 'admin'],
  production: ['production', 'admin'],
  // Watchers are stored as `viewer` user_type in the database; `watcher` is
  // a legacy alias from an earlier rename.
  watcher: ['viewer', 'watcher', 'admin'],
  admin: ['admin']
};

/**
 * Route permission mappings - defines what permissions are needed for each route pattern
 */
export const RoutePermissions: Record<string, Permission[]> = {
  // Creator routes
  '/api/creator/dashboard': [Permission.ANALYTICS_VIEW_OWN],
  '/api/creator/pitches': [Permission.PITCH_CREATE, Permission.PITCH_EDIT_OWN],
  '/api/creator/revenue': [Permission.FINANCIAL_VIEW_OWN],
  '/api/creator/contracts': [Permission.FINANCIAL_VIEW_OWN],
  '/api/creator/analytics': [Permission.ANALYTICS_VIEW_OWN],
  '/api/creator/investors': [Permission.ANALYTICS_VIEW_OWN],

  // Investor routes
  '/api/investor/dashboard': [Permission.PORTFOLIO_VIEW],
  '/api/investor/portfolio': [Permission.PORTFOLIO_VIEW],
  '/api/investor/watchlist': [Permission.PORTFOLIO_VIEW],
  '/api/investor/investments': [Permission.INVESTMENT_VIEW_OWN],
  '/api/investor/analytics': [Permission.ANALYTICS_VIEW_OWN],
  '/api/investor/transactions': [Permission.FINANCIAL_VIEW_OWN],

  // Production routes
  '/api/production/dashboard': [Permission.PRODUCTION_CREATE_PROJECT],
  '/api/production/analytics': [Permission.ANALYTICS_VIEW_OWN],
  '/api/production/projects': [Permission.PRODUCTION_CREATE_PROJECT],
  '/api/production/pipeline': [Permission.PRODUCTION_CREATE_PROJECT],
  '/api/production/talent': [Permission.PRODUCTION_MANAGE_CREW],
  '/api/production/budget': [Permission.PRODUCTION_BUDGET],
  '/api/production/schedule': [Permission.PRODUCTION_SCHEDULE],

  // NDA routes
  '/api/ndas': [Permission.NDA_VIEW_OWN],
  '/api/nda/request': [Permission.NDA_REQUEST],
  '/api/nda/sign': [Permission.NDA_SIGN],
  '/api/nda/approve': [Permission.NDA_APPROVE],
  '/api/nda/reject': [Permission.NDA_REJECT],

  // Pitch routes
  '/api/pitches': [Permission.PITCH_VIEW_PUBLIC],
  '/api/pitch/create': [Permission.PITCH_CREATE],
  '/api/pitch/edit': [Permission.PITCH_EDIT_OWN],
  '/api/pitch/delete': [Permission.PITCH_DELETE_OWN],
  '/api/pitch/publish': [Permission.PITCH_PUBLISH],

  // Document routes
  '/api/documents/upload': [Permission.DOCUMENT_UPLOAD],
  '/api/documents/view': [Permission.DOCUMENT_VIEW_PUBLIC],
  '/api/documents/delete': [Permission.DOCUMENT_DELETE_OWN],

  // User routes
  '/api/user/profile': [Permission.USER_VIEW_OWN],
  '/api/user/settings': [Permission.USER_EDIT_OWN],

  // Message routes
  '/api/messages': [Permission.MESSAGE_SEND, Permission.MESSAGE_RECEIVE],

  // Admin routes
  '/api/admin': [Permission.ADMIN_ACCESS]
};

/**
 * Build RBAC context from authenticated user
 */
export function buildRBACContext(user: AuthenticatedUser): RBACContext {
  const userType = user.user_type || user.userType || user.role || 'viewer';
  const userRole = RBACService.getRoleFromUserType(userType);

  return {
    userId: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
    userRole,
    userType
  };
}

/**
 * Check if user has portal access
 */
export function checkPortalAccess(user: AuthenticatedUser, portal: string): boolean {
  const userType = (user.user_type || user.userType || user.role || '').toLowerCase();
  const allowedTypes = PortalAccessMap[portal.toLowerCase()] || [];
  const hasAccess = allowedTypes.includes(userType);

  // Diagnostic logging for portal access issues
  if (!hasAccess) {
    console.warn(`[RBAC] Portal access DENIED: portal=${portal}, userType='${userType}', allowed=${JSON.stringify(allowedTypes)}, user=${JSON.stringify({ id: user.id, user_type: user.user_type, userType: user.userType, role: user.role })}`);
  }

  return hasAccess;
}

/**
 * Get required permissions for a route
 */
export function getRoutePermissions(pathname: string): Permission[] {
  // Exact match first
  if (RoutePermissions[pathname]) {
    return RoutePermissions[pathname];
  }

  // Pattern matching for dynamic routes
  for (const [pattern, permissions] of Object.entries(RoutePermissions)) {
    // Convert pattern to regex (handles /api/pitch/:id style routes)
    const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}(/.*)?$`);
    if (regex.test(pathname)) {
      return permissions;
    }
  }

  return [];
}

/**
 * Enforce RBAC on a request
 */
export function enforceRBAC(
  user: AuthenticatedUser,
  pathname: string,
  origin?: string | null
): RBACResult {
  const context = buildRBACContext(user);

  // First check portal-specific access based on route path
  const portalMatch = pathname.match(/^\/api\/(creator|investor|production)\//);
  if (portalMatch) {
    const portal = portalMatch[1];
    if (!checkPortalAccess(user, portal)) {
      const userType = user.user_type || user.userType || user.role || 'unknown';
      return {
        authorized: false,
        user,
        context,
        errorMessage: `Access denied. ${portal} portal requires ${portal} role, you have ${userType} role.`,
        response: new Response(JSON.stringify({
          success: false,
          error: `Access denied. This endpoint is only accessible to ${portal} users.`,
          code: 'PORTAL_ACCESS_DENIED'
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(origin)
          }
        })
      };
    }
  }

  const requiredPermissions = getRoutePermissions(pathname);

  // If no permissions required, allow access
  if (requiredPermissions.length === 0) {
    return { authorized: true, user, context };
  }

  // Check if user has any of the required permissions
  if (RBACService.hasAnyPermission(context, requiredPermissions)) {
    return { authorized: true, user, context };
  }

  // Access denied
  const missingPermission = requiredPermissions.find(p => !RBACService.hasPermission(context, p));
  const errorMessage = missingPermission
    ? RBACService.getPermissionError(missingPermission)
    : 'Insufficient permissions';

  return {
    authorized: false,
    user,
    context,
    errorMessage,
    response: new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      code: 'PERMISSION_DENIED'
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    })
  };
}

/**
 * Enforce portal-specific access
 */
export function enforcePortalAccess(
  user: AuthenticatedUser,
  portal: string,
  origin?: string | null
): RBACResult {
  if (checkPortalAccess(user, portal)) {
    return { authorized: true, user, context: buildRBACContext(user) };
  }

  const userType = user.user_type || user.userType || user.role || 'unknown';
  return {
    authorized: false,
    user,
    errorMessage: `${portal.charAt(0).toUpperCase() + portal.slice(1)} portal access required. Your account type is: ${userType}`,
    response: new Response(JSON.stringify({
      success: false,
      error: `${portal.charAt(0).toUpperCase() + portal.slice(1)} portal access required`,
      code: 'PORTAL_ACCESS_DENIED',
      details: {
        required: portal,
        current: userType
      }
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    })
  };
}

/**
 * Check specific permission
 */
export function checkPermission(
  user: AuthenticatedUser,
  permission: Permission,
  resourceOwnerId?: number
): boolean {
  const context = buildRBACContext(user);

  if (resourceOwnerId !== undefined) {
    context.resourceOwnerId = resourceOwnerId;
    return RBACService.canAccess(context, permission, { checkOwnership: true });
  }

  return RBACService.hasPermission(context, permission);
}

/**
 * Check multiple permissions (all must pass)
 */
export function checkAllPermissions(
  user: AuthenticatedUser,
  permissions: Permission[]
): boolean {
  const context = buildRBACContext(user);
  return RBACService.hasAllPermissions(context, permissions);
}

/**
 * Check multiple permissions (at least one must pass)
 */
export function checkAnyPermission(
  user: AuthenticatedUser,
  permissions: Permission[]
): boolean {
  const context = buildRBACContext(user);
  return RBACService.hasAnyPermission(context, permissions);
}

/**
 * Create a standardized forbidden response
 */
export function forbiddenResponse(
  message: string,
  origin?: string | null,
  details?: Record<string, any>
): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    code: 'FORBIDDEN',
    ...details
  }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin)
    }
  });
}

/**
 * Create a standardized unauthorized response
 */
export function unauthorizedResponse(
  message: string = 'Authentication required',
  origin?: string | null
): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    code: 'UNAUTHORIZED'
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin)
    }
  });
}

// Re-export Permission enum for convenience
export { Permission, UserRole, RBACService };
