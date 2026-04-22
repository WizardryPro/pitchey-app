import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PermissionGuard, { PermissionRoute } from '../PermissionGuard';
import { Permission } from '../../hooks/usePermissions';

// Track Navigate calls
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: (props: { to: string; replace?: boolean }) => {
      return <div data-testid="navigate" data-to={props.to} />;
    },
  };
});

// Mock betterAuthStore — must use vi.hoisted to survive vi.mock hoisting
const { mockAuthState, mockUseBetterAuthStore } = vi.hoisted(() => {
  const mockAuthState = {
    isAuthenticated: false,
    user: null as { id: number; userType: string } | null,
    loading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    loginCreator: vi.fn(),
    loginInvestor: vi.fn(),
    loginProduction: vi.fn(),
    register: vi.fn(),
    setUser: vi.fn(),
    updateUser: vi.fn(),
    checkSession: vi.fn(),
    refreshSession: vi.fn(),
  };

  const mockUseBetterAuthStore = Object.assign(
    () => mockAuthState,
    { getState: () => mockAuthState }
  );

  return { mockAuthState, mockUseBetterAuthStore };
});

vi.mock('@/store/betterAuthStore', () => ({
  useBetterAuthStore: mockUseBetterAuthStore,
}));

function setRole(role: string, authenticated = true) {
  mockAuthState.isAuthenticated = authenticated;
  mockAuthState.user = { id: 1, userType: role };
}

function renderGuard(props: React.ComponentProps<typeof PermissionGuard>) {
  return render(
    <MemoryRouter>
      <PermissionGuard {...props} />
    </MemoryRouter>
  );
}

