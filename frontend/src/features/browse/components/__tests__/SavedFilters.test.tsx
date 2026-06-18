import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

// ─── Auth store (STABLE reference) ─────────────────────────────────
const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', user_type: 'investor' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@/store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Config ─────────────────────────────────────────────────────────
vi.mock('@/config', () => ({
  API_URL: 'http://localhost:8787',
  config: {},
}))

// ─── ToastProvider ───────────────────────────────────────────────────
vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: vi.fn(),
    info: vi.fn(),
    addToast: vi.fn(),
    removeToast: vi.fn(),
    toasts: [],
  }),
}))

// ─── Sample data ─────────────────────────────────────────────────────
const mockFilterState = {
  genres: ['Drama', 'Action'],
  formats: ['Feature Film'],
  developmentStages: ['Financing'],
  creatorTypes: [],
  budgetMin: 1000000,
  budgetMax: 10000000,
  searchQuery: 'space drama',
  hasNDA: true,
  seekingInvestment: false,
}

const mockSavedFilters = [
  {
    id: 1,
    name: 'Drama Action Films',
    description: 'High budget drama and action',
    filters: mockFilterState,
    isDefault: false,
    usageCount: 5,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 2,
    name: 'My Default Filter',
    description: undefined,
    filters: {
      genres: ['Comedy'],
      formats: ['TV Series'],
      developmentStages: [],
      creatorTypes: [],
      budgetMin: 0,
      budgetMax: 500000,
      searchQuery: '',
      hasNDA: false,
      seekingInvestment: true,
    },
    isDefault: true,
    usageCount: 12,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
  },
]

// ─── Dynamic import ─────────────────────────────────────────────────
let SavedFilters: React.ComponentType<any>
beforeAll(async () => {
  const mod = await import('../SavedFilters')
  SavedFilters = mod.default
})

// ─── Helper render ───────────────────────────────────────────────────
function renderSavedFilters(
  overrides: Partial<{
    currentFilters: typeof mockFilterState
    onLoadFilter: (filters: any) => void
  }> = {}
) {
  const currentFilters = overrides.currentFilters ?? mockFilterState
  const onLoadFilter = overrides.onLoadFilter ?? vi.fn()
  const result = render(
    <MemoryRouter>
      <SavedFilters
        currentFilters={currentFilters}
        onLoadFilter={onLoadFilter}
      />
    </MemoryRouter>
  )
  return { ...result, onLoadFilter }
}

