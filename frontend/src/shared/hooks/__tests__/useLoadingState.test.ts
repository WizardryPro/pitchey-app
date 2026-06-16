import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadingState, useLoadingStateWithRetry } from '../useLoadingState';

describe('useLoadingState', () => {
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
    it('starts not loading', () => {
      const { result } = renderHook(() => useLoadingState());
      expect(result.current.loading).toBe(false);
    });

    it('starts with type idle', () => {
      const { result } = renderHook(() => useLoadingState());
      expect(result.current.loadingType).toBe('idle');
    });

    it('has no loading message initially', () => {
      const { result } = renderHook(() => useLoadingState());
      expect(result.current.loadingMessage).toBeUndefined();
    });

    it('all specific flags are false', () => {
      const { result } = renderHook(() => useLoadingState());
      expect(result.current.isLoggingIn).toBe(false);
      expect(result.current.isLoggingOut).toBe(false);
      expect(result.current.isSwitchingPortal).toBe(false);
      expect(result.current.isLoadingData).toBe(false);
    });
  });

  // =========================================================================
  // setLoading
  // =========================================================================
  describe('setLoading', () => {
    it('sets loading true for logging-in type', () => {
      const { result } = renderHook(() => useLoadingState());
      act(() => {
        result.current.setLoading('logging-in');
      });
      expect(result.current.loading).toBe(true);
      expect(result.current.loadingType).toBe('logging-in');
      expect(result.current.isLoggingIn).toBe(true);
    });

    it('sets loading true for logging-out type', () => {
      const { result } = renderHook(() => useLoadingState());
      act(() => {
        result.current.setLoading('logging-out');
      });
      expect(result.current.isLoggingOut).toBe(true);
      expect(result.current.loading).toBe(true);
    });

    it('sets loading true for switching-portal type', () => {
      const { result } = renderHook(() => useLoadingState());
      act(() => {
        result.current.setLoading('switching-portal');
      });
      expect(result.current.isSwitchingPortal).toBe(true);
    });

    it('sets loading true for loading-data type', () => {
      const { result } = renderHook(() => useLoadingState());
      act(() => {
        result.current.setLoading('loading-data');
      });
      expect(result.current.isLoadingData).toBe(true);
    });

    it('stores optional message', () => {
      const { result } = renderHook(() => useLoadingState());
      act(() => {
        result.current.setLoading('loading-data', 'Fetching dashboard...');
      });
      expect(result.current.loadingMessage).toBe('Fetching dashboard...');
    });

    it('setting idle resets to not loading', () => {
      const { result } = renderHook(() => useLoadingState());
      act(() => {
        result.current.setLoading('logging-in');
      });
      act(() => {
        result.current.setLoading('idle');
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.loadingType).toBe('idle');
    });
  });

  // =========================================================================
  // clearLoading
  // =========================================================================
  describe('clearLoading', () => {
    it('resets state to idle', () => {
      const { result } = renderHook(() => useLoadingState());
      act(() => {
        result.current.setLoading('logging-in');
      });
      act(() => {
        result.current.clearLoading();
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.loadingType).toBe('idle');
    });
  });

  // =========================================================================
  // Timeout protection
  // =========================================================================
  describe('timeout protection', () => {
    it('auto-resets to idle after timeout', () => {
      const { result } = renderHook(() => useLoadingState({ timeout: 5000 }));
      act(() => {
        result.current.setLoading('loading-data');
      });
      expect(result.current.loading).toBe(true);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.loadingType).toBe('idle');
    });

    it('calls onTimeout callback when timeout fires', () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() => useLoadingState({ timeout: 1000, onTimeout }));

      act(() => {
        result.current.setLoading('loading-data');
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('does not fire timeout for idle state', () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() => useLoadingState({ timeout: 1000, onTimeout }));

      act(() => {
        result.current.setLoading('idle');
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('clears previous timeout when setLoading called again', () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() => useLoadingState({ timeout: 5000, onTimeout }));

      act(() => {
        result.current.setLoading('logging-in');
      });

      // Advance time partway
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Set loading again — should reset the timeout
      act(() => {
        result.current.setLoading('loading-data');
      });

      // Advance 4999ms more — original would have fired, new timeout shouldn't yet
      act(() => {
        vi.advanceTimersByTime(4999);
      });

      expect(onTimeout).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(true);
    });

    it('clears timeout when clearLoading is called', () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() => useLoadingState({ timeout: 1000, onTimeout }));

      act(() => {
        result.current.setLoading('loading-data');
      });
      act(() => {
        result.current.clearLoading();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // isSpecificLoading (via convenience flags)
  // =========================================================================
  describe('convenience flags mutual exclusivity', () => {
    it('only the active loading type flag is true', () => {
      const { result } = renderHook(() => useLoadingState());
      act(() => {
        result.current.setLoading('switching-portal');
      });
      expect(result.current.isLoggingIn).toBe(false);
      expect(result.current.isLoggingOut).toBe(false);
      expect(result.current.isSwitchingPortal).toBe(true);
      expect(result.current.isLoadingData).toBe(false);
    });
  });
});

// =============================================================================
// useLoadingStateWithRetry
// =============================================================================
describe('useLoadingStateWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with retryCount 0', () => {
      const { result } = renderHook(() => useLoadingStateWithRetry());
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('retry()', () => {
    it('returns true and increments retryCount when under limit', () => {
      const { result } = renderHook(() => useLoadingStateWithRetry({ maxRetries: 3 }));
      let canRetry: boolean;
      act(() => {
        canRetry = result.current.retry();
      });
      expect(canRetry!).toBe(true);
      expect(result.current.retryCount).toBe(1);
    });

    it('returns false when at maxRetries', () => {
      const { result } = renderHook(() => useLoadingStateWithRetry({ maxRetries: 1 }));
      act(() => {
        result.current.retry(); // count → 1
      });
      let canRetry: boolean;
      act(() => {
        canRetry = result.current.retry(); // count is already at maxRetries
      });
      expect(canRetry!).toBe(false);
    });

    it('resetRetries sets count back to 0', () => {
      const { result } = renderHook(() => useLoadingStateWithRetry({ maxRetries: 3 }));
      act(() => {
        result.current.retry();
        result.current.retry();
      });
      expect(result.current.retryCount).toBe(2);
      act(() => {
        result.current.resetRetries();
      });
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('executeWithRetry()', () => {
    it('returns operation result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('ok');
      const { result } = renderHook(() => useLoadingStateWithRetry({ maxRetries: 2 }));

      let value: any;
      await act(async () => {
        value = await result.current.executeWithRetry(operation, 'loading-data');
      });

      expect(value).toBe('ok');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('clears loading after successful operation', async () => {
      const operation = vi.fn().mockResolvedValue('done');
      const { result } = renderHook(() => useLoadingStateWithRetry());

      await act(async () => {
        await result.current.executeWithRetry(operation, 'loading-data');
      });

      expect(result.current.loading).toBe(false);
    });

    it('retries on failure up to maxRetries (real timers)', async () => {
      // Real timers so setTimeout(resolve, delay) can fire naturally
      vi.useRealTimers();
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const { result } = renderHook(() =>
        useLoadingStateWithRetry({ maxRetries: 2, retryDelay: 1 })
      );

      let value: any;
      await act(async () => {
        value = await result.current.executeWithRetry(operation, 'loading-data');
      });

      expect(value).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('throws when all retries exhausted (real timers)', async () => {
      vi.useRealTimers();
      const operation = vi.fn().mockRejectedValue(new Error('always fails'));

      const { result } = renderHook(() =>
        useLoadingStateWithRetry({ maxRetries: 2, retryDelay: 1 })
      );

      let threw = false;
      let errorMsg = '';
      await act(async () => {
        try {
          await result.current.executeWithRetry(operation, 'loading-data');
        } catch (e: any) {
          threw = true;
          errorMsg = e.message;
        }
      });

      expect(threw).toBe(true);
      expect(errorMsg).toBe('always fails');
      expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('clears loading after all retries exhausted (real timers)', async () => {
      vi.useRealTimers();
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() =>
        useLoadingStateWithRetry({ maxRetries: 1, retryDelay: 1 })
      );

      await act(async () => {
        try {
          await result.current.executeWithRetry(operation, 'loading-data', 'Loading');
        } catch { /* expected */ }
      });

      expect(result.current.loading).toBe(false);
    });
  });
});
