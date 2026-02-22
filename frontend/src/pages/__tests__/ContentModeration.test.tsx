import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockGetPitches = vi.fn()
const mockApprovePitch = vi.fn()
const mockRejectPitch = vi.fn()
const mockFlagPitch = vi.fn()

vi.mock('../../services/admin.service', () => ({
  adminService: {
    getPitches: (...args: any[]) => mockGetPitches(...args),
    approvePitch: (...args: any[]) => mockApprovePitch(...args),
    rejectPitch: (...args: any[]) => mockRejectPitch(...args),
    flagPitch: (...args: any[]) => mockFlagPitch(...args),
  },
}))

// Dynamic import after mocks
let ContentModeration: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Admin/ContentModeration')
  ContentModeration = mod.default
})

const mockPitches = [
  {
    id: 'pitch-1',
    title: 'Space Adventure',
    synopsis: 'An epic space odyssey about exploration',
    genre: 'Sci-Fi',
    budget: 5000000,
    creator: { id: 'c-1', name: 'Alice Director', email: 'alice@test.com' },
    status: 'pending' as const,
    createdAt: '2026-02-18T10:00:00Z',
    moderationNotes: undefined,
    flaggedReasons: undefined,
    documents: [
      { id: 'doc-1', filename: 'script.pdf', type: 'application/pdf' },
    ],
  },
  {
    id: 'pitch-2',
    title: 'Love in Paris',
    synopsis: 'A romantic comedy set in Paris',
    genre: 'Romance',
    budget: 2000000,
    creator: { id: 'c-2', name: 'Bob Writer', email: 'bob@test.com' },
    status: 'approved' as const,
    createdAt: '2026-02-17T10:00:00Z',
  },
  {
    id: 'pitch-3',
    title: 'Dark Mystery',
    synopsis: 'A thriller about a missing person',
    genre: 'Thriller',
    budget: 3000000,
    creator: { id: 'c-3', name: 'Charlie Author', email: 'charlie@test.com' },
    status: 'flagged' as const,
    createdAt: '2026-02-16T10:00:00Z',
    flaggedReasons: ['Inappropriate content', 'Copyright violation'],
    moderationNotes: 'Needs review for copyright issues',
  },
  {
    id: 'pitch-4',
    title: 'Rejected Film',
    synopsis: 'A film that was rejected',
    genre: 'Drama',
    budget: 1000000,
    creator: { id: 'c-4', name: 'Dave Filmmaker', email: 'dave@test.com' },
    status: 'rejected' as const,
    createdAt: '2026-02-15T10:00:00Z',
  },
]

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <ContentModeration />
    </MemoryRouter>
  )
}

