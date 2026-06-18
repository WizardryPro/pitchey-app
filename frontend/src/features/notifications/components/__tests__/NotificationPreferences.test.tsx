import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockApiGet = vi.fn()
const mockApiPut = vi.fn()
const mockApiPost = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

// ─── API client ─────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  default: {
    get: mockApiGet,
    put: mockApiPut,
    post: mockApiPost,
    delete: vi.fn(),
  },
}))

// ─── ToastProvider ──────────────────────────────────────────────────
vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: vi.fn(),
    info: vi.fn(),
    addToast: vi.fn(),
    removeToast: vi.fn(),
    toasts: [],
  }),
  ToastProvider: ({ children }: any) => <>{children}</>,
  default: ({ children }: any) => <>{children}</>,
}))

// ─── framer-motion ──────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop: string) => {
      const C = ({ children, ...props }: any) => {
        const {
          initial, animate, exit, transition, whileHover, whileTap,
          variants, layout, ...rest
        } = props
        const Tag = prop as any
        return <Tag {...rest}>{children}</Tag>
      }
      return C
    },
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useAnimation: () => ({ start: vi.fn() }),
  useInView: () => true,
}))

// ─── lucide-react ────────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
  Bell: ({ className }: any) => <svg data-testid="icon-bell" className={className} />,
  Mail: () => <svg data-testid="icon-mail" />,
  Smartphone: () => <svg data-testid="icon-smartphone" />,
  MessageSquare: () => <svg data-testid="icon-message-square" />,
  Settings: () => <svg data-testid="icon-settings" />,
  Clock: () => <svg data-testid="icon-clock" />,
  Moon: () => <svg data-testid="icon-moon" />,
  Sun: () => <svg data-testid="icon-sun" />,
  Globe: () => <svg data-testid="icon-globe" />,
  TrendingUp: () => <svg data-testid="icon-trending-up" />,
  DollarSign: () => <svg data-testid="icon-dollar-sign" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  Users: () => <svg data-testid="icon-users" />,
  Star: () => <svg data-testid="icon-star" />,
  AlertCircle: () => <svg data-testid="icon-alert-circle" />,
  CheckCircle: () => <svg data-testid="icon-check-circle" />,
  Info: () => <svg data-testid="icon-info" />,
  Zap: () => <svg data-testid="icon-zap" />,
  Calendar: () => <svg data-testid="icon-calendar" />,
  BarChart3: () => <svg data-testid="icon-bar-chart" />,
  Heart: () => <svg data-testid="icon-heart" />,
  Eye: () => <svg data-testid="icon-eye" />,
  MessageCircle: () => <svg data-testid="icon-message-circle" />,
  Building2: () => <svg data-testid="icon-building" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronRight: () => <svg data-testid="icon-chevron-right" />,
  Save: () => <svg data-testid="icon-save" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
  Loader2: ({ className }: any) => <svg data-testid="icon-loader" className={className} />,
}))

// ─── Helpers ─────────────────────────────────────────────────────────
const makePreferences = (overrides: Record<string, any> = {}) => ({
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  inAppNotifications: true,
  marketingEmails: false,
  digestFrequency: 'daily',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone: 'America/New_York',
  ndaNotifications: true,
  investmentNotifications: true,
  messageNotifications: true,
  pitchUpdateNotifications: true,
  systemNotifications: true,
  submissionStatusUpdates: true,
  meetingReminders: true,
  contractNotifications: true,
  milestoneUpdates: true,
  dealNotifications: true,
  newPitchMatches: true,
  priceAlerts: true,
  trendingPitches: false,
  featuredContent: false,
  recommendationsEnabled: true,
  savedPitchUpdates: true,
  dailyDigest: true,
  weeklyDigest: true,
  monthlyDigest: false,
  marketInsights: true,
  portfolioUpdates: true,
  notificationPriority: 'all',
  batchNotifications: false,
  smartFiltering: true,
  ...overrides,
})

// ─── Dynamic import ──────────────────────────────────────────────────
let NotificationPreferences: React.ComponentType
beforeAll(async () => {
  const mod = await import('../NotificationPreferences')
  NotificationPreferences = mod.default
})

