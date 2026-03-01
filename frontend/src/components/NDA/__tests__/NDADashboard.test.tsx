import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NDADashboard from '../NDADashboard';

const { mockGetNDAStats, mockGetNDAs, mockGetNDAAnalytics, mockSuccess, mockError } = vi.hoisted(() => ({
  mockGetNDAStats: vi.fn(),
  mockGetNDAs: vi.fn(),
  mockGetNDAAnalytics: vi.fn(),
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('../../../services/nda.service', () => ({
  ndaService: {
    getNDAStats: (...args: unknown[]) => mockGetNDAStats(...args),
    getNDAs: (...args: unknown[]) => mockGetNDAs(...args),
    getNDAAnalytics: (...args: unknown[]) => mockGetNDAAnalytics(...args),
  },
}));

vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

// Mock child components to isolate NDADashboard
vi.mock('../NDAApprovalWorkflow', () => ({
  default: ({ creatorId }: { creatorId: number }) => (
    <div data-testid="nda-approval-workflow">NDAApprovalWorkflow creatorId={creatorId}</div>
  ),
}));

vi.mock('../NDANotificationCenter', () => ({
  default: ({ userId }: { userId: number }) => (
    <div data-testid="nda-notification-center">NDANotificationCenter userId={userId}</div>
  ),
}));

const mockStats = {
  total: 25,
  pending: 3,
  approved: 18,
  rejected: 2,
  expired: 2,
  approvalRate: 72,
  avgResponseTimeHours: 14.5,
  recent: {
    requests: 5,
    approvals: 4,
    approvalRate: 80,
  },
  urgency: {
    priority: 1,
    standard: 24,
  },
};

const mockNDAs = [
  {
    id: 1,
    pitchId: 10,
    pitch: { title: 'Test Pitch Alpha' },
    requester: { username: 'john_investor' },
    pitchOwner: { username: 'jane_creator' },
    status: 'approved',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    pitchId: 20,
    pitch: { title: 'Test Pitch Beta' },
    requester: { username: 'bob_investor' },
    pitchOwner: { username: 'jane_creator' },
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];

const mockAnalytics = {
  totalRequests: 25,
  approved: 18,
  rejected: 2,
  pending: 3,
  avgResponseTime: 14.5,
};

describe('NDADashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNDAStats.mockResolvedValue(mockStats);
    mockGetNDAs.mockResolvedValue({ ndas: mockNDAs });
    mockGetNDAAnalytics.mockResolvedValue(mockAnalytics);
  });

  describe('loading state', () => {
    it('shows spinner while loading', () => {
      mockGetNDAStats.mockImplementation(() => new Promise(() => {}));
      mockGetNDAs.mockImplementation(() => new Promise(() => {}));
      render(<NDADashboard userId={1} userRole="creator" />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides spinner after data loads', async () => {
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(screen.getByText('NDA Management')).toBeInTheDocument();
      });

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('overview tab', () => {
    it('renders stat cards with correct values', async () => {
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(screen.getByText('Total NDAs')).toBeInTheDocument();
      });

      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('Pending Reviews')).toBeInTheDocument();
      // "3" appears in stat card AND the approvals tab badge
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Approval Rate')).toBeInTheDocument();
      expect(screen.getByText('72%')).toBeInTheDocument();
      expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
      expect(screen.getByText('15h')).toBeInTheDocument(); // Math.round(14.5) = 15
    });

    it('renders recent NDA activity', async () => {
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(screen.getByText('Recent NDA Activity')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Pitch Alpha')).toBeInTheDocument();
      expect(screen.getByText('Test Pitch Beta')).toBeInTheDocument();
    });

    it('shows empty state when no recent NDAs', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [] });
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(screen.getByText('No recent NDA activity')).toBeInTheDocument();
      });
    });

    it('renders quick actions for creator role', async () => {
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });

      expect(screen.getByText('Review Pending NDAs')).toBeInTheDocument();
      expect(screen.getByText('View Analytics')).toBeInTheDocument();
      expect(screen.getByText('Download Reports')).toBeInTheDocument();
      // "Notifications" appears in both the nav tab and quick actions
      expect(screen.getAllByText('Notifications').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('navigation tabs', () => {
    it('renders all tabs', async () => {
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      expect(screen.getByText('Approvals')).toBeInTheDocument();
      // "Notifications" appears in both the nav tab and quick actions
      expect(screen.getAllByText('Notifications').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    it('shows analytics panel when analytics tab is clicked', async () => {
      const user = userEvent.setup();
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(screen.getByText('NDA Management')).toBeInTheDocument();
      });

      const analyticsTab = screen.getByText('Analytics');
      await user.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('NDA Analytics')).toBeInTheDocument();
      });

      // NDAAnalyticsPanel renders stats from getNDAAnalytics
      expect(screen.getByText('Total NDAs')).toBeInTheDocument();
      expect(screen.getByText('Signed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Avg Time to Sign')).toBeInTheDocument();
    });

    it('shows approval workflow when approvals tab is clicked (creator)', async () => {
      const user = userEvent.setup();
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(screen.getByText('NDA Management')).toBeInTheDocument();
      });

      const approvalsTab = screen.getByText('Approvals');
      await user.click(approvalsTab);

      await waitFor(() => {
        expect(screen.getByTestId('nda-approval-workflow')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('shows error toast when dashboard data fails to load', async () => {
      mockGetNDAStats.mockRejectedValue(new Error('Network error'));
      mockGetNDAs.mockRejectedValue(new Error('Network error'));
      render(<NDADashboard userId={1} userRole="creator" />);

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Loading Failed',
          'Unable to load dashboard data. Please try again.'
        );
      });
    });
  });
});
