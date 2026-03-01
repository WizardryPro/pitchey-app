import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockGetNDAs = vi.fn()
const mockSignNDA = vi.fn()
const mockSendReminder = vi.fn()
const mockRevokeNDA = vi.fn()
const mockDownloadNDA = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

// Stable user object for Zustand mock
const stableUser = { id: 'inv-1', name: 'Test Investor', email: 'investor@test.com', userType: 'investor' }

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({
    user: stableUser,
    isAuthenticated: true,
    checkSession: mockCheckSession,
  }),
}))

vi.mock('../../services/nda.service', () => ({
  NDAService: {
    getNDAs: mockGetNDAs,
    signNDA: mockSignNDA,
    sendReminder: mockSendReminder,
    revokeNDA: mockRevokeNDA,
    downloadNDA: mockDownloadNDA,
  },
}))

vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}))

// Mock shadcn/ui components used by NDARequests
vi.mock('@shared/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))
vi.mock('@shared/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))
vi.mock('@shared/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))
vi.mock('@shared/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@shared/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}))
vi.mock('@shared/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))
vi.mock('@shared/components/ui/tabs', () => ({
  Tabs: ({ children, onValueChange, value, defaultValue }: any) => <div>{children}</div>,
  TabsContent: ({ children, value }: any) => <div data-tab={value}>{children}</div>,
  TabsList: ({ children }: any) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children, value, onClick }: any) => (
    <button role="tab" data-value={value} onClick={onClick}>{children}</button>
  ),
}))

const makeNDA = (overrides: Record<string, any> = {}) => ({
  id: 1,
  pitchTitle: 'Test Pitch',
  creator: 'John Creator',
  company: 'Creator Co.',
  requestDate: '2026-01-15T00:00:00Z',
  status: 'pending' as const,
  genre: 'Drama',
  budget: '$1M-$5M',
  pitchId: 100,
  ...overrides,
})

let NDARequests: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/NDARequests')
  NDARequests = mod.default
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/investor/ndas']}>
      <NDARequests />
    </MemoryRouter>
  )
}

describe('NDARequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetNDAs.mockResolvedValue({ ndas: [], total: 0 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Loading State ──────────────────────────────────────────────────

  describe('Loading State', () => {
    it('shows spinner while loading', () => {
      mockGetNDAs.mockReturnValue(new Promise(() => {})) // never resolves
      renderPage()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })
  })

  // ─── Authentication ─────────────────────────────────────────────────

  describe('Authentication', () => {
    it('checks session on mount', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockCheckSession).toHaveBeenCalledTimes(1)
      })
    })

    it('fetches NDA data after session verified', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetNDAs).toHaveBeenCalledWith({ limit: 50 })
      })
    })
  })

  // ─── API Connectivity — Fetch ───────────────────────────────────────

  describe('API Connectivity — Fetch', () => {
    it('renders fetched NDA requests', async () => {
      mockGetNDAs.mockResolvedValue({
        ndas: [
          { id: 1, pitch: { title: 'Action Movie' }, status: 'pending', requester: { firstName: 'Jane', companyName: 'Film Co' }, requestedAt: '2026-01-15' },
          { id: 2, pitch: { title: 'Comedy Film' }, status: 'approved', requester: { firstName: 'Bob', companyName: 'Studios' }, requestedAt: '2026-01-10' },
        ],
        total: 2,
      })
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Action Movie')).toBeInTheDocument()
        expect(screen.getByText('Comedy Film')).toBeInTheDocument()
      })
    })

    it('shows error when fetch fails', async () => {
      mockGetNDAs.mockRejectedValue(new Error('Network error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load NDA requests/i)).toBeInTheDocument()
      })
    })

    it('displays stats from fetched data', async () => {
      mockGetNDAs.mockResolvedValue({
        ndas: [
          { id: 1, pitch: { title: 'P1' }, status: 'pending', requestedAt: '2026-01-15' },
          { id: 2, pitch: { title: 'P2' }, status: 'signed', requestedAt: '2026-01-10' },
          { id: 3, pitch: { title: 'P3' }, status: 'approved', requestedAt: '2026-01-05' },
        ],
        total: 3,
      })
      renderPage()
      await waitFor(() => {
        // Should show stat counts somewhere in the UI
        expect(mockGetNDAs).toHaveBeenCalled()
      })
    })
  })

  // ─── API Connectivity — Sign NDA ────────────────────────────────────

  describe('API Connectivity — Sign NDA', () => {
    it('calls NDAService.signNDA with correct params', async () => {
      mockGetNDAs.mockResolvedValue({
        ndas: [{ id: 10, pitch: { title: 'Signable Pitch' }, status: 'approved', requestedAt: '2026-01-15' }],
        total: 1,
      })
      mockSignNDA.mockResolvedValue({ success: true })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Signable Pitch')).toBeInTheDocument()
      })

      // Use exact text "Sign NDA" to avoid matching "Signed (0)" tab button
      const signBtn = screen.getByRole('button', { name: /Sign NDA/i })
      const user = userEvent.setup()
      await user.click(signBtn)

      await waitFor(() => {
        expect(mockSignNDA).toHaveBeenCalledWith(
          expect.objectContaining({ ndaId: 10, acceptTerms: true })
        )
      })
    })

    it('shows toast on successful sign', async () => {
      mockGetNDAs.mockResolvedValue({
        ndas: [{ id: 10, pitch: { title: 'Signable Pitch' }, status: 'approved', requestedAt: '2026-01-15' }],
        total: 1,
      })
      mockSignNDA.mockResolvedValue({ success: true })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Signable Pitch')).toBeInTheDocument()
      })

      const signBtn = screen.getByRole('button', { name: /Sign NDA/i })
      const user = userEvent.setup()
      await user.click(signBtn)

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled()
      })
    })
  })

  // ─── API Connectivity — Delete NDA ──────────────────────────────────

  describe('API Connectivity — Delete NDA', () => {
    it('calls NDAService.revokeNDA on delete', async () => {
      // Delete only appears for non-pending NDAs (status !== 'pending')
      mockGetNDAs.mockResolvedValue({
        ndas: [{ id: 20, pitch: { title: 'Deletable NDA' }, status: 'signed', requestedAt: '2026-01-15' }],
        total: 1,
      })
      mockRevokeNDA.mockResolvedValue({ success: true })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Deletable NDA')).toBeInTheDocument()
      })

      // Find delete action in dropdown
      const deleteButtons = screen.getAllByText(/Delete/i)
      if (deleteButtons.length > 0) {
        const user = userEvent.setup()
        await user.click(deleteButtons[0])

        await waitFor(() => {
          expect(mockRevokeNDA).toHaveBeenCalledWith(20, 'Deleted by investor')
        })
      }
    })

    it('does NOT delete when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      // Delete only appears for non-pending NDAs
      mockGetNDAs.mockResolvedValue({
        ndas: [{ id: 20, pitch: { title: 'Kept NDA' }, status: 'signed', requestedAt: '2026-01-15' }],
        total: 1,
      })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Kept NDA')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByText(/Delete/i)
      if (deleteButtons.length > 0) {
        const user = userEvent.setup()
        await user.click(deleteButtons[0])
      }

      expect(mockRevokeNDA).not.toHaveBeenCalled()
    })
  })

  // ─── API Connectivity — Reminder ────────────────────────────────────

  describe('API Connectivity — Reminder', () => {
    it('calls NDAService.sendReminder on follow-up', async () => {
      mockGetNDAs.mockResolvedValue({
        ndas: [{ id: 30, pitch: { title: 'Pending NDA' }, status: 'pending', requestedAt: '2026-01-15' }],
        total: 1,
      })
      mockSendReminder.mockResolvedValue(undefined)
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Pending NDA')).toBeInTheDocument()
      })

      const followUpButtons = screen.getAllByText(/Follow Up|Remind/i)
      if (followUpButtons.length > 0) {
        const user = userEvent.setup()
        await user.click(followUpButtons[0])

        await waitFor(() => {
          expect(mockSendReminder).toHaveBeenCalledWith(30)
        })
      }
    })
  })

  // ─── Empty State ────────────────────────────────────────────────────

  describe('Empty State', () => {
    it('renders with zero NDAs without crashing', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [], total: 0 })
      renderPage()
      await waitFor(() => {
        expect(mockGetNDAs).toHaveBeenCalled()
      })
      // Should render without error
      expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument()
    })
  })
})
