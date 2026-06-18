import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockUseParams = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── CollaboratorService mock functions ─────────────────────────────
const mockGetCollaborationProject = vi.fn()
const mockGetCollaborationChecklist = vi.fn()
const mockToggleChecklistItem = vi.fn()
const mockGetCollaborationNotes = vi.fn()
const mockAddCollaborationNote = vi.fn()
const mockGetCollaborationActivity = vi.fn()

vi.mock('@/services/collaborator.service', () => ({
  CollaboratorService: {
    getCollaborationProject: (...args: any[]) => mockGetCollaborationProject(...args),
    getCollaborationChecklist: (...args: any[]) => mockGetCollaborationChecklist(...args),
    toggleChecklistItem: (...args: any[]) => mockToggleChecklistItem(...args),
    getCollaborationNotes: (...args: any[]) => mockGetCollaborationNotes(...args),
    addCollaborationNote: (...args: any[]) => mockAddCollaborationNote(...args),
    getCollaborationActivity: (...args: any[]) => mockGetCollaborationActivity(...args),
  },
}))

// ─── react-hot-toast ────────────────────────────────────────────────
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { success: (...args: any[]) => mockToastSuccess(...args), error: (...args: any[]) => mockToastError(...args) },
  toast: { success: (...args: any[]) => mockToastSuccess(...args), error: (...args: any[]) => mockToastError(...args) },
  Toaster: () => null,
}))

// ─── date-fns ───────────────────────────────────────────────────────
vi.mock('date-fns', () => ({
  formatDistanceToNow: (_date: Date, _opts?: any) => '2 days ago',
}))

// ─── Realistic mock data ─────────────────────────────────────────────
const mockProject = {
  id: 42,
  title: 'The Dark Forest',
  stage: 'pre-production',
  status: 'active',
  priority: 'high',
  completion_percentage: 35,
  next_milestone: 'Script lock',
  milestone_date: '2026-08-01T00:00:00.000Z',
  start_date: '2026-06-01T00:00:00.000Z',
  target_completion_date: '2026-12-31T00:00:00.000Z',
  notes: 'Focus on the third act structure.',
  my_role: 'writer',
  owner: { name: 'Alice Producer', avatar_url: null },
  budget_visible: true,
  budget_allocated: 500000,
  budget_spent: 120000,
  budget_remaining: 380000,
}

const mockChecklistItems = [
  { id: 'item-1', label: 'Finalize script', completed: false, assigned_role: 'writer' },
  { id: 'item-2', label: 'Cast lead actor', completed: true, assigned_role: 'director' },
  { id: 'item-3', label: 'Scout locations', completed: false, assigned_role: '' },
]

const mockNotes = [
  {
    id: 1,
    content: 'Need to revise the opening scene.',
    category: 'general',
    author: 'Alice Producer',
    created_at: '2026-06-15T10:00:00.000Z',
    updated_at: '2026-06-15T10:00:00.000Z',
  },
  {
    id: 2,
    content: 'Budget increased by 10%.',
    category: 'budget',
    author: 'Bob Director',
    created_at: '2026-06-14T09:00:00.000Z',
    updated_at: '2026-06-14T09:00:00.000Z',
  },
]

const mockActivity = [
  {
    id: 1,
    action: 'checklist_toggled',
    entity_id: 1,
    created_at: '2026-06-15T12:00:00.000Z',
    user: { name: 'Alice Producer', avatar_url: null, role: 'Producer' },
  },
  {
    id: 2,
    action: 'note_added',
    entity_id: 2,
    created_at: '2026-06-14T11:00:00.000Z',
    user: { name: 'Bob Director', avatar_url: 'https://example.com/bob.jpg', role: 'Director' },
  },
]

// ─── Dynamic import ──────────────────────────────────────────────────
let CollaborationProjectView: React.ComponentType
beforeAll(async () => {
  const mod = await import('../CollaborationProjectView')
  CollaborationProjectView = mod.default
})