describe('PermissionGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;
  });

  // ─── Unauthenticated Users ──────────────────────────────────────────

  describe('unauthenticated users', () => {
    it('redirects to /portals when not authenticated', () => {
      renderGuard({
        requires: Permission.PITCH_CREATE,
        children: <div>Protected Content</div>,
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/portals');
    });

    it('redirects to custom path when redirectTo is set', () => {
      renderGuard({
        requires: Permission.PITCH_CREATE,
        redirectTo: '/login',
        children: <div>Protected Content</div>,
      });
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    });

    it('shows fallback when hideIfDenied is true and not authenticated', () => {
      renderGuard({
        requires: Permission.PITCH_CREATE,
        hideIfDenied: true,
        fallback: <div>Access Denied</div>,
        children: <div>Protected Content</div>,
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('renders nothing when hideIfDenied is true with no fallback', () => {
      const { container } = renderGuard({
        requires: Permission.PITCH_CREATE,
        hideIfDenied: true,
        children: <div>Protected Content</div>,
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(container.innerHTML).toBe('');
    });
  });

  // ─── requires (single permission) ──────────────────────────────────

  describe('requires (single permission)', () => {
    it('renders children when user has the required permission', () => {
      setRole('creator');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        children: <div>Create Pitch</div>,
      });
      expect(screen.getByText('Create Pitch')).toBeInTheDocument();
    });

    it('redirects when user lacks the required permission', () => {
      setRole('viewer');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        children: <div>Create Pitch</div>,
      });
      expect(screen.queryByText('Create Pitch')).not.toBeInTheDocument();
      expect(screen.getByTestId('navigate')).toBeInTheDocument();
    });

    it('redirects to /creator/dashboard when creator is denied', () => {
      setRole('creator');
      renderGuard({
        requires: Permission.ADMIN_ACCESS,
        children: <div>Admin Panel</div>,
      });
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/creator/dashboard');
    });

    it('redirects to /investor/dashboard when investor is denied', () => {
      setRole('investor');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        children: <div>Create Pitch</div>,
      });
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/investor/dashboard');
    });

    it('redirects to /production/dashboard when production is denied', () => {
      setRole('production');
      renderGuard({
        requires: Permission.ADMIN_ACCESS,
        children: <div>Admin</div>,
      });
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/production/dashboard');
    });

    it('redirects viewer role to the watcher dashboard', () => {
      // Viewer IS the watcher role per CLAUDE.md (Watcher Portal = browse-only
      // audience). PermissionGuard sends them to their own dashboard, not the
      // portal picker.
      setRole('viewer');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        children: <div>Protected</div>,
      });
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/watcher/dashboard');
    });

    it('admin can access anything', () => {
      setRole('admin');
      renderGuard({
        requires: Permission.ADMIN_ACCESS,
        children: <div>Admin Panel</div>,
      });
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    });

    it('works with string permission values', () => {
      setRole('creator');
      renderGuard({
        requires: 'pitch.create',
        children: <div>Create Pitch</div>,
      });
      expect(screen.getByText('Create Pitch')).toBeInTheDocument();
    });
  });

  // ─── requiresAny ───────────────────────────────────────────────────

  describe('requiresAny', () => {
    it('renders when user has one of the required permissions', () => {
      setRole('creator');
      renderGuard({
        requiresAny: [Permission.PITCH_CREATE, Permission.INVESTMENT_CREATE],
        children: <div>Content</div>,
      });
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('redirects when user has none of the required permissions', () => {
      setRole('viewer');
      renderGuard({
        requiresAny: [Permission.PITCH_CREATE, Permission.INVESTMENT_CREATE],
        children: <div>Content</div>,
      });
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
      expect(screen.getByTestId('navigate')).toBeInTheDocument();
    });

    it('investor can access investment sections', () => {
      setRole('investor');
      renderGuard({
        requiresAny: [Permission.INVESTMENT_CREATE, Permission.PORTFOLIO_VIEW],
        children: <div>Investment Section</div>,
      });
      expect(screen.getByText('Investment Section')).toBeInTheDocument();
    });

    it('hides content with fallback when denied and hideIfDenied', () => {
      setRole('viewer');
      renderGuard({
        requiresAny: [Permission.PITCH_CREATE, Permission.INVESTMENT_CREATE],
        hideIfDenied: true,
        fallback: <div>Upgrade to access</div>,
        children: <div>Content</div>,
      });
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
      expect(screen.getByText('Upgrade to access')).toBeInTheDocument();
    });
  });

  // ─── requiresAll ──────────────────────────────────────────────────

  describe('requiresAll', () => {
    it('renders when user has all required permissions', () => {
      setRole('creator');
      renderGuard({
        requiresAll: [Permission.PITCH_CREATE, Permission.PITCH_PUBLISH, Permission.PITCH_EDIT_OWN],
        children: <div>Full Editor</div>,
      });
      expect(screen.getByText('Full Editor')).toBeInTheDocument();
    });

    it('redirects when user is missing one required permission', () => {
      setRole('creator');
      renderGuard({
        requiresAll: [Permission.PITCH_CREATE, Permission.ADMIN_ACCESS],
        children: <div>Admin Editor</div>,
      });
      expect(screen.queryByText('Admin Editor')).not.toBeInTheDocument();
      expect(screen.getByTestId('navigate')).toBeInTheDocument();
    });

    it('admin passes any requiresAll check', () => {
      setRole('admin');
      renderGuard({
        requiresAll: [Permission.PITCH_CREATE, Permission.ADMIN_ACCESS, Permission.PRODUCTION_BUDGET],
        children: <div>Everything</div>,
      });
      expect(screen.getByText('Everything')).toBeInTheDocument();
    });
  });

  // ─── hideIfDenied & fallback ────────────────────────────────────────

  describe('hideIfDenied and fallback', () => {
    it('renders children when allowed even with hideIfDenied', () => {
      setRole('creator');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        hideIfDenied: true,
        children: <div>Visible</div>,
      });
      expect(screen.getByText('Visible')).toBeInTheDocument();
    });

    it('shows fallback node when denied', () => {
      setRole('viewer');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        hideIfDenied: true,
        fallback: <span>No access</span>,
        children: <div>Protected</div>,
      });
      expect(screen.getByText('No access')).toBeInTheDocument();
      expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    });

    it('renders nothing when hideIfDenied and no fallback', () => {
      setRole('viewer');
      const { container } = renderGuard({
        requires: Permission.PITCH_CREATE,
        hideIfDenied: true,
        children: <div>Protected</div>,
      });
      expect(container.innerHTML).toBe('');
    });
  });

  // ─── Custom redirectTo ──────────────────────────────────────────────

  describe('custom redirectTo', () => {
    it('uses custom redirect path', () => {
      setRole('viewer');
      renderGuard({
        requires: Permission.ADMIN_ACCESS,
        redirectTo: '/403',
        children: <div>Admin</div>,
      });
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/403');
    });

    it('overrides default role-based redirect', () => {
      setRole('creator');
      renderGuard({
        requires: Permission.ADMIN_ACCESS,
        redirectTo: '/not-allowed',
        children: <div>Admin</div>,
      });
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/not-allowed');
    });
  });

  // ─── Combined requires + requiresAny ────────────────────────────────

  describe('combined permission checks', () => {
    it('requires AND requiresAny both must pass', () => {
      setRole('creator');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        requiresAny: [Permission.DOCUMENT_UPLOAD, Permission.DOCUMENT_DELETE_OWN],
        children: <div>Creator with docs</div>,
      });
      expect(screen.getByText('Creator with docs')).toBeInTheDocument();
    });

    it('fails when requires passes but requiresAny fails', () => {
      setRole('creator');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        requiresAny: [Permission.ADMIN_ACCESS, Permission.INVESTMENT_MANAGE],
        children: <div>Content</div>,
      });
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });

    it('requires AND requiresAll both must pass', () => {
      setRole('creator');
      renderGuard({
        requires: Permission.PITCH_CREATE,
        requiresAll: [Permission.PITCH_PUBLISH, Permission.DOCUMENT_UPLOAD],
        children: <div>Full access</div>,
      });
      expect(screen.getByText('Full access')).toBeInTheDocument();
    });
  });
});

