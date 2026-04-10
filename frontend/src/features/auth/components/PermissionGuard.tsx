import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions, type Permission } from '../hooks/usePermissions';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { getPortalPath } from '@/utils/navigation';

interface PermissionGuardProps {
  /** Single permission required to render children */
  requires?: Permission | string;
  /** Any of these permissions grants access */
  requiresAny?: (Permission | string)[];
  /** All of these permissions are required */
  requiresAll?: (Permission | string)[];
  /** Where to redirect if denied (default: login page based on portal) */
  redirectTo?: string;
  /** If true, hide content silently instead of redirecting */
  hideIfDenied?: boolean;
  /** Fallback content to show when access is denied and hideIfDenied is true */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Component-level permission guard.
 *
 * Usage:
 *   <PermissionGuard requires={Permission.PITCH_CREATE}>
 *     <CreatePitchButton />
 *   </PermissionGuard>
 *
 *   <PermissionGuard requiresAny={[Permission.INVESTMENT_CREATE, Permission.PORTFOLIO_VIEW]} hideIfDenied>
 *     <InvestmentSection />
 *   </PermissionGuard>
 */
export default function PermissionGuard({
  requires,
  requiresAny,
  requiresAll,
  redirectTo,
  hideIfDenied = false,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { isAuthenticated } = useBetterAuthStore();
  const { hasPermission, hasAnyPermission, hasAllPermissions, userRole } = usePermissions();

  // Not authenticated at all — redirect to login
  if (!isAuthenticated) {
    if (hideIfDenied) return <>{fallback}</>;
    return <Navigate to={redirectTo || '/portals'} replace />;
  }

  // Check permissions
  let allowed = true;

  if (requires) {
    allowed = hasPermission(requires);
  }

  if (requiresAny && allowed) {
    allowed = hasAnyPermission(requiresAny);
  }

  if (requiresAll && allowed) {
    allowed = hasAllPermissions(requiresAll);
  }

  if (!allowed) {
    if (hideIfDenied) return <>{fallback}</>;
    // Redirect to user's own dashboard if they don't have permission
    const defaultRedirect = redirectTo || `/${getPortalPath(userRole)}/dashboard`;
    return <Navigate to={defaultRedirect} replace />;
  }

  return <>{children}</>;
}

/**
 * Route-level permission guard for wrapping Route elements.
 * Same API as PermissionGuard but always redirects (never hides).
 */
export function PermissionRoute({
  requires,
  requiresAny,
  requiresAll,
  redirectTo,
  children,
}: Omit<PermissionGuardProps, 'hideIfDenied' | 'fallback'>) {
  return (
    <PermissionGuard
      requires={requires}
      requiresAny={requiresAny}
      requiresAll={requiresAll}
      redirectTo={redirectTo}
    >
      {children}
    </PermissionGuard>
  );
}
