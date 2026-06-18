import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

// ─── Auth store (STABLE reference — outside factory to prevent loops) ──
const mockUser = { id: '1', name: 'Test Producer', email: 'producer@test.com', userType: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn(),
}
vi.mock('@/store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── TeamService ─────────────────────────────────────────────────────
const mockGetInvitations = vi.fn()
const mockInviteToTeam = vi.fn()
const mockResendInvitation = vi.fn()
const mockCancelInvitation = vi.fn()

vi.mock('@/services/team.service', () => ({
  TeamService: {
    getInvitations: mockGetInvitations,
    inviteToTeam: mockInviteToTeam,
    resendInvitation: mockResendInvitation,
    cancelInvitation: mockCancelInvitation,
    getTeams: vi.fn().mockResolvedValue([{ id: '42', name: 'Stellar Productions' }]),
  },
}))

// ─── useCurrentTeam hook ─────────────────────────────────────────────
const mockUseCurrentTeam = vi.fn()
vi.mock('@/shared/hooks/useCurrentTeam', () => ({
  useCurrentTeam: () => mockUseCurrentTeam(),
}))

// ─── Dynamic import ─────────────────────────────────────────────────
let TeamInviteComponent: React.ComponentType
beforeAll(async () => {
  const mod = await import('../TeamInvite')
  TeamInviteComponent = mod.default
})

// ─── Fixtures ────────────────────────────────────────────────────────
const makePendingInvitation = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  teamId: '42',
  teamName: 'Stellar Productions',
  email: 'jane@studio.com',
  role: 'editor',
  status: 'pending',
  invitedBy: 'prod-1',
  invitedByName: 'Test Producer',
  message: 'Join our team!',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  token: 'abc123',
  ...overrides,
})

