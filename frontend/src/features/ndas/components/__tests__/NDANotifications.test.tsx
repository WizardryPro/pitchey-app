import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockGetNDAs,
  mockApproveNDA,
  mockRejectNDA,
  mockSuccess,
  mockError,
  mockInfo,
  mockShowNotification,
  mockNavigate,
} = vi.hoisted(() => ({
  mockGetNDAs: vi.fn(),
  mockApproveNDA: vi.fn(),
  mockRejectNDA: vi.fn(),
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
  mockInfo: vi.fn(),
  mockShowNotification: vi.fn(),
  mockNavigate: vi.fn(),
}));

// ─── react-router-dom ───────────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ─── Auth store (stable object reference to prevent re-render loops) ─────────
const mockUser = {
  id: 42,
  email: 'creator@example.com',
  name: 'Test Creator',
  username: 'test_creator',
  userType: 'creator',
};

vi.mock('@/store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({ user: mockUser }),
}));

// ─── NDA service ─────────────────────────────────────────────────────────────
vi.mock('../../services/nda.service', () => ({
  ndaService: {
    getNDAs: (...args: unknown[]) => mockGetNDAs(...args),
    approveNDA: (...args: unknown[]) => mockApproveNDA(...args),
    rejectNDA: (...args: unknown[]) => mockRejectNDA(...args),
  },
}));

// ─── ToastProvider ───────────────────────────────────────────────────────────
vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
    info: mockInfo,
  }),
}));

// ─── WebSocket hook ──────────────────────────────────────────────────────────
vi.mock('@features/notifications/hooks/useWebSocket', () => ({
  useWebSocket: ({ onMessage }: any) => {
    // Expose the onMessage callback for tests that need to simulate WS messages
    (global as any).__ndaNotifOnMessage = onMessage;
    return { isConnected: true };
  },
}));

