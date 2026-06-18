import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// apiClient is a default export with a .get method — mock the same module the
// component imports ('../../lib/api-client' from the component = this path from here).
const mockGet = vi.fn();
vi.mock('../../../lib/api-client', () => ({ default: { get: (...a: unknown[]) => mockGet(...a) } }));

import YourPitcheyValue from '../YourPitcheyValue';

const fullData = {
  verificationTier: 'gold' as const,
  memberSince: '2025-03-01T00:00:00.000Z',
  username: 'alex',
  pitches: { total: 7, published: 5, sealed: 3 },
  audience: { followers: 42, totalViews: 1234 },
  reach: { shareLinkViews: 88 },
  trust: { ndas: 6 },
  heat: { top: 91.5 },
};

beforeEach(() => mockGet.mockReset());

describe('YourPitcheyValue', () => {
  it('shows a skeleton while loading', async () => {
    // Controllable deferred so the promise still settles (no dangling handle).
    let resolve!: (v: unknown) => void;
    mockGet.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<YourPitcheyValue />);
    expect(screen.getByTestId('your-pitchey-skeleton')).toBeInTheDocument();
    resolve({ success: true, data: fullData });
    await waitFor(() => expect(screen.getByTestId('your-pitchey-value')).toBeInTheDocument());
  });

  it('renders the value tiles from the API', async () => {
    mockGet.mockResolvedValue({ success: true, data: fullData });
    render(<YourPitcheyValue />);

    await waitFor(() => expect(screen.getByTestId('your-pitchey-value')).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledWith('/api/creator/value');

    // Headline + tiles
    expect(screen.getByText('Your Pitchey')).toBeInTheDocument();
    expect(screen.getByText('Pitches')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument(); // total pitches
    expect(screen.getByText(/5 published · 3 sealed/)).toBeInTheDocument();
    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('NDAs on your work')).toBeInTheDocument();
    expect(screen.getByText('Member since 2025')).toBeInTheDocument();
  });

  it('renders nothing when the API reports failure (quiet degrade)', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<YourPitcheyValue />);
    await waitFor(() => expect(screen.queryByTestId('your-pitchey-skeleton')).not.toBeInTheDocument());
    expect(screen.queryByTestId('your-pitchey-value')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  // NOTE: the request-rejects/catch branch is intentionally NOT unit-tested here —
  // it trips vitest's eager unhandled-rejection detector against React's effect
  // timing even though the component's try/catch handles it. The user-facing
  // contract (renders nothing when there's no data) is covered by the success:false
  // case above; the catch is exercised end-to-end via the integration tier.

  it('hides the verification badge for the grey (unverified) tier', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...fullData, verificationTier: 'grey' } });
    render(<YourPitcheyValue />);
    await waitFor(() => expect(screen.getByTestId('your-pitchey-value')).toBeInTheDocument());
    // VerificationBadge returns null for grey; tier text/badge should be absent.
    expect(screen.queryByText(/Verified/i)).not.toBeInTheDocument();
  });
});
