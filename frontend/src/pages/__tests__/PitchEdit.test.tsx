import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetById = vi.fn()
const mockUpdate = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '42' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── pitch.service ──────────────────────────────────────────────────
vi.mock('../../services/pitch.service', () => ({
  pitchService: {
    getById: mockGetById,
    update: mockUpdate,
  },
}))

// ─── upload.service ─────────────────────────────────────────────────
vi.mock('../../services/upload.service', () => ({
  uploadService: {
    uploadDocument: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/image.jpg' }),
  },
}))

// ─── pitchConstants ─────────────────────────────────────────────────
vi.mock('../../constants/pitchConstants', () => ({
  getGenresSync: () => ['Drama', 'Comedy', 'Thriller', 'Action'],
  getFormatsSync: () => ['Film', 'Television'],
  FALLBACK_GENRES: ['Drama', 'Comedy', 'Thriller'],
}))

// ─── CharacterManagement component ──────────────────────────────────
vi.mock('../../components/CharacterManagement', () => ({
  CharacterManagement: ({ characters, onChange }: any) => (
    <div data-testid="character-management">
      <span>Characters: {characters?.length || 0}</span>
    </div>
  ),
}))

// ─── DocumentUpload component ────────────────────────────────────────
vi.mock('../../components/DocumentUpload', () => ({
  DocumentUpload: ({ documents, onChange }: any) => (
    <div data-testid="document-upload">Document Upload ({documents?.length || 0} files)</div>
  ),
}))

// ─── characterUtils ─────────────────────────────────────────────────
vi.mock('../../utils/characterUtils', () => ({
  normalizeCharacters: (chars: any) => chars || [],
  serializeCharacters: (chars: any) => chars || [],
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let PitchEdit: React.ComponentType
beforeAll(async () => {
  const mod = await import('../PitchEdit')
  PitchEdit = mod.default
})

const mockPitch = {
  id: 42,
  title: 'The Dark Sky',
  genre: 'Drama',
  format: 'Television - Scripted',
  formatCategory: 'Television - Scripted',
  formatSubtype: 'Narrative Series (ongoing)',
  customFormat: '',
  logline: 'A dark tale of betrayal and redemption.',
  shortSynopsis: 'In the mountains of eastern Europe...',
  themes: 'Justice, family, redemption',
  worldDescription: 'A cold, grey world in Eastern Europe.',
  requireNDA: false,
  characters: [],
  titleImage: 'https://example.com/image.jpg',
}

describe('PitchEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetById.mockResolvedValue(mockPitch)
    mockUpdate.mockResolvedValue({ ...mockPitch, title: 'Updated Title' })
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  it('renders loading spinner initially', () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('loads and renders pitch data', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Edit Pitch')).toBeInTheDocument()
    })
  })

  it('fetches pitch by id on mount', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledWith(42)
    })
  })

  it('renders the form with title field populated', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Enter your project title') as HTMLInputElement
      expect(titleInput).toBeInTheDocument()
      expect(titleInput.value).toBe('The Dark Sky')
    })
  })

  it('renders the logline textarea populated', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      const loglineEl = screen.getByDisplayValue('A dark tale of betrayal and redemption.')
      expect(loglineEl).toBeInTheDocument()
    })
  })

  it('renders basic information section', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument()
    })
  })

  it('renders themes and world building section', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Themes & World Building')).toBeInTheDocument()
    })
  })

  it('renders media and assets section', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Media & Assets')).toBeInTheDocument()
    })
  })

  it('renders NDA configuration section', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('NDA Configuration')).toBeInTheDocument()
    })
  })

  it('renders genre selector', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/Genre/)).toBeInTheDocument()
    })
  })

  it('renders Save Changes and Cancel buttons', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
  })

  it('renders CharacterManagement component', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('character-management')).toBeInTheDocument()
    })
  })

  it('renders document upload section', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Project Documents')).toBeInTheDocument()
    })
  })

  it('shows error state when pitch fails to load', async () => {
    mockGetById.mockRejectedValue(new Error('Pitch not found'))

    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load pitch')).toBeInTheDocument()
    })
  })

  it('shows offline banner when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false })

    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('You are offline')).toBeInTheDocument()
    })
  })

  it('shows NDA radio options: No NDA, Platform NDA, Custom NDA', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No NDA Required')).toBeInTheDocument()
      expect(screen.getByText('Use Platform Standard NDA')).toBeInTheDocument()
      expect(screen.getByText('Use Custom NDA')).toBeInTheDocument()
    })
  })

  it('shows cover image upload area', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cover Image')).toBeInTheDocument()
    })
  })

  it('navigates to creator pitches when Cancel is clicked', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    screen.getByText('Cancel').click()
    expect(mockNavigate).toHaveBeenCalledWith('/creator/pitches')
  })

  it('shows existing cover image when pitch has titleImage', async () => {
    render(
      <MemoryRouter>
        <PitchEdit />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Current cover image:')).toBeInTheDocument()
    })
  })
})
