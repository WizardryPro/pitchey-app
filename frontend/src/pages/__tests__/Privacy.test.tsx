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
let Privacy: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Privacy')
  Privacy = mod.default
})

describe('Privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    )

  it('renders Privacy Policy heading', () => {
    renderComponent()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })

  it('renders effective date', () => {
    renderComponent()
    expect(screen.getByText(/Effective Date/)).toBeInTheDocument()
    expect(screen.getByText(/January 1, 2025/)).toBeInTheDocument()
  })

  it('renders Back to Home button', () => {
    renderComponent()
    expect(screen.getByText('Back to Home')).toBeInTheDocument()
  })

  it('navigates to home when Back to Home is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Back to Home'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders Introduction section', () => {
    renderComponent()
    expect(screen.getByText('1. Introduction')).toBeInTheDocument()
  })

  it('renders Information We Collect section', () => {
    renderComponent()
    expect(screen.getByText('2. Information We Collect')).toBeInTheDocument()
  })

  it('renders Data Security section', () => {
    renderComponent()
    expect(screen.getByText('5. Data Security')).toBeInTheDocument()
  })

  it('renders Your Rights and Choices section', () => {
    renderComponent()
    expect(screen.getByText('6. Your Rights and Choices')).toBeInTheDocument()
  })

  it('renders Contact section', () => {
    renderComponent()
    expect(screen.getByText('11. Contact Us')).toBeInTheDocument()
  })

  it('renders California Privacy Rights section', () => {
    renderComponent()
    expect(screen.getByText('12. California Privacy Rights')).toBeInTheDocument()
  })

  it('renders Pitchey brand mention', () => {
    renderComponent()
    expect(screen.getAllByText(/Pitchey/).length).toBeGreaterThan(0)
  })

  it('renders personal information subsections', () => {
    renderComponent()
    expect(screen.getByText('2.1 Personal Information')).toBeInTheDocument()
    expect(screen.getByText('2.2 Project Information')).toBeInTheDocument()
    expect(screen.getByText('2.3 Technical Information')).toBeInTheDocument()
  })

  it('renders information sharing section', () => {
    renderComponent()
    expect(screen.getByText('4. Information Sharing')).toBeInTheDocument()
    expect(screen.getByText('4.1 With Other Users')).toBeInTheDocument()
  })

  it('renders cookies section', () => {
    renderComponent()
    expect(screen.getByText('7. Cookies and Tracking')).toBeInTheDocument()
  })

  it('renders the full page without crashing', () => {
    const { container } = renderComponent()
    expect(container).toBeTruthy()
    expect(container.querySelector('.min-h-screen')).toBeTruthy()
  })
})
