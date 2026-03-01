import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
const mockNavigate = vi.fn()
const mockFetch = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '42' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', user_type: 'production' }
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({ user: mockUser, isAuthenticated: true }),
}))

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
  config: { API_URL: 'http://localhost:8787' },
  getApiUrl: () => 'http://localhost:8787',
}))

vi.mock('../../components/PitchMediaGallery', () => ({
  default: () => <div data-testid="media-gallery">Media Gallery</div>,
}))

vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format, formatSubtype }: any) => (
    <span data-testid="format-display">{formatSubtype || format || 'Unknown'}</span>
  ),
}))

// ─── Mock data ───────────────────────────────────────────────────────────────
const mockPitchResponse = {
  data: {
    id: 42,
    title: 'The Great Adventure',
    logline: 'A hero on a journey',
    genre: 'Action',
    format: 'Feature Film',
    format_category: 'Film',
    format_subtype: 'Feature',
    short_synopsis: 'Short synopsis text',
    long_synopsis: 'Long synopsis text',
    budget: '$10M - $20M',
    budget_range: '$10M - $20M',
    view_count: 1500,
    like_count: 200,
    nda_count: 15,
    followers_count: 80,
    status: 'published',
    created_at: '2026-01-01T00:00:00Z',
    characters: [{ name: 'Hero', description: 'The main character' }],
    themes: ['Adventure', 'Courage'],
  },
}

// ─── Component import ────────────────────────────────────────────────────────
let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ProductionPitchDetail')
  Component = mod.default
})

describe('ProductionPitchDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<MemoryRouter><Component /></MemoryRouter>)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('calls GET /api/pitches/public/:id with credentials', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPitchResponse),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pitches/public/42'),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  it('renders pitch title after loading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPitchResponse),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument()
    })
  })

  it('renders stats bar with correct counts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPitchResponse),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('1500')).toBeInTheDocument()
    })
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('Total Views')).toBeInTheDocument()
    expect(screen.getByText('Likes')).toBeInTheDocument()
    expect(screen.getByText('NDAs Signed')).toBeInTheDocument()
  })

  it('renders tab buttons', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPitchResponse),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })
    expect(screen.getByText(/Media & Documents/)).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Engagement')).toBeInTheDocument()
  })

  it('shows not-found state when API returns error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({}),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Pitch Not Found')).toBeInTheDocument()
    })
    expect(screen.getByText("The pitch you're looking for doesn't exist.")).toBeInTheDocument()
  })

  it('maps snake_case API fields correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPitchResponse),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('A hero on a journey')).toBeInTheDocument()
    })
    // Budget from snake_case response
    expect(screen.getByText('$10M - $20M')).toBeInTheDocument()
    // Genre from response
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  it('renders characters when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPitchResponse),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Main Characters')).toBeInTheDocument()
    })
    expect(screen.getByText('Hero')).toBeInTheDocument()
    expect(screen.getByText('The main character')).toBeInTheDocument()
  })

  it('renders themes when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPitchResponse),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Themes')).toBeInTheDocument()
    })
    expect(screen.getByText('Adventure')).toBeInTheDocument()
    expect(screen.getByText('Courage')).toBeInTheDocument()
  })

  it('navigates back to dashboard via back button', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPitchResponse),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument()
    })

    // Click the back arrow button in the header
    const header = screen.getByText('The Great Adventure').closest('header')
    const backButton = header?.querySelector('button')
    if (backButton) {
      fireEvent.click(backButton)
      expect(mockNavigate).toHaveBeenCalledWith('/production/dashboard')
    }
  })
})