// ─── PermissionRoute ────────────────────────────────────────────────

describe('PermissionRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;
  });

  it('renders children when permission is granted', () => {
    setRole('creator');
    render(
      <MemoryRouter>
        <PermissionRoute requires={Permission.PITCH_CREATE}>
          <div>Route Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Route Content')).toBeInTheDocument();
  });

  it('redirects when permission is denied', () => {
    setRole('viewer');
    render(
      <MemoryRouter>
        <PermissionRoute requires={Permission.PITCH_CREATE}>
          <div>Route Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Route Content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
  });

  it('supports requiresAny prop', () => {
    setRole('investor');
    render(
      <MemoryRouter>
        <PermissionRoute requiresAny={[Permission.INVESTMENT_CREATE, Permission.PORTFOLIO_VIEW]}>
          <div>Investor Route</div>
        </PermissionRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Investor Route')).toBeInTheDocument();
  });

  it('supports requiresAll prop', () => {
    setRole('admin');
    render(
      <MemoryRouter>
        <PermissionRoute requiresAll={[Permission.ADMIN_ACCESS, Permission.ADMIN_SETTINGS]}>
          <div>Admin Route</div>
        </PermissionRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Admin Route')).toBeInTheDocument();
  });

  it('supports custom redirectTo', () => {
    setRole('viewer');
    render(
      <MemoryRouter>
        <PermissionRoute requires={Permission.ADMIN_ACCESS} redirectTo="/forbidden">
          <div>Admin Route</div>
        </PermissionRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/forbidden');
  });

  it('redirects unauthenticated users to /portals', () => {
    mockAuthState.isAuthenticated = false;
    render(
      <MemoryRouter>
        <PermissionRoute requires={Permission.PITCH_CREATE}>
          <div>Protected Route</div>
        </PermissionRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/portals');
  });
});
