import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ──────────────────────────────────────────
const mockNavigate = vi.fn()
const mockUseParams = vi.fn(() => ({ id: '42' }))

// SlateService mocks
const mockSlateGet = vi.fn()
const mockSlateUpdate = vi.fn()
const mockSlateAddPitch = vi.fn()
const mockSlateRemovePitch = vi.fn()
const mockSlateReorderPitches = vi.fn()

// apiClient mock for pitch search
const mockApiClientGet = vi.fn()

// globalThis.fetch mock for cover upload
const mockFetch = vi.fn()

// toast mock
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

// imageUpload mock
const mockPrepareImageForUpload = vi.fn()

// ─── react-router-dom ────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── SlateService (exact specifier from source: '@/services/slate.service') ──
vi.mock('@/services/slate.service', () => ({
  SlateService: {
    get: (...args: any[]) => mockSlateGet(...args),
    update: (...args: any[]) => mockSlateUpdate(...args),
    addPitch: (...args: any[]) => mockSlateAddPitch(...args),
    removePitch: (...args: any[]) => mockSlateRemovePitch(...args),
    reorderPitches: (...args: any[]) => mockSlateReorderPitches(...args),
  },
}))

// ─── apiClient (exact specifier: '@/lib/api-client') ────────────────
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockApiClientGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// ─── config (exact specifier: '@/config') ────────────────────────────
vi.mock('@/config', () => ({
  API_URL: 'http://localhost:8787',
}))

// ─── imageUpload (exact specifier: '@/utils/imageUpload') ────────────
vi.mock('@/utils/imageUpload', () => ({
  prepareImageForUpload: (...args: any[]) => mockPrepareImageForUpload(...args),
  PRE_COMPRESSION_MAX_BYTES: 30 * 1024 * 1024,
}))

// ─── react-hot-toast (exact specifier: 'react-hot-toast') ────────────
vi.mock('react-hot-toast', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    loading: vi.fn(),
  },
  default: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    loading: vi.fn(),
  },
  Toaster: () => null,
}))

// ─── Realistic mock data ─────────────────────────────────────────────
const mockPitch1 = {
  entry_id: 1,
  position: 0,
  added_at: '2026-01-01T00:00:00Z',
  id: 101,
  title: 'The Dark Horizon',
  logline: 'A lone detective uncovers a city-wide conspiracy.',
  genre: 'Drama',
  format: 'Feature',
  cover_image: null,
  view_count: 120,
  like_count: 45,
  status: 'published',
  created_at: '2026-01-01T00:00:00Z',
}

const mockPitch2 = {
  entry_id: 2,
  position: 1,
  added_at: '2026-01-02T00:00:00Z',
  id: 102,
  title: 'Neon Tides',
  logline: 'A surfer discovers alien life beneath the waves.',
  genre: 'Sci-Fi',
  format: 'Short',
  cover_image: 'https://example.com/cover.jpg',
  view_count: 88,
  like_count: 22,
  status: 'published',
  created_at: '2026-01-02T00:00:00Z',
}

const mockSlate = {
  id: 42,
  title: 'My Best Pitches',
  description: 'A curated selection of top creative work.',
  cover_image: null,
  status: 'draft' as const,
  pitch_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  pitches: [mockPitch1, mockPitch2],
}

const mockPublishedSlate = {
  ...mockSlate,
  status: 'published' as const,
  cover_image: 'https://example.com/slate-cover.jpg',
}

const mockEmptySlate = {
  ...mockSlate,
  pitches: [],
  pitch_count: 0,
}

// ─── Dynamic import ─────────────────────────────────────────────────
let CreatorSlateDetailPage: React.ComponentType

beforeAll(async () => {
  const mod = await import('../CreatorSlateDetail')
  CreatorSlateDetailPage = mod.default
})

