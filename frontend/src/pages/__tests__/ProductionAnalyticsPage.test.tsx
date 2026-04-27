import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ──────────────────────────────────────────
const mockGetDashboard = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── ProductionService ───────────────────────────────────────────────
vi.mock('@portals/production/services/production.service', () => ({
  ProductionService: {
    getDashboard: (...args: any[]) => mockGetDashboard(...args),
  },
  productionService: {},
}))

// ─── Sub-page components (all portal sub-pages are stubbed) ──────────
vi.mock('@portals/production/pages/ProductionAnalytics', () => ({
  default: () => <div data-testid="production-analytics-tab">Production Analytics Component</div>,
}))

vi.mock('@portals/production/pages/ProductionActivity', () => ({
  default: () => <div data-testid="production-activity-tab">Production Activity Component</div>,
}))

vi.mock('@portals/production/pages/ProductionStats', () => ({
  default: () => <div data-testid="production-stats-tab">Production Stats Component</div>,
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ProductionAnalyticsPage')
  Component = mod.default
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

const mockDashboardData = {
  stats: {
    totalProjects: 10,
    activeProjects: 4,
    pitchesReviewed: 25,
    totalBudget: 5000000,
  },
}

describe('ProductionAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDashboard.mockResolvedValue(mockDashboardData)
  })

  describe('page header', () => {
    it('renders the page title', () => {
      renderComponent()
      expect(screen.getByText('Analytics & Performance')).toBeInTheDocument()
    })

    it('renders the page subtitle', () => {
      renderComponent()
      expect(screen.getByText('Track your production metrics and project performance')).toBeInTheDocument()
    })
  })

  describe('tab navigation', () => {
    it('renders all three tab buttons', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /quick stats/i })).toBeInTheDocument()
    })

    it('shows Overview tab content by default', () => {
      renderComponent()
      expect(screen.getByTestId('production-analytics-tab')).toBeInTheDocument()
    })

    it('switches to Activity tab when clicked', () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /activity/i }))
      expect(screen.getByTestId('production-activity-tab')).toBeInTheDocument()
    })

    it('switches to Quick Stats tab when clicked', () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /quick stats/i }))
      expect(screen.getByTestId('production-stats-tab')).toBeInTheDocument()
    })

    it('hides other tab content when switching tabs', () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /activity/i }))
      expect(screen.queryByTestId('production-analytics-tab')).not.toBeInTheDocument()
    })
  })

  describe('overview tab content', () => {
    it('renders Project Performance section', () => {
      renderComponent()
      expect(screen.getByText('Project Performance')).toBeInTheDocument()
    })

    it('renders Budget Overview section', () => {
      renderComponent()
      expect(screen.getByText('Budget Overview')).toBeInTheDocument()
    })

    it('renders Completed Projects metric', () => {
      renderComponent()
      expect(screen.getByText('Completed Projects')).toBeInTheDocument()
    })

    it('renders Active Projects metric', () => {
      renderComponent()
      expect(screen.getByText('Active Projects')).toBeInTheDocument()
    })

    it('renders Pitches Reviewed metric', () => {
      renderComponent()
      expect(screen.getByText('Pitches Reviewed')).toBeInTheDocument()
    })

    it('renders Total Budget display', () => {
      renderComponent()
      expect(screen.getByText('Total Budget')).toBeInTheDocument()
    })

    it('renders Active Allocation progress bar label', () => {
      renderComponent()
      expect(screen.getByText('Active Allocation')).toBeInTheDocument()
    })

    it('renders Available progress bar label', () => {
      renderComponent()
      expect(screen.getByText('Available')).toBeInTheDocument()
    })

    it('renders current year in budget section', () => {
      renderComponent()
      expect(screen.getByText(String(new Date().getFullYear()))).toBeInTheDocument()
    })
  })

  describe('data loading from ProductionService', () => {
    it('calls ProductionService.getDashboard on mount', async () => {
      renderComponent()

      await waitFor(() => {
        expect(mockGetDashboard).toHaveBeenCalledTimes(1)
      })
    })

    it('displays computed stats from dashboard data', async () => {
      renderComponent()

      // totalProjects=10, activeProjects=4 → completedProjects=6
      // Wait for the data to be applied
      await waitFor(() => {
        expect(mockGetDashboard).toHaveBeenCalled()
      })

      // The active projects count is 4
      expect(screen.getAllByText('4').length).toBeGreaterThan(0)
      // Pitches reviewed is 25
      expect(screen.getAllByText('25').length).toBeGreaterThan(0)
    })

    it('displays budget in millions when totalBudget is 5000000', async () => {
      renderComponent()

      await waitFor(() => {
        expect(mockGetDashboard).toHaveBeenCalled()
      })

      expect(screen.getByText('$5.0M')).toBeInTheDocument()
    })

    it('handles getDashboard failure gracefully with default zeros', async () => {
      mockGetDashboard.mockRejectedValue(new Error('API error'))
      renderComponent()

      await waitFor(() => {
        expect(mockGetDashboard).toHaveBeenCalled()
      })

      // With defaults (0s), budget shows '$0'
      expect(screen.getByText('$0')).toBeInTheDocument()
    })

    it('handles missing stats in dashboard response', async () => {
      mockGetDashboard.mockResolvedValue({})
      renderComponent()

      await waitFor(() => {
        expect(mockGetDashboard).toHaveBeenCalled()
      })

      // No crash — page renders
      expect(screen.getByText('Project Performance')).toBeInTheDocument()
    })
  })
})
