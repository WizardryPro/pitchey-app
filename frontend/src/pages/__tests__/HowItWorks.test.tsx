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
    // Default: API fails gracefully, fallback content is used
    mockGetHowItWorks.mockResolvedValue({ success: false, error: 'API unavailable' })
    mockGetStats.mockResolvedValue({ success: false, error: 'API unavailable' })
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <HowItWorks />
      </MemoryRouter>
    )

  it('shows loading state initially', () => {
    let resolve: any
    mockGetHowItWorks.mockReturnValue(new Promise(r => { resolve = r }))
    renderComponent()
    expect(screen.getByText('Loading content...')).toBeInTheDocument()
    resolve({ success: false })
  })

  it('renders "How It Works" heading after loading', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('How It Works')).toBeInTheDocument()
    })
  })

  it('renders hero title from fallback content', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Transform Your Ideas Into Reality')).toBeInTheDocument()
    })
  })

  it('renders "For Creators" section heading', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('For Creators')).toBeInTheDocument()
    })
  })

  it('renders "For Investors" section heading', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('For Investors')).toBeInTheDocument()
    })
  })

  it('renders "Why Choose Pitchey?" section', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Why Choose Pitchey?')).toBeInTheDocument()
    })
  })

  it('renders creator steps from fallback content', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Create Your Pitch')).toBeInTheDocument()
      expect(screen.getByText('Protect Your Work')).toBeInTheDocument()
      expect(screen.getByText('Connect with Investors')).toBeInTheDocument()
      expect(screen.getByText('Secure Funding')).toBeInTheDocument()
    })
  })

  it('renders investor steps from fallback content', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Browse Curated Content')).toBeInTheDocument()
      expect(screen.getByText('Review Under NDA')).toBeInTheDocument()
      expect(screen.getByText('Track Performance')).toBeInTheDocument()
      expect(screen.getByText('Close Deals')).toBeInTheDocument()
    })
  })

  it('renders key features from fallback content', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('AI-Powered Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Secure Platform')).toBeInTheDocument()
      expect(screen.getByText('Quality Control')).toBeInTheDocument()
      expect(screen.getByText('Direct Communication')).toBeInTheDocument()
    })
  })

  it('renders Get Started button in header', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument()
    })
  })

  it('renders CTA section', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText("Ready to Start Your Journey?")).toBeInTheDocument()
    })
  })

  it('renders Create Account and Explore Marketplace buttons', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Create Account')).toBeInTheDocument()
      expect(screen.getByText('Explore Marketplace')).toBeInTheDocument()
    })
  })

  it('renders Start Your Journey button', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Start Your Journey')).toBeInTheDocument()
    })
  })

  it('renders Browse Marketplace button in hero', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getAllByText('Browse Marketplace').length).toBeGreaterThan(0)
    })
  })

  it('renders footer with contact email', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText(/support@pitchey.com/)).toBeInTheDocument()
    })
  })

  it('shows error banner when API fails but still shows fallback content', async () => {
    mockGetHowItWorks.mockRejectedValue(new Error('Network error'))
    mockGetStats.mockRejectedValue(new Error('Network error'))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Transform Your Ideas Into Reality')).toBeInTheDocument()
    })
    // Should still show the error warning
    expect(screen.getByText(/Failed to load latest content/)).toBeInTheDocument()
  })

  it('uses API content when API call succeeds', async () => {
    mockGetHowItWorks.mockResolvedValue({
      success: true,
      data: {
        hero: { title: 'API Hero Title', subtitle: 'API subtitle' },
        creatorSteps: [],
        investorSteps: [],
        features: [],
      }
    })
    mockGetStats.mockResolvedValue({ success: false })

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('API Hero Title')).toBeInTheDocument()
    })
  })

  it('renders Pitchey brand in header', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Pitchey')).toBeInTheDocument()
    })
  })
})
