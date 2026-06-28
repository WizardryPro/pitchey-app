import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ──────────────────────────────────────────
const mockNavigate = vi.fn()
const mockSaveDraft = vi.fn()
const mockPublishDraft = vi.fn()
const mockLoadDraft = vi.fn()
const mockAddPitch = vi.fn()
const mockSetCurrentDraft = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ──────────────────────────────────────────────────────
const mockUser = { id: 1, name: 'Production User', email: 'prod@test.com', user_type: 'production' }
const mockAuthState = { user: mockUser, isAuthenticated: true }
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Pitch store ─────────────────────────────────────────────────────
const mockPitchStoreState = {
  saveDraft: (...args: any[]) => mockSaveDraft(...args),
  publishDraft: (...args: any[]) => mockPublishDraft(...args),
  loadDraft: (...args: any[]) => mockLoadDraft(...args),
  addPitch: (...args: any[]) => mockAddPitch(...args),
  currentDraft: null,
  setCurrentDraft: (...args: any[]) => mockSetCurrentDraft(...args),
}
vi.mock('@features/pitches/store/pitchStore', () => ({
  usePitchStore: () => mockPitchStoreState,
}))

// ─── pitchConstants ──────────────────────────────────────────────────
vi.mock('@config/pitchConstants', () => ({
  getGenresSync: () => ['Action', 'Drama', 'Comedy', 'Thriller'],
  getFormatsSync: () => ['Feature Film', 'Short Film', 'Series'],
  getBudgetRangesSync: () => ['Under $1M', '$1M - $5M', '$5M - $20M', 'Over $20M'],
  getGenres: () => Promise.resolve(['Action', 'Drama', 'Comedy', 'Thriller']),
  getFormats: () => Promise.resolve(['Feature Film', 'Short Film', 'Series']),
  getBudgetRanges: () => Promise.resolve(['Under $1M', '$1M - $5M', '$5M - $20M', 'Over $20M']),
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ProductionPitchCreate')
  Component = mod.default
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionPitchCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPitchStoreState.currentDraft = null
    mockLoadDraft.mockReturnValue(null)
  })

  describe('page header', () => {
    it('renders the page title', () => {
      renderComponent()
      expect(screen.getByText('Create Production Pitch')).toBeInTheDocument()
    })

    it('renders the page subtitle', () => {
      renderComponent()
      expect(screen.getByText('Upload comprehensive pitch materials')).toBeInTheDocument()
    })

    it('renders Save Draft button', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
    })
  })

  describe('step progress bar', () => {
    it('renders all 5 step numbers', () => {
      renderComponent()
      // Steps 1-5 are rendered as buttons in the progress bar
      // step 1 is current so it shows the number
      const progressArea = document.querySelector('.border-b.bg-white')
      expect(progressArea).toBeInTheDocument()
    })

    it('renders step labels on medium+ screens', () => {
      renderComponent()
      // Each step label appears at least once (step 1 label also appears as h2 in content)
      expect(screen.getAllByText('Basic Information').length).toBeGreaterThan(0)
      expect(screen.getByText('Synopsis & Story')).toBeInTheDocument()
      expect(screen.getByText('Budget & Timeline')).toBeInTheDocument()
      expect(screen.getByText('Media & Documents')).toBeInTheDocument()
      expect(screen.getByText('Review & Visibility')).toBeInTheDocument()
    })
  })

  describe('Step 1: Basic Information', () => {
    it('shows Step 1 content by default', () => {
      renderComponent()
      expect(screen.getAllByText('Basic Information').length).toBeGreaterThan(0)
      expect(screen.getByText('Start with the essential details of your production')).toBeInTheDocument()
    })

    it('renders Project Title input', () => {
      renderComponent()
      expect(screen.getByPlaceholderText('Enter your project title')).toBeInTheDocument()
    })

    it('renders Genre select with options from config', () => {
      renderComponent()
      expect(screen.getByText('Select Genre')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Action' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Drama' })).toBeInTheDocument()
    })

    it('renders Format select with options from config', () => {
      renderComponent()
      expect(screen.getByText('Select Format')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Feature Film' })).toBeInTheDocument()
    })

    it('renders Logline textarea', () => {
      renderComponent()
      expect(screen.getByPlaceholderText('A compelling one-sentence description of your project')).toBeInTheDocument()
    })

    it('shows validation errors when Next is clicked with empty fields', () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.getByText('Title is required')).toBeInTheDocument()
      expect(screen.getByText('Genre is required')).toBeInTheDocument()
      expect(screen.getByText('Format is required')).toBeInTheDocument()
      expect(screen.getByText('Logline is required')).toBeInTheDocument()
    })

    it('clears title error when user types in title field', () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.getByText('Title is required')).toBeInTheDocument()

      fireEvent.change(screen.getByPlaceholderText('Enter your project title'), {
        target: { value: 'My Film' }
      })
      expect(screen.queryByText('Title is required')).not.toBeInTheDocument()
    })

    it('advances to step 2 when all Step 1 fields are filled', () => {
      renderComponent()
      fireEvent.change(screen.getByPlaceholderText('Enter your project title'), {
        target: { name: 'title', value: 'My Great Film' }
      })
      // Use querySelectorAll for selects since they share same default value
      const selects = document.querySelectorAll('select')
      fireEvent.change(selects[0], { target: { value: 'action' } })
      fireEvent.change(selects[1], { target: { value: 'feature_film' } })
      fireEvent.change(screen.getByPlaceholderText('A compelling one-sentence description of your project'), {
        target: { name: 'logline', value: 'A hero on a journey' }
      })

      fireEvent.click(screen.getByRole('button', { name: /next/i }))

      // Step 2 content should appear
      expect(screen.getByPlaceholderText(/A brief overview of your story/i)).toBeInTheDocument()
    })
  })

  describe('Step 2: Synopsis & Story', () => {
    // Helper to navigate to step 2
    function goToStep2() {
      const selects = document.querySelectorAll('select')
      fireEvent.change(screen.getByPlaceholderText('Enter your project title'), {
        target: { name: 'title', value: 'My Film' }
      })
      fireEvent.change(selects[0], { target: { value: 'action' } })
      fireEvent.change(selects[1], { target: { value: 'feature_film' } })
      fireEvent.change(screen.getByPlaceholderText('A compelling one-sentence description of your project'), {
        target: { name: 'logline', value: 'A hero on a journey' }
      })
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
    }

    it('renders Short Synopsis textarea on step 2', () => {
      renderComponent()
      goToStep2()
      expect(screen.getByPlaceholderText(/A brief overview of your story/i)).toBeInTheDocument()
    })

    it('shows validation error when Short Synopsis is empty on next', () => {
      renderComponent()
      goToStep2()
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.getByText('Short synopsis is required')).toBeInTheDocument()
    })

    it('allows navigating back to step 1 via Previous button', () => {
      renderComponent()
      goToStep2()
      fireEvent.click(screen.getByRole('button', { name: /previous/i }))
      // Back on step 1 — the title input is visible again
      expect(screen.getByPlaceholderText('Enter your project title')).toBeInTheDocument()
    })
  })

  describe('Save Draft', () => {
    it('calls saveDraft when Save Draft button is clicked', () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
      expect(mockSaveDraft).toHaveBeenCalledTimes(1)
    })

    it('shows save success message after saving draft', async () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
      expect(screen.getByText('Draft saved successfully!')).toBeInTheDocument()
    })

    it('saves draft data including title', () => {
      renderComponent()
      fireEvent.change(screen.getByPlaceholderText('Enter your project title'), {
        target: { name: 'title', value: 'My Great Film' }
      })
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
      expect(mockSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Great Film', status: 'draft' })
      )
    })
  })

  describe('Step 5: Publish button', () => {
    it('does not show Publish Pitch button on step 1', () => {
      renderComponent()
      expect(screen.queryByRole('button', { name: /publish pitch/i })).not.toBeInTheDocument()
    })
  })

  describe('loading draft on mount', () => {
    it('does not call loadDraft when no draftId param', () => {
      renderComponent()
      expect(mockLoadDraft).not.toHaveBeenCalled()
    })

    it('populates form from currentDraft when available', () => {
      mockPitchStoreState.currentDraft = {
        id: 99,
        title: 'Draft Title From Store',
        genre: 'Drama',
        format: 'feature_film',
        logline: 'Draft logline',
        shortSynopsis: 'Draft synopsis',
        longSynopsis: '',
        characters: [],
        budget: '$1M - $5M',
        themes: [],
        targetAudience: '',
        comparableTitles: '',
        visibilitySettings: { showShortSynopsis: true, showCharacters: false, showBudget: false, showMedia: false },
        status: 'draft' as const,
        viewCount: 0, likeCount: 0, ndaCount: 0, followersCount: 0,
        createdAt: '',
        mediaFiles: [],
      }

      renderComponent()
      expect(screen.getByDisplayValue('Draft Title From Store')).toBeInTheDocument()
    })
  })
})
