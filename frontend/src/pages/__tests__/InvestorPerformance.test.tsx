import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/utils'
import InvestorPerformance from '../investor/InvestorPerformance'

const mockGetPerformance = vi.fn()
const mockGetROISummary = vi.fn()
const mockGetROIByCategory = vi.fn()

vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getPerformance: (...args: any[]) => mockGetPerformance(...args),
    getROISummary: (...args: any[]) => mockGetROISummary(...args),
    getROIByCategory: (...args: any[]) => mockGetROIByCategory(...args),
  },
}))

// Mock recharts to avoid rendering issues in test environment
vi.mock('recharts', () => {
  const React = require('react')
  return {
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div />,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div />,
    PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
    Pie: () => <div />,
    Cell: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />,
  }
})

// Mock shadcn chart components
vi.mock('@shared/components/ui/chart', () => ({
  ChartContainer: ({ children }: any) => <div>{children}</div>,
  ChartTooltip: (props: any) => <div />,
  ChartTooltipContent: () => <div />,
  ChartLegend: ({ children }: any) => <div>{children}</div>,
  ChartLegendContent: () => <div />,
}))

// Mock shadcn card components
vi.mock('@shared/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}))

const mockPerformanceData = () => ({
  success: true,
  data: {
    totalReturn: 28.5,
    annualizedReturn: 18.2,
    volatility: 14.3,
    sharpeRatio: 1.85,
    maxDrawdown: -8.7,
    hitRate: 72,
    averageHoldingPeriod: 2.4,
    activeInvestments: 8,
  },
})

const mockROISummaryData = () => ({
  success: true,
  data: {
    summary: {
      total_investments: 15,
      average_roi: 22.5,
      best_roi: 85.0,
      worst_roi: -12.0,
      profitable_count: 11,
    },
  },
})

const mockROIByCategoryData = () => ({
  success: true,
  data: {
    categories: [
      { category: 'Drama', avg_roi: 25.3, count: 5 },
      { category: 'Comedy', avg_roi: 18.7, count: 4 },
      { category: 'Thriller', avg_roi: 32.1, count: 3 },
    ],
  },
})

describe('InvestorPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPerformance.mockResolvedValue(mockPerformanceData())
    mockGetROISummary.mockResolvedValue(mockROISummaryData())
    mockGetROIByCategory.mockResolvedValue(mockROIByCategoryData())
  })

  it('renders the page heading', async () => {
    render(<InvestorPerformance />)

    await waitFor(() => {
      expect(screen.getByText('Performance Analysis')).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        'Detailed analysis of your investment portfolio performance'
      )
    ).toBeInTheDocument()
  })

  it('shows loading spinner initially', () => {
    mockGetPerformance.mockReturnValue(new Promise(() => {}))
    mockGetROISummary.mockReturnValue(new Promise(() => {}))
    mockGetROIByCategory.mockReturnValue(new Promise(() => {}))

    render(<InvestorPerformance />)

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('calls all three API endpoints on mount', async () => {
    render(<InvestorPerformance />)

    await waitFor(() => {
      expect(mockGetPerformance).toHaveBeenCalledWith('1y')
      expect(mockGetROISummary).toHaveBeenCalledWith('1y')
      expect(mockGetROIByCategory).toHaveBeenCalledWith('1y')
    })
  })

  it('displays performance metrics after data loads', async () => {
    render(<InvestorPerformance />)

    await waitFor(() => {
      expect(screen.getByText('Total Return')).toBeInTheDocument()
    })

    // Key metric labels
    expect(screen.getByText('Annualized Return')).toBeInTheDocument()
    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument()
    expect(screen.getByText('Hit Rate')).toBeInTheDocument()

    // Metric values
    expect(screen.getByText('+28.5%')).toBeInTheDocument()
    expect(screen.getByText('+18.2%')).toBeInTheDocument()
    expect(screen.getByText('1.85')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('displays risk metrics section', async () => {
    render(<InvestorPerformance />)

    await waitFor(() => {
      expect(screen.getByText('Risk Metrics')).toBeInTheDocument()
    })

    expect(screen.getByText('Volatility')).toBeInTheDocument()
    expect(screen.getByText('14.3%')).toBeInTheDocument()
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument()
  })

  it('displays genre allocation table', async () => {
    render(<InvestorPerformance />)

    await waitFor(() => {
      expect(screen.getByText('Genre Breakdown')).toBeInTheDocument()
    })

    // Table headers
    expect(screen.getByText('Genre')).toBeInTheDocument()
    expect(screen.getByText('Allocation')).toBeInTheDocument()
    expect(screen.getByText('Investments')).toBeInTheDocument()

    // Genre data rows
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Comedy')).toBeInTheDocument()
    expect(screen.getByText('Thriller')).toBeInTheDocument()
  })
})
