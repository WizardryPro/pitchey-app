import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../../lib/api-client', () => ({
  default: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}));

import CreatorDealInbox from '../CreatorDealInbox';

const deal = (over: Record<string, unknown> = {}) => ({
  id: 7, deal_type: 'option', status: 'inquiry', amount: 25000, backend_percentage: 10,
  notes: null, pitch_title: 'My Film', producer_name: 'Stellar Productions', actionable: true,
  created_at: new Date().toISOString(), ...over,
});

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); mockPost.mockResolvedValue({ success: true }); });

describe('CreatorDealInbox', () => {
  it('renders nothing when there are no deals', async () => {
    mockGet.mockResolvedValue({ success: true, data: { deals: [] } });
    const { container } = render(<CreatorDealInbox />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/creator/deals'));
    expect(screen.queryByTestId('creator-deal-inbox')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an offer with producer, pitch, type and amount', async () => {
    mockGet.mockResolvedValue({ success: true, data: { deals: [deal()] } });
    render(<CreatorDealInbox />);
    await waitFor(() => expect(screen.getByTestId('creator-deal-inbox')).toBeInTheDocument());
    expect(screen.getByText('My Film')).toBeInTheDocument();
    expect(screen.getByText('New offer')).toBeInTheDocument();
    expect(screen.getByText(/Stellar Productions/)).toBeInTheDocument();
    expect(screen.getByText(/€25,000/)).toBeInTheDocument();
  });

  it('accept posts the action then reloads', async () => {
    mockGet
      .mockResolvedValueOnce({ success: true, data: { deals: [deal()] } })
      .mockResolvedValueOnce({ success: true, data: { deals: [deal({ status: 'negotiation', actionable: true })] } });
    render(<CreatorDealInbox />);
    await waitFor(() => expect(screen.getByText('My Film')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/creator/deals/7/respond', { action: 'accept' }));
    await waitFor(() => expect(screen.getByText('In negotiation')).toBeInTheDocument());
  });

  it('counter reveals an amount field and sends the counter', async () => {
    mockGet.mockResolvedValue({ success: true, data: { deals: [deal()] } });
    render(<CreatorDealInbox />);
    await waitFor(() => expect(screen.getByText('My Film')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /counter/i }));
    const input = screen.getByLabelText('Counter amount') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '30000' } });
    fireEvent.click(screen.getByRole('button', { name: /send counter/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/creator/deals/7/respond', { action: 'counter', counterAmount: 30000 }));
  });

  it('decline posts a reject', async () => {
    mockGet.mockResolvedValue({ success: true, data: { deals: [deal()] } });
    render(<CreatorDealInbox />);
    await waitFor(() => expect(screen.getByText('My Film')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/creator/deals/7/respond', { action: 'reject' }));
  });

  it('hides actions for a non-actionable (cancelled) deal', async () => {
    mockGet.mockResolvedValue({ success: true, data: { deals: [deal({ status: 'cancelled', actionable: false })] } });
    render(<CreatorDealInbox />);
    await waitFor(() => expect(screen.getByTestId('creator-deal-inbox')).toBeInTheDocument());
    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
  });
});