// ─── Notification service ────────────────────────────────────────────────────
vi.mock('@features/notifications/services/notification.service', () => ({
  notificationService: {
    showNotification: (...args: unknown[]) => mockShowNotification(...args),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makePendingNDA(overrides: Partial<any> = {}): any {
  return {
    id: 1,
    pitchId: 100,
    status: 'pending',
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago
    pitch: { title: 'My Test Pitch' },
    requester: {
      username: 'john_investor',
      userType: 'investor',
      companyName: 'Acme Capital',
    },
    message: 'Please grant me access to the protected script.',
    ...overrides,
  };
}

// ─── Dynamic import ───────────────────────────────────────────────────────────
let NDANotifications: React.ComponentType<{ className?: string; compact?: boolean }>;
let NDANotificationPanel: React.ComponentType<{ className?: string }>;
let NDANotificationBadge: React.ComponentType<{ className?: string }>;

beforeAll(async () => {
  const mod = await import('../NDANotifications');
  NDANotifications = mod.default;
  NDANotificationPanel = mod.NDANotificationPanel;
  NDANotificationBadge = mod.NDANotificationBadge;
});

// ─── NDANotificationBadge tests ──────────────────────────────────────────────
describe('NDANotificationBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNDAs.mockResolvedValue({ ndas: [] });
  });

  it('renders a notification bell button (delegates to NDANotifications compact=true)', () => {
    render(<NDANotificationBadge />);
    const button = document.querySelector('button');
    expect(button).toBeInTheDocument();
    // compact=true yields rounded-full class
    expect(button).toHaveClass('rounded-full');
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('NDANotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNDAs.mockResolvedValue({ ndas: [] });
    mockShowNotification.mockResolvedValue(undefined);
    mockApproveNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });
    mockRejectNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });
  });

  describe('non-creator user', () => {
    it('renders nothing for a non-creator user', async () => {
      // Temporarily override the user type
      const originalType = mockUser.userType;
      mockUser.userType = 'investor';

      const { container } = render(<NDANotifications />);
      // Component returns null for non-creator
      expect(container.firstChild).toBeNull();

      mockUser.userType = originalType;
    });
  });

  describe('bell button renders for creator', () => {
    it('renders the notification bell button', () => {
      render(<NDANotifications />);
      // Bell button is rendered (svg icon inside a button)
      const button = document.querySelector('button');
      expect(button).toBeInTheDocument();
    });

    it('applies compact styling when compact prop is true', () => {
      render(<NDANotifications compact={true} />);
      const button = document.querySelector('button');
      expect(button).toHaveClass('rounded-full');
    });

    it('applies non-compact styling by default', () => {
      render(<NDANotifications compact={false} />);
      const button = document.querySelector('button');
      expect(button).toHaveClass('rounded-lg');
    });

    it('does not show unread badge when there are no notifications', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [] });
      render(<NDANotifications />);
      await waitFor(() => {
        // Badge only appears when unreadCount > 0
        expect(document.querySelector('.bg-red-500')).not.toBeInTheDocument();
      });
    });

    it('shows unread badge count when there are pending NDAs', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 1 }), makePendingNDA({ id: 2 })] });
      render(<NDANotifications />);
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('shows "9+" badge when more than 9 pending NDAs', async () => {
      const ndas = Array.from({ length: 10 }, (_, i) => makePendingNDA({ id: i + 1 }));
      mockGetNDAs.mockResolvedValue({ ndas });
      render(<NDANotifications />);
      await waitFor(() => {
        expect(screen.getByText('9+')).toBeInTheDocument();
      });
    });
  });

  describe('dropdown panel — toggle behavior', () => {
    it('opens the notifications panel on bell click', async () => {
      const user = userEvent.setup();
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      expect(screen.getByText('NDA Requests')).toBeInTheDocument();
    });

    it('closes the panel when the X button is clicked', async () => {
      const user = userEvent.setup();
      render(<NDANotifications />);

      // Open
      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);
      expect(screen.getByText('NDA Requests')).toBeInTheDocument();

      // Close
      const closeButton = screen.getByText('NDA Requests')
        .closest('div')!
        .querySelector('button') as HTMLButtonElement;
      await user.click(closeButton);
      expect(screen.queryByText('NDA Requests')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state message when no NDA requests exist', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [] });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('No NDA Requests')).toBeInTheDocument();
      });
      expect(
        screen.getByText(/You'll see requests here when investors want access/)
      ).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner while fetching', async () => {
      mockGetNDAs.mockImplementation(() => new Promise(() => {})); // never resolves
      const user = userEvent.setup();
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      expect(screen.getByText('Loading requests...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('notification list', () => {
    it('renders NDA request notifications with pitch title and requester name', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({
        ndas: [makePendingNDA({ id: 1 })],
      });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/NDA Request for "My Test Pitch"/)).toBeInTheDocument();
      });
      expect(screen.getByText(/john_investor/)).toBeInTheDocument();
    });

    it('renders the requester message when present', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({
        ndas: [makePendingNDA({ message: 'Please grant me access to the protected script.' })],
      });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Please grant me access to the protected script.')).toBeInTheDocument();
      });
    });

    it('shows requester userType and companyName when available', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({
        ndas: [makePendingNDA()],
      });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('investor')).toBeInTheDocument();
        expect(screen.getByText('Acme Capital')).toBeInTheDocument();
      });
    });

    it('renders Approve, Reject, and View Details buttons for pending NDAs', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({
        ndas: [makePendingNDA()],
      });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument();
        expect(screen.getByText('Reject')).toBeInTheDocument();
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });
    });

    it('shows fallback text for unknown pitch title', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({
        ndas: [makePendingNDA({ pitch: undefined })],
      });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/NDA Request for "Unknown Pitch"/)).toBeInTheDocument();
      });
    });

    it('shows fallback text for unknown requester name', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({
        ndas: [makePendingNDA({ requester: undefined })],
      });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Unknown User/)).toBeInTheDocument();
      });
    });

    it('renders multiple notifications', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({
        ndas: [
          makePendingNDA({ id: 1, pitch: { title: 'Pitch Alpha' }, requester: { username: 'alice', userType: 'investor' } }),
          makePendingNDA({ id: 2, pitch: { title: 'Pitch Beta' }, requester: { username: 'bob', userType: 'investor' } }),
        ],
      });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/NDA Request for "Pitch Alpha"/)).toBeInTheDocument();
        expect(screen.getByText(/NDA Request for "Pitch Beta"/)).toBeInTheDocument();
      });
    });

    it('shows Refresh button in footer when notifications exist', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA()] });
      render(<NDANotifications />);

      const button = document.querySelector('button') as HTMLButtonElement;
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('approve action', () => {
    it('calls ndaService.approveNDA with correct ID when Approve is clicked', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 7 })] });
      mockApproveNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      await waitFor(() => {
        expect(mockApproveNDA).toHaveBeenCalledWith(
          7,
          'Request approved. Please review and sign the NDA.'
        );
      });
    });

    it('shows success toast after approving an NDA', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 7 })] });
      mockApproveNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'NDA Approved',
          'The requester has been notified and can now sign the NDA.'
        );
      });
    });

    it('shows error toast when approveNDA fails', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 7 })] });
      mockApproveNDA.mockRejectedValue(new Error('Server error'));

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Approval Failed', 'Server error');
      });
    });

    it('refreshes NDA list after approving', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 7 })] });
      mockApproveNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      await waitFor(() => {
        // Initial fetch + fetch after approve
        expect(mockGetNDAs).toHaveBeenCalledTimes(2);
      });
    });

    it('still succeeds even when notificationService.showNotification throws during approve', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 7 })] });
      mockApproveNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });
      // Make the inner notification call fail — should be swallowed (console.warn)
      mockShowNotification.mockRejectedValue(new Error('Notif service down'));

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      // Even though notification failed, the outer success toast still fires
      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'NDA Approved',
          'The requester has been notified and can now sign the NDA.'
        );
      });
    });
  });

  describe('reject action', () => {
    it('calls ndaService.rejectNDA with correct ID when Reject is clicked', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 9 })] });
      mockRejectNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Reject'));
      await user.click(screen.getByText('Reject'));

      await waitFor(() => {
        expect(mockRejectNDA).toHaveBeenCalledWith(9, 'Request declined by creator');
      });
    });

    it('shows info toast after rejecting an NDA', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 9 })] });
      mockRejectNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Reject'));
      await user.click(screen.getByText('Reject'));

      await waitFor(() => {
        expect(mockInfo).toHaveBeenCalledWith('NDA Request Declined', 'The requester has been notified.');
      });
    });

    it('shows error toast when rejectNDA fails', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 9 })] });
      mockRejectNDA.mockRejectedValue(new Error('Reject failed'));

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Reject'));
      await user.click(screen.getByText('Reject'));

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Rejection Failed', 'Reject failed');
      });
    });

    it('still shows info toast even when notificationService.showNotification throws during reject', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ id: 9 })] });
      mockRejectNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });
      mockShowNotification.mockRejectedValue(new Error('Notif service down'));

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Reject'));
      await user.click(screen.getByText('Reject'));

      await waitFor(() => {
        expect(mockInfo).toHaveBeenCalledWith('NDA Request Declined', 'The requester has been notified.');
      });
    });
  });

  describe('View Details navigation', () => {
    it('navigates to NDA detail URL when View Details is clicked', async () => {
      const user = userEvent.setup();
      const nda = makePendingNDA({ id: 3, pitchId: 55 });
      mockGetNDAs.mockResolvedValue({ ndas: [nda] });

      // Spy on window.location.href setter
      let assignedHref = '';
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...window.location, get href() { return assignedHref; }, set href(v) { assignedHref = v; } },
      });

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('View Details'));
      await user.click(screen.getByText('View Details'));

      expect(assignedHref).toBe('/creator/pitches/55/ndas/3');
    });
  });

  describe('Refresh button', () => {
    it('re-fetches NDAs when Refresh button is clicked', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA()] });

      render(<NDANotifications />);

      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => screen.getByText('Refresh'));
      await user.click(screen.getByText('Refresh'));

      await waitFor(() => {
        // Initial fetch + manual refresh fetch
        expect(mockGetNDAs).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('timestamp formatting', () => {
    it('shows "Just now" for timestamps less than 1 hour ago', async () => {
      const user = userEvent.setup();
      const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ createdAt: recentTimestamp })] });

      render(<NDANotifications />);
      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });

    it('shows "Xh ago" for timestamps between 1 and 24 hours ago', async () => {
      const user = userEvent.setup();
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ createdAt: twoHoursAgo })] });

      render(<NDANotifications />);
      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      await waitFor(() => {
        expect(screen.getByText('2h ago')).toBeInTheDocument();
      });
    });

    it('shows locale date string for timestamps older than 7 days', async () => {
      const user = userEvent.setup();
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
      mockGetNDAs.mockResolvedValue({ ndas: [makePendingNDA({ createdAt: eightDaysAgo })] });

      render(<NDANotifications />);
      const bellButton = document.querySelector('button') as HTMLButtonElement;
      await user.click(bellButton);

      const expectedLabel = new Date(eightDaysAgo).toLocaleDateString();
      await waitFor(() => {
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
      });
    });
  });

  describe('WebSocket real-time callback', () => {
    it('re-fetches NDAs and shows info toast when nda_request WS message arrives', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [] });
      render(<NDANotifications />);

      // Wait for initial fetch
      await waitFor(() => expect(mockGetNDAs).toHaveBeenCalledTimes(1));

      // Simulate a WebSocket message
      const onMessage = (global as any).__ndaNotifOnMessage;
      if (onMessage) {
        onMessage({ type: 'nda_request' });
      }

      await waitFor(() => {
        expect(mockInfo).toHaveBeenCalledWith('New NDA notification received');
        expect(mockGetNDAs).toHaveBeenCalledTimes(2);
      });
    });

    it('handles nda_update WS message type', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [] });
      render(<NDANotifications />);

      await waitFor(() => expect(mockGetNDAs).toHaveBeenCalledTimes(1));

      const onMessage = (global as any).__ndaNotifOnMessage;
      if (onMessage) {
        onMessage({ type: 'nda_update' });
      }

      await waitFor(() => {
        expect(mockGetNDAs).toHaveBeenCalledTimes(2);
      });
    });

    it('does not re-fetch for unrelated WS message types', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [] });
      render(<NDANotifications />);

      await waitFor(() => expect(mockGetNDAs).toHaveBeenCalledTimes(1));

      const onMessage = (global as any).__ndaNotifOnMessage;
      if (onMessage) {
        onMessage({ type: 'some_other_event' });
      }

      // Still just 1 call — no extra fetch triggered
      expect(mockGetNDAs).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchNDANotifications error silencing', () => {
    it('silently handles getNDAs errors without crashing', async () => {
      mockGetNDAs.mockRejectedValue(new Error('API down'));
      render(<NDANotifications />);

      // Component should mount without throwing
      await waitFor(() => {
        expect(mockGetNDAs).toHaveBeenCalledTimes(1);
      });
      // No crash — just console.error internally
    });
  });
});

