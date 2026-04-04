import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockLoginInvestor = vi.fn()
let mockError: string | null = null
let mockStoreLoading = false

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

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

vi.mock('../../store/betterAuthStore', () => ({
  MFARequiredError,
  useBetterAuthStore: () => ({
    loginInvestor: mockLoginInvestor,
    error: mockError,
    loading: mockStoreLoading,
  }),
}))

vi.mock('../../components/BackButton', () => ({
  default: () => <button>Back</button>,
}))

vi.mock('../../hooks/useLoadingState', () => ({
  useLoadingState: () => ({
    loading: false,
    setLoading: vi.fn(),
    clearLoading: vi.fn(),
    loadingMessage: null,
  }),
}))

vi.mock('../../utils/auth', () => ({
  clearAuthenticationState: vi.fn(),
}))

let InvestorLogin: React.ComponentType
beforeAll(async () => {
  const mod = await import('../InvestorLogin')
  InvestorLogin = mod.default
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <InvestorLogin />
    </MemoryRouter>
  )
}

describe('InvestorLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockError = null
    mockStoreLoading = false
    mockLoginInvestor.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Rendering ──────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders the Investor Portal heading', () => {
      renderLogin()
      expect(screen.getByText('Investor Portal')).toBeInTheDocument()
    })

    it('renders email and password inputs', () => {
      renderLogin()
      expect(screen.getByLabelText('Email address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders the sign in button', () => {
      renderLogin()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('renders demo account button', () => {
      renderLogin()
      expect(screen.getByText('Use Demo Investor Account')).toBeInTheDocument()
    })

    it('renders links to other portals', () => {
      renderLogin()
      expect(screen.getByText('Creator Portal')).toBeInTheDocument()
      expect(screen.getByText('Production Portal')).toBeInTheDocument()
    })

    it('renders forgot password link', () => {
      renderLogin()
      expect(screen.getByText('Forgot password?')).toBeInTheDocument()
    })
  })

  // ─── Auth Connectivity ──────────────────────────────────────────────

  describe('Auth Connectivity', () => {
    it('calls loginInvestor with form data on submit', async () => {
      renderLogin()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.type(screen.getByLabelText('Email address'), 'investor@example.com')
      await user.type(screen.getByLabelText('Password'), 'Secret123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockLoginInvestor).toHaveBeenCalledWith('investor@example.com', 'Secret123', '')
      })
    })

    it('navigates to /investor/dashboard on successful login', async () => {
      renderLogin()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.type(screen.getByLabelText('Email address'), 'investor@example.com')
      await user.type(screen.getByLabelText('Password'), 'Secret123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      // Navigate happens inside a setTimeout(100ms)
      vi.advanceTimersByTime(200)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/investor/dashboard')
      })
    })

    it('does NOT navigate on login failure', async () => {
      mockLoginInvestor.mockRejectedValue(new Error('Invalid credentials'))
      renderLogin()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.type(screen.getByLabelText('Email address'), 'bad@example.com')
      await user.type(screen.getByLabelText('Password'), 'wrong')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      vi.advanceTimersByTime(200)

      await waitFor(() => {
        expect(mockLoginInvestor).toHaveBeenCalled()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('calls loginInvestor with demo credentials on demo click', async () => {
      renderLogin()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.click(screen.getByText('Use Demo Investor Account'))

      await waitFor(() => {
        expect(mockLoginInvestor).toHaveBeenCalledWith('sarah.investor@demo.com', 'Demo123', '')
      })
    })

    it('navigates to dashboard after successful demo login', async () => {
      renderLogin()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.click(screen.getByText('Use Demo Investor Account'))

      vi.advanceTimersByTime(200)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/investor/dashboard')
      })
    })

    it('does NOT navigate when demo login fails', async () => {
      mockLoginInvestor.mockRejectedValue(new Error('Network error'))
      renderLogin()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.click(screen.getByText('Use Demo Investor Account'))

      vi.advanceTimersByTime(200)

      await waitFor(() => {
        expect(mockLoginInvestor).toHaveBeenCalled()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  // ─── Error State ────────────────────────────────────────────────────

  describe('Error State', () => {
    it('displays error banner when store has error', () => {
      mockError = 'Invalid email or password'
      renderLogin()
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })

    it('does NOT display error banner when no error', () => {
      renderLogin()
      expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument()
    })
  })

  // ─── Form Input ─────────────────────────────────────────────────────

  describe('Form Input', () => {
    it('updates email field as user types', async () => {
      renderLogin()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = screen.getByLabelText('Email address')

      await user.type(emailInput, 'hello@world.com')
      expect(emailInput).toHaveValue('hello@world.com')
    })

    it('updates password field as user types', async () => {
      renderLogin()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const passwordInput = screen.getByLabelText('Password')

      await user.type(passwordInput, 'secret123')
      expect(passwordInput).toHaveValue('secret123')
    })
  })
})
