import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ──────────────────────────────────────────
const mockNavigate = vi.fn()
const mockVerifyEmail = vi.fn()
const mockResendVerificationEmail = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
// Default: simulate a URL with a token query param
let mockSearchParams = new URLSearchParams('?token=abc123')
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── lib/api — authAPI ───────────────────────────────────────────────
vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  authAPI: {
    verifyEmail: (...args: any[]) => mockVerifyEmail(...args),
    resendVerificationEmail: (...args: any[]) => mockResendVerificationEmail(...args),
  },
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../VerifyEmail')
  Component = mod.default
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('VerifyEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams('?token=abc123')
    // localStorage is a vi.fn() mock — reset getItem to return null by default
    vi.mocked(localStorage.getItem).mockReturnValue(null)
  })

  describe('with valid token', () => {
    it('shows loading spinner while verifying', () => {
      mockVerifyEmail.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
      expect(screen.getByText('Verifying your email address...')).toBeInTheDocument()
    })

    it('shows success state after successful verification', async () => {
      mockVerifyEmail.mockResolvedValue(undefined)
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Email verified successfully!')).toBeInTheDocument()
      })
      expect(screen.getByText(/finish your profile/)).toBeInTheDocument()
      expect(screen.getByText('Redirecting to login page...')).toBeInTheDocument()
    })

    it('calls authAPI.verifyEmail with the token from URL', async () => {
      mockVerifyEmail.mockResolvedValue(undefined)
      renderComponent()

      await waitFor(() => {
        expect(mockVerifyEmail).toHaveBeenCalledWith('abc123')
      })
    })

    it('renders Continue to login link after success', async () => {
      mockVerifyEmail.mockResolvedValue(undefined)
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Email verified successfully!')).toBeInTheDocument()
      }, { timeout: 5000 })

      const goToLogin = screen.getByRole('link', { name: 'Continue to login' })
      expect(goToLogin).toBeInTheDocument()
      expect(goToLogin).toHaveAttribute('href', '/login')
    })

    it('shows error state when verification fails', async () => {
      mockVerifyEmail.mockRejectedValue({ response: { data: { error: 'Token expired' } } })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument()
      })
      expect(screen.getByText('Token expired')).toBeInTheDocument()
    })

    it('shows fallback error message when error has no response data', async () => {
      mockVerifyEmail.mockRejectedValue(new Error('Network error'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument()
      })
      expect(screen.getByText('Failed to verify email. The link may be expired.')).toBeInTheDocument()
    })

    it('shows resend button on error state', async () => {
      mockVerifyEmail.mockRejectedValue(new Error('fail'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
      })
    })

    it('resends verification email when button clicked', async () => {
      mockVerifyEmail.mockRejectedValue(new Error('fail'))
      mockResendVerificationEmail.mockResolvedValue(undefined)
      // Mock localStorage.getItem to return the email
      vi.mocked(localStorage.getItem).mockReturnValue('test@example.com')

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }))

      await waitFor(() => {
        expect(mockResendVerificationEmail).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('shows resent confirmation after resend succeeds', async () => {
      mockVerifyEmail.mockRejectedValue(new Error('fail'))
      mockResendVerificationEmail.mockResolvedValue(undefined)
      // Mock localStorage.getItem to return the email
      vi.mocked(localStorage.getItem).mockReturnValue('test@example.com')

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }))

      await waitFor(() => {
        expect(screen.getByText('A new verification email has been sent. Please check your inbox.')).toBeInTheDocument()
      })
    })

    it('navigates to login if no email in localStorage when resending', async () => {
      mockVerifyEmail.mockRejectedValue(new Error('fail'))
      // localStorage.getItem returns null by default (set in beforeEach)

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })

    it('shows Back to login link on error state', async () => {
      mockVerifyEmail.mockRejectedValue(new Error('fail'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument()
      })
    })
  })

  describe('without token', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams('')
    })

    it('shows error state immediately when no token in URL', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument()
      })
      expect(screen.getByText('Invalid verification link')).toBeInTheDocument()
    })

    it('does not call verifyEmail when no token', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invalid verification link')).toBeInTheDocument()
      })
      expect(mockVerifyEmail).not.toHaveBeenCalled()
    })
  })

  describe('page chrome', () => {
    it('renders the Pitchey brand', () => {
      mockVerifyEmail.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByAltText('Pitchey')).toBeInTheDocument()
    })

    it('renders the Email Verification heading', () => {
      mockVerifyEmail.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Email Verification')).toBeInTheDocument()
    })

    it('renders a support contact link', () => {
      mockVerifyEmail.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByRole('link', { name: 'Contact support' })).toBeInTheDocument()
    })
  })

  describe('no-token state (Verify your email prompt)', () => {
    beforeEach(() => {
      // Use a URL without token to trigger the "verify your email" prompt state
      mockSearchParams = new URLSearchParams('')
    })

    it('does not call verifyEmail so loader exits immediately', async () => {
      renderComponent()
      await waitFor(() => {
        // Should land on error state (invalid link)
        expect(screen.getByText('Verification failed')).toBeInTheDocument()
      })
    })
  })
})
