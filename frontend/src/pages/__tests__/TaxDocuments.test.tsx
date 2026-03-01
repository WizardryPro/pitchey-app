import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockGetTaxDocuments = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ─────────────────────────────────────────────────────
const mockUser = { id: 1, name: 'Investor User', email: 'investor@test.com', user_type: 'investor' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Investor service ────────────────────────────────────────────────
vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getTaxDocuments: mockGetTaxDocuments,
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── Defensive utilities ────────────────────────────────────────────
vi.mock('../../utils/defensive', () => ({
  safeArray: (v: any) => v || [],
  safeMap: (arr: any[], fn: any) => (arr || []).map(fn),
  safeAccess: (obj: any, path: string, def: any) => {
    const keys = path.split('.')
    let cur = obj
    for (const k of keys) {
      if (cur == null) return def
      cur = cur[k]
    }
    return cur ?? def
  },
  safeNumber: (v: any, def: number = 0) => (typeof v === 'number' ? v : def),
  safeString: (v: any, def: string = '') => (typeof v === 'string' ? v : def),
  safeExecute: (fn: any) => { try { return fn() } catch { return undefined } },
}))

const mockDocuments = [
  {
    id: 1,
    name: '2024 K-1 Form',
    type: 'K-1',
    size: '245 KB',
    date: '2025-01-15T00:00:00Z',
    status: 'available',
  },
  {
    id: 2,
    name: '2024 Annual Report',
    type: 'Annual Report',
    size: '1.2 MB',
    date: '2025-01-20T00:00:00Z',
    status: 'available',
  },
  {
    id: 3,
    name: '2024 Q3 Statement',
    type: 'Quarterly Statement',
    size: '560 KB',
    date: '2024-10-01T00:00:00Z',
    status: 'processing',
  },
]

let TaxDocuments: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/TaxDocuments')
  TaxDocuments = mod.default
})

describe('TaxDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetTaxDocuments.mockResolvedValue({
      success: true,
      data: { documents: mockDocuments },
    })
  })

  it('shows loading spinner initially', async () => {
    mockGetTaxDocuments.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders page heading after load', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Tax Documents')).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search documents...')).toBeInTheDocument()
    })
  })

  it('renders year selector', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByDisplayValue(/202/)).toBeInTheDocument()
    })
  })

  it('renders Available Documents section', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Available Documents')).toBeInTheDocument()
    })
  })

  it('renders document names from API', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('2024 K-1 Form')).toBeInTheDocument()
      expect(screen.getByText('2024 Annual Report')).toBeInTheDocument()
      expect(screen.getByText('2024 Q3 Statement')).toBeInTheDocument()
    })
  })

  it('renders Download buttons for each document', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      const downloadButtons = screen.getAllByText('Download')
      expect(downloadButtons.length).toBe(mockDocuments.length)
    })
  })

  it('renders Download All button', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Download All')).toBeInTheDocument()
    })
  })

  it('renders Filter button', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument()
    })
  })

  it('shows no documents message when empty', async () => {
    mockGetTaxDocuments.mockResolvedValue({
      success: true,
      data: { documents: [] },
    })
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No documents found')).toBeInTheDocument()
    })
  })

  it('shows error card when API fails', async () => {
    mockGetTaxDocuments.mockRejectedValue(new Error('Network error'))
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load tax documents')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('renders status badges for documents', async () => {
    render(
      <MemoryRouter>
        <TaxDocuments />
      </MemoryRouter>
    )
    await waitFor(() => {
      const availableBadges = screen.getAllByText('available')
      expect(availableBadges.length).toBe(2)
      expect(screen.getByText('processing')).toBeInTheDocument()
    })
  })
})