// ─── Tests ───────────────────────────────────────────────────────────
describe('SavedFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: successful empty list on load
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ filters: [] }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Returns null when no user ─────────────────────────────────────
  describe('unauthenticated state', () => {
    it('renders nothing when user is null', () => {
      // Temporarily make user null
      const originalUser = mockAuthState.user
      ;(mockAuthState as any).user = null

      const { container } = renderSavedFilters()
      expect(container.firstChild).toBeNull()

      ;(mockAuthState as any).user = originalUser
    })
  })

  // ── Initial render with no filters ─────────────────────────────────
  describe('empty state (no saved filters)', () => {
    it('renders without crashing when fetch returns empty list', async () => {
      renderSavedFilters()
      // component mounts and fetches — just wait for loading to settle
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })

    it('does NOT show saved filters dropdown button when list is empty', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.queryByText(/Saved Filters/)).not.toBeInTheDocument()
    })

    it('calls GET /api/filters/saved on mount when user exists', async () => {
      renderSavedFilters()
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8787/api/filters/saved',
          expect.objectContaining({ method: 'GET', credentials: 'include' })
        )
      })
    })

    it('shows Save Filter button when currentFilters has active genres', async () => {
      renderSavedFilters({ currentFilters: { ...mockFilterState, genres: ['Drama'] } })
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.getByText('Save Filter')).toBeInTheDocument()
    })

    it('does NOT show Save Filter button when currentFilters is empty', async () => {
      renderSavedFilters({
        currentFilters: {
          genres: [],
          formats: [],
          developmentStages: [],
          creatorTypes: [],
          budgetMin: 0,
          budgetMax: 999999999,
          searchQuery: '',
          hasNDA: false,
          seekingInvestment: false,
        },
      })
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.queryByText('Save Filter')).not.toBeInTheDocument()
    })
  })

  // ── Populated saved filters list ──────────────────────────────────
  describe('with saved filters', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ filters: mockSavedFilters }),
      }))
    })

    it('shows "Saved Filters (2)" dropdown button when two filters exist', async () => {
      renderSavedFilters()
      await waitFor(() => {
        expect(screen.getByText('Saved Filters (2)')).toBeInTheDocument()
      })
    })

    it('opens the manage dropdown when clicking the Saved Filters button', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))
      expect(screen.getByText('Your Saved Filters')).toBeInTheDocument()
    })

    it('renders filter names inside the dropdown', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))
      expect(screen.getByText('Drama Action Films')).toBeInTheDocument()
      expect(screen.getByText('My Default Filter')).toBeInTheDocument()
    })

    it('renders filter description when present', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))
      expect(screen.getByText('High budget drama and action')).toBeInTheDocument()
    })

    it('shows "Default" badge on the default filter', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))
      expect(screen.getByText('Default')).toBeInTheDocument()
    })

    it('shows usage count for each filter', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))
      expect(screen.getByText('Used 5 times')).toBeInTheDocument()
      expect(screen.getByText('Used 12 times')).toBeInTheDocument()
    })

    it('closes dropdown when clicking outside (overlay click)', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))
      expect(screen.getByText('Your Saved Filters')).toBeInTheDocument()

      // The overlay is a fixed inset div; clicking it closes the dropdown
      const overlay = document.querySelector('.fixed.inset-0.z-40') as HTMLElement
      expect(overlay).toBeTruthy()
      fireEvent.click(overlay)
      await waitFor(() => {
        expect(screen.queryByText('Your Saved Filters')).not.toBeInTheDocument()
      })
    })
  })

  // ── Apply / load a saved filter ───────────────────────────────────
  describe('applying a saved filter', () => {
    beforeEach(() => {
      // First call: load list; subsequent POST /track calls succeed
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: mockSavedFilters }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        })
      )
    })

    it('calls onLoadFilter with the correct filters when Apply (check) is clicked', async () => {
      const onLoadFilter = vi.fn()
      renderSavedFilters({ onLoadFilter })
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      // Each filter card has an Apply (Check icon) button
      const applyButtons = screen.getAllByTitle('Apply Filter')
      fireEvent.click(applyButtons[0])

      expect(onLoadFilter).toHaveBeenCalledWith(mockSavedFilters[0].filters)
    })

    it('calls POST /api/filters/saved/:id/track after applying a filter', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const applyButtons = screen.getAllByTitle('Apply Filter')
      fireEvent.click(applyButtons[0])

      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
        const trackCall = calls.find(
          ([url, opts]: [string, any]) =>
            url === 'http://localhost:8787/api/filters/saved/1/track' &&
            opts?.method === 'POST'
        )
        expect(trackCall).toBeDefined()
      })
    })

    it('shows success toast with filter name when applied', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const applyButtons = screen.getAllByTitle('Apply Filter')
      fireEvent.click(applyButtons[0])

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Applied filter: Drama Action Films')
      })
    })
  })

  // ── Save new filter dialog ────────────────────────────────────────
  describe('save filter dialog', () => {
    it('opens the save dialog when clicking "Save Filter" button', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      fireEvent.click(screen.getByText('Save Filter'))
      expect(screen.getByText('Save Filter', { selector: 'h3' })).toBeInTheDocument()
    })

    it('renders Filter Name input in the save dialog', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      fireEvent.click(screen.getByText('Save Filter'))
      expect(screen.getByPlaceholderText('e.g., High Budget Action Films')).toBeInTheDocument()
    })

    it('renders Description textarea in the save dialog', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      fireEvent.click(screen.getByText('Save Filter'))
      expect(screen.getByPlaceholderText('Describe what this filter is for...')).toBeInTheDocument()
    })

    it('renders "Set as my default filter" checkbox', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      fireEvent.click(screen.getByText('Save Filter'))
      expect(screen.getByLabelText('Set as my default filter')).toBeInTheDocument()
    })

    it('Save Filter button in dialog is disabled when name is empty', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      fireEvent.click(screen.getByText('Save Filter'))
      // The submit button inside the dialog — it has bg-blue-600 class
      const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
      const saveBtn = dialog.querySelector('button.bg-blue-600') as HTMLButtonElement
      expect(saveBtn).toBeTruthy()
      expect(saveBtn).toBeDisabled()
    })

    it('Save Filter button in dialog is enabled when name is typed', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      fireEvent.click(screen.getByText('Save Filter'))
      const input = screen.getByPlaceholderText('e.g., High Budget Action Films')
      fireEvent.change(input, { target: { value: 'My Test Filter' } })
      const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
      const saveBtn = dialog.querySelector('button.bg-blue-600') as HTMLButtonElement
      expect(saveBtn).toBeTruthy()
      expect(saveBtn).not.toBeDisabled()
    })

    it('closes the dialog when Cancel is clicked', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      fireEvent.click(screen.getByText('Save Filter'))
      expect(screen.getByPlaceholderText('e.g., High Budget Action Films')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Cancel'))
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('e.g., High Budget Action Films')).not.toBeInTheDocument()
      })
    })

    it('closes the dialog when X button is clicked', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      fireEvent.click(screen.getByText('Save Filter'))
      const xBtn = screen.getByRole('button', { name: '' }).closest('button') as HTMLElement
      // Find the X close button via its title/label — it's inside the dialog header
      const dialog = screen.getByText('Save Filter', { selector: 'h3' }).closest('div')!
      const closeBtn = dialog.querySelector('button') as HTMLElement
      fireEvent.click(closeBtn)
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('e.g., High Budget Action Films')).not.toBeInTheDocument()
      })
    })

    it('shows error toast when saving without a name — button is disabled guard', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      // The toast.error('Please enter a name') branch is guarded by the disabled state.
      // Verify the guard: open dialog, save button is disabled when name is blank.
      fireEvent.click(screen.getByText('Save Filter'))
      const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
      const saveBtn = dialog.querySelector('button.bg-blue-600') as HTMLButtonElement
      expect(saveBtn).toBeDisabled()
      // Even if clicked, fetch should NOT be called with POST
      fireEvent.click(saveBtn)
      await new Promise((r) => setTimeout(r, 30))
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      const postCall = calls.find(
        ([url, opts]: [string, any]) =>
          url === 'http://localhost:8787/api/filters/saved' && opts?.method === 'POST'
      )
      expect(postCall).toBeUndefined()
    })
  })

  // ── Submitting the save form ──────────────────────────────────────
  describe('submitting a new filter', () => {
    beforeEach(() => {
      // First call: load list; second call: POST save; third: reload list
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 3, name: 'My Test Filter' }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ filters: [] }),
        })
      )
    })

    // Helper to get the dialog's submit button (bg-blue-600 class)
    function getDialogSubmitBtn() {
      const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
      return dialog.querySelector('button.bg-blue-600') as HTMLButtonElement
    }

    it('calls POST /api/filters/saved with correct payload when saving', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())

      fireEvent.click(screen.getByText('Save Filter'))
      const input = screen.getByPlaceholderText('e.g., High Budget Action Films')
      fireEvent.change(input, { target: { value: 'My Test Filter' } })
      const descInput = screen.getByPlaceholderText('Describe what this filter is for...')
      fireEvent.change(descInput, { target: { value: 'A useful filter' } })

      await act(async () => {
        fireEvent.click(getDialogSubmitBtn())
      })

      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
        const saveCall = calls.find(
          ([url, opts]: [string, any]) =>
            url === 'http://localhost:8787/api/filters/saved' &&
            opts?.method === 'POST'
        )
        expect(saveCall).toBeDefined()
        const body = JSON.parse(saveCall![1].body)
        expect(body.name).toBe('My Test Filter')
        expect(body.description).toBe('A useful filter')
        expect(body.filters).toEqual(mockFilterState)
        expect(body.isDefault).toBe(false)
      })
    })

    it('shows success toast after successfully saving a filter', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())

      fireEvent.click(screen.getByText('Save Filter'))
      const input = screen.getByPlaceholderText('e.g., High Budget Action Films')
      fireEvent.change(input, { target: { value: 'My Test Filter' } })
      await act(async () => {
        fireEvent.click(getDialogSubmitBtn())
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Filter saved!')
      })
    })

    it('closes save dialog after successful save', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())

      fireEvent.click(screen.getByText('Save Filter'))
      const input = screen.getByPlaceholderText('e.g., High Budget Action Films')
      fireEvent.change(input, { target: { value: 'My Test Filter' } })
      await act(async () => {
        fireEvent.click(getDialogSubmitBtn())
      })

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('e.g., High Budget Action Films')).not.toBeInTheDocument()
      })
    })

    it('shows error toast when save API call fails', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Server error' }),
        })
      )

      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())

      fireEvent.click(screen.getByText('Save Filter'))
      const input = screen.getByPlaceholderText('e.g., High Budget Action Films')
      fireEvent.change(input, { target: { value: 'My Test Filter' } })
      await act(async () => {
        fireEvent.click(getDialogSubmitBtn())
      })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to save filter')
      })
    })

    it('saves with isDefault=true when checkbox is checked', async () => {
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())

      fireEvent.click(screen.getByText('Save Filter'))
      const input = screen.getByPlaceholderText('e.g., High Budget Action Films')
      fireEvent.change(input, { target: { value: 'Default Filter' } })
      const defaultCheckbox = screen.getByLabelText('Set as my default filter')
      fireEvent.click(defaultCheckbox)
      await act(async () => {
        fireEvent.click(getDialogSubmitBtn())
      })

      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
        const saveCall = calls.find(
          ([url, opts]: [string, any]) =>
            url === 'http://localhost:8787/api/filters/saved' &&
            opts?.method === 'POST'
        )
        expect(saveCall).toBeDefined()
        const body = JSON.parse(saveCall![1].body)
        expect(body.isDefault).toBe(true)
      })
    })
  })

  // ── Edit a saved filter ───────────────────────────────────────────
  describe('editing a saved filter', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: mockSavedFilters }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 1, name: 'Updated Name' }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ filters: mockSavedFilters }),
        })
      )
    })

    it('opens the edit dialog with "Edit Filter" title when Edit button is clicked', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const editButtons = screen.getAllByTitle('Edit Filter')
      fireEvent.click(editButtons[0])

      expect(screen.getByText('Edit Filter')).toBeInTheDocument()
    })

    it('pre-populates filter name when opening edit dialog', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const editButtons = screen.getAllByTitle('Edit Filter')
      fireEvent.click(editButtons[0])

      const input = screen.getByPlaceholderText('e.g., High Budget Action Films')
      expect((input as HTMLInputElement).value).toBe('Drama Action Films')
    })

    it('pre-populates description when opening edit dialog', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const editButtons = screen.getAllByTitle('Edit Filter')
      fireEvent.click(editButtons[0])

      const textarea = screen.getByPlaceholderText('Describe what this filter is for...')
      expect((textarea as HTMLTextAreaElement).value).toBe('High budget drama and action')
    })

    it('calls PUT /api/filters/saved/:id when updating', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const editButtons = screen.getAllByTitle('Edit Filter')
      fireEvent.click(editButtons[0])

      const input = screen.getByPlaceholderText('e.g., High Budget Action Films')
      fireEvent.change(input, { target: { value: 'Updated Name' } })

      const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
      const updateBtn = dialog.querySelector('button.bg-blue-600') as HTMLButtonElement
      await act(async () => {
        fireEvent.click(updateBtn)
      })

      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
        const putCall = calls.find(
          ([url, opts]: [string, any]) =>
            url === 'http://localhost:8787/api/filters/saved/1' &&
            opts?.method === 'PUT'
        )
        expect(putCall).toBeDefined()
      })
    })

    it('shows success toast "Filter updated!" after editing', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const editButtons = screen.getAllByTitle('Edit Filter')
      fireEvent.click(editButtons[0])

      const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
      const updateBtn = dialog.querySelector('button.bg-blue-600') as HTMLButtonElement
      await act(async () => {
        fireEvent.click(updateBtn)
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Filter updated!')
      })
    })
  })

  // ── Delete a saved filter ─────────────────────────────────────────
  describe('deleting a saved filter', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: mockSavedFilters }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ filters: [] }),
        })
      )
      // Make window.confirm return true so the delete proceeds
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('calls DELETE /api/filters/saved/:id when Delete button is clicked', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const deleteButtons = screen.getAllByTitle('Delete Filter')
      await act(async () => {
        fireEvent.click(deleteButtons[0])
      })

      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
        const deleteCall = calls.find(
          ([url, opts]: [string, any]) =>
            url === 'http://localhost:8787/api/filters/saved/1' &&
            opts?.method === 'DELETE'
        )
        expect(deleteCall).toBeDefined()
      })
    })

    it('shows success toast "Filter deleted" after deleting', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const deleteButtons = screen.getAllByTitle('Delete Filter')
      await act(async () => {
        fireEvent.click(deleteButtons[0])
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Filter deleted')
      })
    })

    it('does NOT call DELETE when user cancels the confirm dialog', async () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))

      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const deleteButtons = screen.getAllByTitle('Delete Filter')
      fireEvent.click(deleteButtons[0])

      // Give time for any async ops
      await new Promise((r) => setTimeout(r, 50))

      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      const deleteCall = calls.find(
        ([url, opts]: [string, any]) =>
          typeof url === 'string' &&
          url.includes('/api/filters/saved/') &&
          opts?.method === 'DELETE'
      )
      expect(deleteCall).toBeUndefined()
    })

    it('shows error toast when delete API call fails', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: mockSavedFilters }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Server error' }),
        })
      )

      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const deleteButtons = screen.getAllByTitle('Delete Filter')
      await act(async () => {
        fireEvent.click(deleteButtons[0])
      })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to delete filter')
      })
    })
  })

  // ── Toggle default ─────────────────────────────────────────────────
  describe('toggling default filter', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ filters: mockSavedFilters }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ filters: mockSavedFilters }),
        })
      )
    })

    it('calls PUT /api/filters/saved/:id/default when star button clicked', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      // First filter is NOT default — has StarOff; click it to set as default
      const setDefaultBtns = screen.getAllByTitle('Set as Default')
      await act(async () => {
        fireEvent.click(setDefaultBtns[0])
      })

      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
        const defaultCall = calls.find(
          ([url, opts]: [string, any]) =>
            url === 'http://localhost:8787/api/filters/saved/1/default' &&
            opts?.method === 'PUT'
        )
        expect(defaultCall).toBeDefined()
      })
    })

    it('shows "Set as default filter" toast when setting non-default as default', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      const setDefaultBtns = screen.getAllByTitle('Set as Default')
      await act(async () => {
        fireEvent.click(setDefaultBtns[0])
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Set as default filter')
      })
    })

    it('shows "Removed as default" toast when un-setting the default', async () => {
      renderSavedFilters()
      await waitFor(() => screen.getByText('Saved Filters (2)'))
      fireEvent.click(screen.getByText('Saved Filters (2)'))

      // Second filter IS default — has "Remove as Default" title
      const removeDefaultBtns = screen.getAllByTitle('Remove as Default')
      await act(async () => {
        fireEvent.click(removeDefaultBtns[0])
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Removed as default')
      })
    })
  })

  // ── hasActiveFilters detection ────────────────────────────────────
  describe('hasActiveFilters edge cases', () => {
    it('shows Save Filter button when searchQuery is non-empty', async () => {
      renderSavedFilters({
        currentFilters: {
          genres: [],
          formats: [],
          developmentStages: [],
          creatorTypes: [],
          budgetMin: 0,
          budgetMax: 999999999,
          searchQuery: 'space horror',
          hasNDA: false,
          seekingInvestment: false,
        },
      })
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.getByText('Save Filter')).toBeInTheDocument()
    })

    it('shows Save Filter button when hasNDA is true', async () => {
      renderSavedFilters({
        currentFilters: {
          genres: [],
          formats: [],
          developmentStages: [],
          creatorTypes: [],
          budgetMin: 0,
          budgetMax: 999999999,
          searchQuery: '',
          hasNDA: true,
          seekingInvestment: false,
        },
      })
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.getByText('Save Filter')).toBeInTheDocument()
    })

    it('shows Save Filter button when seekingInvestment is true', async () => {
      renderSavedFilters({
        currentFilters: {
          genres: [],
          formats: [],
          developmentStages: [],
          creatorTypes: [],
          budgetMin: 0,
          budgetMax: 999999999,
          searchQuery: '',
          hasNDA: false,
          seekingInvestment: true,
        },
      })
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.getByText('Save Filter')).toBeInTheDocument()
    })

    it('shows Save Filter button when budgetMin > 0', async () => {
      renderSavedFilters({
        currentFilters: {
          genres: [],
          formats: [],
          developmentStages: [],
          creatorTypes: [],
          budgetMin: 500000,
          budgetMax: 999999999,
          searchQuery: '',
          hasNDA: false,
          seekingInvestment: false,
        },
      })
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.getByText('Save Filter')).toBeInTheDocument()
    })

    it('shows Save Filter button when budgetMax < 999999999', async () => {
      renderSavedFilters({
        currentFilters: {
          genres: [],
          formats: [],
          developmentStages: [],
          creatorTypes: [],
          budgetMin: 0,
          budgetMax: 5000000,
          searchQuery: '',
          hasNDA: false,
          seekingInvestment: false,
        },
      })
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.getByText('Save Filter')).toBeInTheDocument()
    })
  })

  // ── Network error on load ─────────────────────────────────────────
  describe('error handling on load', () => {
    it('handles fetch error gracefully without crashing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
      renderSavedFilters()
      // Should not throw — component should still render
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      // No saved filters button should appear
      expect(screen.queryByText(/Saved Filters \(/)).not.toBeInTheDocument()
    })

    it('handles non-ok response gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      }))
      renderSavedFilters()
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(screen.queryByText(/Saved Filters \(/)).not.toBeInTheDocument()
    })
  })
})
