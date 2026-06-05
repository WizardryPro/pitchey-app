import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'

// ─── Hoisted mocks ──────────────────────────────────────────────────
const mockPost = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../../../lib/api-client', () => ({
  default: { post: (...a: any[]) => mockPost(...a) },
  apiClient: { post: (...a: any[]) => mockPost(...a) },
}))

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CollaborationNdaModal } from '../CollaborationNdaModal'

const ndaBody = { success: true, data: { name: 'Pitchey Standard NDA', content: 'NDA TERMS HERE' } }

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue({ json: () => Promise.resolve(ndaBody) } as any)
  mockPost.mockResolvedValue({ success: true, data: { signed: true } })
})

describe('CollaborationNdaModal', () => {
  it('renders the fetched NDA text with company autofill in the request', async () => {
    render(
      <CollaborationNdaModal teamId={2} company="Stellar Pictures" onClose={() => {}} onSigned={() => {}} />
    )
    await waitFor(() => expect(screen.getByText('NDA TERMS HERE')).toBeInTheDocument())
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('disclosingName=Stellar+Pictures')
    expect(url).toContain('projectName=all+Stellar+Pictures+projects')
  })

  it('keeps Sign disabled until the box is ticked and a name is entered', async () => {
    render(
      <CollaborationNdaModal teamId={2} company="Stellar Pictures" onClose={() => {}} onSigned={() => {}} />
    )
    await waitFor(() => screen.getByText('NDA TERMS HERE'))
    const signBtn = screen.getByRole('button', { name: /Sign & Continue/i }) as HTMLButtonElement
    expect(signBtn.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(signBtn.disabled).toBe(true) // still needs a name

    fireEvent.change(screen.getByPlaceholderText('Jane Q. Creator'), { target: { value: 'Alex Creator' } })
    expect(signBtn.disabled).toBe(false)
  })

  it('POSTs the signature and fires onSigned', async () => {
    const onSigned = vi.fn()
    const onClose = vi.fn()
    render(
      <CollaborationNdaModal teamId={2} company="Stellar Pictures" defaultName="Alex Creator" onClose={onClose} onSigned={onSigned} />
    )
    await waitFor(() => screen.getByText('NDA TERMS HERE'))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Sign & Continue/i }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      '/api/teams/2/collaboration-nda/sign',
      expect.objectContaining({ agreed: true, name: 'Alex Creator' }),
    ))
    await waitFor(() => expect(onSigned).toHaveBeenCalled())
  })
})
