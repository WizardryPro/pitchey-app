import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockLoginCreator = vi.fn()
let mockLoading = false
let mockError: string | null = null

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
    loginCreator: mockLoginCreator,
    loading: mockLoading,
    error: mockError,
  }),
}))

vi.mock('../../components/BackButton', () => ({
  default: () => <button>Back</button>,
}))

let CreatorLogin: React.ComponentType
beforeAll(async () => {
  const mod = await import('../CreatorLogin')
  CreatorLogin = mod.default
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <CreatorLogin />
    </MemoryRouter>
  )
}

describe('CreatorLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoading = false
    mockError = null
    mockLoginCreator.mockResolvedValue(undefined)
  })

  // ─── Rendering ──────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders the Creator Portal heading', () => {
      renderLogin()
      expect(screen.getByText('Creator Portal')).toBeInTheDocument()
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
      expect(screen.getByText('Use Demo Creator Account')).toBeInTheDocument()
    })

    it('renders links to other portals', () => {
      renderLogin()
      expect(screen.getByText('Investor Portal')).toBeInTheDocument()
      expect(screen.getByText('Production Portal')).toBeInTheDocument()
    })

    it('renders forgot password link', () => {
      renderLogin()
      expect(screen.getByText('Forgot password?')).toBeInTheDocument()
    })
  })

  // ─── Auth Connectivity ──────────────────────────────────────────────

  describe('Auth Connectivity', () => {
    it('calls loginCreator with form data on submit', async () => {
      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText('Email address'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'Password123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockLoginCreator).toHaveBeenCalledWith('test@example.com', 'Password123')
      })
    })

    it('navigates to /creator/dashboard on successful login', async () => {
      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText('Email address'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'Password123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/creator/dashboard')
      })
    })

    it('does NOT navigate on login failure', async () => {
      mockLoginCreator.mockRejectedValue(new Error('Invalid credentials'))
      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText('Email address'), 'bad@example.com')
      await user.type(screen.getByLabelText('Password'), 'wrong')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockLoginCreator).toHaveBeenCalled()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('calls loginCreator with demo credentials and navigates on demo click', async () => {
      renderLogin()
      const user = userEvent.setup()

      await user.click(screen.getByText('Use Demo Creator Account'))

      await waitFor(() => {
        expect(mockLoginCreator).toHaveBeenCalledWith('alex.creator@demo.com', 'Demo123')
        expect(mockNavigate).toHaveBeenCalledWith('/creator/dashboard')
      })
    })

    it('does NOT navigate when demo login fails', async () => {
      mockLoginCreator.mockRejectedValue(new Error('Network error'))
      renderLogin()
      const user = userEvent.setup()

      await user.click(screen.getByText('Use Demo Creator Account'))

      await waitFor(() => {
        expect(mockLoginCreator).toHaveBeenCalled()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  // ─── Loading State ──────────────────────────────────────────────────

  describe('Loading State', () => {
    it('disables submit button when loading', () => {
      mockLoading = true
      renderLogin()
      const button = screen.getByRole('button', { name: '' }) // spinner replaces text
      expect(button).toBeDisabled()
    })

    it('shows spinner when loading', () => {
      mockLoading = true
      renderLogin()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('shows Sign in text when not loading', () => {
      renderLogin()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
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
      const user = userEvent.setup()
      const emailInput = screen.getByLabelText('Email address')

      await user.type(emailInput, 'hello@world.com')
      expect(emailInput).toHaveValue('hello@world.com')
    })

    it('updates password field as user types', async () => {
      renderLogin()
      const user = userEvent.setup()
      const passwordInput = screen.getByLabelText('Password')

      await user.type(passwordInput, 'secret123')
      expect(passwordInput).toHaveValue('secret123')
    })
  })
})
