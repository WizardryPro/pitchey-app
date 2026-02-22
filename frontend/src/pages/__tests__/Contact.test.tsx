import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
let Contact: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Contact')
  Contact = mod.default
})

describe('Contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <Contact />
      </MemoryRouter>
    )

  it('renders Contact Us heading', () => {
    renderComponent()
    expect(screen.getByText('Contact Us')).toBeInTheDocument()
  })

  it('renders page description', () => {
    renderComponent()
    expect(screen.getByText(/We'd love to hear from you/)).toBeInTheDocument()
  })

  it('renders Back to Home button', () => {
    renderComponent()
    expect(screen.getByText('Back to Home')).toBeInTheDocument()
  })

  it('navigates home when Back to Home is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Back to Home'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders Type of Feedback select field', () => {
    renderComponent()
    expect(screen.getByLabelText('Type of Feedback *')).toBeInTheDocument()
  })

  it('renders feedback type options', () => {
    renderComponent()
    const select = screen.getByLabelText('Type of Feedback *')
    expect(select).toBeInTheDocument()
    // Options should include standard feedback types
    expect(screen.getByText('Web Issue')).toBeInTheDocument()
    expect(screen.getByText('Feature Request')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('renders Your Email input field', () => {
    renderComponent()
    expect(screen.getByLabelText('Your Email *')).toBeInTheDocument()
  })

  it('renders Subject input field', () => {
    renderComponent()
    expect(screen.getByLabelText('Subject *')).toBeInTheDocument()
  })

  it('renders Message textarea field', () => {
    renderComponent()
    expect(screen.getByLabelText('Message *')).toBeInTheDocument()
  })

  it('renders Send Message button', () => {
    renderComponent()
    expect(screen.getByText('Send Message')).toBeInTheDocument()
  })

  it('allows filling in form fields', () => {
    renderComponent()

    const emailInput = screen.getByLabelText('Your Email *') as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    expect(emailInput.value).toBe('test@example.com')

    const subjectInput = screen.getByLabelText('Subject *') as HTMLInputElement
    fireEvent.change(subjectInput, { target: { value: 'Test subject' } })
    expect(subjectInput.value).toBe('Test subject')

    const messageTextarea = screen.getByLabelText('Message *') as HTMLTextAreaElement
    fireEvent.change(messageTextarea, { target: { value: 'Test message content' } })
    expect(messageTextarea.value).toBe('Test message content')
  })

  it('shows Thank You! page after form submission', async () => {
    renderComponent()

    // Fill in required fields
    fireEvent.change(screen.getByLabelText('Type of Feedback *'), {
      target: { value: 'web-issue' }
    })
    fireEvent.change(screen.getByLabelText('Your Email *'), {
      target: { value: 'test@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Subject *'), {
      target: { value: 'Test' }
    })
    fireEvent.change(screen.getByLabelText('Message *'), {
      target: { value: 'Test message' }
    })

    fireEvent.click(screen.getByText('Send Message'))

    await waitFor(() => {
      expect(screen.getByText('Thank You!')).toBeInTheDocument()
    })
  })

  it('shows redirect message after form submission', async () => {
    renderComponent()

    fireEvent.change(screen.getByLabelText('Type of Feedback *'), { target: { value: 'other' } })
    fireEvent.change(screen.getByLabelText('Your Email *'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByLabelText('Subject *'), { target: { value: 'Hi' } })
    fireEvent.change(screen.getByLabelText('Message *'), { target: { value: 'Hello' } })

    fireEvent.click(screen.getByText('Send Message'))

    await waitFor(() => {
      expect(screen.getByText('Redirecting to homepage...')).toBeInTheDocument()
    })
  })

  it('shows confirmation message after submission', async () => {
    renderComponent()

    fireEvent.change(screen.getByLabelText('Type of Feedback *'), { target: { value: 'praise' } })
    fireEvent.change(screen.getByLabelText('Your Email *'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByLabelText('Subject *'), { target: { value: 'Great!' } })
    fireEvent.change(screen.getByLabelText('Message *'), { target: { value: 'Love Pitchey' } })

    fireEvent.click(screen.getByText('Send Message'))

    await waitFor(() => {
      expect(screen.getByText(/Your message has been received/)).toBeInTheDocument()
    })
  })

  it('renders all feedback type options', () => {
    renderComponent()
    expect(screen.getByText('Complaint about a Pitch')).toBeInTheDocument()
    expect(screen.getByText('Complaint about an Investor')).toBeInTheDocument()
    expect(screen.getByText('Praise for Pitchey')).toBeInTheDocument()
    expect(screen.getByText('Partnership Inquiry')).toBeInTheDocument()
  })
})
