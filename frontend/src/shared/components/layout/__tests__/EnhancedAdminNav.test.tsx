import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const mockNavigate = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/admin/dashboard' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Config ──────────────────────────────────────────────────────────────────
vi.mock('@/config/navigation.routes', () => ({
  ADMIN_ROUTES: {
    dashboard: '/admin/dashboard',
    analytics: '/admin/analytics',
    systemHealth: '/admin/system-health',
    users: '/admin/users',
    content: '/admin/content',
    moderationLog: '/admin/moderation-log',
    transactions: '/admin/transactions',
    reports: '/admin/reports',
    auditLog: '/admin/audit-log',
    gdpr: '/admin/gdpr',
    settings: '/admin/settings',
  },
}))

// ─── Dynamic import after mocks ──────────────────────────────────────────────
let EnhancedAdminNav: React.ComponentType
beforeAll(async () => {
  const mod = await import('../EnhancedAdminNav')
  EnhancedAdminNav = mod.EnhancedAdminNav
})

const renderComponent = (pathname = '/admin/dashboard') => {
  const { rerender } = render(
    <MemoryRouter initialEntries={[pathname]}>
      <EnhancedAdminNav />
    </MemoryRouter>
  )
  return { rerender }
}

describe('EnhancedAdminNav', () => {
  describe('Portal title', () => {
    it('renders "Admin Portal" as the nav heading', () => {
      renderComponent()
      expect(screen.getByText('Admin Portal')).toBeInTheDocument()
    })
  })

  describe('Quick Links section', () => {
    it('renders Quick Links section heading', () => {
      renderComponent()
      expect(screen.getByText('Quick Links')).toBeInTheDocument()
    })

    it('renders Home quick link pointing to /', () => {
      renderComponent()
      const homeLink = screen.getByText('Home').closest('a')
      expect(homeLink).toHaveAttribute('href', '/')
    })

    it('renders Marketplace quick link pointing to /marketplace', () => {
      renderComponent()
      const marketplaceLink = screen.getByText('Marketplace').closest('a')
      expect(marketplaceLink).toHaveAttribute('href', '/marketplace')
    })
  })

  describe('Navigation sections', () => {
    it('renders all 5 section headings', () => {
      renderComponent()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Management')).toBeInTheDocument()
      expect(screen.getByText('Financial')).toBeInTheDocument()
      expect(screen.getByText('Compliance')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })

    it('renders all Dashboard section nav items', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /analytics/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /system health/i })).toBeInTheDocument()
    })

    it('renders all Management section nav items', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /^users$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /content moderation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /moderation log/i })).toBeInTheDocument()
    })

    it('renders all Financial section nav items', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /^transactions$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^reports$/i })).toBeInTheDocument()
    })

    it('renders all Compliance section nav items', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /audit log/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /gdpr/i })).toBeInTheDocument()
    })

    it('renders the System section Settings nav item', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument()
    })
  })

  describe('Active state', () => {
    it('applies active styles to the Overview item when on /admin/dashboard', () => {
      renderComponent('/admin/dashboard')
      const overviewBtn = screen.getByRole('button', { name: /overview/i })
      expect(overviewBtn.className).toContain('bg-purple-100')
    })

    it('does not apply active styles to non-active items', () => {
      renderComponent('/admin/dashboard')
      const analyticsBtn = screen.getByRole('button', { name: /analytics/i })
      expect(analyticsBtn.className).not.toContain('bg-purple-100')
    })
  })

  describe('Navigation behaviour', () => {
    it('calls navigate with the correct path when a nav button is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await user.click(screen.getByRole('button', { name: /^users$/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/admin/users')
    })

    it('navigates to analytics page when Analytics button is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await user.click(screen.getByRole('button', { name: /analytics/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/admin/analytics')
    })

    it('navigates to system health when System Health button is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await user.click(screen.getByRole('button', { name: /system health/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/admin/system-health')
    })
  })
})
