import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockFetch = vi.fn()

// ─── Config ─────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
  config: { API_URL: 'http://localhost:8787' },
  getApiUrl: () => 'http://localhost:8787',
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let Calendar: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Calendar')
  Calendar = mod.default
})

const mockEvents = [
  {
    id: 1,
    title: 'Pitch Review Meeting',
    type: 'meeting',
    date: new Date().toISOString().split('T')[0], // Today
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600000).toISOString(),
    location: 'Conference Room A',
    attendees: ['alice@test.com', 'bob@test.com'],
    description: 'Review the latest pitch deck.',
    color: '#8b5cf6',
  },
  {
    id: 2,
    title: 'Script Deadline',
    type: 'deadline',
    date: new Date().toISOString().split('T')[0],
    color: '#ef4444',
    description: 'Final script submission',
  },
]

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)

    // Default: events fetch succeeds with events
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/creator/calendar/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { events: mockEvents } }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  it('renders the calendar without crashing', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )
    expect(document.body).toBeTruthy()
  })

  it('renders the current month and year in the header', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )
    const now = new Date()
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const expectedMonth = months[now.getMonth()]
    const expectedYear = now.getFullYear().toString()

    expect(screen.getByText(new RegExp(expectedMonth))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(expectedYear))).toBeInTheDocument()
  })

  it('renders day headers (Sun through Sat)', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('renders month/week/day view toggle buttons', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )
    expect(screen.getByText('month')).toBeInTheDocument()
    expect(screen.getByText('week')).toBeInTheDocument()
    expect(screen.getByText('day')).toBeInTheDocument()
  })

  it('renders New Event button', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )
    expect(screen.getByText('New Event')).toBeInTheDocument()
  })

  it('renders Today button', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders navigation arrows', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )
    // Both previous and next buttons should be present
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(2)
  })

  it('shows events from API after loading', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Pitch Review Meeting').length).toBeGreaterThan(0)
    })
  })

  it('shows event count in header when events are loaded', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    await waitFor(() => {
      // Expect events count indicator
      expect(screen.getByText(/2 events/)).toBeInTheDocument()
    })
  })

  it("shows today's events section", async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Today's Events|Events for/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no events for today', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/creator/calendar/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { events: [] } }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No events scheduled')).toBeInTheDocument()
    })
  })

  it('opens New Event modal when New Event button is clicked', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('New Event'))

    await waitFor(() => {
      expect(screen.getByText('Create New Event')).toBeInTheDocument()
    })
  })

  it('shows event form fields in create modal', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('New Event'))

    await waitFor(() => {
      expect(screen.getByText('Event Title *')).toBeInTheDocument()
      expect(screen.getByText('Event Type *')).toBeInTheDocument()
    })
  })

  it('shows event type options in create modal', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('New Event'))

    await waitFor(() => {
      expect(screen.getByText('Meeting')).toBeInTheDocument()
      expect(screen.getByText('Call')).toBeInTheDocument()
      expect(screen.getByText('Deadline')).toBeInTheDocument()
    })
  })

  it('closes New Event modal when Cancel is clicked', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('New Event'))

    await waitFor(() => {
      expect(screen.getByText('Create New Event')).toBeInTheDocument()
    })

    // Find the cancel button in the modal
    const cancelButtons = screen.getAllByText('Cancel')
    fireEvent.click(cancelButtons[cancelButtons.length - 1])

    await waitFor(() => {
      expect(screen.queryByText('Create New Event')).not.toBeInTheDocument()
    })
  })

  it('shows week view placeholder when week tab is clicked', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('week'))

    await waitFor(() => {
      expect(screen.getByText('Week View')).toBeInTheDocument()
    })
  })

  it('shows day view placeholder when day tab is clicked', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('day'))

    await waitFor(() => {
      expect(screen.getByText('Day View')).toBeInTheDocument()
    })
  })

  it('navigates to previous month when prev button is clicked', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    const now = new Date()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    // Find the prev button (ChevronLeft)
    const header = document.querySelector('.flex.items-center.gap-4')
    const buttons = header?.querySelectorAll('button')
    if (buttons && buttons.length > 0) {
      fireEvent.click(buttons[0])
      await waitFor(() => {
        expect(screen.getByText(new RegExp(months[prevMonth.getMonth()]))).toBeInTheDocument()
      })
    }
  })

  it('shows Duration and color options in event form', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('New Event'))

    await waitFor(() => {
      expect(screen.getByText('Duration')).toBeInTheDocument()
      expect(screen.getByText('Event Color')).toBeInTheDocument()
    })
  })

  it('shows Reminder option in event form', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('New Event'))

    await waitFor(() => {
      expect(screen.getByText('Reminder')).toBeInTheDocument()
    })
  })

  it('calls GET /api/creator/calendar/events on mount', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/creator/calendar/events'),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  it('passes start and end query params when fetching events', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    await waitFor(() => {
      const callUrl: string = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('start=')
      expect(callUrl).toContain('end=')
    })
  })
})
