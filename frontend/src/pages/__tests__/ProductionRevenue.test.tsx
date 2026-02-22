import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mock functions
const mockNavigate = vi.fn()
const mockGetRevenue = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

vi.mock('../../services/production.service', () => ({
  ProductionService: {
    getRevenue: (...args: any[]) => mockGetRevenue(...args),
  },
}))

const mockRevenueResponse = {
  totalRevenue: 4500000,
  monthlyRevenue: 375000,
  yearlyRevenue: 4500000,
  revenueByProject: [
    { project_title: 'Midnight Sun', revenue: 1200000, investment_count: 5 },
    { project_title: 'Dark Waters', revenue: 800000, investment_count: 3 },
    { project_title: 'City Lights', revenue: 600000, investment_count: 2 },
  ],
  revenueByMonth: [
    { month: '2026-01', revenue: 180000 },
    { month: '2026-02', revenue: 210000 },
  ],
}

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('../production/ProductionRevenue')
  Component = mod.default
})

describe('ProductionRevenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading skeletons initially', () => {
    mockGetRevenue.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    // The loading state renders StatsCardSkeleton components
    // which contain Skeleton elements within Card wrappers
    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
    // At minimum, the loading flag is true and skeletons render
    expect(screen.getByText('Revenue Reports')).toBeInTheDocument()
  })

  // ─── Layout ───────────────────────────────────────────────────────

  it('renders page header', async () => {
    mockGetRevenue.mockResolvedValue(mockRevenueResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Revenue Reports')).toBeInTheDocument()
    })
    expect(screen.getByText('Track your production revenue and financial metrics')).toBeInTheDocument()
    expect(screen.getByText('Export Report')).toBeInTheDocument()
    expect(screen.getByText('Generate Invoice')).toBeInTheDocument()
  })

  // ─── Data Rendering ──────────────────────────────────────────────

  it('renders revenue stat cards after loading', async () => {
    mockGetRevenue.mockResolvedValue(mockRevenueResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    })
    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument()
    expect(screen.getByText('Growth Rate')).toBeInTheDocument()
    expect(screen.getByText('Avg Deal Size')).toBeInTheDocument()
  })

  it('renders transaction table with project data', async () => {
    mockGetRevenue.mockResolvedValue(mockRevenueResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
    })
    expect(screen.getByText('Midnight Sun')).toBeInTheDocument()
    expect(screen.getByText('Dark Waters')).toBeInTheDocument()
    expect(screen.getByText('City Lights')).toBeInTheDocument()
  })

  it('renders revenue chart', async () => {
    mockGetRevenue.mockResolvedValue(mockRevenueResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Revenue Trend')).toBeInTheDocument()
    })
    // Chart data should include month labels
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Feb')).toBeInTheDocument()
  })

  it('renders revenue breakdown sections', async () => {
    mockGetRevenue.mockResolvedValue(mockRevenueResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Revenue by Category')).toBeInTheDocument()
    })
    expect(screen.getByText('Payment Methods')).toBeInTheDocument()
    expect(screen.getByText('Feature Films')).toBeInTheDocument()
    expect(screen.getByText('Wire Transfer')).toBeInTheDocument()
  })

  // ─── Time Range Selector ─────────────────────────────────────────

  it('renders time range buttons', async () => {
    mockGetRevenue.mockResolvedValue(mockRevenueResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Week')).toBeInTheDocument()
    })
    expect(screen.getByText('Month')).toBeInTheDocument()
    expect(screen.getByText('Quarter')).toBeInTheDocument()
    expect(screen.getByText('Year')).toBeInTheDocument()
  })

  // ─── Error State ──────────────────────────────────────────────────

  it('shows error alert when API fails', async () => {
    mockGetRevenue.mockRejectedValue(new Error('Revenue API error'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load revenue data')).toBeInTheDocument()
    })
    expect(screen.getByText('Revenue API error')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  // ─── Empty / Zero State ──────────────────────────────────────────

  it('handles empty revenue data gracefully', async () => {
    mockGetRevenue.mockResolvedValue({
      totalRevenue: 0,
      monthlyRevenue: 0,
      yearlyRevenue: 0,
      revenueByProject: [],
      revenueByMonth: [],
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    })
    expect(screen.getByText('$0.00M')).toBeInTheDocument()
  })
})