describe('CreatorSlateDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ id: '42' })
    mockSlateGet.mockResolvedValue(mockSlate)
    mockSlateUpdate.mockResolvedValue({ ...mockSlate, title: mockSlate.title })
    mockSlateAddPitch.mockResolvedValue(true)
    mockSlateRemovePitch.mockResolvedValue(true)
    mockSlateReorderPitches.mockResolvedValue(true)
    mockApiClientGet.mockResolvedValue({ data: { pitches: [] } })
    mockPrepareImageForUpload.mockResolvedValue(new File(['img'], 'test.jpg', { type: 'image/jpeg' }))
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://example.com/new-cover.jpg' }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={['/creator/slates/42']}>
        <CreatorSlateDetailPage />
      </MemoryRouter>
    )

  // ─── Loading state ────────────────────────────────────────────────
  it('shows loading spinner initially', () => {
    mockSlateGet.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  // ─── Not found / null slate ───────────────────────────────────────
  it('shows "Slate not found" when SlateService.get returns null', async () => {
    mockSlateGet.mockResolvedValue(null)
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Slate not found')).toBeInTheDocument()
    })
  })

  it('navigates to /creator/slates from not-found back link', async () => {
    mockSlateGet.mockResolvedValue(null)
    renderComponent()
    await waitFor(() => screen.getByText('Back to Slates'))
    fireEvent.click(screen.getByText('Back to Slates'))
    expect(mockNavigate).toHaveBeenCalledWith('/creator/slates')
  })

  // ─── Basic rendering ──────────────────────────────────────────────
  it('renders the slate title after loading', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('My Best Pitches')).toBeInTheDocument()
    })
  })

  it('renders the slate description', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('A curated selection of top creative work.')).toBeInTheDocument()
    })
  })

  it('shows Draft status badge for draft slate', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })
  })

  it('shows Published status badge for published slate', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Published')).toBeInTheDocument()
    })
  })

  it('shows pitch count', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('2 pitches')).toBeInTheDocument()
    })
  })

  it('shows singular pitch count when only one pitch', async () => {
    mockSlateGet.mockResolvedValue({ ...mockSlate, pitches: [mockPitch1], pitch_count: 1 })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('1 pitch')).toBeInTheDocument()
    })
  })

  // ─── Calls SlateService on mount ──────────────────────────────────
  it('calls SlateService.get with the parsed id on mount', async () => {
    renderComponent()
    await waitFor(() => {
      expect(mockSlateGet).toHaveBeenCalledWith(42)
    })
  })

  // ─── Pitch list rendering ─────────────────────────────────────────
  it('renders pitch titles in the slate', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('The Dark Horizon')).toBeInTheDocument()
      expect(screen.getByText('Neon Tides')).toBeInTheDocument()
    })
  })

  it('renders pitch loglines', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('A lone detective uncovers a city-wide conspiracy.')).toBeInTheDocument()
    })
  })

  it('renders pitch genre and format tags', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getAllByText('Drama').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Feature').length).toBeGreaterThan(0)
    })
  })

  it('renders view and like counts for pitches', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('120')).toBeInTheDocument()
      expect(screen.getByText('45')).toBeInTheDocument()
    })
  })

  // ─── Empty state ──────────────────────────────────────────────────
  it('shows empty state when slate has no pitches', async () => {
    mockSlateGet.mockResolvedValue(mockEmptySlate)
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('No pitches in this slate yet')).toBeInTheDocument()
    })
  })

  it('shows "Add your first pitch" link in empty state', async () => {
    mockSlateGet.mockResolvedValue(mockEmptySlate)
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Add your first pitch')).toBeInTheDocument()
    })
  })

  // ─── Navigation ───────────────────────────────────────────────────
  it('navigates back to /creator/slates when back button is clicked', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    // The back button contains ArrowLeft icon; find it by its parent structure
    const allButtons = screen.getAllByRole('button')
    // The back button is rendered before the title area
    const backButton = allButtons.find(btn =>
      btn.querySelector('svg') && btn.className.includes('text-gray-500')
    )
    if (backButton) {
      fireEvent.click(backButton)
      expect(mockNavigate).toHaveBeenCalledWith('/creator/slates')
    }
  })

  // ─── Publish / Unpublish ──────────────────────────────────────────
  it('renders Publish button for draft slate', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Publish')).toBeInTheDocument()
    })
  })

  it('renders Unpublish button for published slate', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Unpublish')).toBeInTheDocument()
    })
  })

  it('calls SlateService.update with status=published when Publish is clicked', async () => {
    mockSlateUpdate.mockResolvedValue({ ...mockSlate, status: 'published' })
    renderComponent()
    await waitFor(() => screen.getByText('Publish'))
    fireEvent.click(screen.getByText('Publish'))
    await waitFor(() => {
      expect(mockSlateUpdate).toHaveBeenCalledWith(42, { status: 'published' })
    })
  })

  it('calls SlateService.update with status=draft when Unpublish is clicked', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    mockSlateUpdate.mockResolvedValue({ ...mockPublishedSlate, status: 'draft' })
    renderComponent()
    await waitFor(() => screen.getByText('Unpublish'))
    fireEvent.click(screen.getByText('Unpublish'))
    await waitFor(() => {
      expect(mockSlateUpdate).toHaveBeenCalledWith(42, { status: 'draft' })
    })
  })

  it('shows toast success after publishing', async () => {
    mockSlateUpdate.mockResolvedValue({ ...mockSlate, status: 'published' })
    renderComponent()
    await waitFor(() => screen.getByText('Publish'))
    fireEvent.click(screen.getByText('Publish'))
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('published')
      )
    })
  })

  it('shows toast error when publish fails', async () => {
    mockSlateUpdate.mockResolvedValue(null)
    renderComponent()
    await waitFor(() => screen.getByText('Publish'))
    fireEvent.click(screen.getByText('Publish'))
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('update')
      )
    })
  })

  // ─── Published slate public link ──────────────────────────────────
  it('shows public link section when slate is published', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Public link:')).toBeInTheDocument()
      expect(screen.getByText('/slates/s/42')).toBeInTheDocument()
    })
  })

  it('does not show public link section when slate is draft', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    expect(screen.queryByText('Public link:')).not.toBeInTheDocument()
  })

  // ─── Edit title/description ───────────────────────────────────────
  it('renders the pencil edit button', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    // Find edit buttons (pencil icon buttons)
    const buttons = screen.getAllByRole('button')
    // Should have a button for edit (pencil icon rendered by Lucide)
    const pencilButton = buttons.find(btn =>
      btn.querySelector('svg') && btn.className.includes('text-gray-4')
    )
    expect(pencilButton).toBeTruthy()
  })

  it('shows title input when edit mode is activated', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    // Click the pencil button to enter editing mode
    const buttons = screen.getAllByRole('button')
    const pencilButton = buttons.find(btn =>
      btn.getAttribute('class')?.includes('text-gray-4') &&
      btn.querySelector('svg')
    )
    if (pencilButton) {
      fireEvent.click(pencilButton)
      await waitFor(() => {
        expect(screen.getByDisplayValue('My Best Pitches')).toBeInTheDocument()
      })
    }
  })

  it('calls SlateService.update with new title when save is clicked', async () => {
    mockSlateUpdate.mockResolvedValue({ ...mockSlate, title: 'Updated Title' })
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    // Enter edit mode via pencil button
    const buttons = screen.getAllByRole('button')
    const pencilButton = buttons.find(btn =>
      btn.getAttribute('class')?.includes('text-gray-4') && btn.querySelector('svg')
    )
    if (pencilButton) {
      fireEvent.click(pencilButton)
      const titleInput = await screen.findByDisplayValue('My Best Pitches')
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } })
      // Find and click the checkmark save button
      const checkButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('class')?.includes('text-green')
      )
      if (checkButton) {
        fireEvent.click(checkButton)
        await waitFor(() => {
          expect(mockSlateUpdate).toHaveBeenCalledWith(42, {
            title: 'Updated Title',
            description: 'A curated selection of top creative work.',
          })
        })
      }
    }
  })

  it('shows toast success after saving title', async () => {
    mockSlateUpdate.mockResolvedValue({ ...mockSlate, title: 'Updated Title' })
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    const buttons = screen.getAllByRole('button')
    const pencilButton = buttons.find(btn =>
      btn.getAttribute('class')?.includes('text-gray-4') && btn.querySelector('svg')
    )
    if (pencilButton) {
      fireEvent.click(pencilButton)
      const titleInput = await screen.findByDisplayValue('My Best Pitches')
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } })
      const checkButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('class')?.includes('text-green')
      )
      if (checkButton) {
        fireEvent.click(checkButton)
        await waitFor(() => {
          expect(mockToastSuccess).toHaveBeenCalledWith('Slate details saved')
        })
      }
    }
  })

  it('shows toast error when save title fails', async () => {
    mockSlateUpdate.mockResolvedValue(null)
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    const buttons = screen.getAllByRole('button')
    const pencilButton = buttons.find(btn =>
      btn.getAttribute('class')?.includes('text-gray-4') && btn.querySelector('svg')
    )
    if (pencilButton) {
      fireEvent.click(pencilButton)
      await screen.findByDisplayValue('My Best Pitches')
      const checkButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('class')?.includes('text-green')
      )
      if (checkButton) {
        fireEvent.click(checkButton)
        await waitFor(() => {
          expect(mockToastError).toHaveBeenCalledWith(
            expect.stringContaining('save slate details')
          )
        })
      }
    }
  })

  // ─── Remove pitch ─────────────────────────────────────────────────
  it('renders Add Pitch button', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Add Pitch')).toBeInTheDocument()
    })
  })

  it('calls SlateService.removePitch when remove button is clicked', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('The Dark Horizon'))
    // Find the trash/remove buttons for the pitch rows
    const removeButtons = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('class')?.includes('text-gray-4') &&
      btn.querySelector('svg') &&
      !btn.getAttribute('class')?.includes('font-medium')
    )
    // The first trash button is for mockPitch1
    if (removeButtons.length > 0) {
      // Find by Trash2 icon presence — remove buttons appear after the pitch info
      const allButtons = screen.getAllByRole('button')
      // Trash buttons are near the end of each pitch row
      const trashLikeButtons = allButtons.filter(btn =>
        btn.getAttribute('class')?.includes('hover:text-red')
      )
      if (trashLikeButtons[0]) {
        fireEvent.click(trashLikeButtons[0])
        await waitFor(() => {
          expect(mockSlateRemovePitch).toHaveBeenCalledWith(42, 101)
        })
      }
    }
  })

  it('shows toast after removing pitch', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('The Dark Horizon'))
    const trashButtons = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('class')?.includes('hover:text-red')
    )
    if (trashButtons[0]) {
      fireEvent.click(trashButtons[0])
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Pitch removed from slate')
      })
    }
  })

  it('shows error toast when removePitch fails', async () => {
    mockSlateRemovePitch.mockResolvedValue(false)
    renderComponent()
    await waitFor(() => screen.getByText('The Dark Horizon'))
    const trashButtons = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('class')?.includes('hover:text-red')
    )
    if (trashButtons[0]) {
      fireEvent.click(trashButtons[0])
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('remove the pitch')
        )
      })
    }
  })

  // ─── Add Pitch modal ──────────────────────────────────────────────
  it('opens Add Pitch modal when "Add Pitch" button is clicked', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('Add Pitch'))
    fireEvent.click(screen.getByText('Add Pitch'))
    await waitFor(() => {
      expect(screen.getByText('Add Pitch to Slate')).toBeInTheDocument()
    })
  })

  it('shows search input in the modal', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('Add Pitch'))
    fireEvent.click(screen.getByText('Add Pitch'))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search your pitches...')).toBeInTheDocument()
    })
  })

  it('shows "Type to search your pitches" when search is empty', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('Add Pitch'))
    fireEvent.click(screen.getByText('Add Pitch'))
    await waitFor(() => {
      expect(screen.getByText('Type to search your pitches')).toBeInTheDocument()
    })
  })

  it('shows "No pitches found" when search returns empty results', async () => {
    mockApiClientGet.mockResolvedValue({ data: { pitches: [] } })
    renderComponent()
    await waitFor(() => screen.getByText('Add Pitch'))
    fireEvent.click(screen.getByText('Add Pitch'))
    const searchInput = await screen.findByPlaceholderText('Search your pitches...')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })
    await waitFor(() => {
      expect(screen.getByText('No pitches found')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('shows pitch results from search', async () => {
    const searchResult = {
      id: 999,
      title: 'Search Result Pitch',
      logline: 'A brand new story.',
      genre: 'Comedy',
      format: 'Short',
      title_image: null,
      status: 'published',
    }
    mockApiClientGet.mockResolvedValue({ data: { pitches: [searchResult] } })
    renderComponent()
    await waitFor(() => screen.getByText('Add Pitch'))
    fireEvent.click(screen.getByText('Add Pitch'))
    const searchInput = await screen.findByPlaceholderText('Search your pitches...')
    fireEvent.change(searchInput, { target: { value: 'Search Result' } })
    await waitFor(() => {
      expect(screen.getByText('Search Result Pitch')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('closes modal when Done button is clicked', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('Add Pitch'))
    fireEvent.click(screen.getByText('Add Pitch'))
    await waitFor(() => screen.getByText('Done'))
    fireEvent.click(screen.getByText('Done'))
    await waitFor(() => {
      expect(screen.queryByText('Add Pitch to Slate')).not.toBeInTheDocument()
    })
  })

  it('calls SlateService.addPitch when Add button is clicked in modal', async () => {
    const searchResult = {
      id: 999,
      title: 'Search Result Pitch',
      logline: 'A brand new story.',
      genre: 'Comedy',
      format: 'Short',
      title_image: null,
      status: 'published',
    }
    mockApiClientGet.mockResolvedValue({ data: { pitches: [searchResult] } })
    // After add, reload returns updated slate
    mockSlateGet.mockResolvedValueOnce(mockSlate).mockResolvedValueOnce({
      ...mockSlate,
      pitches: [...mockSlate.pitches, { ...mockPitch1, id: 999, title: 'Search Result Pitch' }],
    })
    renderComponent()
    await waitFor(() => screen.getByText('Add Pitch'))
    fireEvent.click(screen.getByText('Add Pitch'))
    const searchInput = await screen.findByPlaceholderText('Search your pitches...')
    fireEvent.change(searchInput, { target: { value: 'Search' } })
    await waitFor(() => screen.getByText('Search Result Pitch'), { timeout: 1000 })
    // Find and click the Add button within the search result
    const addButtons = screen.getAllByRole('button').filter(btn =>
      btn.textContent === 'Add'
    )
    if (addButtons[0]) {
      fireEvent.click(addButtons[0])
      await waitFor(() => {
        expect(mockSlateAddPitch).toHaveBeenCalledWith(42, 999)
      })
    }
  })

  it('shows error toast when addPitch fails', async () => {
    mockSlateAddPitch.mockResolvedValue(false)
    const searchResult = {
      id: 999,
      title: 'Search Result Pitch',
      logline: 'A brand new story.',
      genre: 'Comedy',
      format: 'Short',
      title_image: null,
      status: 'published',
    }
    mockApiClientGet.mockResolvedValue({ data: { pitches: [searchResult] } })
    renderComponent()
    await waitFor(() => screen.getByText('Add Pitch'))
    fireEvent.click(screen.getByText('Add Pitch'))
    const searchInput = await screen.findByPlaceholderText('Search your pitches...')
    fireEvent.change(searchInput, { target: { value: 'Search' } })
    await waitFor(() => screen.getByText('Search Result Pitch'), { timeout: 1000 })
    const addButtons = screen.getAllByRole('button').filter(btn => btn.textContent === 'Add')
    if (addButtons[0]) {
      fireEvent.click(addButtons[0])
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('add the pitch')
        )
      })
    }
  })

  // ─── Cover image ──────────────────────────────────────────────────
  it('renders "Add cover image" button text in cover banner area', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Add cover image')).toBeInTheDocument()
    })
  })

  it('renders "Change cover image" button text when slate has cover', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Change cover image')).toBeInTheDocument()
    })
  })

  it('renders cover image when slate has one', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    renderComponent()
    await waitFor(() => {
      const img = document.querySelector('img[alt="My Best Pitches cover"]')
      expect(img).toBeTruthy()
      expect((img as HTMLImageElement)?.src).toContain('slate-cover.jpg')
    })
  })

  it('calls fetch with upload endpoint when file is selected', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()
    const file = new File(['test'], 'cover.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/profile'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('calls SlateService.update with new cover_image url after successful upload', async () => {
    mockSlateUpdate.mockResolvedValue({ ...mockSlate, cover_image: 'https://example.com/new-cover.jpg' })
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'cover.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(mockSlateUpdate).toHaveBeenCalledWith(42, {
        cover_image: 'https://example.com/new-cover.jpg',
      })
    })
  })

  it('shows success toast after cover upload', async () => {
    mockSlateUpdate.mockResolvedValue({ ...mockSlate, cover_image: 'https://example.com/new-cover.jpg' })
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'cover.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Cover updated')
    })
  })

  it('shows error toast when cover upload fetch fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Upload failed' }),
    })
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'cover.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Upload failed')
    })
  })

  it('rejects files over PRE_COMPRESSION_MAX_BYTES', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('My Best Pitches'))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    // Create a fake oversized file
    const bigFile = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(bigFile, 'size', { value: 31 * 1024 * 1024 })
    fireEvent.change(fileInput, { target: { files: [bigFile] } })
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('too large')
      )
    })
  })

  // ─── Remove cover ─────────────────────────────────────────────────
  it('renders Remove cover button when slate has a cover', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })
  })

  it('calls SlateService.update with null cover_image when Remove is clicked', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    mockSlateUpdate.mockResolvedValue({ ...mockPublishedSlate, cover_image: null })
    renderComponent()
    await waitFor(() => screen.getByText('Remove'))
    fireEvent.click(screen.getByText('Remove'))
    await waitFor(() => {
      expect(mockSlateUpdate).toHaveBeenCalledWith(42, { cover_image: null })
    })
  })

  it('shows success toast after removing cover', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    mockSlateUpdate.mockResolvedValue({ ...mockPublishedSlate, cover_image: null })
    renderComponent()
    await waitFor(() => screen.getByText('Remove'))
    fireEvent.click(screen.getByText('Remove'))
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Cover removed')
    })
  })

  it('shows error toast when removing cover fails', async () => {
    mockSlateGet.mockResolvedValue(mockPublishedSlate)
    mockSlateUpdate.mockResolvedValue(null)
    renderComponent()
    await waitFor(() => screen.getByText('Remove'))
    fireEvent.click(screen.getByText('Remove'))
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to remove cover')
    })
  })

  // ─── Drag reorder ─────────────────────────────────────────────────
  it('renders draggable pitch rows', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('The Dark Horizon'))
    const draggableRows = document.querySelectorAll('[draggable="true"]')
    expect(draggableRows.length).toBe(2)
  })

  it('calls SlateService.reorderPitches after a drag-drop reorder', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('The Dark Horizon'))
    const draggableRows = document.querySelectorAll('[draggable="true"]')
    expect(draggableRows.length).toBe(2)
    // Simulate drag: start on index 0, dragover index 1, drop on index 1
    fireEvent.dragStart(draggableRows[0])
    fireEvent.dragOver(draggableRows[1])
    fireEvent.drop(draggableRows[1])
    await waitFor(() => {
      expect(mockSlateReorderPitches).toHaveBeenCalledWith(42, expect.any(Array))
    })
  })

  it('shows error toast when reorder fails', async () => {
    mockSlateReorderPitches.mockResolvedValue(false)
    renderComponent()
    await waitFor(() => screen.getByText('The Dark Horizon'))
    const draggableRows = document.querySelectorAll('[draggable="true"]')
    fireEvent.dragStart(draggableRows[0])
    fireEvent.dragOver(draggableRows[1])
    fireEvent.drop(draggableRows[1])
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('new order')
      )
    })
  })

  // ─── No id edge case ──────────────────────────────────────────────
  it('does not call SlateService.get when id is missing', async () => {
    mockUseParams.mockReturnValue({ id: undefined })
    renderComponent()
    // Component returns null/loading when slateId is 0
    await new Promise(r => setTimeout(r, 100))
    expect(mockSlateGet).not.toHaveBeenCalled()
  })

  // ─── Cover image with pitch thumbnail ────────────────────────────
  it('renders pitch cover image when a pitch has one', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('Neon Tides'))
    // mockPitch2 has cover_image
    const imgs = document.querySelectorAll('img')
    const pitchCoverImg = Array.from(imgs).find(img => img.src.includes('cover.jpg'))
    expect(pitchCoverImg).toBeTruthy()
  })
})
