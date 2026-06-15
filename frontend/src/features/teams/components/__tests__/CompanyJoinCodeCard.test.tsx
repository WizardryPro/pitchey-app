import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { CompanyJoinCodeCard } from '../CompanyTeamCards'

// Route the local api() helper's fetch calls by URL.
function routeFetch(url: string) {
  const json = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as any)
  if (url.endsWith('/api/teams')) return json({ data: { teams: [{ id: 2, is_company_team: true }] } })
  if (url.endsWith('/api/teams/2/code')) return json({ data: { code: 'ABCD2345', seatsUsed: 2, seatLimit: 3 } })
  if (url.endsWith('/api/teams/2/collaboration-nda/members')) return json({ data: { members: [
    { userId: 1025, name: 'Alex Creator', email: 'alex@demo.com', ndaStatus: 'signed', signedAt: '2026-06-05T13:18:28Z', documentUrl: '/api/teams/2/collaboration-nda/document?signerId=1025' },
    { userId: 1099, name: 'Dana Writer', email: 'dana@demo.com', ndaStatus: 'pending', signedAt: null, documentUrl: null },
  ] } })
  return json({})
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockImplementation((url: string) => routeFetch(String(url)))
})

describe('CompanyJoinCodeCard — per-seat NDA status', () => {
  it('lists members with NDA signed / NDA pending status and a doc link for signed', async () => {
    render(<CompanyJoinCodeCard />)

    await waitFor(() => expect(screen.getByText('Alex Creator')).toBeInTheDocument())
    expect(screen.getByText('Dana Writer')).toBeInTheDocument()
    expect(screen.getByText('NDA signed')).toBeInTheDocument()
    expect(screen.getByText('NDA pending')).toBeInTheDocument()

    // Signed member exposes a "View NDA" link to the document endpoint.
    const link = screen.getByTitle('View the signed company collaboration NDA') as HTMLAnchorElement
    expect(link.getAttribute('href')).toContain('/api/teams/2/collaboration-nda/document?signerId=1025')
  })
})
