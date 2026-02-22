import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ───────────────────────────────────────────
const mockNavigate = vi.fn()

// ─── react-router-dom ─────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Component ─────────────────────────────────────────────────────────
let NotFound: React.ComponentType
beforeAll(async () => {
  const mod = await import('../NotFound')
  NotFound = mod.default
})

function renderNotFound() {
  return render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>
  )
}

describe('NotFound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 404 error code', () => {
    renderNotFound()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders Page Not Found heading', () => {
    renderNotFound()
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument()
  })

  it('renders descriptive error message', () => {
    renderNotFound()
    expect(screen.getByText(/couldn't find the page/i)).toBeInTheDocument()
  })

  it('renders Go Back button', () => {
    renderNotFound()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  it('renders Go Home button', () => {
    renderNotFound()
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument()
  })

  it('renders Browse Pitches button', () => {
    renderNotFound()
    expect(screen.getByRole('button', { name: /browse pitches/i })).toBeInTheDocument()
  })

  it('renders Popular pages section', () => {
    renderNotFound()
    expect(screen.getByText('Popular pages:')).toBeInTheDocument()
  })

  it('renders Marketplace popular link', () => {
    renderNotFound()
    expect(screen.getByRole('button', { name: 'Marketplace' })).toBeInTheDocument()
  })

  it('renders Sign In popular link', () => {
    renderNotFound()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('navigates to home when Go Home is clicked', () => {
    renderNotFound()
    fireEvent.click(screen.getByRole('button', { name: /go home/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('navigates back when Go Back is clicked', () => {
    renderNotFound()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('navigates to marketplace when Browse Pitches is clicked', () => {
    renderNotFound()
    fireEvent.click(screen.getByRole('button', { name: /browse pitches/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/marketplace')
  })

  it('navigates to marketplace when Marketplace popular link is clicked', () => {
    renderNotFound()
    fireEvent.click(screen.getByRole('button', { name: 'Marketplace' }))
    expect(mockNavigate).toHaveBeenCalledWith('/marketplace')
  })

  it('navigates to portals when Sign In popular link is clicked', () => {
    renderNotFound()
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(mockNavigate).toHaveBeenCalledWith('/portals')
  })
})
