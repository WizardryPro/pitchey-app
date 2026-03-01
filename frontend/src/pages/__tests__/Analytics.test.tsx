import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import Analytics from '../Analytics'

// Mock config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8001',
  config: { apiUrl: 'http://localhost:8001' },
}))

// Mock AnalyticsService
const mockExportAnalytics = vi.fn()
vi.mock('../../services/analytics.service', () => ({
  AnalyticsService: {
    exportAnalytics: (...args: any[]) => mockExportAnalytics(...args),
  },
}))

const mockAnalyticsData = {
  data: {
    overview: {
      totalViews: 1500,
      totalLikes: 300,
      totalComments: 45,
      totalDownloads: 12,
      viewsThisMonth: 200,
      likesThisMonth: 40,
    },
    pitchPerformance: [
      { id: 1, title: 'Top Pitch', views: 800, likes: 150, comments: 20, conversionRate: 12 },
    ],
  },
}

const mockUserData = {
  data: {
    audienceInsights: {
      topGenres: [{ genre: 'Drama', percentage: 40 }],
      userTypes: [{ type: 'investor', count: 25 }],
      topRegions: [{ region: 'North America', count: 100 }],
    },
  },
}

/** Set up localStorage mock to return authToken so fetchAnalytics runs (not quickLogin) */
const setupLocalStorage = () => {
  vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
    if (key === 'authToken') return 'test-token'
    return null
  })
}

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupLocalStorage()
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading spinner initially', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<Analytics />)

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // ─── Empty / No Data State ────────────────────────────────────────

  it('shows empty state when no analytics data is available', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('No analytics data available yet')).toBeInTheDocument()
    })
    expect(screen.getByText('Start creating pitches to see your analytics')).toBeInTheDocument()
  })

  // ─── Successful Data Display ──────────────────────────────────────

  it('displays analytics overview cards when data loads', async () => {
    // fetchAnalytics fires Promise.all([fetch(dashboard), fetch(users)])
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalyticsData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserData,
      } as Response)

    render(<Analytics />)

    await waitFor(() => {
      // "Total Views" appears in both overview card and period summary, so use getAllByText
      expect(screen.getAllByText('Total Views').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Total Likes').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Comments')).toBeInTheDocument()
    expect(screen.getByText('Downloads')).toBeInTheDocument()
  })

  it('displays pitch performance and audience insights sections', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalyticsData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserData,
      } as Response)

    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('Top Performing Pitches')).toBeInTheDocument()
    })
    expect(screen.getByText('Audience Insights')).toBeInTheDocument()
    expect(screen.getByText('Top Pitch')).toBeInTheDocument()
  })

  // ─── Export Functionality ─────────────────────────────────────────

  it('calls exportAnalytics when Export Report button is clicked', async () => {
    const mockBlob = new Blob(['csv-data'], { type: 'text/csv' })
    mockExportAnalytics.mockResolvedValue(mockBlob)

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const mockRevokeObjectURL = vi.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalyticsData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserData,
      } as Response)

    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('Export Report')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Export Report'))

    await waitFor(() => {
      expect(mockExportAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'csv' })
      )
    })
  })

  // ─── Time Range Selector ──────────────────────────────────────────

  it('renders time range selector with options', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalyticsData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserData,
      } as Response)

    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('Track your pitch performance and audience insights')).toBeInTheDocument()
    })

    // The select should have time range options
    const select = screen.getByDisplayValue('Last 30 days')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    expect(screen.getByText('Last 3 months')).toBeInTheDocument()
    expect(screen.getByText('Last year')).toBeInTheDocument()
  })

  // ─── URL Assertion Tests ──────────────────────────────────────────────────

  it('calls GET /api/analytics/dashboard with preset param', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalyticsData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserData,
      } as Response)

    render(<Analytics />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/dashboard?preset='),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  it('calls GET /api/analytics/user (not /users) with preset param', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalyticsData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserData,
      } as Response)

    render(<Analytics />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/user?preset='),
        expect.objectContaining({ credentials: 'include' })
      )
    })

    // Ensure the wrong URL is NOT called
    const calls = vi.mocked(global.fetch).mock.calls.map(c => c[0])
    const hasWrongUrl = calls.some(url =>
      typeof url === 'string' && url.includes('/api/analytics/users')
    )
    expect(hasWrongUrl).toBe(false)
  })
})
