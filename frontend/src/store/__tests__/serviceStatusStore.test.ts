import { describe, it, expect, beforeEach } from 'vitest';
import { useServiceStatusStore } from '../serviceStatusStore';

describe('serviceStatusStore (R0.1 degraded signal)', () => {
  beforeEach(() => {
    useServiceStatusStore.setState({ degraded: false });
  });

  it('defaults to not degraded', () => {
    expect(useServiceStatusStore.getState().degraded).toBe(false);
  });

  it('flips to degraded on a 5xx signal', () => {
    useServiceStatusStore.getState().setDegraded(true);
    expect(useServiceStatusStore.getState().degraded).toBe(true);
  });

  it('clears on the next healthy response', () => {
    useServiceStatusStore.getState().setDegraded(true);
    useServiceStatusStore.getState().setDegraded(false);
    expect(useServiceStatusStore.getState().degraded).toBe(false);
  });

  it('is a no-op when the value is unchanged (guarded — no needless churn)', () => {
    const before = useServiceStatusStore.getState();
    before.setDegraded(false); // already false
    // Same state object reference proves set() was not called.
    expect(useServiceStatusStore.getState()).toBe(before);
  });
});
