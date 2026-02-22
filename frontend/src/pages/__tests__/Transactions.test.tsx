import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockGetTransactions = vi.fn()
const mockProcessRefund = vi.fn()

vi.mock('../../services/admin.service', () => ({
  adminService: {
    getTransactions: (...args: any[]) => mockGetTransactions(...args),
    processRefund: (...args: any[]) => mockProcessRefund(...args),
  },
}))

// Dynamic import after mocks
let Transactions: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Admin/Transactions')
  Transactions = mod.default
})

const mockTransactions = [
  {
    id: 'txn-001-abcdef-123456',
    type: 'payment' as const,
    amount: 99.99,
    currency: 'USD',
    status: 'completed' as const,
    user: { id: 'u-1', name: 'Alice Creator', email: 'alice@test.com', userType: 'creator' },
    description: 'Premium subscription payment',
    paymentMethod: 'Visa **** 4242',
    stripeTransactionId: 'pi_abc123',
    createdAt: '2026-02-20T10:00:00Z',
    updatedAt: '2026-02-20T10:01:00Z',
    refundableAmount: 99.99,
    metadata: { subscriptionPlan: 'Premium' },
  },
  {
    id: 'txn-002-defghi-789012',
    type: 'credit_purchase' as const,
    amount: 25.00,
    currency: 'USD',
    status: 'completed' as const,
    user: { id: 'u-2', name: 'Bob Investor', email: 'bob@test.com', userType: 'investor' },
    description: '10-pack credit purchase',
    createdAt: '2026-02-19T10:00:00Z',
    updatedAt: '2026-02-19T10:01:00Z',
    refundableAmount: 25.00,
  },
  {
    id: 'txn-003-jklmno-345678',
    type: 'refund' as const,
    amount: 50.00,
    currency: 'USD',
    status: 'completed' as const,
    user: { id: 'u-3', name: 'Charlie Prod', email: 'charlie@test.com', userType: 'production' },
    description: 'Refund for duplicate payment',
    createdAt: '2026-02-18T10:00:00Z',
    updatedAt: '2026-02-18T10:01:00Z',
  },
  {
    id: 'txn-004-pqrstu-901234',
    type: 'subscription' as const,
    amount: 199.99,
    currency: 'USD',
    status: 'pending' as const,
    user: { id: 'u-4', name: 'Dave Admin', email: 'dave@test.com', userType: 'creator' },
    description: 'Annual subscription renewal',
    createdAt: '2026-02-17T10:00:00Z',
    updatedAt: '2026-02-17T10:01:00Z',
  },
  {
    id: 'txn-005-vwxyza-567890',
    type: 'payment' as const,
    amount: 500.00,
    currency: 'USD',
    status: 'disputed' as const,
    user: { id: 'u-5', name: 'Eve User', email: 'eve@test.com', userType: 'investor' },
    description: 'Investment payment disputed',
    createdAt: '2026-02-16T10:00:00Z',
    updatedAt: '2026-02-16T10:01:00Z',
  },
]

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <Transactions />
    </MemoryRouter>
  )
}

