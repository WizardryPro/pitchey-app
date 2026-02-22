import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockMarkNotificationAsRead = vi.fn()
const mockClearAllNotifications = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── WebSocket context ──────────────────────────────────────────────
const mockWsNotifications: any[] = []
vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    isConnected: true,
    connectionQuality: { strength: 'good' },
    isReconnecting: false,
  }),
  useNotifications: () => ({
    notifications: mockWsNotifications,
    markNotificationAsRead: mockMarkNotificationAsRead,
    clearAllNotifications: mockClearAllNotifications,
  }),
}))

// ─── Notifications service ──────────────────────────────────────────
const mockGetNotifications = vi.fn()
const mockGetPreferences = vi.fn()
const mockMarkAsRead = vi.fn()
const mockMarkAllAsRead = vi.fn()
const mockMarkMultipleAsRead = vi.fn()
const mockUpdatePreferences = vi.fn()
const mockConvertToFrontendFormat = vi.fn()
const mockGetNotificationActions = vi.fn()

vi.mock('../../services/notifications.service', () => ({
  NotificationsService: {
    getNotifications: mockGetNotifications,
    getPreferences: mockGetPreferences,
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    markMultipleAsRead: mockMarkMultipleAsRead,
    updatePreferences: mockUpdatePreferences,
    convertToFrontendFormat: mockConvertToFrontendFormat,
    getNotificationActions: mockGetNotificationActions,
  },
}))

// ─── Notification toast ─────────────────────────────────────────────
vi.mock('../../components/Toast/NotificationToastContainer', () => ({
  useNotificationToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

// ─── Dynamic import ─────────────────────────────────────────────────
let NotificationCenter: React.ComponentType
beforeAll(async () => {
  const mod = await import('../NotificationCenter')
  NotificationCenter = mod.default
})

// ─── Test helpers ────────────────────────────────────────────────────
const makeNotification = (overrides: any = {}) => ({
  id: 1,
  userId: 1,
  type: 'info',
  title: 'Test Notification',
  message: 'This is a test notification',
  isRead: false,
  createdAt: new Date().toISOString(),
  ...overrides,
})

const makeFrontendNotification = (overrides: any = {}) => ({
  id: '1',
  type: 'info',
  title: 'Test Notification',
  message: 'This is a test notification',
  timestamp: new Date(),
  read: false,
  actions: [],
  ...overrides,
})

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNotifications.mockResolvedValue([])
    mockGetPreferences.mockResolvedValue(null)
    mockMarkAsRead.mockResolvedValue(true)
    mockMarkAllAsRead.mockResolvedValue(true)
    mockMarkMultipleAsRead.mockResolvedValue(true)
    mockUpdatePreferences.mockResolvedValue(true)
    mockConvertToFrontendFormat.mockImplementation((n: any) => makeFrontendNotification({ id: n.id.toString(), title: n.title, message: n.message }))
    mockGetNotificationActions.mockReturnValue([])
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>
    )

  it('shows loading spinner initially', () => {
    // Loading state appears before API resolves
    let resolveNotifications: any
    mockGetNotifications.mockReturnValue(new Promise(res => { resolveNotifications = res }))
    renderComponent()
    // During loading, the spinner container is shown
    expect(document.querySelector('.animate-spin')).toBeTruthy()
    resolveNotifications([])
  })

  it('renders notifications page header after loading', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })
  })

  it('shows empty state when there are no notifications', async () => {
    mockGetNotifications.mockResolvedValue([])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument()
    })
  })

  it('shows "all caught up" message when filter is "all" and empty', async () => {
    mockGetNotifications.mockResolvedValue([])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText(/You're all caught up/)).toBeInTheDocument()
    })
  })

  it('renders filter buttons in sidebar', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Unread')).toBeInTheDocument()
      expect(screen.getByText('NDA Requests')).toBeInTheDocument()
      expect(screen.getByText('Investments')).toBeInTheDocument()
      expect(screen.getByText('Messages')).toBeInTheDocument()
    })
  })

  it('renders notifications from API', async () => {
    const notification = makeNotification({ title: 'NDA Approved', message: 'Your NDA was approved' })
    mockGetNotifications.mockResolvedValue([notification])
    mockConvertToFrontendFormat.mockReturnValue(
      makeFrontendNotification({ id: '1', title: 'NDA Approved', message: 'Your NDA was approved' })
    )

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('NDA Approved')).toBeInTheDocument()
      expect(screen.getByText('Your NDA was approved')).toBeInTheDocument()
    })
  })

  it('shows unread count badge when there are unread notifications', async () => {
    const notification = makeNotification({ id: 1, isRead: false, title: 'Unread Note' })
    mockGetNotifications.mockResolvedValue([notification])
    mockConvertToFrontendFormat.mockReturnValue(
      makeFrontendNotification({ id: '1', title: 'Unread Note', read: false })
    )

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('1 unread')).toBeInTheDocument()
    })
  })

  it('renders "Mark all read" button when there are unread notifications', async () => {
    const notification = makeNotification({ id: 1, isRead: false })
    mockGetNotifications.mockResolvedValue([notification])
    mockConvertToFrontendFormat.mockReturnValue(makeFrontendNotification({ id: '1', read: false }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument()
    })
  })

  it('shows settings button for preferences', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTitle('Notification preferences')).toBeInTheDocument()
    })
  })

  it('toggles preferences panel when settings button is clicked', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTitle('Notification preferences')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('Notification preferences'))
    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
    })
  })

  it('calls markAllAsRead when "Mark all read" button is clicked', async () => {
    const notification = makeNotification({ id: 1, isRead: false })
    mockGetNotifications.mockResolvedValue([notification])
    mockConvertToFrontendFormat.mockReturnValue(makeFrontendNotification({ id: '1', read: false }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Mark all read'))
    await waitFor(() => {
      expect(mockMarkAllAsRead).toHaveBeenCalled()
    })
  })

  it('navigates back when back button is clicked', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    // Find back button (ArrowLeft icon button)
    const backButton = screen.getByRole('button', { name: '' })
    fireEvent.click(backButton)
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('shows notification read indicator for unread notifications', async () => {
    const notification = makeNotification({ id: 1, isRead: false })
    mockGetNotifications.mockResolvedValue([notification])
    mockConvertToFrontendFormat.mockReturnValue(
      makeFrontendNotification({ id: '1', read: false, title: 'Unread Message' })
    )

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Unread Message')).toBeInTheDocument()
    })
    // The mark-as-read check button should appear for unread notifications
    const markReadBtn = screen.getByTitle('Mark as read')
    expect(markReadBtn).toBeInTheDocument()
  })
})