describe('ContentModeration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPitches.mockResolvedValue(mockPitches)
    mockApprovePitch.mockResolvedValue(undefined)
    mockRejectPitch.mockResolvedValue(undefined)
    mockFlagPitch.mockResolvedValue(undefined)
  })

  describe('Loading', () => {
    it('shows loading state initially', () => {
      mockGetPitches.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Loading pitches...')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('renders the page title and subtitle', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Content Moderation')).toBeInTheDocument()
      })
      expect(screen.getByText('Review and moderate pitch submissions')).toBeInTheDocument()
    })

    it('renders status summary cards', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pending Review')).toBeInTheDocument()
      })
      // "Approved"/"Rejected"/"Flagged" appear in both summary cards and filter options
      expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Rejected').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Flagged').length).toBeGreaterThanOrEqual(1)
    })

    it('renders filter controls', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getByText('Genre')).toBeInTheDocument()
      expect(screen.getByText('Sort By')).toBeInTheDocument()
      expect(screen.getByText('Order')).toBeInTheDocument()
    })

    it('renders table headers', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pitch')).toBeInTheDocument()
      })
      expect(screen.getByText('Creator')).toBeInTheDocument()
      // "Budget" appears both in Sort By select and table header
      expect(screen.getAllByText('Budget').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Submitted')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('renders genre filter options', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('All Genres')).toBeInTheDocument()
      })
      // Check some genre options exist; "Drama" appears in filter and table data
      expect(screen.getAllByText('Action').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Comedy').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Drama').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Horror').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Data', () => {
    it('displays pitch titles and genres', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Space Adventure')).toBeInTheDocument()
      })
      expect(screen.getByText('Love in Paris')).toBeInTheDocument()
      expect(screen.getByText('Dark Mystery')).toBeInTheDocument()
      expect(screen.getByText('Rejected Film')).toBeInTheDocument()
    })

    it('displays creator names', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Alice Director')).toBeInTheDocument()
      })
      expect(screen.getByText('Bob Writer')).toBeInTheDocument()
      expect(screen.getByText('Charlie Author')).toBeInTheDocument()
    })

    it('displays pitch statuses', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('pending').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getAllByText('approved').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('flagged').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('rejected').length).toBeGreaterThanOrEqual(1)
    })

    it('displays status counts in summary cards', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pending Review')).toBeInTheDocument()
      })
      // The summary cards contain status counts as text-2xl font-bold elements
      const boldElements = document.querySelectorAll('.text-2xl.font-bold')
      const counts = Array.from(boldElements).map(el => el.textContent)
      // 1 pending, 1 approved, 1 rejected, 1 flagged
      expect(counts).toContain('1')
    })

    it('displays Review button for each pitch', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Review').length).toBe(4)
      })
    })

    it('calls getPitches on mount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockGetPitches).toHaveBeenCalled()
      })
    })
  })

  describe('Modal', () => {
    it('opens pitch modal when Review is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Review').length).toBe(4)
      })
      await user.click(screen.getAllByText('Review')[0])
      await waitFor(() => {
        expect(screen.getByText('Moderate Pitch')).toBeInTheDocument()
      })
    })

    it('shows pitch details in modal', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Review').length).toBe(4)
      })
      await user.click(screen.getAllByText('Review')[0])
      await waitFor(() => {
        expect(screen.getByText('Pitch Information')).toBeInTheDocument()
      })
      expect(screen.getByText('Creator Information')).toBeInTheDocument()
      expect(screen.getByText('Synopsis')).toBeInTheDocument()
    })

    it('shows Approve, Flag, and Reject buttons for pending pitches', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Review').length).toBe(4)
      })
      // Click Review on the first pending pitch
      await user.click(screen.getAllByText('Review')[0])
      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument()
      })
      expect(screen.getByText('Flag')).toBeInTheDocument()
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    it('shows flag reason checkboxes for pending pitches', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Review').length).toBe(4)
      })
      await user.click(screen.getAllByText('Review')[0])
      await waitFor(() => {
        expect(screen.getByText('Flag Reasons (if flagging)')).toBeInTheDocument()
      })
      expect(screen.getByText('Inappropriate content')).toBeInTheDocument()
      expect(screen.getByText('Copyright violation')).toBeInTheDocument()
      expect(screen.getByText('Spam or duplicate')).toBeInTheDocument()
    })

    it('shows moderation notes textarea', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Review').length).toBe(4)
      })
      await user.click(screen.getAllByText('Review')[0])
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add notes about your moderation decision...')).toBeInTheDocument()
      })
    })

    it('shows Approve button for flagged pitches', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Review').length).toBe(4)
      })
      // Click Review on the flagged pitch (index 2)
      await user.click(screen.getAllByText('Review')[2])
      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument()
      })
    })

    it('closes modal when Cancel is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Review').length).toBe(4)
      })
      await user.click(screen.getAllByText('Review')[0])
      await waitFor(() => {
        expect(screen.getByText('Moderate Pitch')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Cancel'))
      await waitFor(() => {
        expect(screen.queryByText('Moderate Pitch')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error', () => {
    it('shows error message when API fails', async () => {
      mockGetPitches.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Failed to load pitches')).toBeInTheDocument()
      })
    })
  })

  describe('Empty', () => {
    it('shows empty state when no pitches found', async () => {
      mockGetPitches.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No pitches found')).toBeInTheDocument()
      })
    })

    it('shows zero counts in summary cards when no pitches', async () => {
      mockGetPitches.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pending Review')).toBeInTheDocument()
      })
      const boldElements = document.querySelectorAll('.text-2xl.font-bold')
      const counts = Array.from(boldElements).map(el => el.textContent)
      // All counts should be 0
      expect(counts.every(c => c === '0')).toBe(true)
    })
  })
})
