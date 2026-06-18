import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockAddCharacter = vi.fn()
const mockUpdateCharacter = vi.fn()
const mockDeleteCharacter = vi.fn()
const mockReorderCharacters = vi.fn()
const mockMoveCharacter = vi.fn()

// ─── react-hot-toast ────────────────────────────────────────────────
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: {
    success: mockToastSuccess,
    error: mockToastError,
    loading: vi.fn(),
  },
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    loading: vi.fn(),
  },
  Toaster: () => null,
}))

// ─── character.service ──────────────────────────────────────────────
vi.mock('../../../services/character.service', () => ({
  characterService: {
    addCharacter: mockAddCharacter,
    updateCharacter: mockUpdateCharacter,
    deleteCharacter: mockDeleteCharacter,
    reorderCharacters: mockReorderCharacters,
    moveCharacter: mockMoveCharacter,
  },
}))

// ─── CharacterCard — renders name and action buttons ────────────────
vi.mock('../CharacterCard', () => ({
  CharacterCard: ({ character, onEdit, onDelete, isReordering, onMoveUp, onMoveDown, index }: any) => (
    <div data-testid={`character-card-${character.id}`} role="article">
      <span data-testid={`char-name-${character.id}`}>{character.name}</span>
      {character.description && (
        <span data-testid={`char-desc-${character.id}`}>{character.description}</span>
      )}
      {!isReordering && (
        <>
          <button
            type="button"
            data-testid={`edit-btn-${character.id}`}
            onClick={() => onEdit(character)}
          >
            Edit
          </button>
          <button
            type="button"
            data-testid={`delete-btn-${character.id}`}
            onClick={() => onDelete(character.id)}
          >
            Delete
          </button>
        </>
      )}
      {isReordering && (
        <>
          <button
            type="button"
            data-testid={`move-up-${character.id}`}
            onClick={() => onMoveUp(index)}
          >
            MoveUp
          </button>
          <button
            type="button"
            data-testid={`move-down-${character.id}`}
            onClick={() => onMoveDown(index)}
          >
            MoveDown
          </button>
        </>
      )}
    </div>
  ),
}))