// ─── NDANotificationPanel tests ───────────────────────────────────────────────
describe('NDANotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNDAs.mockResolvedValue({ ndas: [] });
    mockApproveNDA.mockResolvedValue({ pitch: { title: 'My Test Pitch' } });
    mockShowNotification.mockResolvedValue(undefined);
  });

  describe('non-creator user', () => {
    it('renders nothing for a non-creator user', () => {
      const originalType = mockUser.userType;
      mockUser.userType = 'investor';

      const { container } = render(<NDANotificationPanel />);
      expect(container.firstChild).toBeNull();

      mockUser.userType = originalType;
    });
  });

  describe('panel structure', () => {
    it('renders the Pending NDA Requests heading', async () => {
      render(<NDANotificationPanel />);
      await waitFor(() => {
        expect(screen.getByText('Pending NDA Requests')).toBeInTheDocument();
      });
    });

    it('renders a Refresh button', async () => {
      render(<NDANotificationPanel />);
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows "No Pending Requests" message when no NDAs', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [] });
      render(<NDANotificationPanel />);

      await waitFor(() => {
        expect(screen.getByText('No Pending Requests')).toBeInTheDocument();
      });
      expect(screen.getByText('NDA requests from investors will appear here.')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows spinner while fetching', () => {
      mockGetNDAs.mockImplementation(() => new Promise(() => {}));
      render(<NDANotificationPanel />);

      expect(screen.getByText('Loading requests...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('with pending NDAs', () => {
    const pendingNDA = {
      id: 10,
      pitchId: 200,
      status: 'pending',
      createdAt: new Date().toISOString(),
      pitch: { title: 'Panel Test Pitch' },
      requester: { username: 'panel_investor' },
      pitchTitle: 'Panel Test Pitch',
      requesterName: 'panel_investor',
    };

    it('renders NDA request entries', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [pendingNDA] });
      render(<NDANotificationPanel />);

      await waitFor(() => {
        expect(screen.getByText('Panel Test Pitch')).toBeInTheDocument();
      });
      expect(screen.getByText(/panel_investor/)).toBeInTheDocument();
    });

    it('renders Approve and Review buttons for each request', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [pendingNDA] });
      render(<NDANotificationPanel />);

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument();
        expect(screen.getByText('Review')).toBeInTheDocument();
      });
    });

    it('calls ndaService.approveNDA when Approve is clicked', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [pendingNDA] });

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      await waitFor(() => {
        expect(mockApproveNDA).toHaveBeenCalledWith(
          10,
          'Request approved. Please review and sign the NDA.'
        );
      });
    });

    it('shows success toast after panel approve', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [pendingNDA] });

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'NDA Approved',
          'The requester has been notified and can now sign the NDA.'
        );
      });
    });

    it('shows Approving... text while processing', async () => {
      const user = userEvent.setup();
      // Keep the promise pending long enough to check the UI state
      let resolveApprove!: (v: any) => void;
      mockApproveNDA.mockImplementation(() => new Promise((res) => { resolveApprove = res; }));
      mockGetNDAs.mockResolvedValue({ ndas: [pendingNDA] });

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      expect(screen.getByText('Approving…')).toBeInTheDocument();

      // Clean up
      resolveApprove({ pitch: { title: 'Panel Test Pitch' } });
    });

    it('shows "View All N Requests" link when more than 3 NDAs exist', async () => {
      const ndas = Array.from({ length: 5 }, (_, i) => ({
        ...pendingNDA,
        id: i + 1,
      }));
      mockGetNDAs.mockResolvedValue({ ndas });
      render(<NDANotificationPanel />);

      await waitFor(() => {
        expect(screen.getByText('View All 5 Requests')).toBeInTheDocument();
      });
    });

    it('navigates to /creator/ndas when Review button is clicked', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [pendingNDA] });

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('Review'));
      await user.click(screen.getByText('Review'));

      expect(mockNavigate).toHaveBeenCalledWith('/creator/ndas');
    });

    it('navigates to /creator/ndas when "View All" is clicked', async () => {
      const user = userEvent.setup();
      const ndas = Array.from({ length: 5 }, (_, i) => ({ ...pendingNDA, id: i + 1 }));
      mockGetNDAs.mockResolvedValue({ ndas });

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('View All 5 Requests'));
      await user.click(screen.getByText('View All 5 Requests'));

      expect(mockNavigate).toHaveBeenCalledWith('/creator/ndas');
    });

    it('only renders first 3 NDAs (panel is capped at 3 visible)', async () => {
      const ndas = Array.from({ length: 5 }, (_, i) => ({
        ...pendingNDA,
        id: i + 1,
        pitchTitle: `Pitch ${i + 1}`,
        pitch: { title: `Pitch ${i + 1}` },
      }));
      mockGetNDAs.mockResolvedValue({ ndas });

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('Pitch 1'));
      expect(screen.getByText('Pitch 2')).toBeInTheDocument();
      expect(screen.getByText('Pitch 3')).toBeInTheDocument();
      expect(screen.queryByText('Pitch 4')).not.toBeInTheDocument();
      expect(screen.queryByText('Pitch 5')).not.toBeInTheDocument();
    });

    it('client-side filters out non-pending NDAs before rendering', async () => {
      const approved = { ...pendingNDA, id: 20, status: 'approved', pitchTitle: 'Approved Pitch', pitch: { title: 'Approved Pitch' } };
      mockGetNDAs.mockResolvedValue({ ndas: [pendingNDA, approved] });

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('Panel Test Pitch'));
      // The approved one should NOT appear because the panel filters client-side
      expect(screen.queryByText('Approved Pitch')).not.toBeInTheDocument();
    });
  });

  describe('Refresh button in panel', () => {
    it('re-fetches NDAs on Refresh click', async () => {
      const user = userEvent.setup();
      mockGetNDAs.mockResolvedValue({ ndas: [] });

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('Refresh'));
      await user.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(mockGetNDAs).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('fetch error handling', () => {
    it('silently handles fetchRequests errors (no crash)', async () => {
      // Panel catches and swallows fetch errors via console.error
      mockGetNDAs.mockRejectedValue(new Error('Network failure'));
      render(<NDANotificationPanel />);

      // Should still render the panel skeleton (heading + Refresh button)
      await waitFor(() => {
        expect(screen.getByText('Pending NDA Requests')).toBeInTheDocument();
      });
      // No Pending Requests empty state should also be absent (loading/error leaves it blank)
      // The component swallows the error — just verify it didn't crash
      expect(screen.queryByText(/unhandled/i)).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows error toast when panel approveNDA fails', async () => {
      const user = userEvent.setup();
      const pendingNDA = {
        id: 10,
        pitchId: 200,
        status: 'pending',
        createdAt: new Date().toISOString(),
        pitch: { title: 'Panel Test Pitch' },
        requester: { username: 'panel_investor' },
        pitchTitle: 'Panel Test Pitch',
        requesterName: 'panel_investor',
      };
      mockGetNDAs.mockResolvedValue({ ndas: [pendingNDA] });
      mockApproveNDA.mockRejectedValue(new Error('Panel approve failed'));

      render(<NDANotificationPanel />);

      await waitFor(() => screen.getByText('Approve'));
      await user.click(screen.getByText('Approve'));

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Approval Failed', 'Panel approve failed');
      });
    });
  });
});
