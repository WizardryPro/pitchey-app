import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ───────────────────────────────────────────
const mockNavigate = vi.fn()
const mockResetPassword = vi.fn()

// ─── react-router-dom ─────────────────────────────────────────────────
let mockSearchParams = new URLSearchParams('token=valid-token-abc123')

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── authAPI via lib/api ───────────────────────────────────────────────
vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  authAPI: {
    requestPasswordReset: vi.fn(),
    resetPassword: mockResetPassword,
  },
}))

// ─── Component ─────────────────────────────────────────────────────────
let ResetPassword: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ResetPassword')
  ResetPassword = mod.default
})

// A strong password that meets all requirements:
// 12+ chars, uppercase, lowercase, number, special char
const STRONG_PASSWORD = 'Secure@Pass99!'

function renderResetPassword() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>
  )
}

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams('token=valid-token-abc123')
    mockResetPassword.mockResolvedValue(undefined)
  })

  describe('with valid token', () => {
    it('renders the Create new password heading', () => {
      renderResetPassword()
      expect(screen.getByText('Create new password')).toBeInTheDocument()
    })

    it('renders Pitchey brand link', () => {
      renderResetPassword()
      expect(screen.getByText('Pitchey')).toBeInTheDocument()
    })

    it('renders new password input', () => {
      renderResetPassword()
      expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    })

    it('renders confirm password input', () => {
      renderResetPassword()
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument()
    })

    it('renders Reset password button', () => {
      renderResetPassword()
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
    })

    it('submit button is disabled initially (passwords empty)', () => {
      renderResetPassword()
      const btn = screen.getByRole('button', { name: /reset password/i })
      expect(btn).toBeDisabled()
    })

    it('shows password requirements when password field is focused', () => {
      renderResetPassword()
      const passwordInput = screen.getByLabelText('New Password')
      fireEvent.focus(passwordInput)
      expect(screen.getByText('At least 12 characters')).toBeInTheDocument()
      expect(screen.getByText('One uppercase letter')).toBeInTheDocument()
      expect(screen.getByText('One lowercase letter')).toBeInTheDocument()
      expect(screen.getByText('One number')).toBeInTheDocument()
      expect(screen.getByText('One special character')).toBeInTheDocument()
    })

    it('shows password strength meter when password is typed', () => {
      renderResetPassword()
      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: 'weak' },
      })
      expect(screen.getByText('Password strength')).toBeInTheDocument()
    })

    it('shows Weak strength label for short password', () => {
      renderResetPassword()
      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: 'abc' },
      })
      expect(screen.getByText('Weak')).toBeInTheDocument()
    })

    it('shows Strong strength label for strong password', () => {
      renderResetPassword()
      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: STRONG_PASSWORD },
      })
      expect(screen.getByText('Strong')).toBeInTheDocument()
    })

    it('shows passwords match indicator when both fields match', () => {
      renderResetPassword()
      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: STRONG_PASSWORD },
      })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: STRONG_PASSWORD },
      })
      expect(screen.getByText('Passwords match')).toBeInTheDocument()
    })

    it('shows passwords do not match indicator when fields differ', () => {
      renderResetPassword()
      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: STRONG_PASSWORD },
      })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: 'differentPass!99' },
      })
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })

    it('calls resetPassword API with correct token and password on submit', async () => {
      renderResetPassword()

      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: STRONG_PASSWORD },
      })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: STRONG_PASSWORD },
      })

      fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('valid-token-abc123', STRONG_PASSWORD)
      })
    })

    it('shows success view after password is reset', async () => {
      renderResetPassword()

      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: STRONG_PASSWORD },
      })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: STRONG_PASSWORD },
      })

      fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('Password reset successful!')).toBeInTheDocument()
      })
      expect(screen.getByText(/redirecting to login page/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login')
    })

    it('shows error when API fails', async () => {
      mockResetPassword.mockRejectedValue({ response: { data: { error: 'Token expired' } } })
      renderResetPassword()

      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: STRONG_PASSWORD },
      })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: STRONG_PASSWORD },
      })

      fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('Token expired')).toBeInTheDocument()
      })
    })

    it('shows fallback error when API fails without message', async () => {
      mockResetPassword.mockRejectedValue(new Error('Network error'))
      renderResetPassword()

      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: STRONG_PASSWORD },
      })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: STRONG_PASSWORD },
      })

      fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText(/Failed to reset password/i)).toBeInTheDocument()
      })
    })

    it('toggles password visibility when eye button clicked', () => {
      renderResetPassword()
      const passwordInput = screen.getByLabelText('New Password') as HTMLInputElement
      expect(passwordInput.type).toBe('password')

      // Click the toggle button (there are 2 - one for each field)
      const toggleButtons = screen.getAllByRole('button').filter(
        btn => btn.type === 'button' && btn.className.includes('inset-y-0')
      )
      if (toggleButtons.length > 0) {
        fireEvent.click(toggleButtons[0])
        expect(passwordInput.type).toBe('text')
      }
    })
  })

  describe('without token', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams('')
    })

    it('shows Invalid Reset Link when no token is present', () => {
      renderResetPassword()
      expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument()
    })

    it('shows descriptive message for invalid link', () => {
      renderResetPassword()
      expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
    })

    it('shows link to request a new reset link', () => {
      renderResetPassword()
      const link = screen.getByRole('link', { name: /request a new password reset link/i })
      expect(link).toHaveAttribute('href', '/forgot-password')
    })
  })
})
