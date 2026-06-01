import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockFetch = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── config (API_URL) ───────────────────────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
  config: {
    API_URL: 'http://localhost:8787',
    WS_URL: 'ws://localhost:8787',
    IS_DEVELOPMENT: true,
    IS_PRODUCTION: false,
    MODE: 'test',
    NODE_ENV: 'test',
    WEBSOCKET_ENABLED: false,
  },
  default: {
    API_URL: 'http://localhost:8787',
    WS_URL: 'ws://localhost:8787',
  },
}))

// ─── saved-pitches service (Saved tab) ──────────────────────────────
vi.mock('@features/pitches/services/saved-pitches.service', () => ({
  SavedPitchesService: { getSavedPitches: vi.fn() },
}))
import { SavedPitchesService } from '@features/pitches/services/saved-pitches.service'

// ─── Dynamic import ─────────────────────────────────────────────────
let Following: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Following')
  Following = mod.default
})

// ─── Helpers ─────────────────────────────────────────────────────────
const makeSuccessResponse = (data: any) => ({
  ok: true,
  json: () => Promise.resolve({ success: true, ...data }),
})

const makeErrorResponse = () => ({
  ok: false,
  json: () => Promise.resolve({ success: false, error: 'Failed to load data' }),
})

describe('Following', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('userType', 'investor')
    // Replace global fetch with mock
    global.fetch = mockFetch
    mockFetch.mockResolvedValue(makeSuccessResponse({
      activities: [],
      summary: { newPitches: 0, activeCreators: 0, engagementRate: 0 }
    }))
    ;(SavedPitchesService.getSavedPitches as any).mockResolvedValue({ savedPitches: [], total: 0 })
  })

  afterEach(() => {
    // Only restore spies, not direct assignments
    vi.clearAllMocks()
  })

  const renderComponent = (initialEntries: string[] = ['/following']) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Following />
      </MemoryRouter>
    )

  it('shows loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    renderComponent()
    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders Following page header after loading', async () => {
    renderComponent()
    await waitFor(() => {
      // "Following" appears in both the h1 and the tab button - use getAllByText
      expect(screen.getAllByText('Following').length).toBeGreaterThan(0)
    })
  })

  it('renders Activity Feed tab', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Activity Feed')).toBeInTheDocument()
    })
  })

  it('renders Followers and Following tabs', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Followers')).toBeInTheDocument()
      expect(screen.getAllByText('Following').length).toBeGreaterThan(0)
    })
  })

  it('shows empty activity state when no activities', async () => {
    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('No recent activity from followed creators')).toBeInTheDocument()
    })
  })

  it('renders "Browse Marketplace" link in empty activity state', async () => {
    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('Browse Marketplace →')).toBeInTheDocument()
    })
  })

  it('navigates to marketplace from empty activity state', async () => {
    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('Browse Marketplace →')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Browse Marketplace →'))
    expect(mockNavigate).toHaveBeenCalledWith('/marketplace')
  })

  it('renders activity summary section with stats', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse({
      activities: [],
      summary: { newPitches: 5, activeCreators: 3, engagementRate: 42 }
    }))

    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('Activity Summary')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('42%')).toBeInTheDocument()
    })
  })

  it('renders stat labels in activity summary', async () => {
    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('New Pitches')).toBeInTheDocument()
      expect(screen.getByText('Active Creators')).toBeInTheDocument()
      expect(screen.getByText('Engagement Rate')).toBeInTheDocument()
    })
  })

  it('renders timeframe selector dropdown', async () => {
    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    })
  })

  it('shows activity items when activities exist', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse({
      pitches: [{
        id: 5,
        title: 'Epic Adventure',
        genre: 'Action',
        logline: 'A hero rises',
        user_id: 10,
        creator_name: 'creator1',
        createdAt: '2025-01-15T10:00:00Z',
      }],
      summary: { newPitches: 1, activeCreators: 1, engagementRate: 0 }
    }))

    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('creator1')).toBeInTheDocument()
      expect(screen.getByText('Epic Adventure')).toBeInTheDocument()
    })
  })

  it('shows empty followers state on default tab', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse({ followers: [], data: [] }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText("You don't have any followers yet")).toBeInTheDocument()
    })
  })

  it('shows empty following state when Following tab is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce(makeSuccessResponse({
        activities: [],
        summary: { newPitches: 0, activeCreators: 0, engagementRate: 0 }
      }))
      .mockResolvedValueOnce(makeSuccessResponse({ following: [], data: [] }))

    renderComponent()
    await waitFor(() => {
      // Wait for the tab button to appear (not the h1)
      expect(screen.getAllByText('Following').length).toBeGreaterThan(0)
    })

    // Click the Following tab (last occurrence is the tab button)
    const tabs = screen.getAllByText('Following')
    fireEvent.click(tabs[tabs.length - 1])

    await waitFor(() => {
      expect(screen.getByText("You're not following anyone yet")).toBeInTheDocument()
    })
  })

  it('shows "Discover Creators" button in empty following state', async () => {
    mockFetch
      .mockResolvedValueOnce(makeSuccessResponse({
        activities: [],
        summary: { newPitches: 0, activeCreators: 0, engagementRate: 0 }
      }))
      .mockResolvedValueOnce(makeSuccessResponse({ following: [], data: [] }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getAllByText('Following').length).toBeGreaterThan(0)
    })

    const tabs = screen.getAllByText('Following')
    fireEvent.click(tabs[tabs.length - 1])

    await waitFor(() => {
      expect(screen.getByText('Discover Creators')).toBeInTheDocument()
    })
  })

  it('shows error banner when API call fails', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse())
    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      // When ok=false, component throws "Failed to fetch following data" which shows in error div
      expect(screen.getByText('Failed to fetch following data')).toBeInTheDocument()
    })
  })

  it('renders active creators count in header', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse({
      activities: [],
      summary: { newPitches: 0, activeCreators: 7, engagementRate: 0 }
    }))

    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      // The text may be split across text nodes in the span
      // Use getByText with a function matcher
      const span = screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && content.includes('active creators')
      })
      expect(span).toBeInTheDocument()
    })
  })

  // ─── Phase 2: unified activity feed + Saved tab ───────────────────

  it('renders activity items from the unified activity_feed', async () => {
    // First fetch (/api/activity/feed) returns events → no fallback needed.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          items: [{
            id: 99,
            action: 'pitch_published',
            createdAt: '2025-02-01T00:00:00Z',
            actor: { id: 7, name: 'Jane Director', username: 'jane', userType: 'creator', profileImage: null },
            pitch: { id: 42, title: 'Neon Skies', genre: 'Sci-Fi', logline: 'The grid awakens', requireNda: false },
          }],
        },
      }),
    })

    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('Neon Skies')).toBeInTheDocument()
      expect(screen.getByText('Jane Director')).toBeInTheDocument()
    })
  })

  it('falls back to followed-creator pitches when the feed is empty', async () => {
    // Feed empty (no items) → component fetches /api/pitches/following.
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: { items: [] } }) })
      .mockResolvedValueOnce(makeSuccessResponse({
        pitches: [{ id: 5, title: 'Fallback Film', genre: 'Action', logline: 'A hero rises', user_id: 10, creator_name: 'creator1' }],
      }))

    renderComponent(['/following?tab=activity'])
    await waitFor(() => {
      expect(screen.getByText('Fallback Film')).toBeInTheDocument()
    })
  })

  it('renders the Saved tab', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })
  })

  it('renders saved pitches in the Saved tab', async () => {
    ;(SavedPitchesService.getSavedPitches as any).mockResolvedValue({
      savedPitches: [{ id: 1, pitchId: 42, savedAt: '2025-01-01T00:00:00Z', pitch: { id: 42, title: 'Saved Film', genre: 'Drama', logline: 'A quiet story' } }],
      total: 1,
    })

    renderComponent(['/following?tab=saved'])
    await waitFor(() => {
      expect(screen.getByText('Saved Film')).toBeInTheDocument()
    })
  })

  it('shows empty saved state when nothing is saved', async () => {
    ;(SavedPitchesService.getSavedPitches as any).mockResolvedValue({ savedPitches: [], total: 0 })

    renderComponent(['/following?tab=saved'])
    await waitFor(() => {
      expect(screen.getByText("You haven't saved any pitches yet")).toBeInTheDocument()
    })
  })
})
