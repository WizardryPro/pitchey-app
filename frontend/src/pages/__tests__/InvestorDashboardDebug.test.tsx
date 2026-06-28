import { describe, it, expect, vi, beforeEach, beforeAll} from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE reference) ──────────────────────────────────
const mockAuthState = {
  logout: mockLogout,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Component ──────────────────────────────────────────────────────
let InvestorDashboardDebug: React.ComponentType
beforeAll(async () => {
  const mod = await import('../InvestorDashboardDebug')
  InvestorDashboardDebug = mod.default
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <InvestorDashboardDebug />
    </MemoryRouter>
  )
}

// Helper: render and wait for loading to complete (setTimeout 1000ms)
async function renderAndWaitForLoad() {
  const result = renderComponent()
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 1100))
  })
  return result
}

describe('InvestorDashboardDebug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
  })

  it('shows loading spinner initially', () => {
    renderComponent()
    expect(screen.getByText(/Loading Dashboard Debug/)).toBeInTheDocument()
  })

  it('shows phase number in loading text', () => {
    renderComponent()
    expect(screen.getByText(/Phase 1/)).toBeInTheDocument()
  })

  it('renders debug mode header after loading completes', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText(/DASHBOARD DEBUG MODE/)).toBeInTheDocument()
  })

  it('renders Pitchey brand button after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Pitchey')).toBeInTheDocument()
  })

  it('renders Investor Dashboard title after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Investor Dashboard (Debug)')).toBeInTheDocument()
  })

  it('renders welcome message with company name after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText(/Welcome back, Johnson Ventures!/)).toBeInTheDocument()
  })

  it('renders Next Phase button after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByRole('button', { name: 'Next Phase' })).toBeInTheDocument()
  })

  it('renders Reset button after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
  })

  it('renders Logout button after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByRole('button', { name: /Logout/ })).toBeInTheDocument()
  })

  it('shows phase 1 description: Basic layout only', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Testing: Basic layout only')).toBeInTheDocument()
  })

  it('renders portfolio overview text after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText("Here's your investment portfolio overview")).toBeInTheDocument()
  })

  it('renders debug information section after loading', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Debug Information:')).toBeInTheDocument()
  })

  it('increments phase when Next Phase is clicked', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Testing: Basic layout only')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next Phase' }))
    // After clicking, component shows loading again then resolves
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100))
    })
    expect(screen.getByText(/Testing: \+ NotificationBell/)).toBeInTheDocument()
  })

  it('resets phase to 1 when Reset is clicked', async () => {
    await renderAndWaitForLoad()
    // Advance to phase 2
    fireEvent.click(screen.getByRole('button', { name: 'Next Phase' }))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100))
    })
    expect(screen.getByText(/Testing: \+ NotificationBell/)).toBeInTheDocument()
    // Reset
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100))
    })
    expect(screen.getByText('Testing: Basic layout only')).toBeInTheDocument()
  })

  it('calls logout when Logout is clicked', async () => {
    await renderAndWaitForLoad()
    fireEvent.click(screen.getByRole('button', { name: /Logout/ }))
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('navigates to home when Pitchey button is clicked', async () => {
    await renderAndWaitForLoad()
    fireEvent.click(screen.getByText('Pitchey'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
