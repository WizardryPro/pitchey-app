import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceDegradedBanner } from '../ServiceDegradedBanner';
import { useServiceStatusStore } from '../../../../store/serviceStatusStore';

describe('ServiceDegradedBanner (R0.1)', () => {
  beforeEach(() => {
    useServiceStatusStore.setState({ degraded: false, stale: false, reason: undefined });
  });

  it('renders nothing when the service is healthy', () => {
    const { container } = render(<ServiceDegradedBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the generic degraded message on a 5xx degrade', () => {
    useServiceStatusStore.setState({ degraded: true, stale: false });
    render(<ServiceDegradedBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/temporarily\s+unavailable/i)).toBeInTheDocument();
  });

  it('shows distinct stale copy when serving cached results (R8)', () => {
    useServiceStatusStore.setState({ degraded: true, stale: true, reason: 'stale' });
    render(<ServiceDegradedBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/cached results/i)).toBeInTheDocument();
  });
});
