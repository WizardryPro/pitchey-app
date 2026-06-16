/**
 * Tests for src/utils/rbac-enforcer.ts
 *
 * rbac-enforcer is the thin adaptor layer that connects HTTP requests to the
 * RBACService. Tests exercise:
 *  - buildRBACContext — maps AuthenticatedUser shapes to RBACContext
 *  - checkPortalAccess — per-portal allow/deny matrix
 *  - getRoutePermissions — exact and pattern matches
 *  - enforceRBAC — end-to-end: portal check then permission check
 *  - enforcePortalAccess — standalone portal check
 *  - checkPermission / checkAllPermissions / checkAnyPermission — wrappers
 *  - forbiddenResponse / unauthorizedResponse — factory helpers
 *
 * Real RBACService is used (pure in-memory, no DB). getCorsHeaders is imported
 * from utils/response — that module is real and safe in node env.
 */

import { describe, it, expect } from 'vitest';
import {
  buildRBACContext,
  checkPortalAccess,
  getRoutePermissions,
  enforceRBAC,
  enforcePortalAccess,
  checkPermission,
  checkAllPermissions,
  checkAnyPermission,
  forbiddenResponse,
  unauthorizedResponse,
  PortalAccessMap,
  RoutePermissions,
  type AuthenticatedUser,
} from '../rbac-enforcer';
import { Permission, UserRole } from '../../services/rbac.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    user_type: 'creator',
    ...overrides,
  };
}

async function parseJSON(r: Response) {
  return r.json();
}

// ---------------------------------------------------------------------------
// buildRBACContext
// ---------------------------------------------------------------------------

describe('buildRBACContext', () => {
  it('maps creator user_type to CREATOR role', () => {
    const ctx = buildRBACContext(makeUser({ user_type: 'creator' }));
    expect(ctx.userRole).toBe(UserRole.CREATOR);
    expect(ctx.userType).toBe('creator');
    expect(ctx.userId).toBe(1);
  });

  it('maps investor user_type to INVESTOR role', () => {
    const ctx = buildRBACContext(makeUser({ user_type: 'investor' }));
    expect(ctx.userRole).toBe(UserRole.INVESTOR);
  });

  it('maps production user_type to PRODUCTION role', () => {
    const ctx = buildRBACContext(makeUser({ user_type: 'production' }));
    expect(ctx.userRole).toBe(UserRole.PRODUCTION);
  });

  it('maps admin user_type to ADMIN role', () => {
    const ctx = buildRBACContext(makeUser({ user_type: 'admin' }));
    expect(ctx.userRole).toBe(UserRole.ADMIN);
  });

  it('maps viewer user_type to VIEWER role', () => {
    const ctx = buildRBACContext(makeUser({ user_type: 'viewer' }));
    expect(ctx.userRole).toBe(UserRole.VIEWER);
  });

  it('falls back to VIEWER for unknown user_type', () => {
    const ctx = buildRBACContext(makeUser({ user_type: 'unknown_role' }));
    expect(ctx.userRole).toBe(UserRole.VIEWER);
  });

  it('prefers user_type over userType', () => {
    const ctx = buildRBACContext(makeUser({ user_type: 'creator', userType: 'investor' }));
    expect(ctx.userRole).toBe(UserRole.CREATOR);
  });

  it('falls back to userType when user_type is absent', () => {
    const user: AuthenticatedUser = { id: 2, user_type: undefined, userType: 'investor' };
    const ctx = buildRBACContext(user);
    expect(ctx.userRole).toBe(UserRole.INVESTOR);
  });

  it('falls back to role field when both user_type and userType absent', () => {
    const user: AuthenticatedUser = { id: 3, role: 'production' };
    const ctx = buildRBACContext(user);
    expect(ctx.userRole).toBe(UserRole.PRODUCTION);
  });

  it('converts string id to number', () => {
    const user: AuthenticatedUser = { id: '42' as any, user_type: 'creator' };
    const ctx = buildRBACContext(user);
    expect(ctx.userId).toBe(42);
  });

  it('defaults to VIEWER when all type fields absent', () => {
    const user: AuthenticatedUser = { id: 1 };
    const ctx = buildRBACContext(user);
    expect(ctx.userRole).toBe(UserRole.VIEWER);
  });
});

