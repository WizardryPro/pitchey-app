/**
 * Tests for the RBAC permission contract that src/utils/rbac-integration.ts is
 * meant to enforce.
 *
 * NOTE: src/utils/rbac-integration.ts was a BROKEN ORPHAN (no live importer —
 * a stray `;` inside an object literal AND imports of non-existent `./errors` /
 * `./response-builder`) and was DELETED 2026-06-16. Its intended security
 * contract is covered here directly against RBACService
 * (src/services/rbac.service.ts), which is what the adaptor delegated to and
 * what the live RBAC path (rbac-enforcer / permission-helpers) actually uses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the broken module entirely — it has a compile-time syntax error.
// We re-implement the expected interface so callers can be tested.
// ---------------------------------------------------------------------------

import { RBACService, Permission, UserRole, type RBACContext } from '../../services/rbac.service';

// ---------------------------------------------------------------------------
// Helpers — mirrors AuthResult shape from rbac-integration.ts
// ---------------------------------------------------------------------------

interface AuthResult {
  authorized: boolean;
  user?: { id: number; email: string; userType?: string; role?: string };
  response?: Response;
}

function makeRequest(): Request {
  return new Request('https://api.example.com/test', { method: 'GET' });
}

function makeContext(userId: number, userType: string): RBACContext {
  return {
    userId,
    userRole: RBACService.getRoleFromUserType(userType),
  };
}

// rbac-integration.ts itself is not imported here — it is a broken orphan
// (see file header). Its intended security contract is covered by the
// RBACService tests below.

// ---------------------------------------------------------------------------
// Test the underlying RBACService rules that RBACIntegration is supposed to
// enforce. These represent the intended security contract.
// ---------------------------------------------------------------------------

describe('RBACService — permission matrix (underlies RBACIntegration)', () => {

  // --- VIEWER (watcher) — critical per CLAUDE.md ---
  describe('VIEWER role', () => {
    const ctx = makeContext(1, 'viewer');

    it('VIEWER: PITCH_CREATE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_CREATE)).toBe(false);
    });

    it('VIEWER: PITCH_EDIT_OWN is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_EDIT_OWN)).toBe(false);
    });

    it('VIEWER: PITCH_DELETE_OWN is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_DELETE_OWN)).toBe(false);
    });

    it('VIEWER: PITCH_VIEW_PUBLIC is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_VIEW_PUBLIC)).toBe(true);
    });

    it('VIEWER: DOCUMENT_VIEW_PUBLIC is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.DOCUMENT_VIEW_PUBLIC)).toBe(true);
    });

    it('VIEWER: USER_VIEW_OWN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.USER_VIEW_OWN)).toBe(true);
    });

    it('VIEWER: USER_EDIT_OWN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.USER_EDIT_OWN)).toBe(true);
    });

    it('VIEWER: INVESTMENT_CREATE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.INVESTMENT_CREATE)).toBe(false);
    });

    it('VIEWER: DOCUMENT_UPLOAD is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.DOCUMENT_UPLOAD)).toBe(false);
    });

    it('VIEWER: NDA_REQUEST is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_REQUEST)).toBe(false);
    });

    it('VIEWER: MESSAGE_SEND is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.MESSAGE_SEND)).toBe(false);
    });

    it('VIEWER: ADMIN_ACCESS is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.ADMIN_ACCESS)).toBe(false);
    });

    it('VIEWER: PITCH_MODERATE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_MODERATE)).toBe(false);
    });

    it('VIEWER: DOCUMENT_VIEW_PRIVATE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.DOCUMENT_VIEW_PRIVATE)).toBe(false);
    });
  });

  // --- CREATOR ---
  describe('CREATOR role', () => {
    const ctx = makeContext(10, 'creator');

    it('CREATOR: PITCH_CREATE is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_CREATE)).toBe(true);
    });

    it('CREATOR: PITCH_EDIT_OWN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_EDIT_OWN)).toBe(true);
    });

    it('CREATOR: PITCH_DELETE_OWN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_DELETE_OWN)).toBe(true);
    });

    it('CREATOR: PITCH_PUBLISH is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_PUBLISH)).toBe(true);
    });

    it('CREATOR: NDA_APPROVE is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_APPROVE)).toBe(true);
    });

    it('CREATOR: NDA_REJECT is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_REJECT)).toBe(true);
    });

    it('CREATOR: NDA_UPLOAD_CUSTOM is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_UPLOAD_CUSTOM)).toBe(true);
    });

    it('CREATOR: DOCUMENT_UPLOAD is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.DOCUMENT_UPLOAD)).toBe(true);
    });

    it('CREATOR: ANALYTICS_VIEW_OWN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.ANALYTICS_VIEW_OWN)).toBe(true);
    });

    it('CREATOR: FINANCIAL_VIEW_OWN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.FINANCIAL_VIEW_OWN)).toBe(true);
    });

    it('CREATOR: MESSAGE_SEND is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.MESSAGE_SEND)).toBe(true);
    });

    it('CREATOR: INVESTMENT_CREATE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.INVESTMENT_CREATE)).toBe(false);
    });

    it('CREATOR: PITCH_EDIT_ANY is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_EDIT_ANY)).toBe(false);
    });

    it('CREATOR: PITCH_DELETE_ANY is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_DELETE_ANY)).toBe(false);
    });

    it('CREATOR: ADMIN_ACCESS is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.ADMIN_ACCESS)).toBe(false);
    });

    it('CREATOR: PITCH_MODERATE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_MODERATE)).toBe(false);
    });

    it('CREATOR: NDA_REQUEST is DENIED (creator approves, not requests)', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_REQUEST)).toBe(false);
    });

    it('CREATOR: PRODUCTION_CREATE_PROJECT is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PRODUCTION_CREATE_PROJECT)).toBe(false);
    });

    it('CREATOR: ANALYTICS_VIEW_ANY is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.ANALYTICS_VIEW_ANY)).toBe(false);
    });
  });

  // --- INVESTOR ---
  describe('INVESTOR role', () => {
    const ctx = makeContext(20, 'investor');

    it('INVESTOR: PITCH_VIEW_PUBLIC is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_VIEW_PUBLIC)).toBe(true);
    });

    it('INVESTOR: PITCH_VIEW_PRIVATE is ALLOWED (with NDA)', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_VIEW_PRIVATE)).toBe(true);
    });

    it('INVESTOR: NDA_REQUEST is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_REQUEST)).toBe(true);
    });

    it('INVESTOR: NDA_SIGN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_SIGN)).toBe(true);
    });

    it('INVESTOR: INVESTMENT_CREATE is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.INVESTMENT_CREATE)).toBe(true);
    });

    it('INVESTOR: PORTFOLIO_VIEW is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PORTFOLIO_VIEW)).toBe(true);
    });

    it('INVESTOR: PORTFOLIO_MANAGE is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PORTFOLIO_MANAGE)).toBe(true);
    });

    it('INVESTOR: ANALYTICS_VIEW_OWN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.ANALYTICS_VIEW_OWN)).toBe(true);
    });

    it('INVESTOR: FINANCIAL_VIEW_OWN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.FINANCIAL_VIEW_OWN)).toBe(true);
    });

    it('INVESTOR: PITCH_CREATE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_CREATE)).toBe(false);
    });

    it('INVESTOR: PITCH_EDIT_OWN is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_EDIT_OWN)).toBe(false);
    });

    it('INVESTOR: NDA_APPROVE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_APPROVE)).toBe(false);
    });

    it('INVESTOR: ADMIN_ACCESS is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.ADMIN_ACCESS)).toBe(false);
    });

    it('INVESTOR: DOCUMENT_UPLOAD is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.DOCUMENT_UPLOAD)).toBe(false);
    });

    it('INVESTOR: PRODUCTION_CREATE_PROJECT is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PRODUCTION_CREATE_PROJECT)).toBe(false);
    });
  });

  // --- PRODUCTION ---
  describe('PRODUCTION role', () => {
    const ctx = makeContext(30, 'production');

    it('PRODUCTION: PITCH_CREATE is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_CREATE)).toBe(true);
    });

    it('PRODUCTION: NDA_REQUEST is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_REQUEST)).toBe(true);
    });

    it('PRODUCTION: NDA_SIGN is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_SIGN)).toBe(true);
    });

    it('PRODUCTION: PRODUCTION_CREATE_PROJECT is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PRODUCTION_CREATE_PROJECT)).toBe(true);
    });

    it('PRODUCTION: PRODUCTION_MANAGE_CREW is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PRODUCTION_MANAGE_CREW)).toBe(true);
    });

    it('PRODUCTION: PRODUCTION_SCHEDULE is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PRODUCTION_SCHEDULE)).toBe(true);
    });

    it('PRODUCTION: PRODUCTION_BUDGET is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PRODUCTION_BUDGET)).toBe(true);
    });

    it('PRODUCTION: INVESTMENT_CREATE is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.INVESTMENT_CREATE)).toBe(true);
    });

    it('PRODUCTION: DOCUMENT_UPLOAD is ALLOWED', () => {
      expect(RBACService.hasPermission(ctx, Permission.DOCUMENT_UPLOAD)).toBe(true);
    });

    it('PRODUCTION: ADMIN_ACCESS is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.ADMIN_ACCESS)).toBe(false);
    });

    it('PRODUCTION: NDA_APPROVE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.NDA_APPROVE)).toBe(false);
    });

    it('PRODUCTION: PITCH_MODERATE is DENIED', () => {
      expect(RBACService.hasPermission(ctx, Permission.PITCH_MODERATE)).toBe(false);
    });
  });

  // --- ADMIN ---
  describe('ADMIN role', () => {
    const ctx = makeContext(0, 'admin');

    it('ADMIN: has EVERY permission in the Permission enum', () => {
      for (const perm of Object.values(Permission)) {
        expect(RBACService.hasPermission(ctx, perm)).toBe(true);
      }
    });

    it('ADMIN: isAdmin returns true', () => {
      expect(RBACService.isAdmin(ctx)).toBe(true);
    });

    it('ADMIN: canModerate returns true', () => {
      expect(RBACService.canModerate(ctx)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// getRoleFromUserType — mapping contract
// ---------------------------------------------------------------------------

describe('RBACService.getRoleFromUserType', () => {
  it('maps "creator" → CREATOR', () => {
    expect(RBACService.getRoleFromUserType('creator')).toBe(UserRole.CREATOR);
  });

  it('maps "investor" → INVESTOR', () => {
    expect(RBACService.getRoleFromUserType('investor')).toBe(UserRole.INVESTOR);
  });

  it('maps "production" → PRODUCTION', () => {
    expect(RBACService.getRoleFromUserType('production')).toBe(UserRole.PRODUCTION);
  });

  it('maps "admin" → ADMIN', () => {
    expect(RBACService.getRoleFromUserType('admin')).toBe(UserRole.ADMIN);
  });

  it('maps "viewer" → VIEWER', () => {
    expect(RBACService.getRoleFromUserType('viewer')).toBe(UserRole.VIEWER);
  });

  it('maps unknown → VIEWER (safe default)', () => {
    expect(RBACService.getRoleFromUserType('hacker')).toBe(UserRole.VIEWER);
    expect(RBACService.getRoleFromUserType(undefined)).toBe(UserRole.VIEWER);
    expect(RBACService.getRoleFromUserType('')).toBe(UserRole.VIEWER);
  });

  it('is case-insensitive', () => {
    expect(RBACService.getRoleFromUserType('CREATOR')).toBe(UserRole.CREATOR);
    expect(RBACService.getRoleFromUserType('INVESTOR')).toBe(UserRole.INVESTOR);
  });
});

// ---------------------------------------------------------------------------
// canAccess — ownership and NDA gating
// ---------------------------------------------------------------------------

describe('RBACService.canAccess — ownership', () => {
  it('owner can edit their own pitch (PITCH_EDIT_OWN)', () => {
    const ctx: RBACContext = { userId: 10, userRole: UserRole.CREATOR, resourceOwnerId: 10 };
    expect(RBACService.canAccess(ctx, Permission.PITCH_EDIT_OWN, { checkOwnership: true })).toBe(true);
  });

  it('non-owner cannot edit someone else\'s pitch (PITCH_EDIT_OWN)', () => {
    const ctx: RBACContext = { userId: 10, userRole: UserRole.CREATOR, resourceOwnerId: 99 };
    expect(RBACService.canAccess(ctx, Permission.PITCH_EDIT_OWN, { checkOwnership: true })).toBe(false);
  });

  it('admin can edit any pitch (PITCH_EDIT_ANY — no ownership requirement)', () => {
    const ctx: RBACContext = { userId: 1, userRole: UserRole.ADMIN, resourceOwnerId: 99 };
    expect(RBACService.canAccess(ctx, Permission.PITCH_EDIT_ANY, { checkOwnership: true })).toBe(true);
  });

  it('viewer cannot edit even their own pitch (lacks PITCH_EDIT_OWN)', () => {
    const ctx: RBACContext = { userId: 5, userRole: UserRole.VIEWER, resourceOwnerId: 5 };
    expect(RBACService.canAccess(ctx, Permission.PITCH_EDIT_OWN, { checkOwnership: true })).toBe(false);
  });
});

describe('RBACService.canAccess — NDA gating', () => {
  it('investor with NDA can view private pitch', () => {
    const ctx: RBACContext = {
      userId: 20, userRole: UserRole.INVESTOR,
      metadata: { hasNDA: true }
    };
    expect(RBACService.canAccess(ctx, Permission.PITCH_VIEW_PRIVATE, { requireNDA: true })).toBe(true);
  });

  it('investor WITHOUT NDA cannot view private pitch', () => {
    const ctx: RBACContext = {
      userId: 20, userRole: UserRole.INVESTOR,
      metadata: { hasNDA: false }
    };
    expect(RBACService.canAccess(ctx, Permission.PITCH_VIEW_PRIVATE, { requireNDA: true })).toBe(false);
  });

  it('investor with no metadata (hasNDA undefined) is denied private pitch', () => {
    const ctx: RBACContext = { userId: 20, userRole: UserRole.INVESTOR };
    expect(RBACService.canAccess(ctx, Permission.PITCH_VIEW_PRIVATE, { requireNDA: true })).toBe(false);
  });

  it('viewer with NDA is still denied private pitch (lacks base permission)', () => {
    const ctx: RBACContext = { userId: 5, userRole: UserRole.VIEWER, metadata: { hasNDA: true } };
    expect(RBACService.canAccess(ctx, Permission.PITCH_VIEW_PRIVATE, { requireNDA: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasAllPermissions / hasAnyPermission
// ---------------------------------------------------------------------------

describe('RBACService.hasAllPermissions', () => {
  it('creator has all of: PITCH_CREATE, PITCH_EDIT_OWN, PITCH_PUBLISH', () => {
    const ctx = makeContext(1, 'creator');
    expect(RBACService.hasAllPermissions(ctx, [
      Permission.PITCH_CREATE, Permission.PITCH_EDIT_OWN, Permission.PITCH_PUBLISH
    ])).toBe(true);
  });

  it('creator does not have all of: PITCH_CREATE + ADMIN_ACCESS', () => {
    const ctx = makeContext(1, 'creator');
    expect(RBACService.hasAllPermissions(ctx, [
      Permission.PITCH_CREATE, Permission.ADMIN_ACCESS
    ])).toBe(false);
  });

  it('returns true for empty list', () => {
    const ctx = makeContext(1, 'viewer');
    expect(RBACService.hasAllPermissions(ctx, [])).toBe(true);
  });
});

describe('RBACService.hasAnyPermission', () => {
  it('creator has any of: ADMIN_ACCESS, PITCH_CREATE', () => {
    const ctx = makeContext(1, 'creator');
    expect(RBACService.hasAnyPermission(ctx, [Permission.ADMIN_ACCESS, Permission.PITCH_CREATE])).toBe(true);
  });

  it('viewer has none of: PITCH_CREATE, ADMIN_ACCESS', () => {
    const ctx = makeContext(5, 'viewer');
    expect(RBACService.hasAnyPermission(ctx, [Permission.PITCH_CREATE, Permission.ADMIN_ACCESS])).toBe(false);
  });

  it('returns false for empty list', () => {
    const ctx = makeContext(1, 'admin');
    expect(RBACService.hasAnyPermission(ctx, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterByPermission
// ---------------------------------------------------------------------------

describe('RBACService.filterByPermission', () => {
  it('returns only resources owned by the user for PITCH_EDIT_OWN', () => {
    const ctx = makeContext(10, 'creator');
    const resources = [
      { id: 1, ownerId: 10 },  // owned by user
      { id: 2, ownerId: 99 },  // owned by someone else
      { id: 3, ownerId: 10 },  // owned by user
    ];
    const filtered = RBACService.filterByPermission(ctx, resources, Permission.PITCH_EDIT_OWN);
    expect(filtered.map(r => r.id)).toEqual([1, 3]);
  });

  it('admin can access all resources (PITCH_EDIT_ANY)', () => {
    const ctx = makeContext(1, 'admin');
    const resources = [
      { id: 1, ownerId: 50 },
      { id: 2, ownerId: 99 },
    ];
    const filtered = RBACService.filterByPermission(ctx, resources, Permission.PITCH_EDIT_ANY);
    expect(filtered).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getPermissionError — error message format
// ---------------------------------------------------------------------------

describe('RBACService.getPermissionError', () => {
  it('generates a human-readable error for PITCH_CREATE', () => {
    const msg = RBACService.getPermissionError(Permission.PITCH_CREATE);
    expect(msg).toContain('pitch');
    expect(msg).toContain('create');
  });

  it('generates a human-readable error for ADMIN_ACCESS', () => {
    const msg = RBACService.getPermissionError(Permission.ADMIN_ACCESS);
    expect(msg).toContain('admin');
    expect(msg).toContain('access');
  });
});

// ---------------------------------------------------------------------------
// getUserPermissions
// ---------------------------------------------------------------------------

describe('RBACService.getUserPermissions', () => {
  it('returns base permissions for creator plus additionalPermissions', () => {
    const extra = [Permission.ADMIN_ACCESS];
    const ctx: RBACContext = {
      userId: 1,
      userRole: UserRole.CREATOR,
      additionalPermissions: extra,
    };
    const perms = RBACService.getUserPermissions(ctx);
    expect(perms).toContain(Permission.PITCH_CREATE);
    expect(perms).toContain(Permission.ADMIN_ACCESS);
  });

  it('returns only base permissions when no additionalPermissions', () => {
    const ctx = makeContext(1, 'viewer');
    const perms = RBACService.getUserPermissions(ctx);
    expect(perms).toContain(Permission.PITCH_VIEW_PUBLIC);
    expect(perms).not.toContain(Permission.PITCH_CREATE);
  });
});

// ---------------------------------------------------------------------------
// additionalPermissions — grants beyond role
// ---------------------------------------------------------------------------

describe('RBACService — additionalPermissions grants', () => {
  it('viewer with granted PITCH_CREATE can create pitches', () => {
    const ctx: RBACContext = {
      userId: 5,
      userRole: UserRole.VIEWER,
      additionalPermissions: [Permission.PITCH_CREATE],
    };
    expect(RBACService.hasPermission(ctx, Permission.PITCH_CREATE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPermissionsForUserType helper (exported from rbac.service)
// ---------------------------------------------------------------------------

describe('getPermissionsForUserType', () => {
  it('is exported from rbac.service', async () => {
    const mod = await import('../../services/rbac.service');
    expect(typeof mod.getPermissionsForUserType).toBe('function');
  });

  it('returns an array of permission strings for creator', async () => {
    const { getPermissionsForUserType } = await import('../../services/rbac.service');
    const perms = getPermissionsForUserType('creator');
    expect(Array.isArray(perms)).toBe(true);
    expect(perms).toContain('pitch.create');
  });

  it('watcher alias resolves to VIEWER permissions', async () => {
    const { getPermissionsForUserType } = await import('../../services/rbac.service');
    const viewer = getPermissionsForUserType('viewer');
    const watcher = getPermissionsForUserType('watcher');
    expect(viewer).toEqual(watcher);
  });

  it('undefined userType resolves to VIEWER permissions', async () => {
    const { getPermissionsForUserType } = await import('../../services/rbac.service');
    const perms = getPermissionsForUserType(undefined);
    expect(perms).toContain('pitch.view.public');
    expect(perms).not.toContain('pitch.create');
  });
});