describe('TeamInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCurrentTeam.mockReturnValue({
      team: { id: '42', name: 'Stellar Productions' },
      teamId: '42',
      loading: false,
      error: null,
      refreshTeam: vi.fn(),
    })
    mockGetInvitations.mockResolvedValue([])
    mockInviteToTeam.mockResolvedValue({
      id: 'inv-new',
      teamId: '42',
      teamName: 'Stellar Productions',
      email: 'new@studio.com',
      role: 'viewer',
      status: 'pending',
      invitedBy: 'prod-1',
      invitedByName: 'Test Producer',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    })
    mockResendInvitation.mockResolvedValue({})
    mockCancelInvitation.mockResolvedValue(undefined)

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={['/production/team/invite']}>
        <TeamInviteComponent />
      </MemoryRouter>
    )

  // ── Layout ──────────────────────────────────────────────────────────
  it('renders the page heading', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Team Invitations')).toBeInTheDocument()
    })
  })

  it('renders the subheading description', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Invite new team members and manage pending invitations')).toBeInTheDocument()
    })
  })

  it('renders the "Send Invitation" header button', async () => {
    renderComponent()
    await waitFor(() => {
      // There may be multiple "Send Invitation" texts when form is open; just check at least one
      expect(screen.getAllByText('Send Invitation').length).toBeGreaterThan(0)
    })
  })

  it('renders the "Pending Invitations" section', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Pending Invitations')).toBeInTheDocument()
    })
  })

  it('renders back navigation button', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Back to Team Management')).toBeInTheDocument()
    })
  })

  // ── Loading state ────────────────────────────────────────────────────
  it('shows loading spinner while fetching invitations', () => {
    mockGetInvitations.mockReturnValue(new Promise(() => {}))
    renderComponent()
    // Spinner is present while loading
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  // ── Empty state ─────────────────────────────────────────────────────
  it('shows empty state when no invitations exist', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('No pending invitations')).toBeInTheDocument()
    })
  })

  it('shows helpful empty-state hint text', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Send your first team invitation to get started')).toBeInTheDocument()
    })
  })

  // ── Error state ─────────────────────────────────────────────────────
  // NOTE: fetchPendingInvitations stores errors in the `error` state but that
  // state is only rendered inside InviteForm — the main page has no top-level
  // error banner. When the fetch fails, invitations stay empty so the empty
  // state is rendered instead.
  it('shows empty state when fetching invitations fails', async () => {
    mockGetInvitations.mockRejectedValue(new Error('Server error'))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('No pending invitations')).toBeInTheDocument()
    })
  })

  // ── Populated invitation list ────────────────────────────────────────
  it('renders a pending invitation with invitee email', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('jane@studio.com')).toBeInTheDocument()
    })
  })

  it('renders invitation status badge', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })

  it('renders "Invited by" field for an invitation', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Invited by Test Producer')).toBeInTheDocument()
    })
  })

  it('renders the personal message on an invitation', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('"Join our team!"')).toBeInTheDocument()
    })
  })

  it('renders accepted invitation status', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ status: 'accepted' })])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('accepted')).toBeInTheDocument()
    })
  })

  it('renders expired invitation status', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    mockGetInvitations.mockResolvedValue([
      makePendingInvitation({ status: 'expired', expiresAt: pastDate }),
    ])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('expired')).toBeInTheDocument()
    })
  })

  it('renders multiple invitations', async () => {
    mockGetInvitations.mockResolvedValue([
      makePendingInvitation({ id: 'inv-1', email: 'a@studio.com' }),
      makePendingInvitation({ id: 'inv-2', email: 'b@studio.com' }),
    ])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('a@studio.com')).toBeInTheDocument()
      expect(screen.getByText('b@studio.com')).toBeInTheDocument()
    })
  })

  it('builds invite link from token', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ token: 'tok999' })])
    renderComponent()
    await waitFor(() => {
      // Eye button (view invite link) is rendered when inviteLink is present
      const eyeButton = document.querySelector('[title="View invite"]')
      expect(eyeButton).toBeTruthy()
    })
  })

  it('shows expiry date for a non-expired invitation', async () => {
    const futureDate = new Date('2030-12-31').toISOString()
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ expiresAt: futureDate })])
    renderComponent()
    await waitFor(() => {
      // Should show "Expires ..." (not "Expired") — locale format varies by env
      const expiryEl = screen.getByText(/^Expires /)
      expect(expiryEl).toBeInTheDocument()
    })
  })

  it('shows "Expired" label for a past-expiry invitation', async () => {
    const pastDate = new Date('2020-01-01').toISOString()
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ expiresAt: pastDate })])
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Expired')).toBeInTheDocument()
    })
  })

  // ── Invite form toggle ───────────────────────────────────────────────
  it('opens the invite form when "Send Invitation" button is clicked', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => {
      expect(screen.getByText('Send Team Invitation')).toBeInTheDocument()
    })
  })

  it('shows email, name, role and department fields in the form', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => {
      expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Select Role')).toBeInTheDocument()
      expect(screen.getByText('Select Department')).toBeInTheDocument()
    })
  })

  it('closes the form when the Cancel button inside the form is clicked', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByText('Send Team Invitation')).not.toBeInTheDocument()
    })
  })

  it('renders permission checkboxes in the form', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => {
      expect(screen.getByText('Permissions')).toBeInTheDocument()
      // At least one permission checkbox
      expect(screen.getByText('view projects')).toBeInTheDocument()
    })
  })

  it('renders role options in the dropdown', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Producer' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Director' })).toBeInTheDocument()
    })
  })

  it('renders department options in the dropdown', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Production' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Marketing' })).toBeInTheDocument()
    })
  })

  // ── Form validation ──────────────────────────────────────────────────
  it('shows validation error when submitting an empty form', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    // Click the form's submit button (last "Send Invitation" button — header button is first)
    const sendBtns = screen.getAllByRole('button', { name: /Send Invitation/i })
    fireEvent.click(sendBtns[sendBtns.length - 1])
    await waitFor(() => {
      expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument()
    })
  })

  it('shows "no team" error when teamId is null', async () => {
    mockUseCurrentTeam.mockReturnValue({
      team: null,
      teamId: null,
      loading: false,
      error: null,
      refreshTeam: vi.fn(),
    })
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    // Fill email, name, role, department to pass the required-fields check
    fireEvent.change(screen.getByPlaceholderText('colleague@company.com'), {
      target: { value: 'test@studio.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Test Person' },
    })
    fireEvent.change(screen.getByDisplayValue('Select Role'), {
      target: { value: 'Producer' },
    })
    fireEvent.change(screen.getByDisplayValue('Select Department'), {
      target: { value: 'Production' },
    })

    const sendBtns2 = screen.getAllByRole('button', { name: /Send Invitation/i })
    fireEvent.click(sendBtns2[sendBtns2.length - 1])
    await waitFor(() => {
      expect(screen.getByText('No team found. Please create a team first.')).toBeInTheDocument()
    })
  })

  // ── Successful invitation submission ─────────────────────────────────
  it('calls TeamService.inviteToTeam with correct payload on submit', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    fireEvent.change(screen.getByPlaceholderText('colleague@company.com'), {
      target: { value: 'newmember@studio.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'New Member' },
    })
    fireEvent.change(screen.getByDisplayValue('Select Role'), {
      target: { value: 'Producer' },
    })
    fireEvent.change(screen.getByDisplayValue('Select Department'), {
      target: { value: 'Production' },
    })
    fireEvent.change(screen.getByPlaceholderText('Add a personal message to the invitation...'), {
      target: { value: 'Welcome aboard!' },
    })

    const sendBtns3 = screen.getAllByRole('button', { name: /Send Invitation/i })
    fireEvent.click(sendBtns3[sendBtns3.length - 1])

    await waitFor(() => {
      expect(mockInviteToTeam).toHaveBeenCalledWith('42', {
        email: 'newmember@studio.com',
        role: 'editor', // Producer maps to editor
        message: 'Welcome aboard!',
      })
    })
  })

  it('maps Producer role to "editor" access level', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    fireEvent.change(screen.getByPlaceholderText('colleague@company.com'), { target: { value: 'p@studio.com' } })
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'P Name' } })
    fireEvent.change(screen.getByDisplayValue('Select Role'), { target: { value: 'Director' } })
    fireEvent.change(screen.getByDisplayValue('Select Department'), { target: { value: 'Creative' } })

    const sendBtns4 = screen.getAllByRole('button', { name: /Send Invitation/i })
    fireEvent.click(sendBtns4[sendBtns4.length - 1])

    await waitFor(() => {
      expect(mockInviteToTeam).toHaveBeenCalledWith('42', expect.objectContaining({ role: 'editor' }))
    })
  })

  it('maps Cinematographer role to "viewer" access level', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    fireEvent.change(screen.getByPlaceholderText('colleague@company.com'), { target: { value: 'c@studio.com' } })
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'C Name' } })
    fireEvent.change(screen.getByDisplayValue('Select Role'), { target: { value: 'Cinematographer' } })
    fireEvent.change(screen.getByDisplayValue('Select Department'), { target: { value: 'Technical' } })

    const sendBtns5 = screen.getAllByRole('button', { name: /Send Invitation/i })
    fireEvent.click(sendBtns5[sendBtns5.length - 1])

    await waitFor(() => {
      expect(mockInviteToTeam).toHaveBeenCalledWith('42', expect.objectContaining({ role: 'viewer' }))
    })
  })

  it('shows success message after sending invitation', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    fireEvent.change(screen.getByPlaceholderText('colleague@company.com'), { target: { value: 's@studio.com' } })
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'S Name' } })
    fireEvent.change(screen.getByDisplayValue('Select Role'), { target: { value: 'Writer' } })
    fireEvent.change(screen.getByDisplayValue('Select Department'), { target: { value: 'Creative' } })

    const sendBtns6 = screen.getAllByRole('button', { name: /Send Invitation/i })
    fireEvent.click(sendBtns6[sendBtns6.length - 1])

    await waitFor(() => {
      expect(screen.getByText('Invitation sent successfully!')).toBeInTheDocument()
    })
  })

  it('closes the invite form after successful submission', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    fireEvent.change(screen.getByPlaceholderText('colleague@company.com'), { target: { value: 'x@studio.com' } })
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'X Name' } })
    fireEvent.change(screen.getByDisplayValue('Select Role'), { target: { value: 'Editor' } })
    fireEvent.change(screen.getByDisplayValue('Select Department'), { target: { value: 'Finance' } })

    const sendBtns7 = screen.getAllByRole('button', { name: /Send Invitation/i })
    fireEvent.click(sendBtns7[sendBtns7.length - 1])

    await waitFor(() => {
      expect(screen.queryByText('Send Team Invitation')).not.toBeInTheDocument()
    })
  })

  it('shows error message when inviteToTeam fails', async () => {
    mockInviteToTeam.mockRejectedValue(new Error('Email already invited'))
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Send Team Invitation'))

    fireEvent.change(screen.getByPlaceholderText('colleague@company.com'), { target: { value: 'err@studio.com' } })
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'Err Name' } })
    fireEvent.change(screen.getByDisplayValue('Select Role'), { target: { value: 'Producer' } })
    fireEvent.change(screen.getByDisplayValue('Select Department'), { target: { value: 'Production' } })

    const sendBtns8 = screen.getAllByRole('button', { name: /Send Invitation/i })
    fireEvent.click(sendBtns8[sendBtns8.length - 1])

    await waitFor(() => {
      expect(screen.getByText('Email already invited')).toBeInTheDocument()
    })
  })

  // ── Resend invitation ────────────────────────────────────────────────
  it('calls TeamService.resendInvitation when resend button is clicked', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ id: 'inv-1' })])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const resendBtn = document.querySelector('[title="Resend invitation"]')
    expect(resendBtn).toBeTruthy()
    fireEvent.click(resendBtn as Element)

    await waitFor(() => {
      expect(mockResendInvitation).toHaveBeenCalledWith('inv-1')
    })
  })

  it('shows success message after resending invitation', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const resendBtn = document.querySelector('[title="Resend invitation"]')
    fireEvent.click(resendBtn as Element)

    await waitFor(() => {
      expect(screen.getByText('Invitation resent successfully!')).toBeInTheDocument()
    })
  })

  it('handles resend error gracefully (does not crash component)', async () => {
    // NOTE: handleResendInvitation stores errors in `error` state which only
    // renders inside InviteForm. When form is closed, errors from resend are
    // stored in state but not visually shown in the main page.
    mockResendInvitation.mockRejectedValue(new Error('Resend failed'))
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const resendBtn = document.querySelector('[title="Resend invitation"]')
    fireEvent.click(resendBtn as Element)

    // Component stays functional — the invitation is still shown
    await waitFor(() => {
      expect(mockResendInvitation).toHaveBeenCalled()
      expect(screen.getByText('jane@studio.com')).toBeInTheDocument()
    })
  })

  // ── Cancel invitation ────────────────────────────────────────────────
  it('calls TeamService.cancelInvitation when cancel button is clicked', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ id: 'inv-del' })])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const cancelBtn = document.querySelector('[title="Cancel invitation"]')
    expect(cancelBtn).toBeTruthy()
    fireEvent.click(cancelBtn as Element)

    await waitFor(() => {
      expect(mockCancelInvitation).toHaveBeenCalledWith('inv-del')
    })
  })

  it('removes the invitation from the list after cancellation', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const cancelBtn = document.querySelector('[title="Cancel invitation"]')
    fireEvent.click(cancelBtn as Element)

    await waitFor(() => {
      expect(screen.queryByText('jane@studio.com')).not.toBeInTheDocument()
    })
  })

  it('shows success message after cancellation', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const cancelBtn = document.querySelector('[title="Cancel invitation"]')
    fireEvent.click(cancelBtn as Element)

    await waitFor(() => {
      expect(screen.getByText('Invitation cancelled successfully')).toBeInTheDocument()
    })
  })

  it('handles cancellation error gracefully (does not crash component)', async () => {
    // NOTE: handleCancelInvitation stores errors in `error` state which only
    // renders inside InviteForm. When form is closed, the error is stored but
    // not visually shown. The invitation remains in the list since filter
    // only runs on success.
    mockCancelInvitation.mockRejectedValue(new Error('Cannot cancel'))
    mockGetInvitations.mockResolvedValue([makePendingInvitation()])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const cancelBtn = document.querySelector('[title="Cancel invitation"]')
    fireEvent.click(cancelBtn as Element)

    // Component stays functional — invitation still in list after failed cancel
    await waitFor(() => {
      expect(mockCancelInvitation).toHaveBeenCalled()
      expect(screen.getByText('jane@studio.com')).toBeInTheDocument()
    })
  })

  // ── Cancel button on expired invitations ─────────────────────────────
  it('shows cancel button for expired invitations', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    mockGetInvitations.mockResolvedValue([
      makePendingInvitation({ status: 'expired', expiresAt: pastDate }),
    ])
    renderComponent()
    await waitFor(() => screen.getByText('expired'))
    const cancelBtn = document.querySelector('[title="Cancel invitation"]')
    expect(cancelBtn).toBeTruthy()
  })

  // ── Copy invite link ─────────────────────────────────────────────────
  it('copies invite link to clipboard when copy button is clicked', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ token: 'tok123' })])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const copyBtn = document.querySelector('[title="Copy invite link"]')
    expect(copyBtn).toBeTruthy()
    fireEvent.click(copyBtn as Element)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/invite/tok123')
      )
    })
  })

  it('shows success message after copying invite link', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ token: 'tok123' })])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    const copyBtn = document.querySelector('[title="Copy invite link"]')
    fireEvent.click(copyBtn as Element)

    await waitFor(() => {
      expect(screen.getByText('Invite link copied to clipboard!')).toBeInTheDocument()
    })
  })

  // ── Navigation ────────────────────────────────────────────────────────
  it('navigates to /production/team when back button is clicked', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('Team Invitations'))

    fireEvent.click(screen.getByText('Back to Team Management'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/team')
  })

  // ── Permission toggle ────────────────────────────────────────────────
  it('toggles permission checkboxes on and off', async () => {
    mockGetInvitations.mockResolvedValue([])
    renderComponent()
    await waitFor(() => screen.getByText('No pending invitations'))

    fireEvent.click(screen.getAllByText('Send Invitation')[0])
    await waitFor(() => screen.getByText('Permissions'))

    const viewProjectsCheckbox = screen.getByRole('checkbox', { name: /view projects/i })
    expect(viewProjectsCheckbox).not.toBeChecked()

    fireEvent.click(viewProjectsCheckbox)
    expect(viewProjectsCheckbox).toBeChecked()

    fireEvent.click(viewProjectsCheckbox)
    expect(viewProjectsCheckbox).not.toBeChecked()
  })

  // ── API called on mount ───────────────────────────────────────────────
  it('calls TeamService.getInvitations on mount', async () => {
    renderComponent()
    await waitFor(() => {
      expect(mockGetInvitations).toHaveBeenCalledTimes(1)
    })
  })

  // ── No resend/copy buttons on accepted invitations ────────────────────
  it('does not show resend or copy buttons for accepted invitations', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ status: 'accepted' })])
    renderComponent()
    await waitFor(() => screen.getByText('accepted'))

    expect(document.querySelector('[title="Resend invitation"]')).toBeNull()
    expect(document.querySelector('[title="Copy invite link"]')).toBeNull()
  })

  // ── Message omitted when empty ────────────────────────────────────────
  it('does not show message block when invitation has no message', async () => {
    mockGetInvitations.mockResolvedValue([makePendingInvitation({ message: undefined })])
    renderComponent()
    await waitFor(() => screen.getByText('jane@studio.com'))

    expect(screen.queryByText('"Join our team!"')).not.toBeInTheDocument()
  })
})
