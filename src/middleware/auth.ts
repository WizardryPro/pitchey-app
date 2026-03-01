/**
 * Authentication Middleware Types and Guards
 * Real auth is handled by Better Auth in worker-integrated.ts.
 * These wrappers reject unauthenticated requests with 401.
 */

export type UserRole = 'creator' | 'investor' | 'production' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Middleware that requires authentication.
 * Rejects with 401 if request.user is not set by upstream auth.
 */
export function requireAuth(handler: (request: Request, user: AuthUser) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const user = (request as any).user as AuthUser | undefined;
    if (!user?.id) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return handler(request, user);
  };
}

/**
 * Middleware that requires a specific role.
 * Rejects with 401 if unauthenticated, 403 if wrong role.
 */
export function requireRole(roles: UserRole | UserRole[]) {
  return (handler: (request: Request, user: AuthUser) => Promise<Response>) => {
    return async (request: Request): Promise<Response> => {
      const user = (request as any).user as AuthUser | undefined;
      if (!user?.id) {
        return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      if (!allowedRoles.includes(user.role)) {
        return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return handler(request, user);
    };
  };
}
