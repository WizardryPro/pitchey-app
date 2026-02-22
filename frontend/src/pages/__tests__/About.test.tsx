import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ───────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetAbout = vi.fn()
const mockGetTeam = vi.fn()

// ─── react-router-dom ─────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── contentService ────────────────────────────────────────────────────
vi.mock('../../services/content.service', () => ({
  contentService: {
    getAbout: mockGetAbout,
    getTeam: mockGetTeam,
  },
}))

// ─── Logo component ─────────────────────────────────────────────────────
vi.mock('../../components/Logo', () => ({
  default: ({ onClick }: any) => (
    <div data-testid="logo" onClick={onClick} role="button">
      Pitchey
    </div>
  ),
}))

// ─── Component ─────────────────────────────────────────────────────────
let About: React.ComponentType
beforeAll(async () => {
  const mod = await import('../About')
  About = mod.default
})

function renderAbout() {
  return render(
    <MemoryRouter>
      <About />
    </MemoryRouter>
  )
}

describe('About', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: API returns no content — uses fallback
    mockGetAbout.mockResolvedValue({ success: false, data: null })
    mockGetTeam.mockResolvedValue({ success: false, data: null })
  })

  it('shows loading state initially', () => {
    mockGetAbout.mockReturnValue(new Promise(() => {})) // never resolves
    mockGetTeam.mockReturnValue(new Promise(() => {}))
    renderAbout()
    expect(screen.getByText('Loading content...')).toBeInTheDocument()
  })

  it('renders fallback title when API returns nothing', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByText('About Pitchey')).toBeInTheDocument()
    })
  })

  it('renders fallback opening paragraph', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByText(/Pitchey was born out of frustration/)).toBeInTheDocument()
    })
  })

  it('renders fallback author attribution', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByText(/Karl King, Founder/)).toBeInTheDocument()
    })
  })

  it('renders fallback content paragraphs', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByText(/As a producer/)).toBeInTheDocument()
    })
  })

  it("renders That's Pitchey paragraph", async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByText("That's Pitchey.")).toBeInTheDocument()
    })
  })

  it('renders Get Started button', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument()
    })
  })

  it('renders How It Works button', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'How It Works' })).toBeInTheDocument()
    })
  })

  it('renders Back button in header', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    })
  })

  it('renders logo', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByTestId('logo')).toBeInTheDocument()
    })
  })

  it('renders API content when API returns valid data', async () => {
    mockGetAbout.mockResolvedValue({
      success: true,
      data: {
        title: 'About Our Platform',
        story: [
          { type: 'highlight', text: 'We started with a dream.' },
          { type: 'paragraph', text: 'And built something great.' },
        ],
        founder: { name: 'John Doe', title: 'CEO' },
      },
    })
    renderAbout()
    // The component merges API data with fallback — title from API takes precedence
    await waitFor(() => {
      expect(screen.getByText('About Our Platform')).toBeInTheDocument()
    })
    // Story text from API is displayed
    expect(screen.getAllByText('We started with a dream.').length).toBeGreaterThan(0)
  })

  it('renders team section when team data is returned', async () => {
    mockGetTeam.mockResolvedValue({
      success: true,
      data: [
        { name: 'Alice Smith', role: 'CTO', bio: 'Leads engineering.' },
        { name: 'Bob Jones', role: 'Designer', bio: 'Builds beautiful things.' },
      ],
    })
    renderAbout()
    await waitFor(() => {
      expect(screen.getByText('Our Team')).toBeInTheDocument()
    })
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('CTO')).toBeInTheDocument()
  })

  it('shows cached content error banner when API throws', async () => {
    mockGetAbout.mockRejectedValue(new Error('Network error'))
    mockGetTeam.mockRejectedValue(new Error('Network error'))
    renderAbout()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load latest content/i)).toBeInTheDocument()
    })
    // Still shows fallback content
    expect(screen.getByText('About Pitchey')).toBeInTheDocument()
  })

  it('navigates home when Get Started is clicked', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument()
    })
    screen.getByRole('button', { name: 'Get Started' }).click()
    expect(mockNavigate).toHaveBeenCalledWith('/portals')
  })

  it('navigates to how-it-works when How It Works is clicked', async () => {
    renderAbout()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'How It Works' })).toBeInTheDocument()
    })
    screen.getByRole('button', { name: 'How It Works' }).click()
    expect(mockNavigate).toHaveBeenCalledWith('/how-it-works')
  })
})
