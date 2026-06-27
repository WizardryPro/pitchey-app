import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../../lib/api-client', () => ({
  default: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}));

import DealSignPanel from '../DealSignPanel';

const state = (over: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    dealId: 7,
    currentHash: 'a'.repeat(64),
    algorithm: 'sha256',
    fullyExecuted: false,
    hasStaleSignature: false,
    viewerParty: 'creator',
    viewerSigned: false,
    signatures: [],
    ...over,
  },
});

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPost.mockResolvedValue({ success: true, data: { fullyExecuted: false } });
});

describe('DealSignPanel', () => {
  it('loads signature state for the deal', async () => {
    mockGet.mockResolvedValue(state());
    render(<DealSignPanel dealId={7} />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/deals/7/signatures'));
    expect(screen.getByText('Binding deal sheet')).toBeInTheDocument();
    expect(screen.getByText('Awaiting signatures')).toBeInTheDocument();
  });

  it('shows the fully-executed badge when both parties have signed the current sheet', async () => {
    mockGet.mockResolvedValue(state({
      fullyExecuted: true,
      viewerSigned: true,
      signatures: [
        { party: 'creator', signedName: 'Alex', signedAt: '2026-06-27T00:00:00Z', contentHash: 'a'.repeat(64), matchesCurrent: true },
        { party: 'production', signedName: 'Stellar', signedAt: '2026-06-27T00:00:00Z', contentHash: 'a'.repeat(64), matchesCurrent: true },
      ],
    }));
    render(<DealSignPanel dealId={7} />);
    await waitFor(() => expect(screen.getByText('Fully executed')).toBeInTheDocument());
    expect(screen.getByText(/You signed this version/)).toBeInTheDocument();
  });

  it('surfaces a tamper warning when a signature is stale', async () => {
    mockGet.mockResolvedValue(state({
      hasStaleSignature: true,
      signatures: [
        { party: 'production', signedName: 'Stellar', signedAt: '2026-06-27T00:00:00Z', contentHash: 'b'.repeat(64), matchesCurrent: false },
      ],
    }));
    render(<DealSignPanel dealId={7} />);
    await waitFor(() => expect(screen.getByText(/A deal term changed after a party signed/)).toBeInTheDocument());
    expect(screen.getByText(/Signed \(stale\)/)).toBeInTheDocument();
  });

  it('requires a typed name and agreement before the sign button is enabled', async () => {
    mockGet.mockResolvedValue(state());
    render(<DealSignPanel dealId={7} />);
    await waitFor(() => screen.getByText('Sign deal sheet'));
    const btn = screen.getByRole('button', { name: /Sign deal sheet/ });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Full legal name'), { target: { value: 'Alex Creator' } });
    expect(btn).toBeDisabled(); // still need agreement
    fireEvent.click(screen.getByRole('checkbox'));
    expect(btn).toBeEnabled();
  });

  it('posts the signature and reloads on sign', async () => {
    mockGet.mockResolvedValue(state());
    render(<DealSignPanel dealId={7} />);
    await waitFor(() => screen.getByText('Sign deal sheet'));

    fireEvent.change(screen.getByPlaceholderText('Full legal name'), { target: { value: 'Alex Creator' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Sign deal sheet/ }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      '/api/deals/7/sign',
      { fullName: 'Alex Creator', agreed: true },
    ));
    // reload after a successful sign
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });
});
