import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Dynamic import ─────────────────────────────────────────────────
let PortalSelect: React.ComponentType
beforeAll(async () => {
  const mod = await import('../PortalSelect')
  PortalSelect = mod.default
})

describe('PortalSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <PortalSelect />
      </MemoryRouter>
    )

  it('renders "Choose Your Portal" heading', () => {
    renderComponent()
    expect(screen.getByText('Choose Your Portal')).toBeInTheDocument()
  })

  it('renders descriptive subtitle', () => {
    renderComponent()
    expect(screen.getByText(/Select the portal that best describes your role/)).toBeInTheDocument()
  })

  it('renders Creator Portal card', () => {
    renderComponent()
    expect(screen.getByText('Creator Portal')).toBeInTheDocument()
    expect(screen.getByText('Submit and manage your movie pitches')).toBeInTheDocument()
  })

  it('renders Investor Portal card', () => {
    renderComponent()
    expect(screen.getByText('Investor Portal')).toBeInTheDocument()
    expect(screen.getByText('Discover and invest in promising projects')).toBeInTheDocument()
  })

  it('renders Production Portal card', () => {
    renderComponent()
    expect(screen.getByText('Production Portal')).toBeInTheDocument()
    expect(screen.getByText('Find and develop exciting content')).toBeInTheDocument()
  })

  it('navigates to creator login when Creator Portal is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Creator Portal'))
    expect(mockNavigate).toHaveBeenCalledWith('/login/creator')
  })

  it('navigates to investor login when Investor Portal is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Investor Portal'))
    expect(mockNavigate).toHaveBeenCalledWith('/login/investor')
  })

  it('navigates to production login when Production Portal is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Production Portal'))
    expect(mockNavigate).toHaveBeenCalledWith('/login/production')
  })

  it('navigates back to home when Back button is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Back'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders sign up link', () => {
    renderComponent()
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument()
    const signUpLink = screen.getByText('Sign up')
    expect(signUpLink).toBeInTheDocument()
    expect(signUpLink.closest('a')).toHaveAttribute('href', '/register')
  })
})
