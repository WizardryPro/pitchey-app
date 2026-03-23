import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGenerateReport = vi.fn()

// ─── Capture original createElement before any spying ───────────────
// This prevents infinite recursion when we spy on document.createElement
const originalCreateElement = document.createElement.bind(document)

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Admin service ───────────────────────────────────────────────────
vi.mock('@/portals/admin/services/admin.service', () => ({
  adminService: {
    generateReport: (...args: any[]) => mockGenerateReport(...args),
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── Dynamic import after mocks ──────────────────────────────────────
let AdminReports: React.ComponentType
beforeAll(async () => {
  const mod = await import('../AdminReports')
  AdminReports = mod.default
})

// ─── Helper: set up download mocks ───────────────────────────────────
function setupDownloadMocks() {
  const mockClick = vi.fn()
  globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return { href: '', download: '', click: mockClick } as any
    return originalCreateElement(tag)
  })
  return { mockClick, spy }
}

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AdminReports />
    </MemoryRouter>
  )

describe('AdminReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateReport.mockResolvedValue(new Blob(['col1,col2\nval1,val2'], { type: 'text/csv' }))
  })

  describe('Layout', () => {
    it('renders the page title', () => {
      renderComponent()
      expect(screen.getByText('Reports')).toBeInTheDocument()
    })

    it('renders all four report type cards', () => {
      renderComponent()
      expect(screen.getByText('Users Report')).toBeInTheDocument()
      expect(screen.getByText('Transactions Report')).toBeInTheDocument()
      expect(screen.getByText('Content Report')).toBeInTheDocument()
      expect(screen.getByText('Revenue Report')).toBeInTheDocument()
    })

    it('renders report type descriptions', () => {
      renderComponent()
      expect(screen.getByText(/User accounts, roles, activity/)).toBeInTheDocument()
      expect(screen.getByText(/Payment history, refunds/)).toBeInTheDocument()
      expect(screen.getByText(/Pitch submissions, moderation actions/)).toBeInTheDocument()
      expect(screen.getByText(/Revenue trends, subscription metrics/)).toBeInTheDocument()
    })

    it('renders the Date Range section', () => {
      renderComponent()
      expect(screen.getByText('Date Range (optional)')).toBeInTheDocument()
    })

    it('renders From and To date inputs', () => {
      renderComponent()
      expect(screen.getByText('From')).toBeInTheDocument()
      expect(screen.getByText('To')).toBeInTheDocument()
      const dateInputs = document.querySelectorAll('input[type="date"]')
      expect(dateInputs.length).toBe(2)
    })

    it('renders the Generate & Download button', () => {
      renderComponent()
      expect(screen.getByText('Generate & Download')).toBeInTheDocument()
    })
  })

  describe('Report Type Selection', () => {
    it('defaults to Users Report selected', () => {
      renderComponent()
      const usersBtn = screen.getByText('Users Report').closest('button')
      expect(usersBtn).toHaveClass('border-purple-900')
    })

    it('selects Transactions Report when clicked', async () => {
      renderComponent()
      await userEvent.click(screen.getByText('Transactions Report'))
      const transBtn = screen.getByText('Transactions Report').closest('button')
      expect(transBtn).toHaveClass('border-purple-900')
    })

    it('selects Content Report when clicked', async () => {
      renderComponent()
      await userEvent.click(screen.getByText('Content Report'))
      const contentBtn = screen.getByText('Content Report').closest('button')
      expect(contentBtn).toHaveClass('border-purple-900')
    })

    it('selects Revenue Report when clicked', async () => {
      renderComponent()
      await userEvent.click(screen.getByText('Revenue Report'))
      const revenueBtn = screen.getByText('Revenue Report').closest('button')
      expect(revenueBtn).toHaveClass('border-purple-900')
    })

    it('deselects previous report type when new one is chosen', async () => {
      renderComponent()
      await userEvent.click(screen.getByText('Transactions Report'))
      const usersBtn = screen.getByText('Users Report').closest('button')
      expect(usersBtn).not.toHaveClass('border-purple-900')
    })
  })

  describe('Generate Button', () => {
    it('calls generateReport with correct type on click', async () => {
      const { spy } = setupDownloadMocks()
      renderComponent()
      await userEvent.click(screen.getByText('Generate & Download'))
      await waitFor(() => {
        expect(mockGenerateReport).toHaveBeenCalledWith('users', expect.any(Object))
      })
      spy.mockRestore()
    })

    it('calls generateReport with selected type', async () => {
      const { spy } = setupDownloadMocks()
      renderComponent()
      await userEvent.click(screen.getByText('Revenue Report'))
      await userEvent.click(screen.getByText('Generate & Download'))
      await waitFor(() => {
        expect(mockGenerateReport).toHaveBeenCalledWith('revenue', expect.any(Object))
      })
      spy.mockRestore()
    })

    it('shows Generating... text while report is being generated', async () => {
      mockGenerateReport.mockReturnValue(new Promise(() => {}))
      renderComponent()
      await userEvent.click(screen.getByText('Generate & Download'))
      expect(screen.getByText('Generating...')).toBeInTheDocument()
    })

    it('disables the button while generating', async () => {
      mockGenerateReport.mockReturnValue(new Promise(() => {}))
      renderComponent()
      await userEvent.click(screen.getByText('Generate & Download'))
      const button = screen.getByText('Generating...').closest('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Download History', () => {
    it('does not show Recent Downloads section initially', () => {
      renderComponent()
      expect(screen.queryByText('Recent Downloads')).not.toBeInTheDocument()
    })

    it('shows Recent Downloads after a successful generate', async () => {
      const { spy } = setupDownloadMocks()
      renderComponent()
      await userEvent.click(screen.getByText('Generate & Download'))
      await waitFor(() => {
        expect(screen.getByText('Recent Downloads')).toBeInTheDocument()
      })
      spy.mockRestore()
    })

    it('shows the filename in download history', async () => {
      const { spy } = setupDownloadMocks()
      renderComponent()
      await userEvent.click(screen.getByText('Generate & Download'))
      await waitFor(() => {
        expect(screen.getByText(/users-report-/)).toBeInTheDocument()
      })
      spy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('shows error message when report generation fails', async () => {
      mockGenerateReport.mockRejectedValue(new Error('Report generation failed'))
      renderComponent()
      await userEvent.click(screen.getByText('Generate & Download'))
      await waitFor(() => {
        expect(screen.getByText('Report generation failed')).toBeInTheDocument()
      })
    })

    it('does not add entry to history on failure', async () => {
      mockGenerateReport.mockRejectedValue(new Error('Report generation failed'))
      renderComponent()
      await userEvent.click(screen.getByText('Generate & Download'))
      await waitFor(() => {
        expect(screen.getByText('Report generation failed')).toBeInTheDocument()
      })
      expect(screen.queryByText('Recent Downloads')).not.toBeInTheDocument()
    })
  })
})
