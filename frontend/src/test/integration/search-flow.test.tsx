/**
 * Integration: Search Flow
 *
 * Exercises useSearch hook + pitchAPI.search (via lib/api.ts / axios) with
 * fetch/axios mocked at the network boundary so the real hook and real axios
 * instance run together.
 *
 * lib/api.ts uses axios; we mock axios's `create()` result at module level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act} from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock axios — intercept calls from lib/api.ts without touching the hook
// ---------------------------------------------------------------------------
const mockAxiosGet = vi.fn();
const mockAxiosPost = vi.fn();

vi.mock('axios', () => {
  const instance = {
    get: (...args: any[]) => mockAxiosGet(...args),
    post: (...args: any[]) => mockAxiosPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: () => instance,
      ...instance,
    },
  };
});

// pitchAPI.search lives in lib/api.ts — import AFTER mock registration
import { useSearch } from '../../features/browse/hooks/useSearch';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_PITCHES = [
  {
    id: 1,
    title: 'The Lost Kingdom',
    logline: 'An epic adventure',
    genre: 'Fantasy',
    format: 'Feature Film',
    view_count: 120,
    like_count: 30,
    status: 'published',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    rating_average: 7.5,
    pitchey_score_avg: 8.0,
    viewer_score_avg: 7.0,
    rating_count: 15,
    nda_count: 2,
  },
  {
    id: 2,
    title: 'Dark Waters',
    logline: 'A thriller set at sea',
    genre: 'Thriller',
    format: 'Series',
    view_count: 85,
    like_count: 20,
    status: 'published',
    created_at: '2025-02-01',
    updated_at: '2025-02-01',
    rating_average: 6.5,
    pitchey_score_avg: 7.0,
    viewer_score_avg: 6.0,
    rating_count: 10,
    nda_count: 0,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Search Flow (useSearch ↔ pitchAPI ↔ axios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Initial state
  // -------------------------------------------------------------------------
  describe('1. Initial state', () => {
    it('starts with empty state and no search performed', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.hasSearched).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful search
  // -------------------------------------------------------------------------
  describe('2. Successful search — hook wires to pitchAPI.search', () => {
    it('calls GET /api/search and returns results', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { results: MOCK_PITCHES },
      });

      const { result } = renderHook(() => useSearch({ debounceMs: 0 }));

      // Trigger search (bypasses debounce in tests via direct `.search()`)
      await act(async () => {
        await result.current.search('kingdom');
      });

      expect(result.current.hasSearched).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.results).toHaveLength(2);
      expect(result.current.results[0].title).toBe('The Lost Kingdom');
    });

    it('passes query string to the API call', async () => {
      mockAxiosGet.mockResolvedValue({ data: { results: [] } });

      const { result } = renderHook(() => useSearch({ debounceMs: 0 }));

      await act(async () => {
        await result.current.search('dark waters');
      });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/api/search',
        expect.objectContaining({ params: { q: 'dark waters' } })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. Short query below minQueryLength is ignored
  // -------------------------------------------------------------------------
  describe('3. Short queries are silently dropped', () => {
    it('does not call the API when query is below minQueryLength (default 2)', async () => {
      const { result } = renderHook(() => useSearch({ debounceMs: 0 }));

      await act(async () => {
        await result.current.search('a');
      });

      expect(mockAxiosGet).not.toHaveBeenCalled();
      expect(result.current.results).toEqual([]);
      expect(result.current.hasSearched).toBe(false);
    });

    it('clears previous results when query drops below minQueryLength', async () => {
      // First do a successful search
      mockAxiosGet.mockResolvedValue({ data: { results: MOCK_PITCHES } });

      const { result } = renderHook(() => useSearch({ debounceMs: 0 }));

      await act(async () => {
        await result.current.search('dark');
      });
      expect(result.current.results).toHaveLength(2);

      // Now clear it with a short query
      await act(async () => {
        await result.current.search('x');
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.hasSearched).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Debounced setQuery flow
  // -------------------------------------------------------------------------
  describe('4. Debounced setQuery — waits before hitting API', () => {
    it('does not call API before debounce delay elapses', async () => {
      mockAxiosGet.mockResolvedValue({ data: { results: [] } });

      const { result } = renderHook(() => useSearch({ debounceMs: 300 }));

      act(() => {
        result.current.setQuery('fantasy');
      });

      // Query updates immediately but API not yet called
      expect(result.current.query).toBe('fantasy');
      expect(mockAxiosGet).not.toHaveBeenCalled();

      // Advance timers past debounce window
      await act(async () => {
        vi.advanceTimersByTime(350);
        // Give the promise chain a tick to resolve
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Error path — API failure surfaces to state
  // -------------------------------------------------------------------------
  describe('5. API error — surfaces to state', () => {
    it('sets error state when pitchAPI.search throws', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Internal Server Error'));

      const { result } = renderHook(() => useSearch({ debounceMs: 0 }));

      await act(async () => {
        await result.current.search('trigger-error');
      });

      expect(result.current.error).toBe('Internal Server Error');
      expect(result.current.results).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.hasSearched).toBe(true);
    });

    it('sets generic error message when axios throws non-Error object', async () => {
      mockAxiosGet.mockRejectedValue('string error');

      const { result } = renderHook(() => useSearch({ debounceMs: 0 }));

      await act(async () => {
        await result.current.search('query');
      });

      expect(result.current.error).toBe('Search failed');
    });
  });

  // -------------------------------------------------------------------------
  // 6. clearSearch resets all state
  // -------------------------------------------------------------------------
  describe('6. clearSearch — full reset', () => {
    it('clears results, query, and error after a successful search', async () => {
      mockAxiosGet.mockResolvedValue({ data: { results: MOCK_PITCHES } });

      const { result } = renderHook(() => useSearch({ debounceMs: 0 }));

      await act(async () => {
        await result.current.search('kingdom');
      });
      expect(result.current.results).toHaveLength(2);

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.hasSearched).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Empty results from API
  // -------------------------------------------------------------------------
  describe('7. Empty results from API', () => {
    it('sets hasSearched true and empty results when API returns none', async () => {
      mockAxiosGet.mockResolvedValue({ data: { results: [] } });

      const { result } = renderHook(() => useSearch({ debounceMs: 0 }));

      await act(async () => {
        await result.current.search('nonexistent pitch title');
      });

      expect(result.current.hasSearched).toBe(true);
      expect(result.current.results).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Custom debounce / minQueryLength options respected
  // -------------------------------------------------------------------------
  describe('8. Custom options are respected', () => {
    it('respects custom minQueryLength option', async () => {
      mockAxiosGet.mockResolvedValue({ data: { results: [] } });

      const { result } = renderHook(() => useSearch({ debounceMs: 0, minQueryLength: 4 }));

      await act(async () => {
        await result.current.search('ab'); // below custom threshold of 4
      });

      expect(mockAxiosGet).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.search('abcd'); // at threshold
      });

      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    });
  });
});