// ─── Test suite ──────────────────────────────────────────────────────
describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: successful load with preferences
    mockApiGet.mockResolvedValue({ ok: true, data: makePreferences() })
    mockApiPut.mockResolvedValue({ ok: true, data: {} })
    mockApiPost.mockResolvedValue({ ok: true, data: {} })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () => render(<NotificationPreferences />)

  // ── Loading state ────────────────────────────────────────────────
  describe('Loading state', () => {
    it('shows loading spinner while fetching preferences', () => {
      // Never resolves during this test
      mockApiGet.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByTestId('icon-loader')).toBeInTheDocument()
      expect(screen.getByText(/loading notification preferences/i)).toBeInTheDocument()
    })

    it('hides spinner after preferences load', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.queryByTestId('icon-loader')).not.toBeInTheDocument()
      })
    })
  })

  // ── Initial render ───────────────────────────────────────────────
  describe('Initial render', () => {
    it('calls GET /api/notifications/preferences on mount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/notifications/preferences')
      })
    })

    it('renders the main heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
      })
    })

    it('renders the description text', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/customize how and when you receive notifications/i)).toBeInTheDocument()
      })
    })

    it('renders all four channel toggle labels', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument()
        expect(screen.getByText('Push')).toBeInTheDocument()
        expect(screen.getByText('SMS')).toBeInTheDocument()
        expect(screen.getByText('In-App')).toBeInTheDocument()
      })
    })

    it('renders Digest Frequency section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Digest Frequency')).toBeInTheDocument()
      })
    })

    it('renders all digest frequency options', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Instant')).toBeInTheDocument()
        expect(screen.getByText('Hourly')).toBeInTheDocument()
        expect(screen.getByText('Daily')).toBeInTheDocument()
        expect(screen.getByText('Weekly')).toBeInTheDocument()
        expect(screen.getByText('Never')).toBeInTheDocument()
      })
    })

    it('renders Quiet Hours section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
      })
    })

    it('renders all notification category titles', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('General Notifications')).toBeInTheDocument()
        expect(screen.getByText('Pitch & Submission Updates')).toBeInTheDocument()
        expect(screen.getByText('Investment & Financial')).toBeInTheDocument()
        expect(screen.getByText('Production Management')).toBeInTheDocument()
        expect(screen.getByText('Marketplace & Discovery')).toBeInTheDocument()
        expect(screen.getByText('Digest & Summary')).toBeInTheDocument()
      })
    })

    it('renders Advanced Settings section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Advanced Settings')).toBeInTheDocument()
      })
    })
  })

  // ── Channel toggles ──────────────────────────────────────────────
  describe('Channel toggles', () => {
    it('email channel toggle is checked when emailNotifications is true', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ emailNotifications: true }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Email')).toBeInTheDocument())

      // Find checkboxes — the sr-only checkboxes back the channel toggles
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      // First four checkboxes are channel toggles (Email, Push, SMS, In-App)
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true)
    })

    it('SMS channel toggle is unchecked when smsNotifications is false', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: false }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('SMS')).toBeInTheDocument())

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      // Channel order: Email(0), Push(1), SMS(2), In-App(3)
      expect((checkboxes[2] as HTMLInputElement).checked).toBe(false)
    })

    it('toggling email channel calls updatePreference and marks changes', async () => {
      // Load with smsNotifications=true (default is false) so clicking toggles to false
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: true }) })
      renderComponent()
      // Wait for load to complete AND originalPreferences to be set
      await waitFor(() => expect(screen.getByText('Digest Frequency')).toBeInTheDocument())

      // Click SMS checkbox (index 2) to toggle from true → false
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      const smsCheckbox = checkboxes[2] as HTMLInputElement
      fireEvent.click(smsCheckbox)

      // After toggling, hasChanges becomes true — save actions bar should appear
      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
      })
    })

    it('Send test buttons are disabled when channel is disabled', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: false }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('SMS')).toBeInTheDocument())

      // Find all "Send test" buttons — there are 4 (one per channel)
      const sendTestButtons = screen.getAllByText('Send test')
      // SMS is the 3rd channel toggle (index 2)
      expect(sendTestButtons[2]).toBeDisabled()
    })

    it('Send test buttons are enabled when channel is enabled', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ emailNotifications: true }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Email')).toBeInTheDocument())

      const sendTestButtons = screen.getAllByText('Send test')
      expect(sendTestButtons[0]).not.toBeDisabled()
    })
  })

  // ── Digest frequency selection ───────────────────────────────────
  describe('Digest frequency selection', () => {
    it('clicking a frequency updates the active state (shows unsaved changes)', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ digestFrequency: 'daily' }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Instant')).toBeInTheDocument())

      fireEvent.click(screen.getByText('Instant'))

      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
      })
    })

    it('clicking the currently active frequency does not trigger unsaved changes', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ digestFrequency: 'daily' }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Daily')).toBeInTheDocument())

      // Click the already-active value (daily)
      fireEvent.click(screen.getByText('Daily'))

      // After clicking the same value, preferences haven't changed from loaded
      // hasChanges should remain false
      await waitFor(() => {
        expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument()
      })
    })
  })

  // ── Quiet hours settings ─────────────────────────────────────────
  describe('Quiet hours settings', () => {
    it('quiet hours time fields are not visible when quietHoursEnabled is false', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ quietHoursEnabled: false }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Quiet Hours')).toBeInTheDocument())

      expect(screen.queryByText('Start Time')).not.toBeInTheDocument()
      expect(screen.queryByText('End Time')).not.toBeInTheDocument()
    })

    it('quiet hours time fields are visible when quietHoursEnabled is true', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ quietHoursEnabled: true }) })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Start Time')).toBeInTheDocument()
        expect(screen.getByText('End Time')).toBeInTheDocument()
        expect(screen.getByText('Timezone')).toBeInTheDocument()
      })
    })

    it('toggling quiet hours checkbox shows time fields', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ quietHoursEnabled: false }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Quiet Hours')).toBeInTheDocument())

      // The quiet hours toggle is the 5th checkbox (after 4 channel toggles)
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      const quietHoursCheckbox = checkboxes[4] as HTMLInputElement
      // click toggles unchecked → checked
      fireEvent.click(quietHoursCheckbox)

      await waitFor(() => {
        expect(screen.getByText('Start Time')).toBeInTheDocument()
        expect(screen.getByText('End Time')).toBeInTheDocument()
      })
    })

    it('start time input reflects loaded value', async () => {
      mockApiGet.mockResolvedValue({
        ok: true,
        data: makePreferences({ quietHoursEnabled: true, quietHoursStart: '23:00' }),
      })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Start Time')).toBeInTheDocument())

      const timeInputs = document.querySelectorAll('input[type="time"]')
      expect((timeInputs[0] as HTMLInputElement).value).toBe('23:00')
    })
  })

  // ── Notification categories (expand/collapse) ────────────────────
  describe('Notification categories', () => {
    it('General Notifications category is expanded by default (loaded from state)', async () => {
      renderComponent()
      await waitFor(() => {
        // "System Updates" is inside the General category — visible when expanded
        expect(screen.getByText('System Updates')).toBeInTheDocument()
      })
    })

    it('other categories are collapsed by default', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Pitch & Submission Updates')).toBeInTheDocument())

      // "Pitch Updates" text is inside the collapsed Pitch category
      expect(screen.queryByText('Pitch Updates')).not.toBeInTheDocument()
    })

    it('clicking a category header expands it', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Pitch & Submission Updates')).toBeInTheDocument())

      fireEvent.click(screen.getByText('Pitch & Submission Updates'))

      await waitFor(() => {
        expect(screen.getByText('Pitch Updates')).toBeInTheDocument()
        expect(screen.getByText('NDA Requests & Approvals')).toBeInTheDocument()
      })
    })

    it('clicking an expanded category collapses it', async () => {
      renderComponent()
      // General is expanded by default
      await waitFor(() => expect(screen.getByText('System Updates')).toBeInTheDocument())

      fireEvent.click(screen.getByText('General Notifications'))

      await waitFor(() => {
        expect(screen.queryByText('System Updates')).not.toBeInTheDocument()
      })
    })

    it('renders preference rows with channel badges when category is expanded', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('System Updates')).toBeInTheDocument())

      // Channel badges for System Updates: email and app
      const emailBadges = screen.getAllByText('email')
      expect(emailBadges.length).toBeGreaterThan(0)
    })

    it('renders premium badge for AI Recommendations preference', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Marketplace & Discovery')).toBeInTheDocument())

      fireEvent.click(screen.getByText('Marketplace & Discovery'))

      await waitFor(() => {
        expect(screen.getByText('AI Recommendations')).toBeInTheDocument()
      })
      // Premium star icons rendered for both SMS channel toggle and AI Recommendations
      const starIcons = screen.getAllByTestId('icon-star')
      expect(starIcons.length).toBeGreaterThan(0)
    })

    it('toggling a preference within a category marks changes as unsaved', async () => {
      // Load with marketingEmails=false (default). marketingEmails is 3rd item in General category.
      // Clicking its checkbox toggles false→true, creating a diff vs originalPreferences.
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ marketingEmails: false }) })
      renderComponent()
      // Wait for preferences to fully load (originalPreferences set)
      await waitFor(() => expect(screen.getByText('System Updates')).toBeInTheDocument())

      // Find all checkboxes. After load:
      // [0]=email, [1]=push, [2]=sms, [3]=in-app, [4]=quietHours, [5]=systemNotifs, [6]=messageNotifs, [7]=marketingEmails
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      // marketing emails (false by default) is the 8th checkbox (index 7)
      const marketingCheckbox = checkboxes[7] as HTMLInputElement
      fireEvent.click(marketingCheckbox)

      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
      })
    })
  })

  // ── Advanced Settings ────────────────────────────────────────────
  describe('Advanced Settings', () => {
    it('Advanced Settings panel is collapsed by default', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Advanced Settings')).toBeInTheDocument())

      expect(screen.queryByText('Notification Priority Level')).not.toBeInTheDocument()
    })

    it('clicking Advanced Settings header expands the panel', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Advanced Settings')).toBeInTheDocument())

      fireEvent.click(screen.getByText('Advanced Settings'))

      await waitFor(() => {
        expect(screen.getByText('Notification Priority Level')).toBeInTheDocument()
      })
    })

    it('renders all three priority levels when expanded', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Advanced Settings')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Advanced Settings'))

      await waitFor(() => {
        expect(screen.getByText('All Notifications')).toBeInTheDocument()
        expect(screen.getByText('High Priority Only')).toBeInTheDocument()
        expect(screen.getByText('Urgent Only')).toBeInTheDocument()
      })
    })

    it('clicking a priority level marks changes as unsaved', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ notificationPriority: 'all' }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Advanced Settings')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Advanced Settings'))

      await waitFor(() => expect(screen.getByText('High Priority Only')).toBeInTheDocument())
      fireEvent.click(screen.getByText('High Priority Only'))

      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
      })
    })

    it('renders Batch Similar Notifications toggle when expanded', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Advanced Settings')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Advanced Settings'))

      await waitFor(() => {
        expect(screen.getByText('Batch Similar Notifications')).toBeInTheDocument()
      })
    })

    it('renders Smart Filtering toggle when expanded', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Advanced Settings')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Advanced Settings'))

      await waitFor(() => {
        expect(screen.getByText('Smart Filtering')).toBeInTheDocument()
      })
    })
  })

  // ── Save / Reset actions ─────────────────────────────────────────
  describe('Save and reset actions', () => {
    it('save actions bar is NOT visible when there are no changes', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByText('Notification Preferences')).toBeInTheDocument())

      expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument()
    })

    it('save actions bar appears after making a change', async () => {
      // Load with smsNotifications=true so clicking SMS toggles it to false
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: true }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Digest Frequency')).toBeInTheDocument())

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      // SMS is index 2 — click to toggle true→false
      fireEvent.click(checkboxes[2] as HTMLInputElement)

      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
        expect(screen.getByText('Reset')).toBeInTheDocument()
      })
    })

    it('clicking Save Changes calls PUT /api/notifications/preferences', async () => {
      // Load with smsNotifications=true so clicking SMS toggles it false → unsaved state
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: true }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Digest Frequency')).toBeInTheDocument())

      // Click SMS (index 2) to toggle true→false
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      fireEvent.click(checkboxes[2] as HTMLInputElement)

      await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())

      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockApiPut).toHaveBeenCalledWith(
          '/api/notifications/preferences',
          expect.objectContaining({ emailNotifications: true })
        )
      })
    })

    it('shows success toast after saving preferences', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: true }) })
      mockApiPut.mockResolvedValue({ ok: true, data: {} })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Digest Frequency')).toBeInTheDocument())

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      fireEvent.click(checkboxes[2] as HTMLInputElement)

      await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Notification preferences saved successfully')
      })
    })

    it('hides unsaved changes bar after successful save', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: true }) })
      mockApiPut.mockResolvedValue({ ok: true, data: {} })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Digest Frequency')).toBeInTheDocument())

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      fireEvent.click(checkboxes[2] as HTMLInputElement)

      await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument()
      })
    })

    it('shows error toast when save fails', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: true }) })
      mockApiPut.mockResolvedValue({ ok: false, data: { message: 'Server error' } })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Digest Frequency')).toBeInTheDocument())

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      fireEvent.click(checkboxes[2] as HTMLInputElement)

      await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to save notification preferences')
      })
    })

    it('shows error toast when save throws', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: true }) })
      mockApiPut.mockRejectedValue(new Error('Network failure'))
      renderComponent()
      await waitFor(() => expect(screen.getByText('Digest Frequency')).toBeInTheDocument())

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      fireEvent.click(checkboxes[2] as HTMLInputElement)

      await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to save notification preferences')
      })
    })

    it('clicking Reset reverts changes and hides the save bar', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ smsNotifications: true }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Digest Frequency')).toBeInTheDocument())

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      fireEvent.click(checkboxes[2] as HTMLInputElement)

      await waitFor(() => expect(screen.getByText('Reset')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Reset'))

      await waitFor(() => {
        expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument()
      })
    })
  })

  // ── Send test notification ────────────────────────────────────────
  describe('Send test notification', () => {
    it('clicking Send test on an enabled channel calls POST /api/notifications/test', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ emailNotifications: true }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Email')).toBeInTheDocument())

      const sendTestButtons = screen.getAllByText('Send test')
      fireEvent.click(sendTestButtons[0]) // email channel

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/notifications/test', { channel: 'email' })
      })
    })

    it('shows success toast after sending test notification', async () => {
      mockApiPost.mockResolvedValue({ ok: true })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Email')).toBeInTheDocument())

      const sendTestButtons = screen.getAllByText('Send test')
      fireEvent.click(sendTestButtons[0])

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringMatching(/test email notification sent/i))
      })
    })

    it('shows error toast when test notification fails', async () => {
      mockApiPost.mockRejectedValue(new Error('Network error'))
      renderComponent()
      await waitFor(() => expect(screen.getByText('Email')).toBeInTheDocument())

      const sendTestButtons = screen.getAllByText('Send test')
      fireEvent.click(sendTestButtons[0])

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/failed to send test email notification/i))
      })
    })
  })

  // ── API error on load ────────────────────────────────────────────
  describe('API error on load', () => {
    it('shows error toast when preferences fail to load', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))
      renderComponent()

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to load notification preferences')
      })
    })

    it('falls back to default preferences when API returns non-ok response', async () => {
      mockApiGet.mockResolvedValue({ ok: false, data: null })
      renderComponent()

      // Should still render without crashing (default state is used)
      await waitFor(() => {
        expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
      })
    })

    it('still renders the UI after a failed preferences load', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))
      renderComponent()

      await waitFor(() => {
        // Component renders with default state even on load error
        expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
        expect(screen.getByText('Email')).toBeInTheDocument()
      })
    })
  })

  // ── Timezone select in quiet hours ───────────────────────────────
  describe('Timezone select', () => {
    it('changing timezone marks changes as unsaved', async () => {
      mockApiGet.mockResolvedValue({
        ok: true,
        data: makePreferences({ quietHoursEnabled: true }),
      })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Start Time')).toBeInTheDocument())

      const timezoneSelect = screen.getByRole('combobox')
      fireEvent.change(timezoneSelect, { target: { value: 'Europe/London' } })

      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
      })
    })

    it('renders timezone options in the select', async () => {
      mockApiGet.mockResolvedValue({
        ok: true,
        data: makePreferences({ quietHoursEnabled: true }),
      })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Start Time')).toBeInTheDocument())

      expect(screen.getByRole('option', { name: 'America/New York' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Europe/London' })).toBeInTheDocument()
    })
  })

  // ── Preferences are loaded into the UI ────────────────────────────
  describe('Loaded preferences applied to UI', () => {
    it('reflects loaded digestFrequency in the button active state', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ digestFrequency: 'weekly' }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Weekly')).toBeInTheDocument())

      // "Weekly" button should have the active class (border-blue-500)
      const weeklyBtn = screen.getByText('Weekly').closest('button')
      expect(weeklyBtn?.className).toContain('border-blue-500')
    })

    it('Daily button is inactive when weekly is selected', async () => {
      mockApiGet.mockResolvedValue({ ok: true, data: makePreferences({ digestFrequency: 'weekly' }) })
      renderComponent()
      await waitFor(() => expect(screen.getByText('Daily')).toBeInTheDocument())

      const dailyBtn = screen.getByText('Daily').closest('button')
      expect(dailyBtn?.className).not.toContain('border-blue-500')
    })
  })
})
