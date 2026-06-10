import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
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

// ─── Auth store ─────────────────────────────────────────────────────
const mockUser = { id: 1, email: 'test@test.com', userType: 'creator', username: 'testuser' }
const mockAuthState: any = { user: mockUser, isAuthenticated: false, logout: vi.fn() }
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Content service ─────────────────────────────────────────────────
const mockGetHowItWorks = vi.fn()
const mockGetStats = vi.fn()

vi.mock('../../services/content.service', () => ({
  contentService: {
    getHowItWorks: mockGetHowItWorks,
    getStats: mockGetStats,
  },
}))

// ─── Dynamic import ─────────────────────────────────────────────────
let HowItWorks: React.ComponentType
beforeAll(async () => {
  const mod = await import('../HowItWorks')
  HowItWorks = mod.default
})

describe('HowItWorks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.isAuthenticated = false
    mockAuthState.user = mockUser
    // Default: API fails gracefully, local default content is used
    mockGetHowItWorks.mockResolvedValue({ success: false, error: 'API unavailable' })
    mockGetStats.mockResolvedValue({ success: false, error: 'API unavailable' })
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <HowItWorks />
      </MemoryRouter>
    )

  it('renders the cinematic hero heading', async () => {
    renderComponent()
    expect(screen.getByText('From a single page')).toBeInTheDocument()
    expect(screen.getByText('to the big screen')).toBeInTheDocument()
  })

  it('renders the "How It Works" nav link and Get Started CTA in header', () => {
    renderComponent()
    expect(screen.getByText('How It Works')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('defaults to the Creators track and shows its tagline + first step', () => {
    renderComponent()
    expect(screen.getByText('Turn a screenplay into your next production.')).toBeInTheDocument()
    expect(screen.getByText('Build your pitch')).toBeInTheDocument()
  })

  it('switches to the Investors track when its tab is clicked', async () => {
    renderComponent()
    // Investor content is not rendered until the tab is active
    expect(screen.queryByText('Browse curated pitches')).not.toBeInTheDocument()
    // The tab pill in the switcher (button, not the nav)
    fireEvent.click(screen.getByRole('button', { name: 'Investors' }))
    await waitFor(() => {
      expect(screen.getByText('Browse curated pitches')).toBeInTheDocument()
    })
  })

  it('switches to the Production track when its tab is clicked', async () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: 'Production' }))
    await waitFor(() => {
      expect(screen.getByText('Stand up your slate')).toBeInTheDocument()
    })
  })

  it('renders the features section with default features', () => {
    renderComponent()
    expect(screen.getByText('The infrastructure behind the deal')).toBeInTheDocument()
    expect(screen.getByText('AI-assisted pitching')).toBeInTheDocument()
    expect(screen.getByText('Heat Score discovery')).toBeInTheDocument()
  })

  it('renders the FAQ section with the first item open by default', () => {
    renderComponent()
    expect(screen.getByText('Good to know')).toBeInTheDocument()
    expect(screen.getByText('Who can join Pitchey?')).toBeInTheDocument()
    // First answer is expanded by default
    expect(screen.getByText(/Creators pitching original work/)).toBeInTheDocument()
  })

  it('toggles a FAQ item open on click', async () => {
    renderComponent()
    fireEvent.click(screen.getByText('What does it cost?'))
    await waitFor(() => {
      expect(screen.getByText(/Browsing and building a profile is free/)).toBeInTheDocument()
    })
  })

  it('renders the CTA section', () => {
    renderComponent()
    expect(screen.getByText('Ready when you are')).toBeInTheDocument()
    expect(screen.getByText('Create your account')).toBeInTheDocument()
  })

  it('renders footer with contact email', () => {
    renderComponent()
    expect(screen.getByText(/support@pitchey.com/)).toBeInTheDocument()
  })

  it('renders the Pitchey brand logo', () => {
    renderComponent()
    // Logotype image(s) (alt="Pitchey") — header + footer
    expect(screen.getAllByAltText('Pitchey').length).toBeGreaterThan(0)
  })

  it('merges API step content over the local defaults', async () => {
    mockGetHowItWorks.mockResolvedValue({
      success: true,
      data: {
        creatorSteps: [{ title: 'Custom Creator Step', description: 'From the CMS', icon: 'film' }],
      },
    })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Custom Creator Step')).toBeInTheDocument()
    })
  })

  it('renders real platform stats when the API returns non-zero data', async () => {
    mockGetStats.mockResolvedValue({
      success: true,
      data: { total_users: 1200, published_pitches: 340, total_pitches: 980, total_invested: 5_000_000 },
    })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Members')).toBeInTheDocument()
      expect(screen.getByText('1.2K')).toBeInTheDocument()
      expect(screen.getByText('$5M')).toBeInTheDocument()
    })
  })

  it('hides the stats strip when the API returns all-zero data', async () => {
    mockGetStats.mockResolvedValue({
      success: true,
      data: { total_users: 0, published_pitches: 0, total_pitches: 0, total_invested: 0 },
    })
    renderComponent()
    // Give the effect a tick to resolve
    await waitFor(() => expect(mockGetStats).toHaveBeenCalled())
    expect(screen.queryByText('Members')).not.toBeInTheDocument()
  })

  it('shows Dashboard instead of Sign In when authenticated', () => {
    mockAuthState.isAuthenticated = true
    renderComponent()
    const header = screen.getByRole('banner')
    expect(within(header).getByText('Dashboard')).toBeInTheDocument()
  })
})
