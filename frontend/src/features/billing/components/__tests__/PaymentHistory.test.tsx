import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import PaymentHistory from '../PaymentHistory';

const mockGetPaymentHistory = vi.fn();
vi.mock('@/lib/apiServices', () => ({
  paymentsAPI: {
    getPaymentHistory: (...args: any[]) => mockGetPaymentHistory(...args),
  },
}));

const mockPayments = [
  {
    id: 1,
    description: 'Monthly Subscription',
    type: 'subscription',
    amount: 2999,
    currency: 'USD',
    status: 'completed',
    createdAt: '2026-01-15T10:00:00Z',
    stripePaymentIntentId: 'pi_abc123def456ghi789',
    invoice: 'inv_001',
  },
  {
    id: 2,
    description: 'Credits Purchase',
    type: 'credits',
    amount: 5000,
    currency: 'USD',
    status: 'pending',
    createdAt: '2026-02-01T12:30:00Z',
    stripePaymentIntentId: null,
    invoice: null,
  },
  {
    id: 3,
    description: 'Deal Fee',
    type: 'deal_fee',
    amount: 10000,
    currency: 'USD',
    status: 'failed',
    createdAt: '2026-02-10T08:00:00Z',
    stripePaymentIntentId: 'pi_xyz789abc123def456',
    invoice: null,
  },
];

const mockOnRefresh = vi.fn();

describe('PaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering with data', () => {
    it('renders payment history header', () => {
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      expect(screen.getByText('Payment History')).toBeInTheDocument();
    });

    it('renders payment descriptions in the table', () => {
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      expect(screen.getByText('Monthly Subscription')).toBeInTheDocument();
      expect(screen.getByText('Credits Purchase')).toBeInTheDocument();
      expect(screen.getByText('Deal Fee')).toBeInTheDocument();
    });

    it('renders payment amounts as credit deltas', () => {
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      // Component now renders credit-transaction deltas (e.g. "+2999 credits"),
      // not dollar amounts. Each of the 3 rows carries a "credits" unit suffix.
      expect(screen.getAllByText('credits').length).toBeGreaterThanOrEqual(3);
    });

    it('renders payment statuses with correct labels', () => {
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('renders payment types', () => {
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      expect(screen.getByText('subscription')).toBeInTheDocument();
      expect(screen.getByText('deal fee')).toBeInTheDocument();
      // 'credits' appears both as a type and as each amount's unit suffix
      expect(screen.getAllByText('credits').length).toBeGreaterThan(0);
    });

    it('shows stripe payment ID for payments with stripePaymentIntentId', () => {
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      // stripePaymentIntentId is truncated to first 20 chars + "..."
      expect(screen.getByText('ID: pi_abc123def456ghi78...')).toBeInTheDocument();
    });

    it('shows Receipt button for payments with invoice', () => {
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      expect(screen.getByText('Receipt')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows "No payment history found" when no payments', () => {
      render(<PaymentHistory payments={[]} onRefresh={mockOnRefresh} />);

      expect(screen.getByText('No payment history found')).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('calls onRefresh when refresh button clicked', async () => {
      const user = userEvent.setup();
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });

    it('shows filter panel when filters button is clicked', async () => {
      const user = userEvent.setup();
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);

      expect(screen.getByText('Payment Type')).toBeInTheDocument();
      expect(screen.getByText('Apply Filters')).toBeInTheDocument();
      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('has an export button visible', () => {
      render(<PaymentHistory payments={mockPayments} onRefresh={mockOnRefresh} />);

      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });
});
