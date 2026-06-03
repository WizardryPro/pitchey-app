/**
 * Navigation utility functions for portal-specific routing
 */

/**
 * Get the correct dashboard route based on user type
 * @param userType - The type of user (creator, investor, production, admin)
 * @returns The appropriate dashboard route
 */
export function getDashboardRoute(userType?: string | null): string {
  if (!userType) return '/';

  switch (userType) {
    case 'creator':
      return '/creator/dashboard';
    case 'investor':
      return '/investor/dashboard';
    case 'production':
      return '/production/dashboard';
    case 'watcher':
    case 'viewer':
      return '/watcher/dashboard';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/';
  }
}

/**
 * Map a DB user_type to its portal route prefix.
 * The DB stores 'viewer' but routes use '/watcher'.
 */
export function getPortalPath(userType?: string | null): string {
  if (!userType) return '';
  if (userType === 'viewer') return 'watcher';
  return userType;
}

/**
 * In-portal "browse pitches" route for a user type. Keeps the portal chrome
 * (PortalLayout header + sidebar) instead of dumping the user onto the standalone
 * /marketplace, whose own header replaces the portal chrome and causes a jarring
 * layout swap ("flutter to the old layout"). Single source of truth so the
 * marketplace links across headers/sidebars/dashboards can't drift apart again.
 * Unauthenticated / unknown falls back to the standalone marketplace.
 */
export function getBrowsePath(userType?: string | null): string {
  switch (userType) {
    case 'creator': return '/creator/browse';
    case 'production': return '/production/browse';
    case 'investor': return '/investor/browse';
    case 'watcher':
    case 'viewer': return '/watcher/browse';
    default: return '/marketplace';
  }
}

/**
 * Get the correct login route based on user type
 * @param userType - The type of user (creator, investor, production, admin)
 * @returns The appropriate login route
 */
export function getLoginRoute(userType?: string | null): string {
  if (!userType) return '/login';
  
  switch (userType) {
    case 'creator':
      return '/login/creator';
    case 'investor':
      return '/login/investor';
    case 'production':
      return '/login/production';
    case 'watcher':
      return '/login/watcher';
    case 'admin':
      return '/login/admin';
    default:
      return '/login';
  }
}

/**
 * Get the correct profile route based on user type
 * @param userType - The type of user (creator, investor, production, admin)
 * @returns The appropriate profile route
 */
export function getProfileRoute(userType?: string | null): string {
  if (!userType) return '/profile';
  
  switch (userType) {
    case 'creator':
      return '/creator/profile';
    case 'investor':
      return '/investor/profile';
    case 'production':
      return '/production/profile';
    case 'admin':
      return '/admin/profile';
    default:
      return '/profile';
  }
}

/**
 * Get the correct settings route based on user type
 * @param userType - The type of user (creator, investor, production, admin)
 * @returns The appropriate settings route
 */
export function getSettingsRoute(userType?: string | null): string {
  if (!userType) return '/settings';
  
  switch (userType) {
    case 'creator':
      return '/creator/settings';
    case 'investor':
      return '/investor/settings';
    case 'production':
      return '/production/settings';
    case 'admin':
      return '/admin/settings';
    default:
      return '/settings';
  }
}