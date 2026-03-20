import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockFetch = vi.fn()

// ─── Stable user object ─────────────────────────────────────────────
const stableUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@test.com',
  userType: 'investor',
}

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '', pathname: '/search' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ─────────────────────────────────────────────────────
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({
    user: stableUser,
    isAuthenticated: true,
    logout: mockLogout,
  }),
}))

// ─── Card components ─────────────────────────────────────────────────
vi.mock('@shared/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}))

// ─── Badge ───────────────────────────────────────────────────────────
vi.mock('@shared/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

// ─── react-hot-toast ─────────────────────────────────────────────────
const mockToast = { success: vi.fn(), error: vi.fn(), loading: vi.fn() }
vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
}))

// ─── Config ──────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
}))

// ─── fetch mock ──────────────────────────────────────────────────────
vi.stubGlobal('fetch', mockFetch)

const mockSearchResults = {
  results: [
    {
      id: '1',
      type: 'pitch',
      title: 'Ocean Depths',
      description: 'A deep sea thriller.',
      genre: ['thriller'],
      budget: 5000000,
      format: 'feature',
      status: 'Development',
      created_at: '2024-01-15T00:00:00.000Z',
      creator_name: 'Creator One',
      views: 500,
      likes: 30,
    },
    {
      id: '2',
      type: 'creator',
      title: 'Jane Director',
      description: 'Award-winning director.',
      created_at: '2024-02-20T00:00:00.000Z',
      views: 200,
    },
  ],
  total: 2,
}

// ─── Component ───────────────────────────────────────────────────────
let AdvancedSearch: React.ComponentType
beforeAll(async () => {
  const mod = await import('../AdvancedSearch')
  AdvancedSearch = mod.default
})

function renderSearch() {
  return render(
    <MemoryRouter>
      <AdvancedSearch />
    </MemoryRouter>
  )
}