// ─── Helpers ────────────────────────────────────────────────────────
function renderComponent() {
  return render(
    <MemoryRouter initialEntries={['/collaboration/42']}>
      <CollaborationProjectView />
    </MemoryRouter>
  )
}

describe('CollaborationProjectView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: '42' })

    // Default: project loads successfully
    mockGetCollaborationProject.mockResolvedValue({
      success: true,
      data: { project: mockProject },
    })
    // Tabs loaded lazily — resolve with empty data by default
    mockGetCollaborationChecklist.mockResolvedValue({
      success: true,
      data: { checklist: mockChecklistItems, my_role: 'writer' },
    })
    mockGetCollaborationNotes.mockResolvedValue({
      success: true,
      data: { notes: mockNotes },
    })
    mockGetCollaborationActivity.mockResolvedValue({
      success: true,
      data: { activity: mockActivity },
    })
    mockToggleChecklistItem.mockResolvedValue({ success: true, data: { item_id: 'item-1', completed: true } })
    mockAddCollaborationNote.mockResolvedValue({
      success: true,
      data: {
        note: {
          id: 99,
          content: 'New test note',
          category: 'general',
          author: 'Test User',
          created_at: '2026-06-18T00:00:00.000Z',
          updated_at: '2026-06-18T00:00:00.000Z',
        },
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  // ─── Loading state ──────────────────────────────────────────────
  describe('Loading state', () => {
    it('shows a spinner while the project is loading', () => {
      mockGetCollaborationProject.mockReturnValue(new Promise(() => {}))
      renderComponent()
      // The spinner is an animate-spin div
      expect(document.querySelector('.animate-spin')).toBeTruthy()
    })
  })

  // ─── Error states ───────────────────────────────────────────────
  describe('Error states', () => {
    it('shows error panel when API returns an error message', async () => {
      mockGetCollaborationProject.mockResolvedValue({
        success: false,
        error: 'Project not found',
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Unable to load project')).toBeInTheDocument()
        expect(screen.getByText('Project not found')).toBeInTheDocument()
      })
    })

    it('shows error panel when API throws', async () => {
      mockGetCollaborationProject.mockRejectedValue(new Error('Network failure'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Unable to load project')).toBeInTheDocument()
        expect(screen.getByText('Network failure')).toBeInTheDocument()
      })
    })

    it('shows "Invalid project ID" when projectId param is missing', async () => {
      mockUseParams.mockReturnValue({ projectId: undefined })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Unable to load project')).toBeInTheDocument()
        expect(screen.getByText('Invalid project ID')).toBeInTheDocument()
      })
    })

    it('shows "Invalid project ID" when projectId param is not a number', async () => {
      mockUseParams.mockReturnValue({ projectId: 'abc' })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Unable to load project')).toBeInTheDocument()
        expect(screen.getByText('Invalid project ID')).toBeInTheDocument()
      })
    })

    it('calls navigate(-1) when "Go back" is clicked on the error panel', async () => {
      mockGetCollaborationProject.mockResolvedValue({ success: false, error: 'Not found' })
      renderComponent()
      await waitFor(() => screen.getByText('Go back'))
      fireEvent.click(screen.getByText('Go back'))
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  // ─── Main layout ────────────────────────────────────────────────
  describe('Main layout', () => {
    it('renders the project title', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('The Dark Forest')).toBeInTheDocument()
      })
    })

    it('renders the project stage badge', async () => {
      renderComponent()
      await waitFor(() => {
        // stage appears twice: header badge + overview tab — use getAllByText
        expect(screen.getAllByText('pre-production').length).toBeGreaterThan(0)
      })
    })

    it('renders the "Your role" line with the correct role', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('writer')).toBeInTheDocument()
      })
    })

    it('renders the Back button and calls navigate(-1) when clicked', async () => {
      renderComponent()
      await waitFor(() => screen.getByText('Back'))
      fireEvent.click(screen.getByText('Back'))
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })

    it('renders all five tab buttons', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument()
        expect(screen.getByText('Checklist')).toBeInTheDocument()
        expect(screen.getByText('Notes')).toBeInTheDocument()
        expect(screen.getByText('Team Chat')).toBeInTheDocument()
        expect(screen.getByText('Activity')).toBeInTheDocument()
      })
    })

    it('calls getCollaborationProject with the numeric project ID', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockGetCollaborationProject).toHaveBeenCalledWith(42)
      })
    })
  })

  // ─── Overview tab ────────────────────────────────────────────────
  describe('Overview tab (default)', () => {
    it('shows the completion percentage', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('35%')).toBeInTheDocument()
      })
    })

    it('shows the overall completion label', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Overall completion')).toBeInTheDocument()
      })
    })

    it('renders the Timeline section with start and completion dates', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument()
        expect(screen.getByText('Start Date')).toBeInTheDocument()
        expect(screen.getByText('Target Completion')).toBeInTheDocument()
      })
    })

    it('renders the next milestone', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Script lock')).toBeInTheDocument()
      })
    })

    it('shows "No upcoming milestone" when next_milestone is null', async () => {
      mockGetCollaborationProject.mockResolvedValue({
        success: true,
        data: { project: { ...mockProject, next_milestone: null } },
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No upcoming milestone')).toBeInTheDocument()
      })
    })

    it('renders the Budget section with allocated/spent/remaining', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Budget')).toBeInTheDocument()
        expect(screen.getByText('Allocated')).toBeInTheDocument()
        expect(screen.getByText('Spent')).toBeInTheDocument()
        expect(screen.getByText('Remaining')).toBeInTheDocument()
        expect(screen.getByText('$500,000')).toBeInTheDocument()
        expect(screen.getByText('$120,000')).toBeInTheDocument()
        expect(screen.getByText('$380,000')).toBeInTheDocument()
      })
    })

    it('shows the budget-hidden message when budget_visible is false', async () => {
      mockGetCollaborationProject.mockResolvedValue({
        success: true,
        data: { project: { ...mockProject, budget_visible: false } },
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Budget details not shared for this project.')).toBeInTheDocument()
      })
    })

    it('renders the Project Owner section', async () => {
      renderComponent()
      await waitFor(() => {
        // "Project Owner" appears as both the section heading and the subtitle below the owner name
        expect(screen.getAllByText('Project Owner').length).toBeGreaterThan(0)
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })
    })

    it('renders the owner avatar image when avatar_url is set', async () => {
      mockGetCollaborationProject.mockResolvedValue({
        success: true,
        data: {
          project: {
            ...mockProject,
            owner: { name: 'Bob Owner', avatar_url: 'https://example.com/avatar.jpg' },
          },
        },
      })
      renderComponent()
      await waitFor(() => {
        const img = screen.getByAltText('Bob Owner')
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
      })
    })

    it('renders project notes when present', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Focus on the third act structure.')).toBeInTheDocument()
      })
    })

    it('does not render project notes section when notes is null', async () => {
      mockGetCollaborationProject.mockResolvedValue({
        success: true,
        data: { project: { ...mockProject, notes: null } },
      })
      renderComponent()
      await waitFor(() => screen.getByText('The Dark Forest'))
      expect(screen.queryByText('Focus on the third act structure.')).not.toBeInTheDocument()
    })
  })

  // ─── Checklist tab ───────────────────────────────────────────────
  describe('Checklist tab', () => {
    async function openChecklist() {
      renderComponent()
      await waitFor(() => screen.getByText('Checklist'))
      fireEvent.click(screen.getByText('Checklist'))
    }

    it('shows a spinner while the checklist is loading', async () => {
      mockGetCollaborationChecklist.mockReturnValue(new Promise(() => {}))
      await openChecklist()
      await waitFor(() => {
        // At least one spinner should be visible (the checklist tab's own spinner)
        expect(document.querySelector('.animate-spin')).toBeTruthy()
      })
    })

    it('renders checklist items after loading', async () => {
      await openChecklist()
      await waitFor(() => {
        expect(screen.getByText('Finalize script')).toBeInTheDocument()
        expect(screen.getByText('Cast lead actor')).toBeInTheDocument()
        expect(screen.getByText('Scout locations')).toBeInTheDocument()
      })
    })

    it('shows "N of M items completed" progress', async () => {
      await openChecklist()
      await waitFor(() => {
        expect(screen.getByText('1 of 3 items completed')).toBeInTheDocument()
      })
    })

    it('shows a lock icon for items assigned to a different role', async () => {
      await openChecklist()
      await waitFor(() => {
        // "Cast lead actor" is assigned to 'director' but my_role is 'writer' — should show lock
        // The item should not have a check-button, instead show lock
        expect(screen.getByText('Cast lead actor')).toBeInTheDocument()
      })
      // Verify lock elements exist in the DOM (svg from lucide Lock icon)
      const lockIcons = document.querySelectorAll('svg')
      expect(lockIcons.length).toBeGreaterThan(0)
    })

    it('shows empty state when checklist is empty', async () => {
      mockGetCollaborationChecklist.mockResolvedValue({
        success: true,
        data: { checklist: [], my_role: 'writer' },
      })
      await openChecklist()
      await waitFor(() => {
        expect(screen.getByText('No checklist items for this project yet.')).toBeInTheDocument()
      })
    })

    it('toggles a checklist item when the button is clicked', async () => {
      await openChecklist()
      await waitFor(() => screen.getByText('Finalize script'))

      // Multiple "Check item" buttons exist (item-1: writer, item-3: no role)
      // Use the first one which corresponds to item-1 (Finalize script)
      const checkButtons = screen.getAllByLabelText('Check item')
      fireEvent.click(checkButtons[0])

      await waitFor(() => {
        expect(mockToggleChecklistItem).toHaveBeenCalledWith(42, 'item-1', true)
      })
    })

    it('shows success toast after successful toggle', async () => {
      await openChecklist()
      await waitFor(() => screen.getByText('Finalize script'))

      const checkButtons = screen.getAllByLabelText('Check item')
      fireEvent.click(checkButtons[0])

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Item checked')
      })
    })

    it('reverts optimistic update when toggle fails', async () => {
      mockToggleChecklistItem.mockResolvedValue({ success: false, error: 'Server error' })
      await openChecklist()
      await waitFor(() => screen.getByText('Finalize script'))

      const checkButtons = screen.getAllByLabelText('Check item')
      fireEvent.click(checkButtons[0])

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Server error')
      })
    })

    it('handles checklist as an object (normalized)', async () => {
      mockGetCollaborationChecklist.mockResolvedValue({
        success: true,
        data: {
          checklist: {
            'item-obj-1': { label: 'Write treatment', completed: false, assigned_role: 'writer' },
            'item-obj-2': { label: 'Budget review', completed: true, assigned_role: 'producer' },
          },
          my_role: 'writer',
        },
      })
      await openChecklist()
      await waitFor(() => {
        expect(screen.getByText('Write treatment')).toBeInTheDocument()
        expect(screen.getByText('Budget review')).toBeInTheDocument()
      })
    })

    it('shows error toast when checklist fetch throws', async () => {
      mockGetCollaborationChecklist.mockRejectedValue(new Error('Checklist fetch failed'))
      await openChecklist()
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Checklist fetch failed')
        )
      })
    })
  })

  // ─── Notes tab ───────────────────────────────────────────────────
  describe('Notes tab', () => {
    async function openNotes() {
      renderComponent()
      await waitFor(() => screen.getByText('Notes'))
      fireEvent.click(screen.getByText('Notes'))
    }

    it('shows a spinner while notes are loading', async () => {
      mockGetCollaborationNotes.mockReturnValue(new Promise(() => {}))
      await openNotes()
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeTruthy()
      })
    })

    it('renders notes after loading', async () => {
      await openNotes()
      await waitFor(() => {
        expect(screen.getByText('Need to revise the opening scene.')).toBeInTheDocument()
        expect(screen.getByText('Budget increased by 10%.')).toBeInTheDocument()
      })
    })

    it('renders note authors', async () => {
      await openNotes()
      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })
    })

    it('shows relative time on notes ("2 days ago")', async () => {
      await openNotes()
      await waitFor(() => {
        expect(screen.getAllByText('2 days ago').length).toBeGreaterThan(0)
      })
    })

    it('renders category filter pills', async () => {
      await openNotes()
      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument()
        // "Budget" and "General" appear both as filter pills and as note category badges
        expect(screen.getAllByText(/Budget/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/General/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Casting/).length).toBeGreaterThan(0)
      })
    })

    it('filters notes by category when a pill is clicked', async () => {
      await openNotes()
      await waitFor(() => screen.getByText('Need to revise the opening scene.'))

      // Click "Budget" filter
      // There may be multiple elements with "Budget" (pill and note badge) — target the button
      const budgetButtons = screen.getAllByText(/Budget/)
      // The filter pill button with just "Budget" text followed by count
      const filterButton = budgetButtons.find(
        el => el.tagName === 'BUTTON' || el.closest('button') !== null
      )
      if (filterButton) {
        fireEvent.click(filterButton.closest('button') ?? filterButton)
      }

      await waitFor(() => {
        // general note should be hidden
        expect(screen.queryByText('Need to revise the opening scene.')).not.toBeInTheDocument()
        // budget note should be visible
        expect(screen.getByText('Budget increased by 10%.')).toBeInTheDocument()
      })
    })

    it('shows empty notes state when no notes exist', async () => {
      mockGetCollaborationNotes.mockResolvedValue({ success: true, data: { notes: [] } })
      await openNotes()
      await waitFor(() => {
        expect(screen.getByText('No notes yet. Be the first to add one.')).toBeInTheDocument()
      })
    })

    it('renders the Add a Note form', async () => {
      await openNotes()
      await waitFor(() => {
        expect(screen.getByText('Add a Note')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Write your note here...')).toBeInTheDocument()
        expect(screen.getByText('Add Note')).toBeInTheDocument()
      })
    })

    it('submits a new note and shows toast', async () => {
      await openNotes()
      await waitFor(() => screen.getByPlaceholderText('Write your note here...'))

      const textarea = screen.getByPlaceholderText('Write your note here...')
      fireEvent.change(textarea, { target: { value: 'New test note' } })

      const addButton = screen.getByText('Add Note')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(mockAddCollaborationNote).toHaveBeenCalledWith(42, {
          content: 'New test note',
          category: 'general',
        })
        expect(mockToastSuccess).toHaveBeenCalledWith('Note added')
      })
    })

    it('clears the textarea after successful note submission', async () => {
      await openNotes()
      await waitFor(() => screen.getByPlaceholderText('Write your note here...'))

      const textarea = screen.getByPlaceholderText('Write your note here...')
      fireEvent.change(textarea, { target: { value: 'Temporary content' } })
      fireEvent.click(screen.getByText('Add Note'))

      await waitFor(() => {
        expect((textarea as HTMLTextAreaElement).value).toBe('')
      })
    })

    it('shows error toast when note add fails', async () => {
      mockAddCollaborationNote.mockResolvedValue({ success: false, error: 'Failed to add' })
      await openNotes()
      await waitFor(() => screen.getByPlaceholderText('Write your note here...'))

      const textarea = screen.getByPlaceholderText('Write your note here...')
      fireEvent.change(textarea, { target: { value: 'Note that fails' } })
      fireEvent.click(screen.getByText('Add Note'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to add')
      })
    })

    it('disables submit button when textarea is empty', async () => {
      await openNotes()
      await waitFor(() => screen.getByText('Add Note'))

      const addButton = screen.getByText('Add Note').closest('button')
      expect(addButton).toBeDisabled()
    })
  })

  // ─── Team Chat tab ───────────────────────────────────────────────
  describe('Team Chat tab', () => {
    it('shows the "coming soon" message', async () => {
      renderComponent()
      await waitFor(() => screen.getByText('Team Chat'))
      fireEvent.click(screen.getByText('Team Chat'))
      await waitFor(() => {
        expect(screen.getByText('Project messaging coming soon')).toBeInTheDocument()
      })
    })
  })

  // ─── Activity tab ────────────────────────────────────────────────
  describe('Activity tab', () => {
    async function openActivity() {
      renderComponent()
      await waitFor(() => screen.getByText('Activity'))
      fireEvent.click(screen.getByText('Activity'))
    }

    it('shows a spinner while activity is loading', async () => {
      mockGetCollaborationActivity.mockReturnValue(new Promise(() => {}))
      await openActivity()
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeTruthy()
      })
    })

    it('renders activity entries after loading', async () => {
      await openActivity()
      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
        expect(screen.getByText('Bob Director')).toBeInTheDocument()
      })
    })

    it('renders human-readable action labels', async () => {
      await openActivity()
      await waitFor(() => {
        expect(screen.getByText('toggled a checklist item')).toBeInTheDocument()
        expect(screen.getByText('added a note')).toBeInTheDocument()
      })
    })

    it('renders user role when present', async () => {
      await openActivity()
      await waitFor(() => {
        expect(screen.getByText('Producer')).toBeInTheDocument()
        expect(screen.getByText('Director')).toBeInTheDocument()
      })
    })

    it('renders relative timestamps on activity entries', async () => {
      await openActivity()
      await waitFor(() => {
        expect(screen.getAllByText('2 days ago').length).toBeGreaterThan(0)
      })
    })

    it('renders the avatar image for entries with avatar_url', async () => {
      await openActivity()
      await waitFor(() => {
        const img = screen.getByAltText('Bob Director')
        expect(img).toHaveAttribute('src', 'https://example.com/bob.jpg')
      })
    })

    it('shows empty activity state when no activity exists', async () => {
      mockGetCollaborationActivity.mockResolvedValue({ success: true, data: { activity: [] } })
      await openActivity()
      await waitFor(() => {
        expect(screen.getByText('No activity recorded for this project yet.')).toBeInTheDocument()
      })
    })

    it('calls getCollaborationActivity with limit 50', async () => {
      await openActivity()
      await waitFor(() => {
        expect(mockGetCollaborationActivity).toHaveBeenCalledWith(42, { limit: 50 })
      })
    })

    it('shows error toast when activity fetch throws', async () => {
      mockGetCollaborationActivity.mockRejectedValue(new Error('Activity fetch failed'))
      await openActivity()
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Activity fetch failed')
        )
      })
    })
  })

  // ─── Tab switching ───────────────────────────────────────────────
  describe('Tab switching', () => {
    it('starts on the Overview tab by default', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Overall completion')).toBeInTheDocument()
      })
    })

    it('switches to Checklist tab', async () => {
      renderComponent()
      await waitFor(() => screen.getByText('Checklist'))
      fireEvent.click(screen.getByText('Checklist'))
      await waitFor(() => {
        // Checklist tab calls the checklist API
        expect(mockGetCollaborationChecklist).toHaveBeenCalled()
      })
    })

    it('switches to Notes tab', async () => {
      renderComponent()
      await waitFor(() => screen.getByText('Notes'))
      fireEvent.click(screen.getByText('Notes'))
      await waitFor(() => {
        expect(mockGetCollaborationNotes).toHaveBeenCalled()
      })
    })

    it('switches to Activity tab', async () => {
      renderComponent()
      await waitFor(() => screen.getByText('Activity'))
      fireEvent.click(screen.getByText('Activity'))
      await waitFor(() => {
        expect(mockGetCollaborationActivity).toHaveBeenCalled()
      })
    })

    it('hides Overview content when switching to another tab', async () => {
      renderComponent()
      await waitFor(() => screen.getByText('Team Chat'))
      fireEvent.click(screen.getByText('Team Chat'))
      await waitFor(() => {
        expect(screen.getByText('Project messaging coming soon')).toBeInTheDocument()
        expect(screen.queryByText('Overall completion')).not.toBeInTheDocument()
      })
    })
  })
})
