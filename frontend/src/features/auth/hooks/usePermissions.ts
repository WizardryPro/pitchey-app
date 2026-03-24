import { useMemo } from 'react';
import { useBetterAuthStore } from '@/store/betterAuthStore';

/**
 * Permission constants mirroring backend RBAC service (src/services/rbac.service.ts)
 */
export const Permission = {
  // Pitch permissions
  PITCH_CREATE: 'pitch.create',
  PITCH_EDIT_OWN: 'pitch.edit.own',
  PITCH_EDIT_ANY: 'pitch.edit.any',
  PITCH_DELETE_OWN: 'pitch.delete.own',
  PITCH_DELETE_ANY: 'pitch.delete.any',
  PITCH_VIEW_PUBLIC: 'pitch.view.public',
  PITCH_VIEW_PRIVATE: 'pitch.view.private',
  PITCH_PUBLISH: 'pitch.publish',
  PITCH_MODERATE: 'pitch.moderate',

  // NDA permissions
  NDA_REQUEST: 'nda.request',
  NDA_APPROVE: 'nda.approve',
  NDA_REJECT: 'nda.reject',
  NDA_SIGN: 'nda.sign',
  NDA_REVOKE: 'nda.revoke',
  NDA_VIEW_OWN: 'nda.view.own',
  NDA_VIEW_ANY: 'nda.view.any',
  NDA_UPLOAD_CUSTOM: 'nda.upload.custom',

  // Investment permissions
  INVESTMENT_CREATE: 'investment.create',
  INVESTMENT_VIEW_OWN: 'investment.view.own',
  INVESTMENT_VIEW_ANY: 'investment.view.any',
  INVESTMENT_MANAGE: 'investment.manage',
  INVESTMENT_WITHDRAW: 'investment.withdraw',
  PORTFOLIO_VIEW: 'portfolio.view',
  PORTFOLIO_MANAGE: 'portfolio.manage',

  // Document permissions
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_VIEW_PUBLIC: 'document.view.public',
  DOCUMENT_VIEW_PRIVATE: 'document.view.private',
  DOCUMENT_DELETE_OWN: 'document.delete.own',
  DOCUMENT_DELETE_ANY: 'document.delete.any',

  // User permissions
  USER_VIEW_OWN: 'user.view.own',
  USER_VIEW_ANY: 'user.view.any',
  USER_EDIT_OWN: 'user.edit.own',
  USER_EDIT_ANY: 'user.edit.any',
  USER_DELETE_ANY: 'user.delete.any',
  USER_BAN: 'user.ban',
  USER_UNBAN: 'user.unban',

  // Analytics permissions
  ANALYTICS_VIEW_OWN: 'analytics.view.own',
  ANALYTICS_VIEW_ANY: 'analytics.view.any',
  ANALYTICS_EXPORT: 'analytics.export',

  // Messaging permissions
  MESSAGE_SEND: 'message.send',
  MESSAGE_RECEIVE: 'message.receive',
  MESSAGE_BROADCAST: 'message.broadcast',

  // Admin permissions
  ADMIN_ACCESS: 'admin.access',
  ADMIN_SETTINGS: 'admin.settings',
  ADMIN_LOGS: 'admin.logs',
  ADMIN_BACKUP: 'admin.backup',

  // Financial permissions
  FINANCIAL_VIEW_OWN: 'financial.view.own',
  FINANCIAL_VIEW_ANY: 'financial.view.any',
  FINANCIAL_EXPORT: 'financial.export',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_REFUND: 'payment.refund',

  // Production permissions
  PRODUCTION_CREATE_PROJECT: 'production.create.project',
  PRODUCTION_MANAGE_CREW: 'production.manage.crew',
  PRODUCTION_SCHEDULE: 'production.schedule',
  PRODUCTION_BUDGET: 'production.budget',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

type UserRole = 'admin' | 'creator' | 'investor' | 'production' | 'viewer';

/**
 * Role-Permission mappings — mirrors backend src/services/rbac.service.ts
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: Object.values(Permission) as Permission[],

  creator: [
    Permission.PITCH_CREATE,
    Permission.PITCH_EDIT_OWN,
    Permission.PITCH_DELETE_OWN,
    Permission.PITCH_VIEW_PUBLIC,
    Permission.PITCH_VIEW_PRIVATE,
    Permission.PITCH_PUBLISH,
    Permission.NDA_APPROVE,
    Permission.NDA_REJECT,
    Permission.NDA_REVOKE,
    Permission.NDA_VIEW_OWN,
    Permission.NDA_UPLOAD_CUSTOM,
    Permission.DOCUMENT_UPLOAD,
    Permission.DOCUMENT_VIEW_PUBLIC,
    Permission.DOCUMENT_VIEW_PRIVATE,
    Permission.DOCUMENT_DELETE_OWN,
    Permission.USER_VIEW_OWN,
    Permission.USER_EDIT_OWN,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.ANALYTICS_EXPORT,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_RECEIVE,
    Permission.FINANCIAL_VIEW_OWN,
    Permission.PAYMENT_CREATE,
  ],

  investor: [
    Permission.PITCH_VIEW_PUBLIC,
    Permission.PITCH_VIEW_PRIVATE,
    Permission.NDA_REQUEST,
    Permission.NDA_SIGN,
    Permission.NDA_VIEW_OWN,
    Permission.INVESTMENT_CREATE,
    Permission.INVESTMENT_VIEW_OWN,
    Permission.INVESTMENT_MANAGE,
    Permission.INVESTMENT_WITHDRAW,
    Permission.PORTFOLIO_VIEW,
    Permission.PORTFOLIO_MANAGE,
    Permission.DOCUMENT_VIEW_PUBLIC,
    Permission.DOCUMENT_VIEW_PRIVATE,
    Permission.USER_VIEW_OWN,
    Permission.USER_EDIT_OWN,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.ANALYTICS_EXPORT,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_RECEIVE,
    Permission.FINANCIAL_VIEW_OWN,
    Permission.FINANCIAL_EXPORT,
    Permission.PAYMENT_CREATE,
  ],

  production: [
    Permission.PITCH_CREATE,
    Permission.PITCH_EDIT_OWN,
    Permission.PITCH_DELETE_OWN,
    Permission.PITCH_VIEW_PUBLIC,
    Permission.PITCH_VIEW_PRIVATE,
    Permission.PITCH_PUBLISH,
    Permission.NDA_REQUEST,
    Permission.NDA_SIGN,
    Permission.NDA_VIEW_OWN,
    Permission.INVESTMENT_CREATE,
    Permission.INVESTMENT_VIEW_OWN,
    Permission.PORTFOLIO_VIEW,
    Permission.DOCUMENT_VIEW_PUBLIC,
    Permission.DOCUMENT_VIEW_PRIVATE,
    Permission.DOCUMENT_UPLOAD,
    Permission.USER_VIEW_OWN,
    Permission.USER_EDIT_OWN,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_RECEIVE,
    Permission.FINANCIAL_VIEW_OWN,
    Permission.PAYMENT_CREATE,
    Permission.PRODUCTION_CREATE_PROJECT,
    Permission.PRODUCTION_MANAGE_CREW,
    Permission.PRODUCTION_SCHEDULE,
    Permission.PRODUCTION_BUDGET,
  ],

  viewer: [
    Permission.PITCH_VIEW_PUBLIC,
    Permission.DOCUMENT_VIEW_PUBLIC,
    Permission.USER_VIEW_OWN,
  ],
};

/**
 * Derive user's role from userType stored in auth state
 */
function getUserRole(): UserRole {
  const user = useBetterAuthStore.getState().user;
  // Users with admin_access get admin permissions regardless of their primary userType
  if (user?.adminAccess) return 'admin';
  const userType = user?.userType || '';
  if (userType in rolePermissions) {
    return userType as UserRole;
  }
  return 'viewer';
}

export interface UsePermissionsResult {
  permissions: Permission[];
  userRole: UserRole;
  hasPermission: (permission: Permission | string) => boolean;
  hasAnyPermission: (permissions: (Permission | string)[]) => boolean;
  hasAllPermissions: (permissions: (Permission | string)[]) => boolean;
}

/**
 * Frontend permission hook — derives permissions from user's role,
 * matching the backend RBAC service exactly.
 */
export function usePermissions(): UsePermissionsResult {
  const { isAuthenticated } = useBetterAuthStore();

  const userRole = useMemo(() => {
    if (!isAuthenticated) return 'viewer' as UserRole;
    return getUserRole();
  }, [isAuthenticated]);

  const permissions = useMemo(() => {
    return rolePermissions[userRole] || rolePermissions.viewer;
  }, [userRole]);

  const hasPermission = useMemo(() => {
    const permSet = new Set<string>(permissions);
    return (permission: Permission | string) => permSet.has(permission);
  }, [permissions]);

  const hasAnyPermission = useMemo(() => {
    const permSet = new Set<string>(permissions);
    return (perms: (Permission | string)[]) => perms.some(p => permSet.has(p));
  }, [permissions]);

  const hasAllPermissions = useMemo(() => {
    const permSet = new Set<string>(permissions);
    return (perms: (Permission | string)[]) => perms.every(p => permSet.has(p));
  }, [permissions]);

  return { permissions, userRole, hasPermission, hasAnyPermission, hasAllPermissions };
}
