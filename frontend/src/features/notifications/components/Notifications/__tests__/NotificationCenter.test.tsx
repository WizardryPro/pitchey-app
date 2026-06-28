import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'

// ─── react-hot-toast ────────────────────────────────────────────────
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    loading: vi.fn(),
  },
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    loading: vi.fn(),
  },
  Toaster: () => null,
}))

// ─── lucide-react ────────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
  Bell: ({ className }: any) => <svg data-testid="icon-bell" className={className} />,
  BellRing: ({ className }: any) => <svg data-testid="icon-bell-ring" className={className} />,
  X: () => <svg data-testid="icon-x" />,
  Settings: () => <svg data-testid="icon-settings" />,
  RefreshCw: ({ className }: any) => <svg data-testid="icon-refresh" className={className} />,
  AlertCircle: () => <svg data-testid="icon-alert-circle" />,
  Info: () => <svg data-testid="icon-info" />,
  TrendingUp: () => <svg data-testid="icon-trending-up" />,
  DollarSign: () => <svg data-testid="icon-dollar-sign" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  Briefcase: () => <svg data-testid="icon-briefcase" />,
}))

// ─── date-fns ────────────────────────────────────────────────────────
vi.mock('date-fns', () => ({
  formatDistanceToNow: (_date: Date, _opts?: any) => '2 hours ago',
  isToday: (_date: Date) => false,
  isYesterday: (_date: Date) => false,
  format: (_date: Date, _fmt: string) => 'Jan 1, 2025',
}))

// ─── Fetch mock ───────────────────────────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Helpers ─────────────────────────────────────────────────────────
const makeNotification = (overrides: Partial<{
  id: string
  type: 'investment' | 'project' | 'system' | 'analytics' | 'market'
  category: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  actionUrl?: string
  actionText?: string
  isRead: boolean
  createdAt: string
}> = {}) => ({
  id: 'notif-1',
  type: 'system' as const,
  category: 'general',
  priority: 'medium' as const,
  title: 'Test Notification',
  message: 'This is a test notification message',
  isRead: false,
  createdAt: '2025-01-01T10:00:00Z',
  ...overrides,
})

const makeListResponse = (notifications: any[], unreadCount = 0) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: notifications, unreadCount }),
  })

const makeErrorResponse = () =>
  Promise.resolve({ ok: false, json: () => Promise.resolve({}) })

// ─── Dynamic import ──────────────────────────────────────────────────
let NotificationCenter: React.ComponentType<{ className?: string; maxWidth?: string }>
beforeAll(async () => {
  const mod = await import('../NotificationCenter')
  NotificationCenter = mod.NotificationCenter
})

