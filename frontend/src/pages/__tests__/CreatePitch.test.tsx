import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockSuccessToast = vi.fn()
const mockErrorToast = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ──────────────────────────────────────────────────────
const mockUser = { id: 1, name: 'Test Creator', email: 'creator@test.com', user_type: 'creator' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn(),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Toast ───────────────────────────────────────────────────────────
vi.mock('../../components/Toast/ToastProvider', () => ({
  useToast: () => ({
    success: mockSuccessToast,
    error: mockErrorToast,
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

// ─── LoadingSpinner ──────────────────────────────────────────────────
vi.mock('../../components/Loading/LoadingSpinner', () => ({
  default: ({ size, color }: any) => <div data-testid="loading-spinner" />,
}))

// ─── pitch.service ──────────────────────────────────────────────────
vi.mock('../../services/pitch.service', () => ({
  pitchService: {
    create: mockCreate,
    update: mockUpdate,
  },
}))

// ─── upload.service ─────────────────────────────────────────────────
vi.mock('../../services/upload.service', () => ({
  uploadService: {
    uploadDocument: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/file.pdf' }),
  },
}))

// ─── pitchConstants ─────────────────────────────────────────────────
vi.mock('../../constants/pitchConstants', () => ({
  getGenresSync: () => ['Drama', 'Comedy', 'Thriller', 'Action', 'Horror'],
  getFormatsSync: () => ['Film', 'Television - Scripted'],
  FALLBACK_GENRES: ['Drama', 'Comedy', 'Thriller'],
  getGenres: () => Promise.resolve(['Drama', 'Comedy', 'Thriller', 'Action']),
  getFormats: () => Promise.resolve(['Film', 'Television']),
}))

// ─── Form validation hook ────────────────────────────────────────────
vi.mock('../../hooks/useFormValidation', () => ({
  useFormValidation: (initialData: any, options: any) => ({
    data: initialData,
    errors: {},
    fieldErrors: {},
    isValid: false,
    isValidating: false,
    touchedFields: {},
    getFieldProps: (field: string) => ({ name: field, value: initialData[field] || '' }),
    handleFieldChange: (field: string) => (value: any) => {},
    handleFieldBlur: (field: string) => () => {},
    handleSubmit: (fn: any) => async () => { await fn(initialData); return true },
    validateField: vi.fn().mockResolvedValue([]),
    setValue: vi.fn(),
    setValues: vi.fn(),
    hasFieldError: () => false,
    getFieldError: () => [],
  }),
}))

// ─── Upload manager hook ─────────────────────────────────────────────
vi.mock('../../hooks/usePitchUploadManager', () => ({
  usePitchUploadManager: () => ({
    addUpload: vi.fn().mockReturnValue('upload-id-1'),
    removeUpload: vi.fn(),
    hasUploads: false,
    pendingUploads: [],
    overallProgress: 0,
    executeUploads: vi.fn().mockResolvedValue({ successful: [], failed: [] }),
  }),
}))

// ─── pitch.schema ────────────────────────────────────────────────────
vi.mock('../../schemas/pitch.schema', () => ({
  PitchFormSchema: {},
  getCharacterCountInfo: () => ({ count: 0, remaining: 10, isNearLimit: false }),
}))

// ─── accessibility util ──────────────────────────────────────────────
vi.mock('../../utils/accessibility', () => ({
  a11y: {
    announcer: { createAnnouncer: vi.fn(), announce: vi.fn() },
    focus: { focusById: vi.fn() },
    validation: { announceFieldError: vi.fn(), announceSuccess: vi.fn() },
    keyboard: { onActivate: (fn: any) => () => fn() },
    button: {
      getAttributes: (opts: any) => ({
        type: opts.type || 'button',
        disabled: opts.disabled || false,
        'aria-label': opts.ariaLabel,
        'aria-busy': opts.loading || false,
      }),
    },
    formField: {
      getLabelAttributes: (id: string, required: boolean) => ({
        htmlFor: id,
        className: 'block text-sm font-medium text-gray-700 mb-2',
      }),
      getAttributes: (opts: any) => ({
        id: opts.id,
        name: opts.id,
        required: opts.required || false,
        'aria-required': opts.required || false,
        'aria-invalid': opts.invalid || false,
        'aria-describedby': [opts.errorId, opts.helpId].filter(Boolean).join(' ') || undefined,
      }),
      getErrorAttributes: (id: string) => ({
        id: `${id}-error`,
        role: 'alert',
        className: 'mt-1 text-sm text-red-600 flex items-center',
      }),
      getHelpAttributes: (id: string) => ({
        id: `${id}-help`,
        className: 'text-xs text-gray-500 mt-1',
      }),
    },
    aria: {
      labelledBy: (id: string) => ({ 'aria-labelledby': id }),
      describedBy: (id: string) => ({ 'aria-describedby': id }),
    },
    classes: {
      focusVisible: 'focus-visible:ring-2',
      srOnly: 'sr-only',
      disabledElement: 'opacity-50 cursor-not-allowed',
    },
    fileUpload: {
      getDropZoneAttributes: (opts: any) => ({
        role: 'button',
        tabIndex: opts.disabled ? -1 : 0,
        'aria-labelledby': opts.labelId,
        className: 'border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer',
      }),
      getInputAttributes: (opts: any) => ({
        id: opts.id,
        type: 'file',
        accept: opts.accept,
        disabled: opts.disabled,
        className: 'sr-only',
        'aria-hidden': true,
      }),
    },
  },
}))

// ─── messages constants ──────────────────────────────────────────────
vi.mock('../../constants/messages', () => ({
  MESSAGES: {},
  VALIDATION_MESSAGES: {},
  SUCCESS_MESSAGES: { PITCH_CREATED: 'Pitch created successfully!' },
  ERROR_MESSAGES: { UNEXPECTED_ERROR: 'An unexpected error occurred' },
}))

// ─── CharacterManagement ─────────────────────────────────────────────
vi.mock('../../components/CharacterManagement', () => ({
  CharacterManagement: ({ characters }: any) => (
    <div data-testid="character-management">Characters: {characters?.length || 0}</div>
  ),
}))

// ─── characterUtils ──────────────────────────────────────────────────
vi.mock('../../utils/characterUtils', () => ({
  serializeCharacters: (chars: any) => chars || [],
  normalizeCharacters: (chars: any) => chars || [],
}))

// ─── DocumentUploadHub ───────────────────────────────────────────────
vi.mock('../../components/FileUpload/DocumentUploadHub', () => ({
  default: ({ onFilesSelected, disabled }: any) => (
    <div data-testid="document-upload-hub">Document Upload Hub</div>
  ),
}))

// ─── NDAUploadSection ────────────────────────────────────────────────
vi.mock('../../components/FileUpload/NDAUploadSection', () => ({
  default: ({ ndaDocument, onChange, disabled }: any) => (
    <div data-testid="nda-upload-section">NDA Upload Section</div>
  ),
}))

// ─── Enhanced pitch form sections ────────────────────────────────────
vi.mock('../../components/PitchForm/EnhancedPitchFormSections', () => ({
  ToneAndStyleSection: ({ value, onChange }: any) => (
    <div data-testid="tone-and-style">Tone and Style</div>
  ),
  CompsSection: ({ value, onChange }: any) => (
    <div data-testid="comps-section">Comps Section</div>
  ),
  StoryBreakdownSection: ({ value, onChange }: any) => (
    <div data-testid="story-breakdown">Story Breakdown</div>
  ),
  WhyNowSection: ({ value, onChange }: any) => (
    <div data-testid="why-now">Why Now</div>
  ),
  ProductionLocationSection: ({ value, onChange }: any) => (
    <div data-testid="production-location">Production Location</div>
  ),
  DevelopmentStageSelect: ({ value, onChange }: any) => (
    <div data-testid="development-stage">Development Stage</div>
  ),
  CreativeAttachmentsManager: ({ attachments, onChange }: any) => (
    <div data-testid="creative-attachments">Creative Attachments</div>
  ),
  VideoUrlSection: ({ value, onChange }: any) => (
    <div data-testid="video-url">Video URL</div>
  ),
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let CreatePitch: React.ComponentType
beforeAll(async () => {
  const mod = await import('../CreatePitch')
  CreatePitch = mod.default
})

describe('CreatePitch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
    mockCreate.mockResolvedValue({ id: 99, title: 'New Pitch' })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  it('renders the Create New Pitch heading', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Create New Pitch')).toBeInTheDocument()
  })

  it('renders the form element', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('create-pitch-form')).toBeInTheDocument()
  })

  it('renders the Basic Information section', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Basic Information')).toBeInTheDocument()
  })

  it('renders the title input', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('title-input')).toBeInTheDocument()
  })

  it('renders the genre select', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('genre-select')).toBeInTheDocument()
  })

  it('renders the logline textarea', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('logline-textarea')).toBeInTheDocument()
  })

  it('renders genre options from constants', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    const genreSelect = screen.getByTestId('genre-select')
    expect(genreSelect).toBeInTheDocument()
    // Check some options are present
    expect(screen.getAllByText('Drama').length).toBeGreaterThan(0)
  })

  it('renders the Themes and World Building section', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Themes & World Building')).toBeInTheDocument()
  })

  it('renders the Story and Style Details section', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Story & Style Details')).toBeInTheDocument()
  })

  it('renders enhanced form sections (ToneAndStyle, Comps, StoryBreakdown)', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('tone-and-style')).toBeInTheDocument()
    expect(screen.getByTestId('comps-section')).toBeInTheDocument()
    expect(screen.getByTestId('story-breakdown')).toBeInTheDocument()
  })

  it('renders Market and Production section', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Market & Production')).toBeInTheDocument()
  })

  it('renders CharacterManagement', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('character-management')).toBeInTheDocument()
  })

  it('renders NDA upload section', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('nda-upload-section')).toBeInTheDocument()
  })

  it('renders Media and Assets section', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Media & Assets')).toBeInTheDocument()
  })

  it('renders the Funding and Investment section', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Funding & Investment')).toBeInTheDocument()
  })

  it('renders the Seeking Investment checkbox', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Actively Seeking Investment')).toBeInTheDocument()
  })

  it('renders Cancel and Create Pitch buttons', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
    expect(screen.getByTestId('submit-button')).toBeInTheDocument()
  })

  it('shows credit cost overview notice', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText(/Credit System Overview/)).toBeInTheDocument()
  })

  it('shows offline warning when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false })

    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )

    expect(screen.getByText(/You are offline/)).toBeInTheDocument()
  })

  it('navigates back when Cancel is clicked', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )

    const cancelButton = screen.getByTestId('cancel-button')
    cancelButton.click()
    expect(mockNavigate).toHaveBeenCalledWith('/creator/dashboard')
  })

  it('renders Creative Team section', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByText('Creative Team')).toBeInTheDocument()
  })

  it('renders Document Upload Hub', () => {
    render(
      <MemoryRouter>
        <CreatePitch />
      </MemoryRouter>
    )
    expect(screen.getByTestId('document-upload-hub')).toBeInTheDocument()
  })
})
