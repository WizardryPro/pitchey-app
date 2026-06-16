/**
 * Tests for src/utils/permission-helpers.ts
 *
 * permission-helpers.ts calls PermissionService (the DB-backed instance service
 * at ../services/permission.service) as if it were a static class with a
 * different API signature than what that file actually exports. The module is
 * mocked entirely to provide controllable static method stubs.
 *
 * Exports tested:
 *   PERMISSIONS   — constant map (spot check a few)
 *   ROLES         — constant map (spot check a few)
 *   RESOURCE_TYPES — constant map (spot check)
 *   PermissionHelpers — every public static method
 *   QuickChecks   — every shorthand
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the permission service before importing the module under test.
// permission-helpers.ts uses PermissionService with static-style calls
// (PermissionService.hasPermission, .getUserRoles, .getRolePermissions,
// .getResourcePermissions) that do not exist in the real class. We stub them.
//
// vi.hoisted() ensures the mock object exists before vi.mock() runs (which is
// hoisted to the top of the file by Vitest's transform).
// ---------------------------------------------------------------------------

const mockPermissionService = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getUserRoles: vi.fn(),
  getRolePermissions: vi.fn(),
  getResourcePermissions: vi.fn(),
}));

vi.mock('../../services/permission.service.ts', () => ({
  PermissionService: mockPermissionService,
}));

import {
  PERMISSIONS,
  ROLES,
  RESOURCE_TYPES,
  PermissionHelpers,
  QuickChecks,
} from '../permission-helpers';

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// PERMISSIONS constant
// ---------------------------------------------------------------------------

describe('PERMISSIONS constant', () => {
  it('exports PITCH_CREATE', () => {
    expect(PERMISSIONS.PITCH_CREATE).toBe('pitch_create');
  });

  it('exports NDA_APPROVE', () => {
    expect(PERMISSIONS.NDA_APPROVE).toBe('nda_approve');
  });

  it('exports ANALYTICS_VIEW', () => {
    expect(PERMISSIONS.ANALYTICS_VIEW).toBe('analytics_view');
  });

  it('exports ADMIN_ACCESS system permissions', () => {
    expect(PERMISSIONS.PERMISSION_MANAGE).toBe('permission_manage');
    expect(PERMISSIONS.ROLE_MANAGE).toBe('role_manage');
  });

  it('exports FILE_UPLOAD and FILE_DELETE', () => {
    expect(PERMISSIONS.FILE_UPLOAD).toBe('file_upload');
    expect(PERMISSIONS.FILE_DELETE).toBe('file_delete');
  });
});

// ---------------------------------------------------------------------------
// ROLES constant
// ---------------------------------------------------------------------------

describe('ROLES constant', () => {
  it('has core admin roles', () => {
    expect(ROLES.ADMIN).toBe('admin');
    expect(ROLES.SUPER_ADMIN).toBe('super_admin');
  });

  it('has creator variants', () => {
    expect(ROLES.CREATOR).toBe('creator');
    expect(ROLES.CREATOR_PREMIUM).toBe('creator_premium');
    expect(ROLES.CREATOR_VERIFIED).toBe('creator_verified');
  });

  it('has investor variants', () => {
    expect(ROLES.INVESTOR).toBe('investor');
    expect(ROLES.INVESTOR_ACCREDITED).toBe('investor_accredited');
    expect(ROLES.INVESTOR_INSTITUTIONAL).toBe('investor_institutional');
  });

  it('has production variants', () => {
    expect(ROLES.PRODUCTION_COMPANY).toBe('production_company');
    expect(ROLES.PRODUCER).toBe('producer');
    expect(ROLES.EXECUTIVE_PRODUCER).toBe('executive_producer');
  });

  it('has VIEWER role', () => {
    expect(ROLES.VIEWER).toBe('viewer');
  });

  it('has GUEST role', () => {
    expect(ROLES.GUEST).toBe('guest');
  });
});

// ---------------------------------------------------------------------------
// RESOURCE_TYPES constant
// ---------------------------------------------------------------------------

describe('RESOURCE_TYPES constant', () => {
  it('has PITCH', () => expect(RESOURCE_TYPES.PITCH).toBe('pitch'));
  it('has NDA', () => expect(RESOURCE_TYPES.NDA).toBe('nda'));
  it('has USER', () => expect(RESOURCE_TYPES.USER).toBe('user'));
  it('has ANALYTICS', () => expect(RESOURCE_TYPES.ANALYTICS).toBe('analytics'));
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canCreatePitch
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canCreatePitch', () => {
  it('returns true when PermissionService.hasPermission resolves true', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    expect(await PermissionHelpers.canCreatePitch(1)).toBe(true);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(1, PERMISSIONS.PITCH_CREATE);
  });

  it('returns false when PermissionService.hasPermission resolves false', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(false);
    expect(await PermissionHelpers.canCreatePitch(1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canEditPitch
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canEditPitch', () => {
  it('calls hasPermission with PITCH_UPDATE and ownership options', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    const result = await PermissionHelpers.canEditPitch(5, 42);
    expect(result).toBe(true);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(5, PERMISSIONS.PITCH_UPDATE, {
      resourceType: RESOURCE_TYPES.PITCH,
      resourceId: 42,
      checkOwnership: true,
    });
  });

  it('returns false when permission denied', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(false);
    expect(await PermissionHelpers.canEditPitch(5, 42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canModerateContent
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canModerateContent', () => {
  it('passes an array with requireAny:true', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    await PermissionHelpers.canModerateContent(1);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      1,
      [PERMISSIONS.CONTENT_MODERATE, PERMISSIONS.PITCH_MODERATE],
      { requireAny: true }
    );
  });

  it('returns false for non-moderator', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(false);
    expect(await PermissionHelpers.canModerateContent(1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canManageNDAs
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canManageNDAs', () => {
  it('checks NDA_MANAGE, NDA_APPROVE, NDA_REJECT with requireAny', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    await PermissionHelpers.canManageNDAs(1);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      1,
      [PERMISSIONS.NDA_MANAGE, PERMISSIONS.NDA_APPROVE, PERMISSIONS.NDA_REJECT],
      { requireAny: true }
    );
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canApproveNDA
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canApproveNDA', () => {
  it('checks NDA_APPROVE with pitch ownership', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    await PermissionHelpers.canApproveNDA(10, 77);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      10,
      PERMISSIONS.NDA_APPROVE,
      { resourceType: RESOURCE_TYPES.PITCH, resourceId: 77, checkOwnership: true }
    );
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.isAdmin
// ---------------------------------------------------------------------------

describe('PermissionHelpers.isAdmin', () => {
  it('returns true when user has admin role by role.name', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'admin' } }
    ]);
    expect(await PermissionHelpers.isAdmin(1)).toBe(true);
  });

  it('returns true when user has super_admin role by role.name', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'super_admin' } }
    ]);
    expect(await PermissionHelpers.isAdmin(1)).toBe(true);
  });

  it('returns true when role.category is admin', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'custom_role', category: 'admin' } }
    ]);
    expect(await PermissionHelpers.isAdmin(1)).toBe(true);
  });

  it('returns false for creator role', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'creator', category: 'creator' } }
    ]);
    expect(await PermissionHelpers.isAdmin(1)).toBe(false);
  });

  it('returns false when user has no roles', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([]);
    expect(await PermissionHelpers.isAdmin(1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canAccessAnalytics
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canAccessAnalytics', () => {
  it('passes ANALYTICS_VIEW + ANALYTICS_MANAGE with requireAny', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(false);
    await PermissionHelpers.canAccessAnalytics(1);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      1,
      [PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_MANAGE],
      { requireAny: true }
    );
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canManageUsers
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canManageUsers', () => {
  it('passes USER_MODERATE, USER_ASSIGN_ROLES, USER_DELETE with requireAny', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(false);
    await PermissionHelpers.canManageUsers(1);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      1,
      [PERMISSIONS.USER_MODERATE, PERMISSIONS.USER_ASSIGN_ROLES, PERMISSIONS.USER_DELETE],
      { requireAny: true }
    );
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canProcessFinancials
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canProcessFinancials', () => {
  it('passes FINANCE_PROCESS, PAYMENT_PROCESS, INVESTMENT_MANAGE with requireAny', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(false);
    await PermissionHelpers.canProcessFinancials(1);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      1,
      [PERMISSIONS.FINANCE_PROCESS, PERMISSIONS.PAYMENT_PROCESS, PERMISSIONS.INVESTMENT_MANAGE],
      { requireAny: true }
    );
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canUploadFiles
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canUploadFiles', () => {
  it('passes FILE_UPLOAD with optional resource params', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    await PermissionHelpers.canUploadFiles(1, 'pitch', 42);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      1,
      PERMISSIONS.FILE_UPLOAD,
      { resourceType: 'pitch', resourceId: 42 }
    );
  });

  it('passes undefined resource params when not provided', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    await PermissionHelpers.canUploadFiles(1);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      1,
      PERMISSIONS.FILE_UPLOAD,
      { resourceType: undefined, resourceId: undefined }
    );
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canSendMessages
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canSendMessages', () => {
  it('passes MESSAGE_SEND with optional target user', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    await PermissionHelpers.canSendMessages(1, 99);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      1,
      PERMISSIONS.MESSAGE_SEND,
      { resourceType: RESOURCE_TYPES.USER, resourceId: 99 }
    );
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.getUserEffectivePermissions
// ---------------------------------------------------------------------------

describe('PermissionHelpers.getUserEffectivePermissions', () => {
  it('combines role permissions and direct resource permissions, deduplicating', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([{ roleId: 1 }]);
    mockPermissionService.getRolePermissions.mockResolvedValue([
      { granted: true, permission: { name: 'pitch_create' } },
      { granted: true, permission: { name: 'pitch_read' } },
      { granted: false, permission: { name: 'admin_access' } }, // not granted — filtered out
    ]);
    mockPermissionService.getResourcePermissions.mockResolvedValue([
      { granted: true, permission: { name: 'pitch_create' } }, // duplicate
      { granted: true, permission: { name: 'nda_request' } },
    ]);

    const perms = await PermissionHelpers.getUserEffectivePermissions(1);
    expect(perms).toContain('pitch_create');
    expect(perms).toContain('pitch_read');
    expect(perms).toContain('nda_request');
    expect(perms).not.toContain('admin_access'); // was granted: false
    // Deduplication: pitch_create should appear only once
    expect(perms.filter(p => p === 'pitch_create')).toHaveLength(1);
  });

  it('returns empty array on service error', async () => {
    mockPermissionService.getUserRoles.mockRejectedValue(new Error('DB down'));
    const perms = await PermissionHelpers.getUserEffectivePermissions(1);
    expect(perms).toEqual([]);
  });

  it('filters empty permission names', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([{ roleId: 1 }]);
    mockPermissionService.getRolePermissions.mockResolvedValue([
      { granted: true, permission: { name: '' } }, // empty name
      { granted: true, permission: null },          // null permission
    ]);
    mockPermissionService.getResourcePermissions.mockResolvedValue([]);
    const perms = await PermissionHelpers.getUserEffectivePermissions(1);
    expect(perms).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.hasAnyRole
// ---------------------------------------------------------------------------

describe('PermissionHelpers.hasAnyRole', () => {
  it('returns true when user has one of the specified roles', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'creator' } }
    ]);
    expect(await PermissionHelpers.hasAnyRole(1, ['creator', 'admin'])).toBe(true);
  });

  it('returns false when user has none of the specified roles', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'viewer' } }
    ]);
    expect(await PermissionHelpers.hasAnyRole(1, ['creator', 'admin'])).toBe(false);
  });

  it('returns false on error', async () => {
    mockPermissionService.getUserRoles.mockRejectedValue(new Error('DB error'));
    expect(await PermissionHelpers.hasAnyRole(1, ['creator'])).toBe(false);
  });

  it('returns false when user has no roles', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([]);
    expect(await PermissionHelpers.hasAnyRole(1, ['admin'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.getUserMaxRoleLevel
// ---------------------------------------------------------------------------

describe('PermissionHelpers.getUserMaxRoleLevel', () => {
  it('returns highest role level', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { level: 1 } },
      { role: { level: 5 } },
      { role: { level: 3 } },
    ]);
    expect(await PermissionHelpers.getUserMaxRoleLevel(1)).toBe(5);
  });

  it('returns 0 when the user has no roles (empty-array guard)', async () => {
    // Math.max(...[]) === -Infinity; the implementation guards the empty case and
    // returns 0 so a no-role user is not a poison value in hierarchy comparisons.
    mockPermissionService.getUserRoles.mockResolvedValue([]);
    const result = await PermissionHelpers.getUserMaxRoleLevel(1);
    expect(result).toBe(0);
  });

  it('returns 0 on error', async () => {
    mockPermissionService.getUserRoles.mockRejectedValue(new Error('fail'));
    expect(await PermissionHelpers.getUserMaxRoleLevel(1)).toBe(0);
  });

  it('treats missing role.level as 0', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: {} }, // no level field
    ]);
    expect(await PermissionHelpers.getUserMaxRoleLevel(1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.canAccessByHierarchy
// ---------------------------------------------------------------------------

describe('PermissionHelpers.canAccessByHierarchy', () => {
  it('returns true when user level exceeds target by required difference', async () => {
    // user=5, target=3, required=1 → 5 >= (3+1) ✓
    mockPermissionService.getUserRoles
      .mockResolvedValueOnce([{ role: { level: 5 } }])  // user
      .mockResolvedValueOnce([{ role: { level: 3 } }]); // target
    expect(await PermissionHelpers.canAccessByHierarchy(1, 2, 1)).toBe(true);
  });

  it('returns false when user level equals target (needs to exceed by 1)', async () => {
    // user=3, target=3, required=1 → 3 >= (3+1) ✗
    mockPermissionService.getUserRoles
      .mockResolvedValueOnce([{ role: { level: 3 } }])
      .mockResolvedValueOnce([{ role: { level: 3 } }]);
    expect(await PermissionHelpers.canAccessByHierarchy(1, 2, 1)).toBe(false);
  });

  it('uses default required difference of 1', async () => {
    mockPermissionService.getUserRoles
      .mockResolvedValueOnce([{ role: { level: 4 } }])
      .mockResolvedValueOnce([{ role: { level: 2 } }]);
    expect(await PermissionHelpers.canAccessByHierarchy(1, 2)).toBe(true);
  });

  it('returns false on error', async () => {
    mockPermissionService.getUserRoles.mockRejectedValue(new Error('fail'));
    expect(await PermissionHelpers.canAccessByHierarchy(1, 2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.isTimePermissionValid
// ---------------------------------------------------------------------------

describe('PermissionHelpers.isTimePermissionValid', () => {
  it('returns false when no matching permission found', async () => {
    mockPermissionService.getResourcePermissions.mockResolvedValue([]);
    expect(await PermissionHelpers.isTimePermissionValid(1, 'pitch_create')).toBe(false);
  });

  it('returns true when permission found and not expired', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
    mockPermissionService.getResourcePermissions.mockResolvedValue([
      { permission: { name: 'pitch_create' }, granted: true, expiresAt: futureDate, conditions: {} }
    ]);
    expect(await PermissionHelpers.isTimePermissionValid(1, 'pitch_create')).toBe(true);
  });

  it('returns false when permission is expired', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // -1 day
    mockPermissionService.getResourcePermissions.mockResolvedValue([
      { permission: { name: 'pitch_create' }, granted: true, expiresAt: pastDate, conditions: {} }
    ]);
    expect(await PermissionHelpers.isTimePermissionValid(1, 'pitch_create')).toBe(false);
  });

  it('returns false when permission is found but granted:false', async () => {
    mockPermissionService.getResourcePermissions.mockResolvedValue([
      { permission: { name: 'pitch_create' }, granted: false, conditions: {} }
    ]);
    expect(await PermissionHelpers.isTimePermissionValid(1, 'pitch_create')).toBe(false);
  });

  it('returns false on error', async () => {
    mockPermissionService.getResourcePermissions.mockRejectedValue(new Error('DB error'));
    expect(await PermissionHelpers.isTimePermissionValid(1, 'pitch_create')).toBe(false);
  });

  it('respects time restrictions — rejects disallowed hour', async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const disallowedHours = Array.from({ length: 24 }, (_, i) => i).filter(h => h !== currentHour);
    // Only allowed hours are everything except the current hour
    mockPermissionService.getResourcePermissions.mockResolvedValue([
      {
        permission: { name: 'pitch_create' }, granted: true, conditions: {
          timeRestrictions: { allowedHours: disallowedHours }
        }
      }
    ]);
    expect(await PermissionHelpers.isTimePermissionValid(1, 'pitch_create')).toBe(false);
  });

  it('respects time restrictions — allows current hour', async () => {
    const currentHour = new Date().getHours();
    mockPermissionService.getResourcePermissions.mockResolvedValue([
      {
        permission: { name: 'pitch_create' }, granted: true, conditions: {
          timeRestrictions: { allowedHours: [currentHour] }
        }
      }
    ]);
    expect(await PermissionHelpers.isTimePermissionValid(1, 'pitch_create')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PermissionHelpers.getPermissionSummary
// ---------------------------------------------------------------------------

describe('PermissionHelpers.getPermissionSummary', () => {
  it('returns a complete summary structure', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { roleId: 1, role: { name: 'creator', category: 'creator' } }
    ]);
    mockPermissionService.getRolePermissions.mockResolvedValue([
      { granted: true, permission: { name: 'pitch_create' } }
    ]);
    mockPermissionService.getResourcePermissions.mockResolvedValue([]);
    mockPermissionService.hasPermission.mockResolvedValue(false);

    const summary = await PermissionHelpers.getPermissionSummary(1);
    expect(summary).toHaveProperty('roles');
    expect(summary).toHaveProperty('permissions');
    expect(summary).toHaveProperty('level');
    expect(summary).toHaveProperty('isAdmin');
    expect(summary).toHaveProperty('canModerate');
    expect(summary).toHaveProperty('canManageFinances');
    expect(Array.isArray(summary.roles)).toBe(true);
    expect(Array.isArray(summary.permissions)).toBe(true);
  });

  it('returns safe defaults on error', async () => {
    mockPermissionService.getUserRoles.mockRejectedValue(new Error('fail'));
    mockPermissionService.hasPermission.mockRejectedValue(new Error('fail'));
    mockPermissionService.getRolePermissions.mockRejectedValue(new Error('fail'));
    mockPermissionService.getResourcePermissions.mockRejectedValue(new Error('fail'));

    const summary = await PermissionHelpers.getPermissionSummary(1);
    expect(summary.roles).toEqual([]);
    expect(summary.permissions).toEqual([]);
    expect(summary.level).toBe(0);
    expect(summary.isAdmin).toBe(false);
    expect(summary.canModerate).toBe(false);
    expect(summary.canManageFinances).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QuickChecks — shorthand methods
// ---------------------------------------------------------------------------

describe('QuickChecks', () => {
  it('isCreator checks creator, creator_premium, creator_verified', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'creator_verified' } }
    ]);
    expect(await QuickChecks.isCreator(1)).toBe(true);
  });

  it('isCreator returns false for investor', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'investor' } }
    ]);
    expect(await QuickChecks.isCreator(1)).toBe(false);
  });

  it('isInvestor checks investor, investor_accredited, investor_institutional', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'investor_institutional' } }
    ]);
    expect(await QuickChecks.isInvestor(1)).toBe(true);
  });

  it('isProducer checks producer, executive_producer, production_company', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'executive_producer' } }
    ]);
    expect(await QuickChecks.isProducer(1)).toBe(true);
  });

  it('isModerator checks moderator, content_reviewer, admin', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'admin' } }
    ]);
    expect(await QuickChecks.isModerator(1)).toBe(true);
  });

  it('isModerator is false for creator', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'creator' } }
    ]);
    expect(await QuickChecks.isModerator(1)).toBe(false);
  });

  it('isAdmin delegates to PermissionHelpers.isAdmin', async () => {
    mockPermissionService.getUserRoles.mockResolvedValue([
      { role: { name: 'admin' } }
    ]);
    expect(await QuickChecks.isAdmin(1)).toBe(true);
  });

  it('canCreateContent delegates to canCreatePitch', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(true);
    expect(await QuickChecks.canCreateContent(1)).toBe(true);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(1, PERMISSIONS.PITCH_CREATE);
  });

  it('canModerate delegates to canModerateContent', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(false);
    expect(await QuickChecks.canModerate(1)).toBe(false);
  });
});
