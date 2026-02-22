import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockNavigate = vi.fn()
const mockLogout = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockUser = { id: 1, name: 'Production User', email: 'production@test.com', userType: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

vi.mock('../../components/DashboardHeader', () => ({
  default: ({ title }: any) => <div data-testid="dashboard-header">{title}</div>,
}))

vi.mock('../../utils/navigation', () => ({
  getDashboardRoute: (userType: string) => `/production/dashboard`,
}))

vi.mock('../../components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}))

const mockToast = { success: vi.fn(), error: vi.fn(), loading: vi.fn() }
vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../production/settings/ProductionSettingsProfile')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSettingsProfile', () => {
  it('renders the page title', () => {
    renderComponent()
    expect(screen.getAllByText('Company Profile Settings').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Manage your production company's public profile and information")).toBeInTheDocument()
  })

  it('renders company information fields with default values', () => {
    renderComponent()
    const nameInput = screen.getByDisplayValue('Stellar Productions')
    expect(nameInput).toBeInTheDocument()
    expect(screen.getByDisplayValue('2015')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Los Angeles, CA')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://stellarproductions.com')).toBeInTheDocument()
  })

  it('renders contact information', () => {
    renderComponent()
    expect(screen.getByDisplayValue('contact@stellarproductions.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('+1 (555) 123-4567')).toBeInTheDocument()
    expect(screen.getByDisplayValue('BL-2015-LA-5678')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12-3456789')).toBeInTheDocument()
  })

  it('renders social media fields', () => {
    renderComponent()
    // @stellarproductions appears in both Twitter and Instagram fields
    expect(screen.getAllByDisplayValue('@stellarproductions').length).toBe(2)
    expect(screen.getByDisplayValue('linkedin.com/company/stellar-productions')).toBeInTheDocument()
  })

  it('renders Company Branding section', () => {
    renderComponent()
    expect(screen.getByText('Company Branding')).toBeInTheDocument()
    expect(screen.getByText('Upload your company logo and cover image')).toBeInTheDocument()
  })

  it('renders Save Changes and Cancel buttons', () => {
    renderComponent()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('navigates back on Cancel', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/dashboard')
  })

  it('renders section cards', () => {
    renderComponent()
    expect(screen.getByText('Company Information')).toBeInTheDocument()
    expect(screen.getByText('Contact Information')).toBeInTheDocument()
    expect(screen.getByText('Social Media')).toBeInTheDocument()
  })
})
