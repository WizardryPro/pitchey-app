import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act} from '@testing-library/react';

// ─── Mock pitchAPI from @/lib/api ──────────────────────────────────────────
const mockSearch = vi.fn();

vi.mock('@/lib/api', () => ({
  pitchAPI: {
    search: (...args: any[]) => mockSearch(...args),
  },
  // Minimal stubs for other named exports the module may reference
  authAPI: {},
  ndaAPI: {},
  default: {},
}));

import { useSearch } from '../useSearch';

const mockPitches = [
  { id: '1', title: 'Space Opera', genre: 'Sci-Fi' },
  { id: '2', title: 'Space Western', genre: 'Western' },
];

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Initial state
  // =========================================================================
  describe('initial state', () => {
    it('starts with empty query and no results', () => {
      const { result } = renderHook(() => useSearch());
      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasSearched).toBe(false);
    });
  });

  // =========================================================================
  // setQuery — debouncing
  // =========================================================================
  describe('setQuery', () => {
    it('updates query immediately', () => {
      const { result } = renderHook(() => useSearch());
      act(() => {
        result.current.setQuery('space');
      });
      expect(result.current.query).toBe('space');
    });

    it('does not call API before debounce delay', () => {
      const { result } = renderHook(() => useSearch({ debounceMs: 300 }));
      act(() => {
        result.current.setQuery('space');
      });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('calls API after debounce delay', async () => {
      mockSearch.mockResolvedValue(mockPitches);
      const { result } = renderHook(() => useSearch({ debounceMs: 300 }));

      await act(async () => {
        result.current.setQuery('space');
        vi.advanceTimersByTime(300);
      });

      expect(mockSearch).toHaveBeenCalledWith('space');
    });

    it('resets results when query is shorter than minQueryLength', () => {
      const { result } = renderHook(() => useSearch({ minQueryLength: 2 }));
      act(() => {
        result.current.setQuery('s'); // 1 char < minQueryLength=2
      });
      expect(result.current.results).toEqual([]);
      expect(result.current.hasSearched).toBe(false);
    });

    it('debounces rapid successive calls', async () => {
      mockSearch.mockResolvedValue(mockPitches);
      const { result } = renderHook(() => useSearch({ debounceMs: 300 }));

      await act(async () => {
        result.current.setQuery('sp');
        result.current.setQuery('spa');
        result.current.setQuery('spac');
        result.current.setQuery('space');
        vi.advanceTimersByTime(300);
      });

      expect(mockSearch).toHaveBeenCalledTimes(1);
      expect(mockSearch).toHaveBeenCalledWith('space');
    });
  });

  // =========================================================================
  // search (direct call, no debounce)
  // =========================================================================
  describe('search()', () => {
    it('sets loading true then false after resolve', async () => {
      let resolveSearch!: (v: any) => void;
      mockSearch.mockReturnValue(new Promise(res => { resolveSearch = res; }));

      const { result } = renderHook(() => useSearch());

      act(() => {
        void result.current.search('space');
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveSearch(mockPitches);
      });

      expect(result.current.loading).toBe(false);
    });

    it('sets results on success', async () => {
      mockSearch.mockResolvedValue(mockPitches);
      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search('space');
      });

      expect(result.current.results).toEqual(mockPitches);
      expect(result.current.hasSearched).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('clears results and sets error on failure', async () => {
      mockSearch.mockRejectedValue(new Error('Search failed'));
      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search('space');
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Search failed');
      expect(result.current.hasSearched).toBe(true);
    });

    it('uses generic error message for non-Error rejections', async () => {
      mockSearch.mockRejectedValue('network down');
      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search('space');
      });

      expect(result.current.error).toBe('Search failed');
    });

    it('returns early and resets state when query is too short', async () => {
      const { result } = renderHook(() => useSearch({ minQueryLength: 3 }));

      await act(async () => {
        await result.current.search('ab'); // < minQueryLength=3
      });

      expect(mockSearch).not.toHaveBeenCalled();
      expect(result.current.hasSearched).toBe(false);
    });

    it('respects custom minQueryLength option', async () => {
      mockSearch.mockResolvedValue(mockPitches);
      const { result } = renderHook(() => useSearch({ minQueryLength: 1 }));

      await act(async () => {
        await result.current.search('s'); // 1 char >= minQueryLength=1
      });

      expect(mockSearch).toHaveBeenCalledWith('s');
    });
  });

  // =========================================================================
  // clearSearch
  // =========================================================================
  describe('clearSearch()', () => {
    it('resets all state to initial values', async () => {
      mockSearch.mockResolvedValue(mockPitches);
      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search('space');
      });

      expect(result.current.results).toHaveLength(2);

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasSearched).toBe(false);
    });

    it('cancels pending debounce timer', async () => {
      mockSearch.mockResolvedValue(mockPitches);
      const { result } = renderHook(() => useSearch({ debounceMs: 300 }));

      act(() => {
        result.current.setQuery('space');
      });

      act(() => {
        result.current.clearSearch();
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // API should NOT have been called because clear cancelled the timer
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Options
  // =========================================================================
  describe('options', () => {
    it('uses default debounceMs of 300', async () => {
      mockSearch.mockResolvedValue([]);
      const { result } = renderHook(() => useSearch());

      await act(async () => {
        result.current.setQuery('space');
        vi.advanceTimersByTime(299);
      });
      expect(mockSearch).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(mockSearch).toHaveBeenCalled();
    });

    it('uses default minQueryLength of 2', async () => {
      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search('x'); // 1 char — below default min of 2
      });
      expect(mockSearch).not.toHaveBeenCalled();

      await act(async () => {
        mockSearch.mockResolvedValue([]);
        await result.current.search('xy'); // 2 chars — at default min
      });
      expect(mockSearch).toHaveBeenCalled();
    });
  });
});