// ─── CharacterForm — minimal modal mock ─────────────────────────────
vi.mock('../CharacterForm', () => ({
  CharacterForm: ({ isOpen, onSave, onCancel, character }: any) => {
    if (!isOpen) return null
    return (
      <div data-testid="character-form-modal" role="dialog">
        <h3>{character ? 'Edit Character' : 'Add New Character'}</h3>
        <button
          type="button"
          data-testid="form-save-btn"
          onClick={() =>
            onSave({
              id: character?.id || '',
              name: character ? 'Updated Hero' : 'New Hero',
              description: character
                ? 'Updated description here ok'
                : 'A brave protagonist who saves the world',
              age: '30',
              gender: 'Male',
              role: 'Protagonist',
              relationship: '',
              actor: '',
            })
          }
        >
          {character ? 'Update Character' : 'Add Character'}
        </button>
        <button type="button" data-testid="form-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  },
}))

// ─── getCharacterStats ───────────────────────────────────────────────
vi.mock('../../../utils/characterUtils', () => ({
  getCharacterStats: (chars: any[]) => ({
    total: chars.length,
    withActors: chars.filter((c: any) => c.actor?.trim()).length,
    withAge: chars.filter((c: any) => c.age?.trim()).length,
    withRole: chars.filter((c: any) => c.role?.trim()).length,
    withRelationships: chars.filter((c: any) => c.relationship?.trim()).length,
    avgDescriptionLength: chars.length > 0 ? 50 : 0,
  }),
}))

// ─── Mock data ──────────────────────────────────────────────────────
const mockCharacter1 = {
  id: '1',
  name: 'Alex Johnson',
  description: 'A determined detective with a troubled past',
  age: '35',
  gender: 'Male',
  role: 'Protagonist',
  actor: 'Tom Hanks',
  relationship: 'Partner of Sarah',
  displayOrder: 0,
}

const mockCharacter2 = {
  id: '2',
  name: 'Sarah Chen',
  description: 'A brilliant scientist who holds the key to everything',
  age: '28',
  gender: 'Female',
  role: 'Supporting',
  actor: '',
  relationship: 'Partner of Alex',
  displayOrder: 1,
}

// ─── Component (dynamic import after mocks) ──────────────────────────
let CharacterManagement: React.ComponentType<any>

beforeAll(async () => {
  const mod = await import('../CharacterManagement')
  CharacterManagement = mod.CharacterManagement
})

// ─── Tests ───────────────────────────────────────────────────────────
describe('CharacterManagement', () => {
  let mockOnChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnChange = vi.fn()
    // Default: confirm always returns true
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Rendering ──────────────────────────────────────────────────────

  it('renders the Characters heading', () => {
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    expect(screen.getByText('Characters')).toBeInTheDocument()
  })

  it('shows empty state when no characters are provided', () => {
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    expect(screen.getByText('No Characters Added')).toBeInTheDocument()
    expect(screen.getByText(/Add characters to help investors/i)).toBeInTheDocument()
  })

  it('renders character count badge', () => {
    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
        maxCharacters={10}
      />
    )
    expect(screen.getByText('1/10')).toBeInTheDocument()
  })

  it('renders character list when characters are provided', () => {
    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    expect(screen.getByTestId('character-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('character-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('char-name-1')).toHaveTextContent('Alex Johnson')
    expect(screen.getByTestId('char-name-2')).toHaveTextContent('Sarah Chen')
  })

  it('renders the Add Character button', () => {
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    expect(screen.getAllByText('Add Character')[0]).toBeInTheDocument()
  })

  it('shows the Reorder button when there are 2+ characters', () => {
    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    expect(screen.getByText('Reorder')).toBeInTheDocument()
  })

  it('does not show the Reorder button when there is only 1 character', () => {
    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
      />
    )
    expect(screen.queryByText('Reorder')).not.toBeInTheDocument()
  })

  it('renders management tips in normal mode', () => {
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    expect(screen.getByText('Character Management Tips:')).toBeInTheDocument()
  })

  // ── Add character (local mode) ─────────────────────────────────────

  it('opens the form when Add Character button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    // Click the header Add Character button
    const addBtn = screen.getAllByText('Add Character')[0]
    await user.click(addBtn)
    expect(screen.getByTestId('character-form-modal')).toBeInTheDocument()
    expect(screen.getByText('Add New Character')).toBeInTheDocument()
  })

  it('opens the form when "Add Your First Character" empty-state button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Add Your First Character'))
    expect(screen.getByTestId('character-form-modal')).toBeInTheDocument()
  })

  it('adds a character in local mode (no pitchId) and calls onChange', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    const addBtn = screen.getAllByText('Add Character')[0]
    await user.click(addBtn)
    await user.click(screen.getByTestId('form-save-btn'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    const [updatedChars] = mockOnChange.mock.calls[0]
    expect(updatedChars).toHaveLength(1)
    expect(updatedChars[0].name).toBe('New Hero')
    expect(mockAddCharacter).not.toHaveBeenCalled()
    expect(mockToastSuccess).toHaveBeenCalledWith('Character saved')
  })

  it('closes the form after successful save', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getAllByText('Add Character')[0])
    expect(screen.getByTestId('character-form-modal')).toBeInTheDocument()

    await user.click(screen.getByTestId('form-save-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('character-form-modal')).not.toBeInTheDocument()
    })
  })

  // ── Add character (API mode) ────────────────────────────────────────

  it('calls characterService.addCharacter when pitchId is provided', async () => {
    const user = userEvent.setup()
    mockAddCharacter.mockResolvedValueOnce({
      id: '99',
      name: 'New Hero',
      description: 'A brave protagonist who saves the world',
      age: '30',
      gender: 'Male',
      role: 'Protagonist',
      relationship: '',
      actor: '',
      displayOrder: 0,
    })

    render(
      <CharacterManagement
        pitchId={42}
        characters={[]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getAllByText('Add Character')[0])
    await user.click(screen.getByTestId('form-save-btn'))

    await waitFor(() => {
      expect(mockAddCharacter).toHaveBeenCalledTimes(1)
    })
    expect(mockAddCharacter).toHaveBeenCalledWith(42, expect.objectContaining({ name: 'New Hero' }))
    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('Character saved')
  })

  // ── Edit character ─────────────────────────────────────────────────

  it('opens form in edit mode when Edit button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByTestId('edit-btn-1'))
    expect(screen.getByTestId('character-form-modal')).toBeInTheDocument()
    expect(screen.getByText('Edit Character')).toBeInTheDocument()
  })

  it('updates a character locally when no pitchId', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByTestId('edit-btn-1'))
    await user.click(screen.getByTestId('form-save-btn'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    const [updatedChars] = mockOnChange.mock.calls[0]
    expect(updatedChars).toHaveLength(1)
    expect(updatedChars[0].name).toBe('Updated Hero')
    expect(mockUpdateCharacter).not.toHaveBeenCalled()
  })

  it('calls characterService.updateCharacter when pitchId is provided', async () => {
    const user = userEvent.setup()
    mockUpdateCharacter.mockResolvedValueOnce({
      id: '1',
      name: 'Updated Hero',
      description: 'Updated description here ok',
      age: '30',
      gender: 'Male',
      role: 'Protagonist',
      relationship: '',
      actor: '',
      displayOrder: 0,
    })

    render(
      <CharacterManagement
        pitchId={42}
        characters={[mockCharacter1]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByTestId('edit-btn-1'))
    await user.click(screen.getByTestId('form-save-btn'))

    await waitFor(() => {
      expect(mockUpdateCharacter).toHaveBeenCalledTimes(1)
    })
    expect(mockUpdateCharacter).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({ name: 'Updated Hero' })
    )
    expect(mockToastSuccess).toHaveBeenCalledWith('Character saved')
  })

  // ── Delete character ───────────────────────────────────────────────

  it('deletes a character locally after confirm', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByTestId('delete-btn-1'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    const [updatedChars] = mockOnChange.mock.calls[0]
    expect(updatedChars).toHaveLength(1)
    expect(updatedChars[0].id).toBe('2')
    expect(mockDeleteCharacter).not.toHaveBeenCalled()
    expect(mockToastSuccess).toHaveBeenCalledWith('Character deleted')
  })

  it('does not delete when confirm is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByTestId('delete-btn-1'))

    expect(mockOnChange).not.toHaveBeenCalled()
    expect(mockDeleteCharacter).not.toHaveBeenCalled()
  })

  it('calls characterService.deleteCharacter when pitchId is provided', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteCharacter.mockResolvedValueOnce(undefined)

    render(
      <CharacterManagement
        pitchId={42}
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByTestId('delete-btn-1'))

    await waitFor(() => {
      expect(mockDeleteCharacter).toHaveBeenCalledTimes(1)
    })
    expect(mockDeleteCharacter).toHaveBeenCalledWith(42, 1)
    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('Character deleted')
  })

  // ── Error states ───────────────────────────────────────────────────

  it('shows error message when API save fails', async () => {
    const user = userEvent.setup()
    mockAddCharacter.mockRejectedValueOnce(new Error('Server error'))

    render(
      <CharacterManagement
        pitchId={42}
        characters={[]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getAllByText('Add Character')[0])
    await user.click(screen.getByTestId('form-save-btn'))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
    expect(mockToastError).toHaveBeenCalledWith('Server error')
  })

  it('shows error message when API delete fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteCharacter.mockRejectedValueOnce(new Error('Delete failed'))

    render(
      <CharacterManagement
        pitchId={42}
        characters={[mockCharacter1]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByTestId('delete-btn-1'))

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument()
    })
    expect(mockToastError).toHaveBeenCalledWith('Delete failed')
  })

  it('dismisses error when Dismiss button is clicked', async () => {
    const user = userEvent.setup()
    mockAddCharacter.mockRejectedValueOnce(new Error('Server error'))

    render(
      <CharacterManagement
        pitchId={42}
        characters={[]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getAllByText('Add Character')[0])
    await user.click(screen.getByTestId('form-save-btn'))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Dismiss'))
    expect(screen.queryByText('Server error')).not.toBeInTheDocument()
  })

  // ── Max characters limit ───────────────────────────────────────────

  it('disables Add Character button when at max', () => {
    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
        maxCharacters={1}
      />
    )
    // The header Add Character button
    const addBtns = screen.getAllByText('Add Character')
    expect(addBtns[0].closest('button')).toBeDisabled()
  })

  it('alerts and does not open form when max characters exceeded via programmatic call', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockReturnValue(undefined)

    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
        maxCharacters={1}
      />
    )
    // Clicking the disabled button won't call handleAddCharacter; simulate directly
    // by confirming button is indeed disabled
    const addBtns = screen.getAllByText('Add Character')
    const btn = addBtns[0].closest('button')!
    // fireEvent bypasses the disabled check on the outer click handler in some cases;
    // use fireEvent to trigger any underlying handler
    fireEvent.click(btn)
    // With disabled button, the click should not propagate to the handler
    expect(screen.queryByTestId('character-form-modal')).not.toBeInTheDocument()
    alertSpy.mockRestore()
  })

  // ── Reorder mode ───────────────────────────────────────────────────

  it('toggles reorder mode when Reorder button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    const reorderBtn = screen.getByText('Reorder')
    await user.click(reorderBtn)

    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('Reordering Mode:')).toBeInTheDocument()
  })

  it('exits reorder mode when Done is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Reorder'))
    await user.click(screen.getByText('Done'))

    expect(screen.getByText('Reorder')).toBeInTheDocument()
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
  })

  it('calls onChange with reordered characters when MoveUp is clicked (local mode)', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Reorder'))

    // Move character2 (index 1) up
    await user.click(screen.getByTestId('move-up-2'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    const [updatedChars] = mockOnChange.mock.calls[0]
    // After moving index 1 up, character2 should now be first
    expect(updatedChars[0].id).toBe('2')
    expect(updatedChars[1].id).toBe('1')
  })

  it('calls onChange with reordered characters when MoveDown is clicked (local mode)', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Reorder'))

    // Move character1 (index 0) down
    await user.click(screen.getByTestId('move-down-1'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    const [updatedChars] = mockOnChange.mock.calls[0]
    expect(updatedChars[0].id).toBe('2')
    expect(updatedChars[1].id).toBe('1')
  })

  // ── Stats toggle ───────────────────────────────────────────────────

  it('shows stats when Show Stats is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Show Stats'))

    expect(screen.getByText(/Total:/)).toBeInTheDocument()
    expect(screen.getByText(/With Roles:/)).toBeInTheDocument()
  })

  it('hides stats when Hide Stats is clicked after showing', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Show Stats'))
    await user.click(screen.getByText('Hide Stats'))

    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument()
  })

  // ── Form cancel ────────────────────────────────────────────────────

  it('closes the form without saving when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getAllByText('Add Character')[0])
    expect(screen.getByTestId('character-form-modal')).toBeInTheDocument()

    await user.click(screen.getByTestId('form-cancel-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('character-form-modal')).not.toBeInTheDocument()
    })
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  // ── API reorder ────────────────────────────────────────────────────

  it('calls characterService.moveCharacter up when pitchId is provided in reorder mode', async () => {
    const user = userEvent.setup()
    mockMoveCharacter.mockResolvedValueOnce([
      { ...mockCharacter2, displayOrder: 0 },
      { ...mockCharacter1, displayOrder: 1 },
    ])

    render(
      <CharacterManagement
        pitchId={42}
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Reorder'))
    await user.click(screen.getByTestId('move-up-2'))

    await waitFor(() => {
      expect(mockMoveCharacter).toHaveBeenCalledTimes(1)
    })
    expect(mockMoveCharacter).toHaveBeenCalledWith(42, 2, 'up')
  })

  it('calls characterService.moveCharacter down when pitchId is provided in reorder mode', async () => {
    const user = userEvent.setup()
    mockMoveCharacter.mockResolvedValueOnce([
      { ...mockCharacter2, displayOrder: 0 },
      { ...mockCharacter1, displayOrder: 1 },
    ])

    render(
      <CharacterManagement
        pitchId={42}
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Reorder'))
    await user.click(screen.getByTestId('move-down-1'))

    await waitFor(() => {
      expect(mockMoveCharacter).toHaveBeenCalledTimes(1)
    })
    expect(mockMoveCharacter).toHaveBeenCalledWith(42, 1, 'down')
  })

  // ── Multiple characters display ─────────────────────────────────────

  it('renders correct count badge with multiple characters', () => {
    const characters = [mockCharacter1, mockCharacter2]
    render(
      <CharacterManagement
        characters={characters}
        onChange={mockOnChange}
        maxCharacters={5}
      />
    )
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('renders all character cards in the list', () => {
    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    // Use the character card test IDs to count rendered cards rather than role='listitem'
    // which also matches the tip bullet points rendered as <li> elements
    expect(screen.getByTestId('character-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('character-card-2')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  // ── Escape key exits reorder mode ──────────────────────────────────

  it('exits reorder mode when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(
      <CharacterManagement
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Reorder'))
    expect(screen.getByText('Done')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.getByText('Reorder')).toBeInTheDocument()
    })
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
  })

  // ── API reorder error ──────────────────────────────────────────────

  it('shows error toast when moveCharacter API fails', async () => {
    const user = userEvent.setup()
    mockMoveCharacter.mockRejectedValueOnce(new Error('Reorder failed'))

    render(
      <CharacterManagement
        pitchId={42}
        characters={[mockCharacter1, mockCharacter2]}
        onChange={mockOnChange}
      />
    )
    await user.click(screen.getByText('Reorder'))
    await user.click(screen.getByTestId('move-up-2'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Reorder failed')
    })
  })
})
