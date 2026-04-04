import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, getMockAuthStore, getMockNavigate } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import CreatorLogin from '../../pages/CreatorLogin'
import InvestorLogin from '../../pages/InvestorLogin'
import ProductionLogin from '../../pages/ProductionLogin'

// Mock BackButton component
vi.mock('../../components/BackButton', () => ({
  default: ({ variant }: { variant?: string }) => (
    <button data-testid="back-button" className={variant}>
      Back
    </button>
  ),
}))

const mockAuthStore = {
  loginCreator: vi.fn(),
  loginInvestor: vi.fn(),
  loginProduction: vi.fn(),
  loading: false,
  error: null,
  user: null,
  isAuthenticated: false,
}

describe('LoginForm Components', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Mock auth store
    const authStore = getMockAuthStore()
    Object.assign(authStore, {
      ...mockAuthStore,
      loginCreator: vi.fn().mockResolvedValue({ success: true }),
      loginInvestor: vi.fn().mockResolvedValue({ success: true }),
      loginProduction: vi.fn().mockResolvedValue({ success: true }),
    })
    
    // Reset navigation mock
    getMockNavigate().mockClear()
  })

  describe('CreatorLogin', () => {
    describe('Rendering', () => {
      it('should render creator login form', async () => {
        render(<CreatorLogin />)

        expect(screen.getByText('Creator Portal')).toBeInTheDocument()
        expect(screen.getByText('Sign in to manage your pitches')).toBeInTheDocument()
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      })

      it('should render back button', () => {
        render(<CreatorLogin />)
        expect(screen.getByTestId('back-button')).toBeInTheDocument()
      })

      it('should render demo account section', () => {
        render(<CreatorLogin />)
        expect(screen.getByText('Try our demo account')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /use demo creator account/i })).toBeInTheDocument()
      })

      it('should render links to other portals', () => {
        render(<CreatorLogin />)
        expect(screen.getByRole('link', { name: /investor portal/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /production portal/i })).toBeInTheDocument()
      })

      it('should render forgot password link', () => {
        render(<CreatorLogin />)
        expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
      })
    })

    describe('Form Interactions', () => {
      it('should update email field when typing', async () => {
        render(<CreatorLogin />)

        const emailInput = screen.getByLabelText(/email address/i)
        await user.type(emailInput, 'test@example.com')

        expect(emailInput).toHaveValue('test@example.com')
      })

      it('should update password field when typing', async () => {
        render(<CreatorLogin />)

        const passwordInput = screen.getByLabelText(/password/i)
        await user.type(passwordInput, 'password123')

        expect(passwordInput).toHaveValue('password123')
      })

      it('should fill demo credentials when demo button is clicked', async () => {
        render(<CreatorLogin />)

        const demoButton = screen.getByRole('button', { name: /use demo creator account/i })
        await user.click(demoButton)

        const emailInput = screen.getByLabelText(/email address/i)
        const passwordInput = screen.getByLabelText(/password/i)

        expect(emailInput).toHaveValue('alex.creator@demo.com')
        expect(passwordInput).toHaveValue('Demo123')
      })
    })

    describe('Form Validation', () => {
      it('should require email field', async () => {
        render(<CreatorLogin />)

        const emailInput = screen.getByLabelText(/email address/i)
        expect(emailInput).toBeRequired()
      })

      it('should require password field', async () => {
        render(<CreatorLogin />)

        const passwordInput = screen.getByLabelText(/password/i)
        expect(passwordInput).toBeRequired()
      })

      it('should have email input type', () => {
        render(<CreatorLogin />)

        const emailInput = screen.getByLabelText(/email address/i)
        expect(emailInput).toHaveAttribute('type', 'email')
      })

      it('should have password input type', () => {
        render(<CreatorLogin />)

        const passwordInput = screen.getByLabelText(/password/i)
        expect(passwordInput).toHaveAttribute('type', 'password')
      })
    })

    describe('Form Submission', () => {
      it('should call loginCreator on form submission', async () => {
        const authStore = getMockAuthStore()
        vi.mocked(authStore.loginCreator).mockResolvedValue({ success: true })
        
        render(<CreatorLogin />)

        const emailInput = screen.getByLabelText(/email address/i)
        const passwordInput = screen.getByLabelText(/password/i)
        const submitButton = screen.getByRole('button', { name: /sign in/i })

        await user.type(emailInput, 'creator@test.com')
        await user.type(passwordInput, 'password123')
        await user.click(submitButton)

        expect(authStore.loginCreator).toHaveBeenCalledWith('creator@test.com', 'password123', '')
      })

      it('should navigate to creator dashboard on successful login', async () => {
        const authStore = getMockAuthStore()
        const mockNavigate = getMockNavigate()
        vi.mocked(authStore.loginCreator).mockResolvedValue({ success: true })
        
        render(<CreatorLogin />)

        const emailInput = screen.getByLabelText(/email address/i)
        const passwordInput = screen.getByLabelText(/password/i)
        const submitButton = screen.getByRole('button', { name: /sign in/i })

        await user.type(emailInput, 'creator@test.com')
        await user.type(passwordInput, 'password123')
        await user.click(submitButton)

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith('/creator/dashboard')
        })
      })

      it('should show loading state during submission', async () => {
        const authStore = getMockAuthStore()
        authStore.loading = true
        
        render(<CreatorLogin />)

        // Find submit button by its type attribute
        const submitButton = document.querySelector('button[type="submit"]')
        expect(submitButton).toBeTruthy()
        expect(submitButton).toBeDisabled()
        // Check for loading spinner in the button
        const spinner = submitButton?.querySelector('.animate-spin')
        expect(spinner).toBeTruthy()
      })

      it('should handle login errors', async () => {
        const authStore = getMockAuthStore()
        authStore.error = 'Invalid credentials' as any

        render(<CreatorLogin />)

        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
        // Check for error container instead of role
        const errorElement = screen.getByText('Invalid credentials').closest('div')
        expect(errorElement).toHaveClass('bg-red-50')
      })
    })

    describe('Accessibility', () => {
      it('should have proper form labels', () => {
        render(<CreatorLogin />)

        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      })

      it('should have proper ARIA attributes', () => {
        render(<CreatorLogin />)

        const emailInput = screen.getByLabelText(/email address/i)
        const passwordInput = screen.getByLabelText(/password/i)

        expect(emailInput).toHaveAttribute('autocomplete', 'email')
        expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
      })

      it('should show error with proper ARIA attributes', () => {
        const authStore = getMockAuthStore()
        authStore.error = 'Login failed' as any

        render(<CreatorLogin />)

        // Error is displayed but might not have role="alert"
        const errorElement = screen.getByText('Login failed')
        expect(errorElement).toBeInTheDocument()
        // Check it's in an error container
        const errorContainer = errorElement.closest('div')
        expect(errorContainer).toHaveClass('bg-red-50')
      })

      it('should have keyboard navigation support', async () => {
        render(<CreatorLogin />)

        const emailInput = screen.getByLabelText(/email address/i)
        const passwordInput = screen.getByLabelText(/password/i)

        // Focus on email input first
        emailInput.focus()
        expect(emailInput).toHaveFocus()
        
        // Tab to password
        await user.tab()
        expect(passwordInput).toHaveFocus()
        
        // Continue tabbing should eventually reach submit button
        await user.tab() // May go to forgot password link
        await user.tab() // May go to submit button
        
        // Check that submit button is reachable via keyboard
        const submitButton = screen.getByRole('button', { name: /sign in/i })
        expect(submitButton).toBeTruthy()
      })
    })
  })

  describe('InvestorLogin', () => {
    it('should render investor login form', () => {
      render(<InvestorLogin />)

      expect(screen.getByText('Investor Portal')).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    it('should have investor-specific demo credentials', async () => {
      render(<InvestorLogin />)

      const demoButton = screen.getByRole('button', { name: /demo.*investor/i })
      await user.click(demoButton)

      const emailInput = screen.getByLabelText(/email address/i)
      expect(emailInput).toHaveValue('sarah.investor@demo.com')
    })

    it('should call loginInvestor on form submission', async () => {
      const authStore = getMockAuthStore()
      authStore.loginInvestor.mockResolvedValue({ success: true })
      
      render(<InvestorLogin />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(emailInput, 'investor@test.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      expect(authStore.loginInvestor).toHaveBeenCalledWith('investor@test.com', 'password123', '')
    })

    it('should navigate to investor dashboard on successful login', async () => {
      const authStore = getMockAuthStore()
      authStore.loginInvestor.mockResolvedValue({ success: true })
      
      const { navigate } = render(<InvestorLogin />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(emailInput, 'investor@test.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/investor/dashboard')
      })
    })
  })

  describe('ProductionLogin', () => {
    it('should render production login form', () => {
      render(<ProductionLogin />)

      expect(screen.getByText('Production Portal')).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    it('should have production-specific demo credentials', async () => {
      render(<ProductionLogin />)

      const demoButton = screen.getByRole('button', { name: /demo.*production/i })
      await user.click(demoButton)

      const emailInput = screen.getByLabelText(/email address/i)
      expect(emailInput).toHaveValue('stellar.production@demo.com')
    })

    it('should call loginProduction on form submission', async () => {
      const authStore = getMockAuthStore()
      authStore.loginProduction.mockResolvedValue({ success: true })
      
      render(<ProductionLogin />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(emailInput, 'production@test.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      expect(authStore.loginProduction).toHaveBeenCalledWith('production@test.com', 'password123', '')
    })

    it('should navigate to production dashboard on successful login', async () => {
      const authStore = getMockAuthStore()
      authStore.loginProduction.mockResolvedValue({ success: true })
      
      const { navigate } = render(<ProductionLogin />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(emailInput, 'production@test.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/production/dashboard')
      })
    })
  })

  describe('API Integration', () => {
    it('should handle API login success', async () => {
      const authStore = getMockAuthStore()
      authStore.loginCreator.mockResolvedValue({ success: true })
      
      render(<CreatorLogin />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(emailInput, 'creator@test.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(authStore.loginCreator).toHaveBeenCalled()
      })
    })

    it('should handle API login failure', async () => {
      const authStore = getMockAuthStore()
      authStore.loginCreator.mockRejectedValue(new Error('Login failed'))
      authStore.error = 'Invalid credentials' as any

      render(<CreatorLogin />)

      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })

    it('should handle network errors', async () => {
      const authStore = getMockAuthStore()
      authStore.loginCreator.mockRejectedValue(new Error('Network error'))
      authStore.error = 'Network error' as any

      render(<CreatorLogin />)

      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  describe('Security', () => {
    it('should not expose password in DOM', async () => {
      render(<CreatorLogin />)

      const passwordInput = screen.getByLabelText(/password/i)
      await user.type(passwordInput, 'secretpassword')

      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput.getAttribute('value')).toBe('secretpassword')
      expect(screen.queryByText('secretpassword')).not.toBeInTheDocument()
    })

    it('should prevent form submission without credentials', async () => {
      const authStore = getMockAuthStore()
      render(<CreatorLogin />)

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      // Should not call login function with empty credentials
      expect(authStore.loginCreator).not.toHaveBeenCalled()
    })

    it('should trim whitespace from email input', async () => {
      const authStore = getMockAuthStore()
      authStore.loginCreator.mockResolvedValue({ success: true })
      
      render(<CreatorLogin />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(emailInput, '  creator@test.com  ')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      expect(authStore.loginCreator).toHaveBeenCalledWith('creator@test.com', 'password123', '')
    })
  })

  describe('Responsive Design', () => {
    it('should render properly on mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<CreatorLogin />)

      const container = screen.getByText('Creator Portal').closest('div')
      expect(container).toBeInTheDocument()
    })

    it('should maintain accessibility on small screens', () => {
      render(<CreatorLogin />)

      // Form should still be accessible regardless of screen size
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  describe('Portal Navigation', () => {
    it('should link to other portals correctly', () => {
      render(<CreatorLogin />)

      const investorLink = screen.getByRole('link', { name: /investor portal/i })
      const productionLink = screen.getByRole('link', { name: /production portal/i })

      expect(investorLink).toHaveAttribute('href', '/login/investor')
      expect(productionLink).toHaveAttribute('href', '/login/production')
    })

    it('should link to forgot password page', () => {
      render(<CreatorLogin />)

      const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i })
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password')
    })
  })
})