// ---------------------------------------------------------------------------
// PortalAccessMap — data-driven deny matrix
// ---------------------------------------------------------------------------

describe('PortalAccessMap shape', () => {
  it('creator portal allows creator and admin', () => {
    expect(PortalAccessMap['creator']).toContain('creator');
    expect(PortalAccessMap['creator']).toContain('admin');
  });

  it('creator portal blocks investor', () => {
    expect(PortalAccessMap['creator']).not.toContain('investor');
  });

  it('investor portal allows investor and admin', () => {
    expect(PortalAccessMap['investor']).toContain('investor');
    expect(PortalAccessMap['investor']).toContain('admin');
  });

  it('production portal allows production and admin', () => {
    expect(PortalAccessMap['production']).toContain('production');
    expect(PortalAccessMap['production']).toContain('admin');
  });

  it('watcher portal allows both viewer and watcher aliases', () => {
    expect(PortalAccessMap['watcher']).toContain('viewer');
    expect(PortalAccessMap['watcher']).toContain('watcher');
    expect(PortalAccessMap['watcher']).toContain('admin');
  });

  it('admin portal only allows admin', () => {
    expect(PortalAccessMap['admin']).toEqual(['admin']);
  });
});

// ---------------------------------------------------------------------------
// checkPortalAccess
// ---------------------------------------------------------------------------