// ─── Test suite ──────────────────────────────────────────────────────
describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: empty list, 0 unread
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.startsWith('/api/notifications')) {
        return makeListResponse([], 0)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    // Restore window.location.href writes (some tests reassign it)
    vi.restoreAllMocks()
  })

  const renderComponent = (props = {}) =>
    render(<NotificationCenter {...props} />)

  // ── Bell button ──────────────────────────────────────────────────
  describe('Bell button', () => {
    it('renders the bell button', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    })

    it('shows Bell icon when unread count is 0', async () => {
      mockFetch.mockImplementation(() => makeListResponse([], 0))
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      expect(screen.getByTestId('icon-bell')).toBeInTheDocument()
    })

    it('shows BellRing icon when there are unread notifications', async () => {
      mockFetch.mockImplementation(() => makeListResponse([makeNotification()], 1))
      renderComponent()
      await waitFor(() => expect(screen.getByTestId('icon-bell-ring')).toBeInTheDocument())
    })

    it('shows unread badge with count', async () => {
      mockFetch.mockImplementation(() => makeListResponse([makeNotification()], 3))
      renderComponent()
      await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    })

    it('shows 99+ when unread count exceeds 99', async () => {
      const notifs = Array.from({ length: 10 }, (_, i) =>
        makeNotification({ id: `n-${i}` })
      )
      mockFetch.mockImplementation(() => makeListResponse(notifs, 150))
      renderComponent()
      await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument())
    })

    it('does not show badge when unread count is 0', async () => {
      mockFetch.mockImplementation(() => makeListResponse([], 0))
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      // The badge span only renders when unreadCount > 0
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })

    it('opens dropdown when bell is clicked', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() =>
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      )
    })
  })

  // ── Dropdown header ──────────────────────────────────────────────
  describe('Dropdown header', () => {
    const openDropdown = async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() =>
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      )
    }

    it('renders Notifications heading', async () => {
      await openDropdown()
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    it('renders filter tabs: All, Unread, Today', async () => {
      await openDropdown()
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Unread' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
    })

    it('closes dropdown when X button is clicked', async () => {
      await openDropdown()
      const closeBtn = screen.getByTestId('icon-x').closest('button')!
      fireEvent.click(closeBtn)
      await waitFor(() =>
        expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
      )
    })

    it('toggles dropdown closed when bell clicked again', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      const bell = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(bell)
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      fireEvent.click(bell)
      await waitFor(() =>
        expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
      )
    })
  })

  // ── Empty state ───────────────────────────────────────────────────
  describe('Empty state', () => {
    const openDropdown = async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() =>
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      )
    }

    it('shows "No notifications" in all filter', async () => {
      await openDropdown()
      await waitFor(() =>
        expect(screen.getByText('No notifications')).toBeInTheDocument()
      )
    })

    it('shows "No unread notifications" on unread filter', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      // Switch to Unread tab — triggers another fetch
      mockFetch.mockImplementation(() => makeListResponse([], 0))
      fireEvent.click(screen.getByRole('button', { name: 'Unread' }))
      await waitFor(() =>
        expect(screen.getByText('No unread notifications')).toBeInTheDocument()
      )
    })

    it('shows "No notifications today" on today filter', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      mockFetch.mockImplementation(() => makeListResponse([], 0))
      fireEvent.click(screen.getByRole('button', { name: 'Today' }))
      await waitFor(() =>
        expect(screen.getByText('No notifications today')).toBeInTheDocument()
      )
    })
  })

  // ── Notification list ─────────────────────────────────────────────
  describe('Notification list', () => {
    const notifs = [
      makeNotification({ id: 'n1', title: 'Investment Update', type: 'investment', isRead: false }),
      makeNotification({ id: 'n2', title: 'Project Created', type: 'project', isRead: true }),
      makeNotification({ id: 'n3', title: 'System Alert', type: 'system', priority: 'critical', isRead: false }),
    ]

    const openWithNotifs = async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.startsWith('/api/notifications')) {
          return makeListResponse(notifs, 2)
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Investment Update')).toBeInTheDocument())
    }

    it('renders notification titles', async () => {
      await openWithNotifs()
      expect(screen.getByText('Investment Update')).toBeInTheDocument()
      expect(screen.getByText('Project Created')).toBeInTheDocument()
      expect(screen.getByText('System Alert')).toBeInTheDocument()
    })

    it('renders notification messages', async () => {
      await openWithNotifs()
      // All have same default message
      const msgs = screen.getAllByText('This is a test notification message')
      expect(msgs.length).toBe(3)
    })

    it('shows "Urgent" badge for critical priority notifications', async () => {
      await openWithNotifs()
      expect(screen.getByText('Urgent')).toBeInTheDocument()
    })

    it('does not show "Urgent" badge for non-critical notifications', async () => {
      mockFetch.mockImplementation(() =>
        makeListResponse([makeNotification({ id: 'n1', priority: 'high' })], 1)
      )
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      expect(screen.queryByText('Urgent')).not.toBeInTheDocument()
    })

    it('shows "Mark all read" button when there are unread notifications', async () => {
      await openWithNotifs()
      expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument()
    })

    it('does not show "Mark all read" when unreadCount is 0', async () => {
      mockFetch.mockImplementation(() => makeListResponse([], 0))
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument()
    })

    it('shows action button when notification has actionText and actionUrl', async () => {
      mockFetch.mockImplementation(() =>
        makeListResponse(
          [makeNotification({ actionText: 'View Pitch', actionUrl: '/pitches/1' })],
          1
        )
      )
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText(/View Pitch/)).toBeInTheDocument())
    })

    it('does not show action button when actionText is missing', async () => {
      mockFetch.mockImplementation(() =>
        makeListResponse([makeNotification({ actionUrl: '/pitches/1' })], 1)
      )
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      // No action button text
      expect(screen.queryByText(/→$/)).not.toBeInTheDocument()
    })

    it('shows formatted time for notifications', async () => {
      await openWithNotifs()
      // date-fns is mocked: all non-today non-yesterday dates -> 'Jan 1, 2025'
      const times = screen.getAllByText('Jan 1, 2025')
      expect(times.length).toBeGreaterThan(0)
    })
  })

  // ── Unread vs read styling ────────────────────────────────────────
  describe('Unread vs read styling', () => {
    it('unread notification has blue-dot indicator', async () => {
      mockFetch.mockImplementation(() =>
        makeListResponse([makeNotification({ id: 'n1', isRead: false })], 1)
      )
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      // The unread indicator is a div with bg-blue-500 and rounded-full
      const indicator = document.querySelector('.bg-blue-500.rounded-full')
      expect(indicator).not.toBeNull()
    })

    it('read notification has no blue-dot indicator', async () => {
      mockFetch.mockImplementation(() =>
        makeListResponse([makeNotification({ id: 'n1', isRead: true })], 0)
      )
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      const indicator = document.querySelector('.bg-blue-500.rounded-full')
      expect(indicator).toBeNull()
    })

    it('unread notification row has bg-blue-50 background', async () => {
      mockFetch.mockImplementation(() =>
        makeListResponse([makeNotification({ id: 'n1', isRead: false })], 1)
      )
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      const row = document.querySelector('.bg-blue-50')
      expect(row).not.toBeNull()
    })
  })

  // ── Mark as read ──────────────────────────────────────────────────
  describe('Mark as read', () => {
    it('calls PUT /api/notifications/:id/read when clicking an unread notification', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/notifications?page=1&limit=10&unreadOnly=false') {
          return makeListResponse([makeNotification({ id: 'notif-42', isRead: false })], 1)
        }
        if (url === '/api/notifications/notif-42/read') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }
        return makeListResponse([], 0)
      })
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Test Notification'))
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map(c => c[0])
        expect(calls).toContain('/api/notifications/notif-42/read')
      })
    })

    it('does not call mark-as-read when clicking an already-read notification', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('unreadOnly')) {
          return makeListResponse([makeNotification({ id: 'notif-99', isRead: true })], 0)
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      const callsBefore = mockFetch.mock.calls.length
      fireEvent.click(screen.getByText('Test Notification'))
      // No extra fetch should be made for read notification (no actionUrl to open)
      await waitFor(() => {
        const callsAfter = mockFetch.mock.calls.length
        expect(callsAfter).toBe(callsBefore)
      })
    })

    it('decrements unread count after marking as read', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('unreadOnly')) {
          return makeListResponse([makeNotification({ id: 'notif-r', isRead: false })], 1)
        }
        if (url === '/api/notifications/notif-r/read') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
      renderComponent()
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Test Notification'))
      // After mark-as-read, unreadCount goes to 0 so badge disappears
      await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument())
    })
  })

  // ── Mark all as read ──────────────────────────────────────────────
  describe('Mark all as read', () => {
    const setupWithUnread = async () => {
      const notifs = [
        makeNotification({ id: 'a1', isRead: false }),
        makeNotification({ id: 'a2', isRead: false }),
      ]
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('unreadOnly')) {
          return makeListResponse(notifs, 2)
        }
        if (url === '/api/notifications/read-multiple') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument()
      )
    }

    it('calls PUT /api/notifications/read-multiple when clicking Mark all read', async () => {
      await setupWithUnread()
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map(c => c[0])
        expect(calls).toContain('/api/notifications/read-multiple')
      })
    })

    it('sends correct notificationIds in body', async () => {
      await setupWithUnread()
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
      await waitFor(() => {
        const readMultipleCall = mockFetch.mock.calls.find(
          c => c[0] === '/api/notifications/read-multiple'
        )
        expect(readMultipleCall).toBeDefined()
        const body = JSON.parse(readMultipleCall[1]?.body)
        expect(body.notificationIds).toContain('a1')
        expect(body.notificationIds).toContain('a2')
      })
    })

    it('shows success toast after marking all read', async () => {
      await setupWithUnread()
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('All notifications marked as read')
      })
    })

    it('resets unread count to 0 after marking all read', async () => {
      await setupWithUnread()
      expect(screen.getByText('2')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
      await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument())
    })

    it('shows error toast when mark-all-read fails', async () => {
      const notifs = [makeNotification({ id: 'a1', isRead: false })]
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('unreadOnly')) {
          return makeListResponse(notifs, 1)
        }
        if (url === '/api/notifications/read-multiple') {
          return makeErrorResponse()
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument()
      )
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Couldn't mark notifications as read. Please try again."
        )
      })
    })

    it('does nothing when there are no unread notifications', async () => {
      // All notifications are already read
      const notifs = [makeNotification({ id: 'r1', isRead: true })]
      mockFetch.mockImplementation(() => makeListResponse(notifs, 0))
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      // "Mark all read" button should not be visible when unreadCount === 0
      expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument()
    })
  })

  // ── Notification click with actionUrl ────────────────────────────
  describe('Notification click with actionUrl', () => {
    it('opens actionUrl in new tab when notification has actionUrl', async () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('unreadOnly')) {
          return makeListResponse(
            [makeNotification({ id: 'na', isRead: true, actionUrl: '/pitches/99' })],
            0
          )
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Test Notification'))
      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith('/pitches/99', '_blank')
      })
      windowOpenSpy.mockRestore()
    })

    it('action button click opens URL and does not bubble to parent click', async () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('unreadOnly')) {
          return makeListResponse(
            [
              makeNotification({
                id: 'nb',
                isRead: true,
                actionUrl: '/pitches/42',
                actionText: 'View Pitch',
              }),
            ],
            0
          )
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText(/View Pitch/)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/View Pitch/))
      // window.open called once (from action button, stopPropagation prevents double-open)
      await waitFor(() => expect(windowOpenSpy).toHaveBeenCalledTimes(1))
      windowOpenSpy.mockRestore()
    })
  })

  // ── Refresh button ────────────────────────────────────────────────
  describe('Refresh button', () => {
    it('calls fetch again when refresh button is clicked', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      const callsBefore = mockFetch.mock.calls.length
      const refreshBtn = screen.getByTestId('icon-refresh').closest('button')!
      fireEvent.click(refreshBtn)
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore)
      })
    })
  })

  // ── Pagination ────────────────────────────────────────────────────
  describe('Load more', () => {
    it('shows "Load more notifications" when there are exactly 10 results', async () => {
      const tenNotifs = Array.from({ length: 10 }, (_, i) =>
        makeNotification({ id: `p${i}`, title: `Notification ${i}` })
      )
      mockFetch.mockImplementation(() => makeListResponse(tenNotifs, 10))
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() =>
        expect(screen.getByText('Load more notifications')).toBeInTheDocument()
      )
    })

    it('does not show "Load more" when fewer than 10 results returned', async () => {
      const fewNotifs = Array.from({ length: 3 }, (_, i) =>
        makeNotification({ id: `f${i}`, title: `Notification ${i}` })
      )
      mockFetch.mockImplementation(() => makeListResponse(fewNotifs, 3))
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notification 0')).toBeInTheDocument())
      expect(screen.queryByText('Load more notifications')).not.toBeInTheDocument()
    })

    it('calls fetch with incremented page when "Load more" is clicked', async () => {
      const tenNotifs = Array.from({ length: 10 }, (_, i) =>
        makeNotification({ id: `pp${i}`, title: `Notification ${i}` })
      )
      mockFetch.mockImplementation(() => makeListResponse(tenNotifs, 10))
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() =>
        expect(screen.getByText('Load more notifications')).toBeInTheDocument()
      )
      const callsBefore = mockFetch.mock.calls.length
      fireEvent.click(screen.getByText('Load more notifications'))
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore)
      })
    })
  })

  // ── Filter tabs ───────────────────────────────────────────────────
  describe('Filter tabs', () => {
    it('re-fetches with unreadOnly=true when Unread tab clicked', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: 'Unread' }))
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map(c => c[0] as string)
        const unreadCall = calls.find(u => u.includes('unreadOnly=true'))
        expect(unreadCall).toBeTruthy()
      })
    })

    it('re-fetches with unreadOnly=false when All tab clicked', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      // Click Unread, then All
      fireEvent.click(screen.getByRole('button', { name: 'Unread' }))
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map(c => c[0] as string)
        expect(calls.some(u => u.includes('unreadOnly=true'))).toBe(true)
      })
      mockFetch.mockClear()
      fireEvent.click(screen.getByRole('button', { name: 'All' }))
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map(c => c[0] as string)
        expect(calls.some(u => u.includes('unreadOnly=false'))).toBe(true)
      })
    })

    it('appends startDate when Today tab is clicked', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: 'Today' }))
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map(c => c[0] as string)
        const todayCall = calls.find(u => u.includes('startDate='))
        expect(todayCall).toBeTruthy()
      })
    })
  })

  // ── Footer navigation ─────────────────────────────────────────────
  describe('Footer navigation', () => {
    const openDropdown = async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())
    }

    it('renders "View all notifications" link in footer', async () => {
      await openDropdown()
      expect(screen.getByText('View all notifications')).toBeInTheDocument()
    })

    it('renders Settings button in footer', async () => {
      await openDropdown()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('navigates to /notifications when "View all notifications" is clicked', async () => {
      // jsdom doesn't execute location.href assignments; just verify the handler fires
      const originalHref = window.location.href
      await openDropdown()
      // Should not throw
      fireEvent.click(screen.getByText('View all notifications'))
      // Dropdown closes
      await waitFor(() =>
        expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
      )
    })

    it('navigates to /settings/notifications when Settings is clicked', async () => {
      await openDropdown()
      // Should not throw
      fireEvent.click(screen.getByText('Settings'))
      // Dropdown closes
      await waitFor(() =>
        expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
      )
    })
  })

  // ── Real-time WebSocket event ─────────────────────────────────────
  describe('Real-time notification events', () => {
    it('prepends new notification from window notification event', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())

      const newNotif = makeNotification({
        id: 'ws-1',
        title: 'Live Update',
        isRead: false,
      })
      const event = new CustomEvent('notification', { detail: newNotif })
      window.dispatchEvent(event)

      await waitFor(() => expect(screen.getByText('Live Update')).toBeInTheDocument())
    })

    it('increments unread count on real-time event', async () => {
      mockFetch.mockImplementation(() => makeListResponse([], 0))
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())

      // No badge initially
      expect(screen.queryByText('1')).not.toBeInTheDocument()

      const newNotif = makeNotification({ id: 'ws-2', isRead: false })
      const event = new CustomEvent('notification', { detail: newNotif })
      window.dispatchEvent(event)

      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
    })
  })

  // ── Loading state ─────────────────────────────────────────────────
  describe('Loading state', () => {
    it('refresh button becomes disabled while loading', async () => {
      // Let initial fetch complete quickly so dropdown can open
      mockFetch.mockImplementation(() => makeListResponse([], 0))

      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())

      // Now intercept the NEXT fetch with a delayed promise
      let resolveRefresh!: (v: any) => void
      const delayedRefresh = new Promise<any>(r => { resolveRefresh = r })
      mockFetch.mockImplementation(() => delayedRefresh)

      // Click the refresh button to trigger loading state
      const refreshBtn = screen.getByTestId('icon-refresh').closest('button')!
      fireEvent.click(refreshBtn)

      // While in-flight the button should be disabled (loading=true disables it per JSX)
      expect(refreshBtn).toBeDisabled()

      // Resolve the fetch — loading should stop, button re-enabled
      resolveRefresh({ ok: true, json: () => Promise.resolve({ data: [], unreadCount: 0 }) })
      await waitFor(() => {
        expect(screen.getByTestId('icon-refresh').closest('button')).not.toBeDisabled()
      })
    })
  })

  // ── API fetch parameters ──────────────────────────────────────────
  describe('API fetch parameters', () => {
    it('calls /api/notifications with page, limit, unreadOnly on mount', async () => {
      renderComponent()
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map(c => c[0] as string)
        const call = calls.find(u => u.startsWith('/api/notifications'))
        expect(call).toBeTruthy()
        expect(call).toContain('page=1')
        expect(call).toContain('limit=10')
        expect(call).toContain('unreadOnly=false')
      })
    })

    it('passes credentials: include in fetch calls', async () => {
      renderComponent()
      await waitFor(() => {
        const initArgs = mockFetch.mock.calls[0]?.[1]
        expect(initArgs?.credentials).toBe('include')
      })
    })
  })

  // ── Notification type icons ────────────────────────────────────────
  describe('Notification type icons', () => {
    const types: Array<'investment' | 'project' | 'system' | 'analytics' | 'market'> = [
      'investment',
      'project',
      'system',
      'analytics',
      'market',
    ]

    it.each(types)('renders correct icon for %s type notification', async (type) => {
      const iconMap: Record<string, string> = {
        investment: 'icon-dollar-sign',
        project: 'icon-file-text',
        system: 'icon-info',
        analytics: 'icon-trending-up',
        market: 'icon-briefcase',
      }
      mockFetch.mockImplementation(() =>
        makeListResponse([makeNotification({ id: 'ti', type })], 1)
      )
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Test Notification')).toBeInTheDocument())
      expect(screen.getByTestId(iconMap[type])).toBeInTheDocument()
    })
  })

  // ── Outside click ────────────────────────────────────────────────
  describe('Outside click', () => {
    it('closes dropdown when clicking outside', async () => {
      renderComponent()
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument())

      // Simulate mousedown outside
      fireEvent.mouseDown(document.body)
      await waitFor(() =>
        expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
      )
    })
  })
})
