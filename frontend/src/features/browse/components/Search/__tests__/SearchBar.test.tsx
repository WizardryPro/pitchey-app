import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockApiGet = vi.fn()

// ─── API client — must match the EXACT specifier used by SearchBar.tsx ──
// SearchBar imports: import { apiClient } from '@/lib/api-client'
// '@/' resolves to 'src/' via vitest alias
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: mockApiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let SearchBar: React.ComponentType<any>
beforeAll(async () => {
  const mod = await import('../SearchBar')
  SearchBar = mod.SearchBar
})

// ─── Default props factory ────────────────────────────────────────────
const makeProps = (overrides: Record<string, any> = {}) => ({
  value: '',
  onChange: vi.fn(),
  onSearch: vi.fn(),
  ...overrides,
})

// Helper: flush all pending microtasks
const flushPromises = () => new Promise<void>(r => setTimeout(r, 0))

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: history returns empty, suggestions return empty
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/history')) {
        return Promise.resolve({ success: true, data: { searchHistory: [] } })
      }
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({ success: true, data: { suggestions: [] } })
      }
      return Promise.resolve({ success: false, data: {} })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Rendering ─────────────────────────────────────────────────────

  it('renders the search input', () => {
    render(<SearchBar {...makeProps()} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders with default placeholder', () => {
    render(<SearchBar {...makeProps()} />)
    expect(screen.getByPlaceholderText('Search pitches...')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(<SearchBar {...makeProps({ placeholder: 'Find a movie...' })} />)
    expect(screen.getByPlaceholderText('Find a movie...')).toBeInTheDocument()
  })

  it('renders with provided value', () => {
    render(<SearchBar {...makeProps({ value: 'thriller' })} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('thriller')
  })

  it('does not show clear button when value is empty', () => {
    render(<SearchBar {...makeProps({ value: '' })} />)
    // The X button only appears when value is truthy
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows clear button when value is non-empty', () => {
    render(<SearchBar {...makeProps({ value: 'hello' })} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  // ─── Search history on mount ────────────────────────────────────────

  it('fetches search history on mount when showHistory=true', async () => {
    render(<SearchBar {...makeProps({ showHistory: true })} />)

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/history')
      )
    })
  })

  it('does NOT fetch search history when showHistory=false', async () => {
    render(<SearchBar {...makeProps({ showHistory: false })} />)

    await act(async () => { await flushPromises() })

    const historyCalls = mockApiGet.mock.calls.filter(([url]) =>
      url.includes('/api/search/history')
    )
    expect(historyCalls.length).toBe(0)
  })

  it('gracefully handles failed history fetch', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'))
    render(<SearchBar {...makeProps({ showHistory: true })} />)

    await act(async () => { await flushPromises() })

    // Component should still be rendered
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  // ─── onChange callback ──────────────────────────────────────────────

  it('calls onChange when user types', () => {
    const onChange = vi.fn()
    render(<SearchBar {...makeProps({ onChange })} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'drama' } })

    expect(onChange).toHaveBeenCalledWith('drama')
  })

  it('calls onChange with each keystroke value', () => {
    const onChange = vi.fn()
    render(<SearchBar {...makeProps({ onChange })} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ac' } })
    fireEvent.change(input, { target: { value: 'act' } })

    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenLastCalledWith('act')
  })

  // ─── Debounced suggestion fetching ─────────────────────────────────

  it('fetches suggestions after debounce delay when typing 2+ chars', async () => {
    // Use fake timers that auto-advance so waitFor still works
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          success: true,
          data: {
            suggestions: [{ query: 'action film', type: 'search', count: 42 }],
          },
        })
      }
      return Promise.resolve({ success: true, data: { searchHistory: [] } })
    })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    // Settle mount effects
    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'ac' } })

    // Suggestions not fetched yet — debounce pending
    const callsBefore = mockApiGet.mock.calls.filter(([url]) =>
      url.includes('/api/search/suggestions')
    ).length
    expect(callsBefore).toBe(0)

    // Fire the debounce
    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    const callsAfter = mockApiGet.mock.calls.filter(([url]) =>
      url.includes('/api/search/suggestions')
    )
    expect(callsAfter.length).toBeGreaterThan(0)
    expect(callsAfter[0][0]).toContain('q=ac')
  })

  it('does NOT fetch suggestions for a single character', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'a' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    const suggestionCalls = mockApiGet.mock.calls.filter(([url]) =>
      url.includes('/api/search/suggestions')
    )
    expect(suggestionCalls.length).toBe(0)
  })

  it('does NOT fetch suggestions when showSuggestions=false', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    render(<SearchBar {...makeProps({ showSuggestions: false })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'action' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    const suggestionCalls = mockApiGet.mock.calls.filter(([url]) =>
      url.includes('/api/search/suggestions')
    )
    expect(suggestionCalls.length).toBe(0)
  })

  it('debounces — only fires one request for rapid typing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    // Rapid typing — each change resets the debounce
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ac' } })
    fireEvent.change(input, { target: { value: 'act' } })
    fireEvent.change(input, { target: { value: 'acti' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    const suggestionCalls = mockApiGet.mock.calls.filter(([url]) =>
      url.includes('/api/search/suggestions')
    )
    // Only the last value triggers one fetch after debounce
    expect(suggestionCalls.length).toBe(1)
    expect(suggestionCalls[0][0]).toContain('q=acti')
  })

  // ─── Suggestions dropdown display ──────────────────────────────────

  it('shows suggestions in dropdown after debounce', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          success: true,
          data: {
            suggestions: [
              { query: 'action thriller', type: 'search', count: 15 },
              { query: 'action comedy', type: 'genre', count: 7 },
            ],
          },
        })
      }
      return Promise.resolve({ success: true, data: { searchHistory: [] } })
    })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'action' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    await waitFor(() => {
      expect(screen.getByText('action thriller')).toBeInTheDocument()
      expect(screen.getByText('action comedy')).toBeInTheDocument()
    })
  })

  it('shows suggestion labels for different types', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          success: true,
          data: {
            suggestions: [
              { query: 'Inception', type: 'title', count: 1 },
              { query: 'Horror', type: 'genre', count: 5 },
              { query: 'Series', type: 'format', count: 3 },
              { query: 'Alex Smith', type: 'creator', count: 2 },
            ],
          },
        })
      }
      return Promise.resolve({ success: true, data: { searchHistory: [] } })
    })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'test' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Genre')).toBeInTheDocument()
      expect(screen.getByText('Format')).toBeInTheDocument()
      expect(screen.getByText('Creator')).toBeInTheDocument()
    })
  })

  it('shows result count on suggestions when provided', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          success: true,
          data: {
            suggestions: [{ query: 'drama', type: 'genre', count: 42 }],
          },
        })
      }
      return Promise.resolve({ success: true, data: { searchHistory: [] } })
    })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'dr' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    await waitFor(() => {
      expect(screen.getByText('• 42 results')).toBeInTheDocument()
    })
  })

  it('shows no dropdown when API returns empty suggestions for 2+ char query', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({ success: true, data: { suggestions: [] } })
      }
      return Promise.resolve({ success: true, data: { searchHistory: [] } })
    })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zz' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    // The dropdown is only shown when showDropdown is true
    // showDropdown = isOpen && (suggestions.length > 0 || history shown)
    // When suggestions=[] and value.length>=2, showDropdown is false
    await waitFor(() => {
      // Suggestion items are not rendered
      expect(screen.queryByText('Suggestions')).not.toBeInTheDocument()
    })
    // The API was still called with the correct query
    const calls = mockApiGet.mock.calls.filter(([url]) =>
      url.includes('/api/search/suggestions')
    )
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0][0]).toContain('q=zz')
  })

  it('handles failed suggestion fetch gracefully — component stays mounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/history')) {
        return Promise.resolve({ success: true, data: { searchHistory: [] } })
      }
      if (url.includes('/api/search/suggestions')) {
        return Promise.reject(new Error('API down'))
      }
      return Promise.resolve({ success: false, data: {} })
    })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'drama' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    // Component must still be mounted and functional after fetch failure
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    // Dropdown is not shown because suggestions=[] and showDropdown requires suggestions or history
    expect(screen.queryByText('Suggestions')).not.toBeInTheDocument()
  })

  // ─── Suggestion click triggers onSearch ─────────────────────────────

  it('calls onSearch with suggestion query when suggestion is clicked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const onSearch = vi.fn()
    const onChange = vi.fn()

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          success: true,
          data: {
            suggestions: [{ query: 'sci-fi epic', type: 'search' }],
          },
        })
      }
      return Promise.resolve({ success: true, data: { searchHistory: [] } })
    })

    render(<SearchBar {...makeProps({ onSearch, onChange })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sci' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    await waitFor(() => {
      expect(screen.getByText('sci-fi epic')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('sci-fi epic'))

    expect(onSearch).toHaveBeenCalledWith('sci-fi epic')
    expect(onChange).toHaveBeenCalledWith('sci-fi epic')
  })

  // ─── Search history display ─────────────────────────────────────────

  it('shows search history in dropdown on focus when value is empty', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/history')) {
        return Promise.resolve({
          success: true,
          data: { searchHistory: ['thriller drama', 'indie comedy'] },
        })
      }
      return Promise.resolve({ success: true, data: { suggestions: [] } })
    })

    render(<SearchBar {...makeProps({ value: '', showHistory: true })} />)

    // Wait for history to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/history')
      )
    })

    // Focus to open dropdown
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('Recent Searches')).toBeInTheDocument()
      expect(screen.getByText('thriller drama')).toBeInTheDocument()
      expect(screen.getByText('indie comedy')).toBeInTheDocument()
    })
  })

  it('clicking a history item calls onSearch with that query', async () => {
    const onSearch = vi.fn()
    const onChange = vi.fn()

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/history')) {
        return Promise.resolve({
          success: true,
          data: { searchHistory: ['old query'] },
        })
      }
      return Promise.resolve({ success: true, data: { suggestions: [] } })
    })

    render(<SearchBar {...makeProps({ value: '', showHistory: true, onSearch, onChange })} />)

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/history')
      )
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('old query')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('old query'))

    expect(onSearch).toHaveBeenCalledWith('old query')
  })

  // ─── Clear button ────────────────────────────────────────────────────

  it('calls onChange with empty string when clear button is clicked', () => {
    const onChange = vi.fn()
    render(<SearchBar {...makeProps({ value: 'thriller', onChange })} />)

    const clearBtn = screen.getByRole('button')
    fireEvent.click(clearBtn)

    expect(onChange).toHaveBeenCalledWith('')
  })

  // ─── Enter key submits ───────────────────────────────────────────────

  it('calls onSearch when Enter is pressed with a value', () => {
    const onSearch = vi.fn()
    render(<SearchBar {...makeProps({ value: 'horror', onSearch })} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).toHaveBeenCalledWith('horror')
  })

  it('does not call onSearch when Enter is pressed with empty value', () => {
    const onSearch = vi.fn()
    render(<SearchBar {...makeProps({ value: '', onSearch })} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).not.toHaveBeenCalled()
  })

  it('does not call onSearch when Enter is pressed with only whitespace', () => {
    const onSearch = vi.fn()
    render(<SearchBar {...makeProps({ value: '   ', onSearch })} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).not.toHaveBeenCalled()
  })

  // ─── Escape key closes dropdown ──────────────────────────────────────

  it('closes dropdown on Escape key', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/history')) {
        return Promise.resolve({
          success: true,
          data: { searchHistory: ['recent item'] },
        })
      }
      return Promise.resolve({ success: true, data: { suggestions: [] } })
    })

    render(<SearchBar {...makeProps({ value: '', showHistory: true })} />)

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/history')
      )
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('recent item')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('recent item')).not.toBeInTheDocument()
    })
  })

  // ─── Keyboard navigation ─────────────────────────────────────────────

  it('ArrowDown + Enter selects first suggestion', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const onSearch = vi.fn()
    const onChange = vi.fn()

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          success: true,
          data: {
            suggestions: [
              { query: 'first result', type: 'search' },
              { query: 'second result', type: 'search' },
            ],
          },
        })
      }
      return Promise.resolve({ success: true, data: { searchHistory: [] } })
    })

    render(<SearchBar {...makeProps({ value: 'res', showHistory: false, onSearch, onChange })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'res' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    await waitFor(() => {
      expect(screen.getByText('first result')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).toHaveBeenCalledWith('first result')
  })

  // ─── Size variants ───────────────────────────────────────────────────

  it('renders with sm size class', () => {
    render(<SearchBar {...makeProps({ size: 'sm' })} />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('h-8')
  })

  it('renders with md size class (default)', () => {
    render(<SearchBar {...makeProps()} />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('h-10')
  })

  it('renders with lg size class', () => {
    render(<SearchBar {...makeProps({ size: 'lg' })} />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('h-12')
  })

  // ─── Search adds to local history ────────────────────────────────────

  it('adds searched query to local history and shows it on next focus', async () => {
    const onSearch = vi.fn()

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/history')) {
        return Promise.resolve({ success: true, data: { searchHistory: [] } })
      }
      return Promise.resolve({ success: true, data: { suggestions: [] } })
    })

    const { rerender } = render(
      <SearchBar {...makeProps({ value: 'new search', showHistory: true, onSearch })} />
    )

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/history')
      )
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).toHaveBeenCalledWith('new search')

    // Re-render with empty value so dropdown can show history
    rerender(
      <SearchBar {...makeProps({ value: '', showHistory: true, onSearch })} />
    )

    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('new search')).toBeInTheDocument()
    })
  })

  // ─── Suggestions label header ────────────────────────────────────────

  it('shows "Suggestions" header in dropdown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          success: true,
          data: {
            suggestions: [{ query: 'test query', type: 'search' }],
          },
        })
      }
      return Promise.resolve({ success: true, data: { searchHistory: [] } })
    })

    render(<SearchBar {...makeProps({ showSuggestions: true })} />)

    await act(async () => {
      vi.advanceTimersByTime(0)
      await flushPromises()
    })

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'te' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await flushPromises()
    })

    await waitFor(() => {
      expect(screen.getByText('Suggestions')).toBeInTheDocument()
    })
  })
})