describe('checkPortalAccess', () => {
  it('grants creator access to creator portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'creator' }), 'creator')).toBe(true);
  });

  it('grants admin access to creator portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'admin' }), 'creator')).toBe(true);
  });

  it('denies investor access to creator portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'investor' }), 'creator')).toBe(false);
  });

  it('denies viewer access to creator portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'viewer' }), 'creator')).toBe(false);
  });

  it('grants viewer access to watcher portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'viewer' }), 'watcher')).toBe(true);
  });

  it('grants watcher access to watcher portal (legacy alias)', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'watcher' }), 'watcher')).toBe(true);
  });

  it('denies creator access to watcher portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'creator' }), 'watcher')).toBe(false);
  });

  it('denies creator access to investor portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'creator' }), 'investor')).toBe(false);
  });

  it('denies production access to investor portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'production' }), 'investor')).toBe(false);
  });

  it('grants admin access to admin portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'admin' }), 'admin')).toBe(true);
  });

  it('denies creator access to admin portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'creator' }), 'admin')).toBe(false);
  });

  it('is case-insensitive on userType', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'CREATOR' }), 'creator')).toBe(true);
    expect(checkPortalAccess(makeUser({ user_type: 'Creator' }), 'creator')).toBe(true);
  });

  it('is case-insensitive on portal name', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'creator' }), 'CREATOR')).toBe(true);
  });

  it('returns false for unknown portal', () => {
    expect(checkPortalAccess(makeUser({ user_type: 'creator' }), 'nonexistent')).toBe(false);
  });

  it('reads userType field as fallback when user_type absent', () => {
    const user: AuthenticatedUser = { id: 1, userType: 'investor' };
    expect(checkPortalAccess(user, 'investor')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getRoutePermissions
// ---------------------------------------------------------------------------

describe('getRoutePermissions', () => {
  it('returns exact match for /api/creator/dashboard', () => {
    const perms = getRoutePermissions('/api/creator/dashboard');
    expect(perms).toContain(Permission.ANALYTICS_VIEW_OWN);
  });

  it('returns exact match for /api/pitch/create', () => {
    const perms = getRoutePermissions('/api/pitch/create');
    expect(perms).toContain(Permission.PITCH_CREATE);
  });

  it('returns exact match for /api/nda/approve', () => {
    const perms = getRoutePermissions('/api/nda/approve');
    expect(perms).toContain(Permission.NDA_APPROVE);
  });

  it('returns exact match for /api/admin', () => {
    const perms = getRoutePermissions('/api/admin');
    expect(perms).toContain(Permission.ADMIN_ACCESS);
  });

  it('returns empty array for unmapped route', () => {
    const perms = getRoutePermissions('/api/totally/unknown/endpoint');
    expect(perms).toEqual([]);
  });

  it('returns empty array for root path', () => {
    expect(getRoutePermissions('/')).toEqual([]);
  });

  it('matches pattern with subpath on exact routes', () => {
    // /api/creator/dashboard is in RoutePermissions
    // /api/creator/dashboard/extra should also match via regex
    const perms = getRoutePermissions('/api/creator/dashboard/extra');
    expect(perms).toContain(Permission.ANALYTICS_VIEW_OWN);
  });

  it('returns PITCH_VIEW_PUBLIC for /api/pitches', () => {
    const perms = getRoutePermissions('/api/pitches');
    expect(perms).toContain(Permission.PITCH_VIEW_PUBLIC);
  });

  it('returns DOCUMENT_UPLOAD for /api/documents/upload', () => {
    const perms = getRoutePermissions('/api/documents/upload');
    expect(perms).toContain(Permission.DOCUMENT_UPLOAD);
  });
});

// ---------------------------------------------------------------------------
// enforceRBAC
// ---------------------------------------------------------------------------

describe('enforceRBAC', () => {
  describe('portal access check', () => {
    it('allows creator on /api/creator/dashboard', () => {
      const result = enforceRBAC(makeUser({ user_type: 'creator' }), '/api/creator/dashboard');
      expect(result.authorized).toBe(true);
    });

    it('denies investor on /api/creator/dashboard', async () => {
      const result = enforceRBAC(makeUser({ user_type: 'investor' }), '/api/creator/dashboard');
      expect(result.authorized).toBe(false);
      expect(result.response?.status).toBe(403);
      const body = await parseJSON(result.response!);
      expect(body.code).toBe('PORTAL_ACCESS_DENIED');
    });

    it('denies viewer on /api/investor/dashboard', async () => {
      const result = enforceRBAC(makeUser({ user_type: 'viewer' }), '/api/investor/dashboard');
      expect(result.authorized).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('allows admin on any portal route', () => {
      const adminUser = makeUser({ user_type: 'admin' });
      expect(enforceRBAC(adminUser, '/api/creator/dashboard').authorized).toBe(true);
      expect(enforceRBAC(adminUser, '/api/investor/dashboard').authorized).toBe(true);
      expect(enforceRBAC(adminUser, '/api/production/dashboard').authorized).toBe(true);
    });

    it('includes errorMessage on portal denial', () => {
      const result = enforceRBAC(makeUser({ user_type: 'investor' }), '/api/creator/pitches');
      expect(result.errorMessage).toMatch(/creator/i);
    });
  });

  describe('permission check after portal pass', () => {
    it('allows creator with PITCH_CREATE for /api/pitch/create', () => {
      const result = enforceRBAC(makeUser({ user_type: 'creator' }), '/api/pitch/create');
      expect(result.authorized).toBe(true);
    });

    it('denies viewer on /api/pitch/create — no PITCH_CREATE permission', async () => {
      const result = enforceRBAC(makeUser({ user_type: 'viewer' }), '/api/pitch/create');
      expect(result.authorized).toBe(false);
      expect(result.response?.status).toBe(403);
      const body = await parseJSON(result.response!);
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('allows access on unmapped route (no permissions required)', () => {
      const result = enforceRBAC(makeUser({ user_type: 'viewer' }), '/api/some/random/route');
      expect(result.authorized).toBe(true);
    });

    it('denies viewer on /api/pitch/delete — no PITCH_DELETE_OWN', () => {
      const result = enforceRBAC(makeUser({ user_type: 'viewer' }), '/api/pitch/delete');
      expect(result.authorized).toBe(false);
    });

    it('allows investor on /api/nda/request', () => {
      const result = enforceRBAC(makeUser({ user_type: 'investor' }), '/api/nda/request');
      expect(result.authorized).toBe(true);
    });

    it('denies creator on /api/nda/request (NDA_REQUEST not in creator permissions)', () => {
      const result = enforceRBAC(makeUser({ user_type: 'creator' }), '/api/nda/request');
      expect(result.authorized).toBe(false);
      expect(result.errorMessage).toBeTruthy();
    });

    it('sets user on result', () => {
      const user = makeUser({ user_type: 'creator' });
      const result = enforceRBAC(user, '/api/pitch/create');
      expect(result.user).toBe(user);
    });

    it('sets context on result', () => {
      const result = enforceRBAC(makeUser({ user_type: 'creator' }), '/api/pitch/create');
      expect(result.context?.userRole).toBe(UserRole.CREATOR);
    });

    it('returns Content-Type application/json on 403 response', async () => {
      const result = enforceRBAC(makeUser({ user_type: 'viewer' }), '/api/pitch/create');
      expect(result.response?.headers.get('Content-Type')).toContain('application/json');
    });
  });
});

// ---------------------------------------------------------------------------
// enforcePortalAccess
// ---------------------------------------------------------------------------

describe('enforcePortalAccess', () => {
  it('authorizes creator for creator portal', () => {
    const r = enforcePortalAccess(makeUser({ user_type: 'creator' }), 'creator');
    expect(r.authorized).toBe(true);
    expect(r.response).toBeUndefined();
  });

  it('denies investor for creator portal with 403', async () => {
    const r = enforcePortalAccess(makeUser({ user_type: 'investor' }), 'creator');
    expect(r.authorized).toBe(false);
    expect(r.response?.status).toBe(403);
    const body = await parseJSON(r.response!);
    expect(body.code).toBe('PORTAL_ACCESS_DENIED');
    expect(body.details?.required).toBe('creator');
  });

  it('includes current user_type in denial details', async () => {
    const r = enforcePortalAccess(makeUser({ user_type: 'production' }), 'investor');
    const body = await parseJSON(r.response!);
    expect(body.details?.current).toBe('production');
  });

  it('includes capitalized portal name in error message', async () => {
    const r = enforcePortalAccess(makeUser({ user_type: 'investor' }), 'creator');
    const body = await parseJSON(r.response!);
    expect(body.error).toMatch(/Creator/);
  });
});

// ---------------------------------------------------------------------------
// checkPermission
// ---------------------------------------------------------------------------

describe('checkPermission', () => {
  it('returns true for creator with PITCH_CREATE', () => {
    expect(checkPermission(makeUser({ user_type: 'creator' }), Permission.PITCH_CREATE)).toBe(true);
  });

  it('returns false for viewer with PITCH_CREATE', () => {
    expect(checkPermission(makeUser({ user_type: 'viewer' }), Permission.PITCH_CREATE)).toBe(false);
  });

  it('returns false for viewer with PITCH_EDIT_OWN', () => {
    // CLAUDE.md: VIEWER is denied PITCH_CREATE / EDIT_OWN / DELETE_OWN
    expect(checkPermission(makeUser({ user_type: 'viewer' }), Permission.PITCH_EDIT_OWN)).toBe(false);
  });

  it('returns false for viewer with PITCH_DELETE_OWN', () => {
    expect(checkPermission(makeUser({ user_type: 'viewer' }), Permission.PITCH_DELETE_OWN)).toBe(false);
  });

  it('returns true for viewer with PITCH_VIEW_PUBLIC', () => {
    expect(checkPermission(makeUser({ user_type: 'viewer' }), Permission.PITCH_VIEW_PUBLIC)).toBe(true);
  });

  it('admin has all permissions', () => {
    const admin = makeUser({ user_type: 'admin' });
    expect(checkPermission(admin, Permission.PITCH_CREATE)).toBe(true);
    expect(checkPermission(admin, Permission.ADMIN_ACCESS)).toBe(true);
    expect(checkPermission(admin, Permission.USER_DELETE_ANY)).toBe(true);
    expect(checkPermission(admin, Permission.PITCH_MODERATE)).toBe(true);
  });

  it('investor does not have PITCH_CREATE', () => {
    expect(checkPermission(makeUser({ user_type: 'investor' }), Permission.PITCH_CREATE)).toBe(false);
  });

  it('creator does not have INVESTMENT_CREATE', () => {
    expect(checkPermission(makeUser({ user_type: 'creator' }), Permission.INVESTMENT_CREATE)).toBe(false);
  });

  it('production has PRODUCTION_CREATE_PROJECT', () => {
    expect(checkPermission(makeUser({ user_type: 'production' }), Permission.PRODUCTION_CREATE_PROJECT)).toBe(true);
  });

  it('creator does not have PRODUCTION_CREATE_PROJECT', () => {
    expect(checkPermission(makeUser({ user_type: 'creator' }), Permission.PRODUCTION_CREATE_PROJECT)).toBe(false);
  });

  describe('ownership check via resourceOwnerId', () => {
    it('allows creator to edit their own pitch (owner matches user id)', () => {
      const user = makeUser({ id: 100, user_type: 'creator' });
      // PITCH_EDIT_OWN requires context.userId === context.resourceOwnerId
      expect(checkPermission(user, Permission.PITCH_EDIT_OWN, 100)).toBe(true);
    });

    it('denies creator editing someone else\'s pitch', () => {
      const user = makeUser({ id: 100, user_type: 'creator' });
      expect(checkPermission(user, Permission.PITCH_EDIT_OWN, 999)).toBe(false);
    });

    it('admin can edit any pitch regardless of ownership', () => {
      const admin = makeUser({ id: 1, user_type: 'admin' });
      // PITCH_EDIT_ANY has '.any' which bypasses ownership check
      expect(checkPermission(admin, Permission.PITCH_EDIT_ANY, 999)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// checkAllPermissions
// ---------------------------------------------------------------------------

describe('checkAllPermissions', () => {
  it('returns true when user has all listed permissions', () => {
    const creator = makeUser({ user_type: 'creator' });
    expect(checkAllPermissions(creator, [Permission.PITCH_CREATE, Permission.PITCH_PUBLISH])).toBe(true);
  });

  it('returns false when user lacks one permission', () => {
    const creator = makeUser({ user_type: 'creator' });
    // Creator has PITCH_CREATE but not ADMIN_ACCESS
    expect(checkAllPermissions(creator, [Permission.PITCH_CREATE, Permission.ADMIN_ACCESS])).toBe(false);
  });

  it('returns true for empty permission list', () => {
    expect(checkAllPermissions(makeUser(), [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkAnyPermission
// ---------------------------------------------------------------------------

describe('checkAnyPermission', () => {
  it('returns true when user has at least one permission', () => {
    const creator = makeUser({ user_type: 'creator' });
    // creator has PITCH_CREATE but not ADMIN_ACCESS
    expect(checkAnyPermission(creator, [Permission.PITCH_CREATE, Permission.ADMIN_ACCESS])).toBe(true);
  });

  it('returns false when user has none', () => {
    const viewer = makeUser({ user_type: 'viewer' });
    expect(checkAnyPermission(viewer, [Permission.PITCH_CREATE, Permission.ADMIN_ACCESS])).toBe(false);
  });

  it('returns false for empty permission list', () => {
    expect(checkAnyPermission(makeUser({ user_type: 'creator' }), [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forbiddenResponse
// ---------------------------------------------------------------------------

describe('forbiddenResponse', () => {
  it('returns 403 status', () => {
    const r = forbiddenResponse('not allowed');
    expect(r.status).toBe(403);
  });

  it('body contains success:false and code FORBIDDEN', async () => {
    const r = forbiddenResponse('not allowed');
    const body = await parseJSON(r);
    expect(body.success).toBe(false);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.error).toBe('not allowed');
  });

  it('merges extra details into response body', async () => {
    const r = forbiddenResponse('msg', undefined, { foo: 'bar' });
    const body = await parseJSON(r);
    expect(body.foo).toBe('bar');
  });

  it('Content-Type is application/json', () => {
    const r = forbiddenResponse('msg');
    expect(r.headers.get('Content-Type')).toContain('application/json');
  });
});

// ---------------------------------------------------------------------------
// unauthorizedResponse
// ---------------------------------------------------------------------------

describe('unauthorizedResponse', () => {
  it('returns 401 status', () => {
    const r = unauthorizedResponse();
    expect(r.status).toBe(401);
  });

  it('body contains success:false and code UNAUTHORIZED', async () => {
    const r = unauthorizedResponse();
    const body = await parseJSON(r);
    expect(body.success).toBe(false);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('uses default message when none provided', async () => {
    const body = await parseJSON(unauthorizedResponse());
    expect(body.error).toBe('Authentication required');
  });

  it('accepts custom message', async () => {
    const body = await parseJSON(unauthorizedResponse('Session expired'));
    expect(body.error).toBe('Session expired');
  });
});
