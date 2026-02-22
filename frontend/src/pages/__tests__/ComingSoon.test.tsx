import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ─────────────────────────────────────────────────────
const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', user_type: 'creator', userType: 'creator' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn(),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Dynamic import ─────────────────────────────────────────────────
let ComingSoon: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ComingSoon')
  ComingSoon = mod.default
})

describe('ComingSoon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = (path = '/creator/advanced-analytics') =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<ComingSoon />} />
        </Routes>
      </MemoryRouter>
    )

  it('renders "Coming Soon" text', () => {
    renderComponent()
    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
  })

  it('renders page title based on URL pathname', () => {
    renderComponent('/creator/advanced-analytics')
    // Title appears in h1 and also as a feature card, so use getAllByText
    expect(screen.getAllByText('Advanced Analytics').length).toBeGreaterThan(0)
  })

  it('renders Go Back button', () => {
    renderComponent()
    expect(screen.getByText('Go Back')).toBeInTheDocument()
  })

  it('navigates back when Go Back button is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Go Back'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('renders feature cards', () => {
    // Use a path that doesn't conflict with feature card titles
    renderComponent('/creator/some-feature')
    // Feature card titles should appear
    expect(screen.getAllByText('Advanced Analytics').length).toBeGreaterThan(0)
    expect(screen.getByText('AI-Powered Tools')).toBeInTheDocument()
    expect(screen.getByText('Real-time Updates')).toBeInTheDocument()
  })

  it('renders "Get Notified" section', () => {
    renderComponent()
    expect(screen.getByText('Get Notified')).toBeInTheDocument()
    expect(screen.getByText(/Be the first to know/)).toBeInTheDocument()
  })

  it('renders email input field', () => {
    renderComponent()
    const emailInput = screen.getByPlaceholderText('Enter your email')
    expect(emailInput).toBeInTheDocument()
  })

  it('pre-fills email with user email from auth store', () => {
    renderComponent()
    const emailInput = screen.getByPlaceholderText('Enter your email') as HTMLInputElement
    expect(emailInput.value).toBe('test@test.com')
  })

  it('renders "Notify Me" button', () => {
    renderComponent()
    expect(screen.getByText('Notify Me')).toBeInTheDocument()
  })

  it('shows "Thank You!" message after subscribing', async () => {
    renderComponent()
    const emailInput = screen.getByPlaceholderText('Enter your email')
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } })

    const notifyButton = screen.getByText('Notify Me')
    fireEvent.click(notifyButton)

    await waitFor(() => {
      expect(screen.getByText('Thank You!')).toBeInTheDocument()
    })
  })

  it('shows confirmation message after subscribing', async () => {
    renderComponent()
    const emailInput = screen.getByPlaceholderText('Enter your email')
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByText('Notify Me'))

    await waitFor(() => {
      expect(screen.getByText(/We'll let you know/)).toBeInTheDocument()
    })
  })

  it('renders expected launch date', () => {
    renderComponent()
    expect(screen.getByText('Expected Launch')).toBeInTheDocument()
    expect(screen.getByText('Q1 2025')).toBeInTheDocument()
  })

  it('renders pitches description for creator user type', () => {
    renderComponent()
    expect(screen.getByText(/pitches/)).toBeInTheDocument()
  })
})
