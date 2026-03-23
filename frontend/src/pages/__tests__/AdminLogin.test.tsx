import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogin = vi.fn()
const mockLogout = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE reference — avoids infinite useEffect loops) ─────────
const mockAuthState = {
  user: null as any,
  isAuthenticated: false,
  loading: false,
  error: null as string | null,
  login: (...args: any[]) => mockLogin(...args),
  logout: mockLogout,
}

// getState must return the same object (stable reference)
const mockGetState = vi.fn(() => ({ user: null as any, logout: mockLogout }))

vi.mock('../../store/betterAuthStore', () => {
  class MFARequiredError extends Error {
    challengeId: string
    methods: string[]
    expiresAt: string
    user: { id: string; email: string; name: string; userType: string }

    constructor(data: { challengeId: string; methods: string[]; expiresAt: string; user: { id: string; email: string; name: string; userType: string } }) {
      super('MFA verification required')
      this.name = 'MFARequiredError'
      this.challengeId = data.challengeId
      this.methods = data.methods
      this.expiresAt = data.expiresAt
      this.user = data.user
    }
  }

  const useBetterAuthStore: any = () => mockAuthState
  useBetterAuthStore.getState = mockGetState

  return { useBetterAuthStore, MFARequiredError }
})

// ─── BackButton component ────────────────────────────────────────────────────
vi.mock('../../components/BackButton', () => ({
  default: ({ variant }: any) => (
    <button data-testid="back-button" data-variant={variant}>Back</button>
  ),
}))

// ─── Dynamic import after mocks ──────────────────────────────────────────────
let AdminLogin: React.ComponentType
beforeAll(async () => {
  const mod = await import('../../pages/AdminLogin')
  AdminLogin = mod.default
})

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AdminLogin />
    </MemoryRouter>
  )

describe('AdminLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.loading = false
    mockAuthState.error = null
    mockAuthState.user = null
    mockGetState.mockReturnValue({ user: null, logout: mockLogout })
    mockLogin.mockResolvedValue(undefined)
  })

  describe('Rendering', () => {
    it('renders the Admin Portal heading', () => {
      renderComponent()
      expect(screen.getByText('Admin Portal')).toBeInTheDocument()
    })

    it('renders the sign-in subtitle', () => {
      renderComponent()
      expect(screen.getByText('Sign in to the administration panel')).toBeInTheDocument()
    })

    it('renders email and password input fields', () => {
      renderComponent()
      expect(screen.getByLabelText('Email address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders the Sign in submit button', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('renders the passwordless sign-in link', () => {
      renderComponent()
      const emailCodeLink = screen.getByText('Sign in with email code')
      expect(emailCodeLink).toBeInTheDocument()
      expect(emailCodeLink.closest('a')).toHaveAttribute('href', '/login/email')
    })

    it('renders the back to portal selection link', () => {
      renderComponent()
      const backLink = screen.getByText('Back to portal selection')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/portals')
    })

    it('renders the BackButton component', () => {
      renderComponent()
      expect(screen.getByTestId('back-button')).toBeInTheDocument()
    })

    it('does not show error message initially', () => {
      renderComponent()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('calls login with the entered email and password', async () => {
      const user = userEvent.setup()
      mockGetState.mockReturnValue({
        user: { id: '1', userType: 'admin' },
        logout: mockLogout,
      })
      renderComponent()

      await user.type(screen.getByLabelText('Email address'), 'admin@pitchey.com')
      await user.type(screen.getByLabelText('Password'), 'secret123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('admin@pitchey.com', 'secret123')
      })
    })

    it('navigates to /admin/dashboard after successful admin login', async () => {
      const user = userEvent.setup()
      mockGetState.mockReturnValue({
        user: { id: '1', userType: 'admin' },
        logout: mockLogout,
      })
      renderComponent()

      await user.type(screen.getByLabelText('Email address'), 'admin@pitchey.com')
      await user.type(screen.getByLabelText('Password'), 'password')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard')
      })
    })
  })

  describe('Non-admin rejection', () => {
    it('shows access denied error and calls logout when user is not admin', async () => {
      const user = userEvent.setup()
      // login succeeds but user is a creator, not admin
      mockGetState.mockReturnValue({
        user: { id: '2', userType: 'creator' },
        logout: mockLogout,
      })
      renderComponent()

      await user.type(screen.getByLabelText('Email address'), 'creator@example.com')
      await user.type(screen.getByLabelText('Password'), 'password')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
      })
      expect(screen.getByText('Access denied. This portal is restricted to administrators.')).toBeInTheDocument()
    })

    it('does not navigate to dashboard when user is not admin', async () => {
      const user = userEvent.setup()
      mockGetState.mockReturnValue({
        user: { id: '3', userType: 'investor' },
        logout: mockLogout,
      })
      renderComponent()

      await user.type(screen.getByLabelText('Email address'), 'investor@example.com')
      await user.type(screen.getByLabelText('Password'), 'password')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
      })
      expect(mockNavigate).not.toHaveBeenCalledWith('/admin/dashboard')
    })
  })

  describe('MFA redirect', () => {
    it('redirects to MFA challenge page when MFARequiredError is thrown', async () => {
      const user = userEvent.setup()

      // Import the real MFARequiredError from the mock module
      const { MFARequiredError } = await import('../../store/betterAuthStore')
      const mfaError = new MFARequiredError({
        challengeId: 'chal-123',
        methods: ['email'],
        expiresAt: '2026-12-01T00:00:00Z',
        user: { id: '1', email: 'admin@pitchey.com', name: 'Admin', userType: 'admin' },
      })
      mockLogin.mockRejectedValue(mfaError)

      renderComponent()

      await user.type(screen.getByLabelText('Email address'), 'admin@pitchey.com')
      await user.type(screen.getByLabelText('Password'), 'password')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/mfa/challenge?challengeId=chal-123')
        )
      })
    })
  })

  describe('Error display', () => {
    it('displays error from auth store', () => {
      mockAuthState.error = 'Invalid credentials'
      renderComponent()
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })

    it('displays auth error set locally (non-admin rejection)', async () => {
      const user = userEvent.setup()
      mockGetState.mockReturnValue({
        user: { id: '5', userType: 'production' },
        logout: mockLogout,
      })
      renderComponent()

      await user.type(screen.getByLabelText('Email address'), 'prod@example.com')
      await user.type(screen.getByLabelText('Password'), 'password')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(screen.getByText('Access denied. This portal is restricted to administrators.')).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('shows loading spinner when auth store is loading', () => {
      mockAuthState.loading = true
      renderComponent()
      // The submit button is disabled and shows a spinner
      const submitBtn = screen.getByRole('button', { name: '' }) // spinner — no text
      expect(submitBtn).toBeDisabled()
    })
  })
})
