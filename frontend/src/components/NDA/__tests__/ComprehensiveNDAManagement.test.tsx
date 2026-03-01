import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComprehensiveNDAManagement from '../ComprehensiveNDAManagement';
import type { NDARequest } from '@shared/types/nda.types';

// Use vi.hoisted so mock objects are available before vi.mock hoisting
const { mockNdaService, mockAuthStore } = vi.hoisted(() => ({
  mockNdaService: {
    getIncomingRequests: vi.fn(),
    getOutgoingRequests: vi.fn(),
    getSignedNDAs: vi.fn(),
    getNDAStats: vi.fn(),
    approveNDA: vi.fn(),
    rejectNDA: vi.fn(),
    bulkApprove: vi.fn(),
    bulkReject: vi.fn(),
    sendReminder: vi.fn(),
    downloadNDA: vi.fn(),
  },
  mockAuthStore: {
    isAuthenticated: true,
  },
}));

vi.mock('../../../services/nda.service', () => ({
  ndaService: mockNdaService,
}));

vi.mock('../../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthStore,
}));

// Mock child components
vi.mock('../../NDAManagementPanel', () => ({
  default: ({ title, description }: any) => (
    <div data-testid="nda-management-panel">
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock('../../NDAStatusBadge', () => ({
  default: ({ status }: any) => (
    <div data-testid="nda-status-badge">{status}</div>
  ),
}));

// Test data factories
const createMockNDARequest = (overrides: Partial<NDARequest> = {}): NDARequest => ({
  id: 1,
  pitchId: 100,
  requesterId: 2,
  ownerId: 3,
  ndaType: 'basic',
  status: 'pending',
  requestMessage: 'Please review this NDA',
  requestedAt: '2026-02-01T10:00:00Z',
  respondedAt: undefined,
  expiresAt: '2026-03-01T10:00:00Z',
  pitch: {
    id: 100,
    title: 'Test Pitch Title',
    logline: 'Test logline',
    synopsis: 'Test synopsis',
    genre: 'Drama',
    status: 'published',
    thumbnail: '',
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
  } as any,
  requester: {
    id: 2,
    username: 'investor_user',
    email: 'investor@test.com',
  } as any,
  owner: {
    id: 3,
    username: 'creator_user',
    email: 'creator@test.com',
  } as any,
  ...overrides,
});

const createMockStats = (overrides = {}) => ({
  total: 10,
  pending: 3,
  approved: 5,
  rejected: 1,
  expired: 1,
  revoked: 0,
  approvalRate: 71.4,
  avgResponseTime: 24,
  ...overrides,
});

describe('ComprehensiveNDAManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.isAuthenticated = true;

    // Setup default mock responses
    mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: [] });
    mockNdaService.getOutgoingRequests.mockResolvedValue({ ndaRequests: [] });
    mockNdaService.getSignedNDAs.mockResolvedValue({ ndaRequests: [] });
    mockNdaService.getNDAStats.mockResolvedValue(createMockStats());
  });

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      expect(screen.getByText(/Loading NDA management/i)).toBeInTheDocument();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides spinner after data loads', async () => {
      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('rendering for creator', () => {
    it('shows NDA Management header with Shield icon', async () => {
      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.getByText('NDA Management')).toBeInTheDocument();
      });

      expect(screen.getByText(/Manage your confidentiality agreements/i)).toBeInTheDocument();
    });

    it('fetches incoming requests for creators', async () => {
      const mockIncoming = [createMockNDARequest({ id: 1, status: 'pending' })];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockIncoming });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(mockNdaService.getIncomingRequests).toHaveBeenCalled();
        expect(mockNdaService.getOutgoingRequests).not.toHaveBeenCalled();
      });
    });

    it('shows incoming tab for creators', async () => {
      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Incoming Requests')).toBeInTheDocument();
      });
    });

    it('shows analytics stats when loaded', async () => {
      const mockStats = createMockStats({ total: 15, approvalRate: 80 });
      mockNdaService.getNDAStats.mockResolvedValue(mockStats);

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument(); // Total Requests
        expect(screen.getByText('80%')).toBeInTheDocument(); // Approval Rate
      });
    });
  });

  describe('rendering for investor', () => {
    it('fetches outgoing requests for investors', async () => {
      const mockOutgoing = [createMockNDARequest({ id: 2, status: 'approved' })];
      mockNdaService.getOutgoingRequests.mockResolvedValue({ ndaRequests: mockOutgoing });

      render(<ComprehensiveNDAManagement userType="investor" userId={2} />);

      await waitFor(() => {
        expect(mockNdaService.getOutgoingRequests).toHaveBeenCalled();
        expect(mockNdaService.getIncomingRequests).not.toHaveBeenCalled();
      });
    });

    it('shows My Requests tab for investors', async () => {
      render(<ComprehensiveNDAManagement userType="investor" userId={2} />);

      await waitFor(() => {
        expect(screen.getByText('My Requests')).toBeInTheDocument();
      });
    });
  });

  describe('rendering for production', () => {
    it('fetches outgoing requests for production users', async () => {
      const mockOutgoing = [createMockNDARequest({ id: 3, status: 'pending' })];
      mockNdaService.getOutgoingRequests.mockResolvedValue({ ndaRequests: mockOutgoing });

      render(<ComprehensiveNDAManagement userType="production" userId={3} />);

      await waitFor(() => {
        expect(mockNdaService.getOutgoingRequests).toHaveBeenCalled();
        expect(mockNdaService.getIncomingRequests).not.toHaveBeenCalled();
      });
    });

    it('shows My Requests tab for production users', async () => {
      render(<ComprehensiveNDAManagement userType="production" userId={3} />);

      await waitFor(() => {
        expect(screen.getByText('My Requests')).toBeInTheDocument();
      });
    });
  });

  describe('empty states', () => {
    it('shows empty state when no NDAs', async () => {
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: [] });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Click on incoming tab to see the empty state
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        expect(screen.getByText('No NDAs found')).toBeInTheDocument();
      });
    });

    it('does not fetch if userId is 0', () => {
      render(<ComprehensiveNDAManagement userType="creator" userId={0} />);

      expect(mockNdaService.getIncomingRequests).not.toHaveBeenCalled();
      expect(mockNdaService.getOutgoingRequests).not.toHaveBeenCalled();
      expect(mockNdaService.getNDAStats).not.toHaveBeenCalled();
    });

    it('does not fetch if userId is negative', () => {
      render(<ComprehensiveNDAManagement userType="creator" userId={-1} />);

      expect(mockNdaService.getIncomingRequests).not.toHaveBeenCalled();
      expect(mockNdaService.getOutgoingRequests).not.toHaveBeenCalled();
      expect(mockNdaService.getNDAStats).not.toHaveBeenCalled();
    });

    it('does not fetch if not authenticated', () => {
      mockAuthStore.isAuthenticated = false;

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      expect(mockNdaService.getIncomingRequests).not.toHaveBeenCalled();
      expect(mockNdaService.getOutgoingRequests).not.toHaveBeenCalled();
      expect(mockNdaService.getNDAStats).not.toHaveBeenCalled();
    });
  });

  describe('tab navigation', () => {
    it('switches to incoming tab when clicked', async () => {
      const mockIncoming = [createMockNDARequest({ id: 1 })];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockIncoming });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        expect(screen.getByText('Test Pitch Title')).toBeInTheDocument();
      });
    });

    it('switches to signed tab when clicked', async () => {
      const mockSigned = [createMockNDARequest({ id: 2, status: 'approved' })];
      mockNdaService.getSignedNDAs.mockResolvedValue({ ndaRequests: mockSigned });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // "Active NDAs" appears in stats, tab nav, and Quick Actions — scope to nav
      const nav = document.querySelector('nav')!;
      const signedTab = within(nav).getByText('Active NDAs');
      fireEvent.click(signedTab);

      await waitFor(() => {
        expect(screen.getByTestId('nda-management-panel')).toBeInTheDocument();
      });
    });

    it('switches to analytics tab when clicked', async () => {
      const mockStats = createMockStats({ total: 20 });
      mockNdaService.getNDAStats.mockResolvedValue(mockStats);

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      const analyticsTab = screen.getByText('Analytics');
      fireEvent.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('Recommendations')).toBeInTheDocument();
      });
    });

    it('shows correct content for overview tab', async () => {
      const mockIncoming = [createMockNDARequest({ id: 1 })];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockIncoming });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Overview tab should show Recent Activity
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
  });

  describe('search and filter', () => {
    it('filters NDAs by search query', async () => {
      const mockNDAs = [
        createMockNDARequest({ id: 1, pitch: { title: 'Action Movie' } as any }),
        createMockNDARequest({ id: 2, pitch: { title: 'Drama Film' } as any }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        expect(screen.getByText('Action Movie')).toBeInTheDocument();
        expect(screen.getByText('Drama Film')).toBeInTheDocument();
      });

      // Search for "Action"
      const searchInput = screen.getByPlaceholderText('Search NDAs...');
      fireEvent.change(searchInput, { target: { value: 'Action' } });

      await waitFor(() => {
        expect(screen.getByText('Action Movie')).toBeInTheDocument();
        expect(screen.queryByText('Drama Film')).not.toBeInTheDocument();
      });
    });

    it('filters NDAs by status', async () => {
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'pending' }),
        createMockNDARequest({ id: 2, status: 'approved' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        const badges = screen.getAllByTestId('nda-status-badge');
        expect(badges).toHaveLength(2);
      });

      // Filter by approved status — use getByDisplayValue to target the status select (not the sort select)
      const statusFilter = screen.getByDisplayValue('All Status');
      fireEvent.change(statusFilter, { target: { value: 'approved' } });

      await waitFor(() => {
        const badges = screen.getAllByTestId('nda-status-badge');
        expect(badges).toHaveLength(1);
        expect(badges[0]).toHaveTextContent('approved');
      });
    });

    it('shows empty state when filters return no results', async () => {
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'pending' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      // Filter by approved (but all are pending)
      const statusFilter = screen.getByDisplayValue('All Status');
      fireEvent.change(statusFilter, { target: { value: 'approved' } });

      await waitFor(() => {
        expect(screen.getByText('No NDAs found')).toBeInTheDocument();
        expect(screen.getByText(/Try adjusting your filters/i)).toBeInTheDocument();
      });
    });
  });

  describe('bulk actions', () => {
    it('creator sees approve/reject bulk actions', async () => {
      const user = userEvent.setup();
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'pending' }),
        createMockNDARequest({ id: 2, status: 'pending' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab
      const incomingTab = screen.getByText('Incoming Requests');
      await user.click(incomingTab);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });

      // Select first NDA (index 0 = "Select all", index 1+ = individual NDAs)
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        // "1 selected" appears in both header and list — check at least one exists
        expect(screen.getAllByText(/1 selected/).length).toBeGreaterThan(0);
      });

      // Open bulk actions menu — "Actions" button appears in header when items are selected
      const actionsButton = screen.getByText('Actions');
      await user.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText('Approve Selected')).toBeInTheDocument();
        expect(screen.getByText('Reject Selected')).toBeInTheDocument();
        expect(screen.getByText('Send Reminders')).toBeInTheDocument();
      });
    });

    it('investor sees download bulk action', async () => {
      const user = userEvent.setup();
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'approved' }),
        createMockNDARequest({ id: 2, status: 'approved' }),
      ];
      mockNdaService.getOutgoingRequests.mockResolvedValue({ ndaRequests: mockNDAs });

      render(<ComprehensiveNDAManagement userType="investor" userId={2} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to outgoing tab
      const outgoingTab = screen.getByText('My Requests');
      await user.click(outgoingTab);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });

      // Select first NDA
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        // "1 selected" appears in both header and list — check at least one exists
        expect(screen.getAllByText(/1 selected/).length).toBeGreaterThan(0);
      });

      // Open bulk actions menu
      const actionsButton = screen.getByText('Actions');
      await user.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText('Download Selected')).toBeInTheDocument();
        expect(screen.getByText('Send Follow-ups')).toBeInTheDocument();
      });
    });

    it('calls bulkApprove when approve action is triggered', async () => {
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'pending' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });
      mockNdaService.bulkApprove.mockResolvedValue({ success: true });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab and select an NDA
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[1]);
      });

      // Open bulk actions and click approve
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      const approveButton = screen.getByText('Approve Selected');
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(mockNdaService.bulkApprove).toHaveBeenCalledWith([1]);
      });
    });

    it('calls bulkReject when reject action is triggered', async () => {
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'pending' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });
      mockNdaService.bulkReject.mockResolvedValue({ success: true });

      // Mock window.prompt
      const originalPrompt = window.prompt;
      window.prompt = vi.fn().mockReturnValue('Rejection reason');

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab and select an NDA
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[1]);
      });

      // Open bulk actions and click reject
      const actionsButton = screen.getByText('Actions');
      fireEvent.click(actionsButton);

      const rejectButton = screen.getByText('Reject Selected');
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(mockNdaService.bulkReject).toHaveBeenCalledWith([1], 'Rejection reason');
      });

      // Restore window.prompt
      window.prompt = originalPrompt;
    });
  });

  describe('error handling', () => {
    it('clears data on 401 error', async () => {
      const mockError = { response: { status: 401 }, message: '401 Unauthorized' };
      mockNdaService.getIncomingRequests.mockRejectedValue(mockError);

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Should not show any NDAs after 401 error
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        expect(screen.getByText('No NDAs found')).toBeInTheDocument();
      });
    });

    it('handles generic API errors gracefully', async () => {
      const mockError = new Error('Network error');
      mockNdaService.getIncomingRequests.mockRejectedValue(mockError);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch NDA data:', mockError);

      consoleErrorSpy.mockRestore();
    });

    it('handles error when approving NDA', async () => {
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'pending' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });
      mockNdaService.approveNDA.mockRejectedValue(new Error('Approve failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument();
      });

      // Click approve button
      const approveButton = screen.getByText('Approve');
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('refresh functionality', () => {
    it('refetches data when refresh button is clicked', async () => {
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: [] });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Clear the mock call count
      mockNdaService.getIncomingRequests.mockClear();

      // Click refresh button
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockNdaService.getIncomingRequests).toHaveBeenCalled();
      });
    });
  });

  describe('analytics section', () => {
    it('shows performance metrics in analytics tab', async () => {
      const mockStats = createMockStats({
        total: 25,
        approvalRate: 85,
        avgResponseTime: 36
      });
      mockNdaService.getNDAStats.mockResolvedValue(mockStats);

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to analytics tab
      const analyticsTab = screen.getByText('Analytics');
      fireEvent.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        // Check that metrics are displayed (they appear multiple times - in header and analytics)
        const totalElements = screen.getAllByText('25');
        expect(totalElements.length).toBeGreaterThan(0);
      });
    });

    it('shows recommendations based on metrics', async () => {
      const mockStats = createMockStats({
        avgResponseTime: 50, // High response time triggers recommendation
        approvalRate: 55 // Low approval rate triggers recommendation
      });
      mockNdaService.getNDAStats.mockResolvedValue(mockStats);

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to analytics tab
      const analyticsTab = screen.getByText('Analytics');
      fireEvent.click(analyticsTab);

      await waitFor(() => {
        expect(screen.getByText(/Consider faster response times/i)).toBeInTheDocument();
        expect(screen.getByText(/Review rejection reasons/i)).toBeInTheDocument();
      });
    });
  });

  describe('tab counts', () => {
    it('shows correct count badges on tabs', async () => {
      const mockIncoming = [
        createMockNDARequest({ id: 1 }),
        createMockNDARequest({ id: 2 }),
      ];
      const mockSigned = [
        createMockNDARequest({ id: 3, status: 'approved' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockIncoming });
      mockNdaService.getSignedNDAs.mockResolvedValue({ ndaRequests: mockSigned });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Check for count badges in tab nav — badges are <span> inside tab <button>s
      // Use getAllByText since numbers may appear elsewhere in the DOM
      const twoBadges = screen.getAllByText('2');
      expect(twoBadges.length).toBeGreaterThan(0); // Incoming count badge
      const oneBadges = screen.getAllByText('1');
      expect(oneBadges.length).toBeGreaterThan(0); // Signed count badge
    });
  });

  describe('individual NDA actions', () => {
    it('allows creator to approve individual NDA', async () => {
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'pending' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });
      mockNdaService.approveNDA.mockResolvedValue({ success: true });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument();
      });

      // Click approve button
      const approveButton = screen.getByText('Approve');
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(mockNdaService.approveNDA).toHaveBeenCalledWith(1);
      });
    });

    it('allows creator to reject individual NDA', async () => {
      const mockNDAs = [
        createMockNDARequest({ id: 1, status: 'pending' }),
      ];
      mockNdaService.getIncomingRequests.mockResolvedValue({ ndaRequests: mockNDAs });
      mockNdaService.rejectNDA.mockResolvedValue({ success: true });

      render(<ComprehensiveNDAManagement userType="creator" userId={1} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading NDA management/i)).not.toBeInTheDocument();
      });

      // Switch to incoming tab
      const incomingTab = screen.getByText('Incoming Requests');
      fireEvent.click(incomingTab);

      await waitFor(() => {
        expect(screen.getByText('Reject')).toBeInTheDocument();
      });

      // Click reject button
      const rejectButton = screen.getByText('Reject');
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(mockNdaService.rejectNDA).toHaveBeenCalledWith(1, 'Request declined');
      });
    });
  });
});