describe('Transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTransactions.mockResolvedValue(mockTransactions)
    mockProcessRefund.mockResolvedValue(undefined)
  })

  describe('Loading', () => {
    it('shows loading state initially', () => {
      mockGetTransactions.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Loading transactions...')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('renders the page title and subtitle', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Transaction Management')).toBeInTheDocument()
      })
      expect(screen.getByText('View payment history and process refunds')).toBeInTheDocument()
    })

    it('renders summary stat cards', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      })
      expect(screen.getByText('Total Refunds')).toBeInTheDocument()
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Disputed').length).toBeGreaterThanOrEqual(1)
    })

    it('renders filter controls', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Type').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('User Type')).toBeInTheDocument()
      expect(screen.getByText('From Date')).toBeInTheDocument()
      expect(screen.getByText('To Date')).toBeInTheDocument()
      expect(screen.getByText('Sort')).toBeInTheDocument()
    })

    it('renders table headers', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Transaction')).toBeInTheDocument()
      })
      expect(screen.getByText('User')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })
  })

  describe('Data', () => {
    it('displays transaction IDs (truncated)', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('txn-001-...')).toBeInTheDocument()
      })
      expect(screen.getByText('txn-002-...')).toBeInTheDocument()
    })

    it('displays transaction descriptions', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Premium subscription payment')).toBeInTheDocument()
      })
      expect(screen.getByText('10-pack credit purchase')).toBeInTheDocument()
      expect(screen.getByText('Refund for duplicate payment')).toBeInTheDocument()
    })

    it('displays user names and emails', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Alice Creator')).toBeInTheDocument()
      })
      expect(screen.getByText('alice@test.com')).toBeInTheDocument()
      expect(screen.getByText('Bob Investor')).toBeInTheDocument()
    })

    it('displays transaction types', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('payment').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getByText('credit purchase')).toBeInTheDocument()
      expect(screen.getByText('refund')).toBeInTheDocument()
      expect(screen.getByText('subscription')).toBeInTheDocument()
    })

    it('displays transaction statuses', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('completed').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getAllByText('pending').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('disputed').length).toBeGreaterThanOrEqual(1)
    })

    it('displays View buttons for each transaction', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('View').length).toBe(5)
      })
    })

    it('calculates total revenue correctly', async () => {
      renderComponent()
      await waitFor(() => {
        // Revenue = completed non-refund transactions: 99.99 + 25.00 = 124.99
        expect(screen.getByText('$124.99')).toBeInTheDocument()
      })
    })

    it('calculates total refunds correctly', async () => {
      renderComponent()
      await waitFor(() => {
        // Refunds = completed refund transactions: 50.00
        // $50.00 appears in both summary card and table row
        expect(screen.getAllByText('$50.00').length).toBeGreaterThanOrEqual(1)
      })
      // The red-colored summary card should contain the refund total
      const redBold = document.querySelector('.text-2xl.font-bold.text-red-600')
      expect(redBold?.textContent).toBe('$50.00')
    })

    it('displays pending and disputed counts', async () => {
      renderComponent()
      await waitFor(() => {
        // 1 pending, 1 disputed
        const boldElements = document.querySelectorAll('.text-2xl.font-bold')
        const counts = Array.from(boldElements).map(el => el.textContent)
        expect(counts).toContain('1')
      })
    })
  })

  describe('Modal', () => {
    it('opens transaction modal when View is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('View').length).toBe(5)
      })
      await user.click(screen.getAllByText('View')[0])
      await waitFor(() => {
        expect(screen.getByText('Transaction Details')).toBeInTheDocument()
      })
    })

    it('shows transaction details in modal', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('View').length).toBe(5)
      })
      await user.click(screen.getAllByText('View')[0])
      await waitFor(() => {
        expect(screen.getByText('Transaction Information')).toBeInTheDocument()
      })
      expect(screen.getByText('User Information')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Payment Details')).toBeInTheDocument()
    })

    it('shows Stripe transaction ID in modal', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('View').length).toBe(5)
      })
      await user.click(screen.getAllByText('View')[0])
      await waitFor(() => {
        expect(screen.getByText('pi_abc123')).toBeInTheDocument()
      })
    })

    it('shows refund section for refundable transactions', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('View').length).toBe(5)
      })
      // First transaction is completed payment with refundableAmount
      await user.click(screen.getAllByText('View')[0])
      await waitFor(() => {
        expect(screen.getByText('Transaction Details')).toBeInTheDocument()
      })
      // "Process Refund" appears as both section heading and button text
      expect(screen.getAllByText('Process Refund').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Refund Amount')).toBeInTheDocument()
      expect(screen.getByText('Refund Reason')).toBeInTheDocument()
      expect(screen.getByText('Max')).toBeInTheDocument()
    })

    it('shows subscription plan in metadata when available', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('View').length).toBe(5)
      })
      await user.click(screen.getAllByText('View')[0])
      await waitFor(() => {
        expect(screen.getByText('Subscription Plan')).toBeInTheDocument()
      })
      expect(screen.getByText('Premium')).toBeInTheDocument()
    })

    it('closes modal when close button is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('View').length).toBe(5)
      })
      await user.click(screen.getAllByText('View')[0])
      await waitFor(() => {
        expect(screen.getByText('Transaction Details')).toBeInTheDocument()
      })
      // Close button is the X character
      await user.click(screen.getAllByText(/\u2715/)[0])
      await waitFor(() => {
        expect(screen.queryByText('Transaction Details')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error', () => {
    it('shows error message when API fails', async () => {
      mockGetTransactions.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Failed to load transactions')).toBeInTheDocument()
      })
    })
  })

  describe('Empty', () => {
    it('shows empty state when no transactions found', async () => {
      mockGetTransactions.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeInTheDocument()
      })
    })

    it('shows zero revenue and refunds when empty', async () => {
      mockGetTransactions.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        // Both Total Revenue and Total Refunds show $0.00
        expect(screen.getAllByText('$0.00').length).toBe(2)
      })
    })
  })
})
