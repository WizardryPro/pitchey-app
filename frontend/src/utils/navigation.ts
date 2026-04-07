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
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/';
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