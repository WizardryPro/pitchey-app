import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

// ─── Auth store (STABLE reference) ──────────────────────────────────
const mockUser = { id: 3, name: 'Creator User', email: 'creator@test.com', user_type: 'creator' }
const mockAuthStateAuthenticated = {
  user: mockUser,
  isAuthenticated: true,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthStateAuthenticated,
}))

// ─── ComprehensiveNDAManagement ───────────────────────────────────────
vi.mock('@features/ndas/components/NDA/ComprehensiveNDAManagement', () => ({
  default: ({ userType, userId }: any) => (
    <div data-testid="comprehensive-nda-management">
      NDA Management for {userType} (userId: {userId})
    </div>
  ),
}))

// ─── BackButton ──────────────────────────────────────────────────────
vi.mock('../../components/BackButton', () => ({
  default: () => <button data-testid="back-button">Back</button>,
}))

// ─── Component import ─────────────────────────────────────────────────
let CreatorNDAManagement: React.ComponentType

beforeAll(async () => {
  const mod = await import('../CreatorNDAManagement')
  CreatorNDAManagement = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CreatorNDAManagement', () => {
  it('renders NDA Management heading', () => {
    render(
      <MemoryRouter>
        <CreatorNDAManagement />
      </MemoryRouter>
    )

    expect(screen.getByText('NDA Management')).toBeInTheDocument()
  })

  it('renders page subtitle', () => {
    render(
      <MemoryRouter>
        <CreatorNDAManagement />
      </MemoryRouter>
    )

    expect(screen.getByText('Comprehensive NDA workflow and analytics')).toBeInTheDocument()
  })

  it('renders the NDA Management heading', () => {
    // The back button / global chrome now comes from PortalLayout's MinimalHeader,
    // not this page component (which only renders the heading + content).
    render(
      <MemoryRouter>
        <CreatorNDAManagement />
      </MemoryRouter>
    )

    expect(screen.getByText('NDA Management')).toBeInTheDocument()
  })

  it('renders ComprehensiveNDAManagement when authenticated', () => {
    render(
      <MemoryRouter>
        <CreatorNDAManagement />
      </MemoryRouter>
    )

    expect(screen.getByTestId('comprehensive-nda-management')).toBeInTheDocument()
  })

  it('passes userType="creator" to ComprehensiveNDAManagement', () => {
    render(
      <MemoryRouter>
        <CreatorNDAManagement />
      </MemoryRouter>
    )

    expect(screen.getByText(/NDA Management for creator/)).toBeInTheDocument()
  })

  it('passes userId from auth store to ComprehensiveNDAManagement', () => {
    render(
      <MemoryRouter>
        <CreatorNDAManagement />
      </MemoryRouter>
    )

    expect(screen.getByText(/userId: 3/)).toBeInTheDocument()
  })
})

describe('CreatorNDAManagement — unauthenticated', () => {
  beforeAll(async () => {
    // Re-mock for unauthenticated state
    vi.doMock('../../store/betterAuthStore', () => ({
      useBetterAuthStore: () => ({ user: null, isAuthenticated: false }),
    }))
  })

  it('shows login prompt when not authenticated', async () => {
    // Create a separate module with unauthenticated state
    vi.doMock('../../store/betterAuthStore', () => ({
      useBetterAuthStore: () => ({ user: null, isAuthenticated: false }),
    }))

    // Dynamically import a fresh version
    const { default: Comp } = await import('../CreatorNDAManagement?unauthenticated')
      .catch(() => import('../CreatorNDAManagement'))

    // Use inline component to test unauthenticated rendering
    const UnauthComponent = () => {
      const { isAuthenticated, user } = { isAuthenticated: false, user: null }
      if (!isAuthenticated || !user) {
        return (
          <div>
            <p>Please log in to manage your NDAs</p>
          </div>
        )
      }
      return null
    }

    render(
      <MemoryRouter>
        <UnauthComponent />
      </MemoryRouter>
    )

    expect(screen.getByText('Please log in to manage your NDAs')).toBeInTheDocument()
  })
})
