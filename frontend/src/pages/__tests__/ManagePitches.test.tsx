import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockGetMyPitches = vi.fn()
const mockPublish = vi.fn()
const mockArchive = vi.fn()
const mockDelete = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@features/pitches/services/pitch.service', () => ({
  pitchService: {
    getMyPitches: mockGetMyPitches,
    publish: mockPublish,
    archive: mockArchive,
    delete: mockDelete,
  },
}))

vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format }: { format?: string }) => <span>{format || 'Feature'}</span>,
}))

const makePitch = (overrides: Record<string, any> = {}) => ({
  id: 1,
  title: 'Test Pitch',
  logline: 'A compelling logline',
  genre: 'Drama',
  format: 'Feature Film',
  formatCategory: 'film',
  formatSubtype: 'feature',
  status: 'draft',
  viewCount: 10,
  likeCount: 5,
  titleImage: '',
  updatedAt: '2026-01-15T00:00:00Z',
  ...overrides,
})

let ManagePitches: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ManagePitches')
  ManagePitches = mod.default
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ManagePitches />
    </MemoryRouter>
  )
}

describe('ManagePitches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockGetMyPitches.mockResolvedValue([])

    // Stub window.confirm for delete tests
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ─── Loading State ──────────────────────────────────────────────────

  describe('Loading State', () => {
    it('shows spinner while loading', () => {
      mockGetMyPitches.mockReturnValue(new Promise(() => {})) // never resolves
      renderPage()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('hides spinner after data loads', async () => {
      mockGetMyPitches.mockResolvedValue([])
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('No pitches found')).toBeInTheDocument()
      })
    })
  })

  // ─── API Connectivity — Fetch ───────────────────────────────────────

  describe('API Connectivity — Fetch', () => {
    it('calls pitchService.getMyPitches on mount', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetMyPitches).toHaveBeenCalledTimes(1)
      })
    })

    it('renders fetched pitches', async () => {
      mockGetMyPitches.mockResolvedValue([
        makePitch({ id: 1, title: 'My First Pitch', genre: 'Comedy' }),
        makePitch({ id: 2, title: 'Second Pitch', genre: 'Horror' }),
      ])
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('My First Pitch')).toBeInTheDocument()
        expect(screen.getByText('Second Pitch')).toBeInTheDocument()
      })
    })

    it('displays stats from fetched data', async () => {
      mockGetMyPitches.mockResolvedValue([
        makePitch({ id: 1, status: 'published', viewCount: 50, likeCount: 10 }),
        makePitch({ id: 2, status: 'draft', viewCount: 20, likeCount: 3 }),
      ])
      renderPage()
      await waitFor(() => {
        // Total Pitches
        expect(screen.getByText('2')).toBeInTheDocument()
        // Published
        expect(screen.getByText('1')).toBeInTheDocument()
        // Total Views (50+20=70)
        expect(screen.getByText('70')).toBeInTheDocument()
        // Total Likes (10+3=13)
        expect(screen.getByText('13')).toBeInTheDocument()
      })
    })

    it('shows empty state when no pitches', async () => {
      mockGetMyPitches.mockResolvedValue([])
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('No pitches found')).toBeInTheDocument()
        expect(screen.getByText(/Create Your First Pitch/i)).toBeInTheDocument()
      })
    })

    it('shows error notification when fetch fails', async () => {
      mockGetMyPitches.mockRejectedValue(new Error('Network error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })

  // ─── API Connectivity — Publish/Archive ─────────────────────────────

  describe('API Connectivity — Publish/Archive', () => {
    it('calls pitchService.publish when publishing a draft', async () => {
      const pitch = makePitch({ id: 42, status: 'draft' })
      mockGetMyPitches.mockResolvedValue([pitch])
      mockPublish.mockResolvedValue({ ...pitch, status: 'published' })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Test Pitch')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByText('Publish'))

      await waitFor(() => {
        expect(mockPublish).toHaveBeenCalledWith(42)
      })
    })

    it('calls pitchService.archive when unpublishing', async () => {
      const pitch = makePitch({ id: 42, status: 'published' })
      mockGetMyPitches.mockResolvedValue([pitch])
      mockArchive.mockResolvedValue({ ...pitch, status: 'draft' })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Test Pitch')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByText('Unpublish'))

      await waitFor(() => {
        expect(mockArchive).toHaveBeenCalledWith(42)
      })
    })

    it('shows success notification after publish', async () => {
      const pitch = makePitch({ id: 42, status: 'draft' })
      mockGetMyPitches.mockResolvedValue([pitch])
      mockPublish.mockResolvedValue({ ...pitch, status: 'published' })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Publish')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByText('Publish'))

      await waitFor(() => {
        expect(screen.getByText(/published successfully/i)).toBeInTheDocument()
      })
    })

    it('shows error notification when publish fails', async () => {
      const pitch = makePitch({ id: 42, status: 'draft' })
      mockGetMyPitches.mockResolvedValue([pitch])
      mockPublish.mockRejectedValue(new Error('Publish failed'))
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Publish')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByText('Publish'))

      await waitFor(() => {
        expect(screen.getByText('Publish failed')).toBeInTheDocument()
      })
    })
  })

  // ─── API Connectivity — Delete ──────────────────────────────────────

  describe('API Connectivity — Delete', () => {
    it('calls pitchService.delete after confirm', async () => {
      mockGetMyPitches.mockResolvedValue([makePitch({ id: 99 })])
      mockDelete.mockResolvedValue(undefined)
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Test Pitch')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      // The delete button has a Trash2 icon — find by title
      const deleteBtn = screen.getByTitle('Delete pitch')
      await user.click(deleteBtn)

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith(99)
      })
    })

    it('does NOT delete when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      mockGetMyPitches.mockResolvedValue([makePitch({ id: 99 })])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Test Pitch')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByTitle('Delete pitch'))

      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('shows FK constraint error on delete failure', async () => {
      mockGetMyPitches.mockResolvedValue([makePitch({ id: 99 })])
      mockDelete.mockRejectedValue(new Error('foreign key constraint violation'))
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Test Pitch')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByTitle('Delete pitch'))

      await waitFor(() => {
        expect(screen.getByText(/active investments or NDAs/i)).toBeInTheDocument()
      })
    })

    it('removes pitch from list after successful delete', async () => {
      mockGetMyPitches.mockResolvedValue([makePitch({ id: 99, title: 'Doomed Pitch' })])
      mockDelete.mockResolvedValue(undefined)
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Doomed Pitch')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByTitle('Delete pitch'))

      await waitFor(() => {
        expect(screen.queryByText('Doomed Pitch')).not.toBeInTheDocument()
      })
    })
  })

  // ─── Search & Filter ────────────────────────────────────────────────

  describe('Search & Filter', () => {
    it('filters pitches by search term', async () => {
      mockGetMyPitches.mockResolvedValue([
        makePitch({ id: 1, title: 'Horror Movie', genre: 'Horror' }),
        makePitch({ id: 2, title: 'Comedy Special', genre: 'Comedy' }),
      ])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Horror Movie')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.type(screen.getByPlaceholderText('Search pitches...'), 'Horror')

      expect(screen.getByText('Horror Movie')).toBeInTheDocument()
      expect(screen.queryByText('Comedy Special')).not.toBeInTheDocument()
    })

    it('filters pitches by status', async () => {
      mockGetMyPitches.mockResolvedValue([
        makePitch({ id: 1, title: 'Published One', status: 'published' }),
        makePitch({ id: 2, title: 'Draft One', status: 'draft' }),
      ])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Published One')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      // Status filter is now a tab row (replaced the <select>); click the Published tab.
      await user.click(screen.getByRole('button', { name: /Published/ }))

      expect(screen.getByText('Published One')).toBeInTheDocument()
      expect(screen.queryByText('Draft One')).not.toBeInTheDocument()
    })

    it('shows no-results message when filter matches nothing', async () => {
      mockGetMyPitches.mockResolvedValue([
        makePitch({ id: 1, title: 'Only Pitch' }),
      ])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Only Pitch')).toBeInTheDocument()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.type(screen.getByPlaceholderText('Search pitches...'), 'nonexistent')

      expect(screen.getByText('No pitches found')).toBeInTheDocument()
    })
  })

  // ─── Navigation ─────────────────────────────────────────────────────

  describe('Navigation', () => {
    it('navigates to new pitch on New Pitch button', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetMyPitches).toHaveBeenCalled()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByText('New Pitch'))

      expect(mockNavigate).toHaveBeenCalledWith('/creator/pitch/new')
    })

    it('navigates to dashboard on back arrow', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetMyPitches).toHaveBeenCalled()
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      // Back button is the first button in the header
      const backBtn = document.querySelector('header button')
      if (backBtn) {
        await user.click(backBtn)
        expect(mockNavigate).toHaveBeenCalledWith('/creator/dashboard')
      }
    })
  })

  // ─── Auto-refresh ───────────────────────────────────────────────────

  describe('Auto-refresh', () => {
    it('refreshes data every 30 seconds when auto-refresh is on', async () => {
      mockGetMyPitches.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        expect(mockGetMyPitches).toHaveBeenCalledTimes(1)
      })

      // Advance 30 seconds
      vi.advanceTimersByTime(30000)

      await waitFor(() => {
        expect(mockGetMyPitches).toHaveBeenCalledTimes(2)
      })
    })

    it('displays live updates status', async () => {
      mockGetMyPitches.mockResolvedValue([])
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Live updates enabled/i)).toBeInTheDocument()
      })
    })

    it('manual refresh button calls fetchPitches', async () => {
      mockGetMyPitches.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        expect(mockGetMyPitches).toHaveBeenCalledTimes(1)
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByText('Refresh'))

      await waitFor(() => {
        expect(mockGetMyPitches).toHaveBeenCalledTimes(2)
      })
    })
  })
})