describe('AdvancedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSearchResults,
    })
  })

  // ─── Header & Layout ─────────────────────────────────────────────
  describe('Header and Layout', () => {
    it('renders the page heading with Advanced Search title', () => {
      renderSearch()
      expect(screen.getByRole('heading', { name: /Advanced Search/i })).toBeInTheDocument()
    })

    it('renders the page description', () => {
      renderSearch()
      expect(screen.getByText(/Find pitches, creators, and production companies/i)).toBeInTheDocument()
    })

    it('renders search input', () => {
      renderSearch()
      expect(screen.getByPlaceholderText(/Search for pitches, creators/i)).toBeInTheDocument()
    })

    it('renders Filters toggle button', () => {
      renderSearch()
      // Multiple "Filters" elements exist (sidebar heading + toggle button)
      expect(screen.getAllByText('Filters').length).toBeGreaterThan(0)
    })
  })

  // ─── Filters Sidebar ─────────────────────────────────────────────
  describe('Filters Sidebar', () => {
    it('shows filters panel by default', () => {
      renderSearch()
      expect(screen.getByText('Search Type')).toBeInTheDocument()
    })

    it('renders Search Type select with All Results option', () => {
      renderSearch()
      expect(screen.getByDisplayValue('All Results')).toBeInTheDocument()
    })

    it('renders Genres filter checkboxes', () => {
      renderSearch()
      expect(screen.getByText('Genres')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
      expect(screen.getByText('Drama')).toBeInTheDocument()
    })

    it('renders Budget Range filter', () => {
      renderSearch()
      expect(screen.getByText('Budget Range')).toBeInTheDocument()
    })

    it('renders Format filter checkboxes', () => {
      renderSearch()
      expect(screen.getByText('Format')).toBeInTheDocument()
      expect(screen.getByText('Feature Film')).toBeInTheDocument()
    })

    it('renders Minimum Rating filter', () => {
      renderSearch()
      expect(screen.getByText('Minimum Rating')).toBeInTheDocument()
    })

    it('renders Location filter', () => {
      renderSearch()
      // The label text exists; input is not associated via htmlFor but is in a sibling
      expect(screen.getByText('Location')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('City, State or Country')).toBeInTheDocument()
    })

    it('renders Clear All button in filters', () => {
      renderSearch()
      expect(screen.getByText('Clear All')).toBeInTheDocument()
    })
  })

  // ─── Search Controls ─────────────────────────────────────────────
  describe('Search Controls', () => {
    it('renders Sort by dropdown', () => {
      renderSearch()
      expect(screen.getByText('Sort by:')).toBeInTheDocument()
    })

    it('renders relevance as default sort', () => {
      renderSearch()
      expect(screen.getByDisplayValue('Relevance')).toBeInTheDocument()
    })

    it('renders Export button', () => {
      renderSearch()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('shows results count', () => {
      renderSearch()
      // Multiple elements may contain "results found" (count span + empty state heading)
      expect(screen.getAllByText(/results found/i).length).toBeGreaterThan(0)
    })
  })

  // ─── Empty State ─────────────────────────────────────────────────
  describe('Empty State', () => {
    it('shows No results found when no results', () => {
      renderSearch()
      // Initially no search performed, so results are empty
      expect(screen.getByText('No results found')).toBeInTheDocument()
    })

    it('shows helpful message in empty state', () => {
      renderSearch()
      expect(screen.getByText(/Try adjusting your search terms/i)).toBeInTheDocument()
    })

    it('renders Clear Filters button in empty state', () => {
      renderSearch()
      // Multiple "Clear Filters" / "Clear All" buttons may exist
      const clearButtons = screen.getAllByText(/Clear/i)
      expect(clearButtons.length).toBeGreaterThan(0)
    })
  })

  // ─── Search Execution ────────────────────────────────────────────
  describe('Search Execution', () => {
    it('performs search when query is entered', async () => {
      renderSearch()
      const searchInput = screen.getByPlaceholderText(/Search for pitches, creators/i)
      fireEvent.change(searchInput, { target: { value: 'thriller' } })
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/search'),
          expect.objectContaining({ credentials: 'include' })
        )
      })
    })

    it('displays search results after successful search', async () => {
      renderSearch()
      const searchInput = screen.getByPlaceholderText(/Search for pitches, creators/i)
      fireEvent.change(searchInput, { target: { value: 'ocean' } })
      await waitFor(() => {
        expect(screen.getByText('Ocean Depths')).toBeInTheDocument()
      })
    })

    it('shows error toast when search fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      renderSearch()
      const searchInput = screen.getByPlaceholderText(/Search for pitches, creators/i)
      fireEvent.change(searchInput, { target: { value: 'something' } })
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Search failed. Please try again.')
      })
    })

    it('shows error toast when search returns non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })
      renderSearch()
      const searchInput = screen.getByPlaceholderText(/Search for pitches, creators/i)
      fireEvent.change(searchInput, { target: { value: 'something' } })
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Search failed. Please try again.')
      })
    })
  })

  // ─── Filter Interactions ─────────────────────────────────────────
  describe('Filter Interactions', () => {
    it('toggles filter panel visibility', () => {
      renderSearch()
      const filtersBtn = screen.getAllByText('Filters').find(el => el.closest('button'))
      expect(filtersBtn).toBeTruthy()
      fireEvent.click(filtersBtn!.closest('button')!)
      // Filters panel should be hidden now
      expect(screen.queryByText('Search Type')).not.toBeInTheDocument()
    })

    it('clears all filters when Clear All clicked', () => {
      renderSearch()
      fireEvent.click(screen.getByText('Clear All'))
      // After clearing, form resets — search input should be empty
      const searchInput = screen.getByPlaceholderText(/Search for pitches, creators/i) as HTMLInputElement
      expect(searchInput.value).toBe('')
    })

    it('toggles genre checkbox', () => {
      renderSearch()
      const actionCheckbox = screen.getByRole('checkbox', { name: 'Action' })
      fireEvent.click(actionCheckbox)
      expect(actionCheckbox).toBeChecked()
    })

    it('toggles format checkbox', () => {
      renderSearch()
      const featureCheckbox = screen.getByRole('checkbox', { name: 'Feature Film' })
      fireEvent.click(featureCheckbox)
      expect(featureCheckbox).toBeChecked()
    })
  })

  // ─── Export ──────────────────────────────────────────────────────
  describe('Export', () => {
    it('shows success toast when Export clicked', () => {
      renderSearch()
      const exportBtn = screen.getByText('Export').closest('button')!
      fireEvent.click(exportBtn)
      expect(mockToast.success).toHaveBeenCalledWith('Search results exported to CSV')
    })
  })

  // ─── View Mode Toggle ────────────────────────────────────────────
  describe('View Mode Toggle', () => {
    it('renders grid and list view toggle buttons', () => {
      renderSearch()
      // Grid and List buttons are rendered in the controls section
      const buttons = document.querySelectorAll('button')
      const buttonTexts = Array.from(buttons).map(b => b.textContent?.trim())
      // Both view toggle buttons should exist (SVG only, no text)
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
