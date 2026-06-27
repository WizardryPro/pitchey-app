import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceDegradedBanner } from '../ServiceDegradedBanner';
import { useServiceStatusStore } from '../../../../store/serviceStatusStore';

describe('ServiceDegradedBanner (R0.1)', () => {
  beforeEach(() => {
    useServiceStatusStore.setState({ degraded: false });
  });

  it('renders nothing when the service is healthy', () => {
    const { container } = render(<ServiceDegradedBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the degraded message when degraded', () => {
    useServiceStatusStore.setState({ degraded: true });
    render(<ServiceDegradedBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/temporarily\s+unavailable/i)).toBeInTheDocument();
  });
});
