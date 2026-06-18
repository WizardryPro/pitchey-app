import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── react-hot-toast ────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: {
    success: mockToastSuccess,
    error: mockToastError,
    loading: vi.fn(),
  },
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    loading: vi.fn(),
  },
  Toaster: () => null,
}))

// ─── CompaniesHouseAutocomplete ──────────────────────────────────────
vi.mock('../../components/CompaniesHouseAutocomplete', () => ({
  default: ({ value, onChange, onSelect }: any) => (
    <div data-testid="companies-house-autocomplete">
      <input
        data-testid="ch-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing your company name"
      />
      <button
        data-testid="ch-select-result"
        type="button"
        onClick={() =>
          onSelect({
            companyNumber: '12345678',
            title: 'Acme Productions Ltd',
            status: 'active',
            address: '1 Example St, London',
            dateOfCreation: '2010-01-01',
          })
        }
      >
        Select Test Company
      </button>
    </div>
  ),
}))

// ─── globalThis.fetch stub ───────────────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Dynamic import ─────────────────────────────────────────────────
let ProductionVerification: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ProductionVerification')
  ProductionVerification = mod.default
})

// ─── Helpers ─────────────────────────────────────────────────────────
function makeResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

const unverifiedResponse = { verified: false, verification: null }

const pendingVerification = {
  id: 'v-1',
  status: 'pending' as const,
  companyName: 'Stellar Productions Inc',
  region: 'USA' as const,
  websiteUrl: 'https://stellarproductions.com',
  createdAt: '2026-06-10T10:00:00Z',
  autoChecks: [
    { name: 'Domain registration check', status: 'pass' as const, message: 'Domain registered.' },
    { name: 'EIN format check', status: 'warn' as const, message: 'Format looks valid.' },
  ],
}

const approvedVerification = {
  id: 'v-2',
  status: 'approved' as const,
  companyName: 'Stellar Productions Inc',
  region: 'USA' as const,
  websiteUrl: 'https://stellarproductions.com',
  createdAt: '2026-06-01T10:00:00Z',
  reviewedAt: '2026-06-03T14:00:00Z',
}

const autoApprovedVerification = {
  ...approvedVerification,
  id: 'v-3',
  status: 'auto_approved' as const,
}

const rejectedVerification = {
  id: 'v-4',
  status: 'rejected' as const,
  companyName: 'Stellar Productions Inc',
  region: 'UK' as const,
  websiteUrl: 'https://stellarproductions.co.uk',
  createdAt: '2026-06-05T10:00:00Z',
  rejectionReason: 'Company number could not be verified with Companies House.',
}

describe('ProductionVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = mockFetch
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <ProductionVerification />
      </MemoryRouter>
    )

  // ─── Loading state ─────────────────────────────────────────────────
  it('shows a loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    renderComponent()
    // The loading spinner is a RefreshCw with animate-spin class
    const spinners = document.querySelectorAll('.animate-spin')
    expect(spinners.length).toBeGreaterThan(0)
  })

  // ─── Page header ───────────────────────────────────────────────────
  it('renders the Company Verification heading', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Company Verification')).toBeInTheDocument()
    })
  })

  it('renders the subtitle description', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(
        screen.getByText(/Verify your production company to unlock credits/i)
      ).toBeInTheDocument()
    })
  })

  // ─── Error state ───────────────────────────────────────────────────
  it('shows an error message when the status fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load verification status/i)).toBeInTheDocument()
    })
  })

  it('includes the error detail in the error message', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })
  })

  it('shows error when API returns non-OK status', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Unauthorized' }, false, 401))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load verification status/i)).toBeInTheDocument()
    })
  })

  // ─── Unverified state — verification form ──────────────────────────
  it('shows the verification form when unverified (no prior submission)', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument()
    })
  })

  it('renders the Region select with all options', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Region/i)).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'USA' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'UK' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Ireland' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Canada' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Australia' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'New Zealand' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Rest of World' })).toBeInTheDocument()
    })
  })

  it('shows EIN label for USA region', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/EIN/i)).toBeInTheDocument()
    })
  })

  it('renders the Company Website input', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Company Website/i)).toBeInTheDocument()
    })
  })

  it('renders the Submit for Verification button', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Submit for Verification')).toBeInTheDocument()
    })
  })

  it('shows "no company registration number" checkbox', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/I don't have a company registration number/i)).toBeInTheDocument()
    })
  })

  // ─── Region-specific UI: UK → Companies House autocomplete ─────────
  it('shows Companies House autocomplete when UK region is selected', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Region/i)).toBeInTheDocument()
    })

    const regionSelect = screen.getByLabelText(/Region/i)
    fireEvent.change(regionSelect, { target: { value: 'UK' } })

    await waitFor(() => {
      expect(screen.getByTestId('companies-house-autocomplete')).toBeInTheDocument()
    })
  })

  it('shows plain registration input for non-UK regions', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/EIN/i)).toBeInTheDocument()
    })
  })

  it('shows CRO Number label for Ireland region', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Region/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: 'IRE' } })
    await waitFor(() => {
      expect(screen.getByLabelText(/CRO Number/i)).toBeInTheDocument()
    })
  })

  it('shows ACN label for Australia region', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Region/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: 'AUS' } })
    await waitFor(() => {
      expect(screen.getByLabelText(/ACN/i)).toBeInTheDocument()
    })
  })

  // ─── Insurance upload flow ─────────────────────────────────────────
  it('shows insurance upload section when "no company number" is checked', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/I don't have a company registration number/i)).toBeInTheDocument()
    })

    const checkbox = screen.getByLabelText(/I don't have a company registration number/i)
    fireEvent.click(checkbox)

    await waitFor(() => {
      // The upload button text is unique to the insurance section
      expect(screen.getByText(/Click to upload PDF, JPG, or PNG/i)).toBeInTheDocument()
    })
  })

  it('hides registration number field when "no company number" is checked', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/EIN/i)).toBeInTheDocument()
    })

    const checkbox = screen.getByLabelText(/I don't have a company registration number/i)
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(screen.queryByLabelText(/EIN/i)).not.toBeInTheDocument()
    })
  })

  // ─── Form validation errors ────────────────────────────────────────
  it('shows validation error when company name is missing on submit', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Submit for Verification')).toBeInTheDocument()
    })

    const submitButton = screen.getByText('Submit for Verification')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Company name is required.')).toBeInTheDocument()
    })
  })

  it('shows validation error when website URL is missing on submit', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Company Name/i), {
      target: { value: 'Stellar Productions' },
    })
    fireEvent.click(screen.getByText('Submit for Verification'))

    await waitFor(() => {
      expect(screen.getByText('Website URL is required.')).toBeInTheDocument()
    })
  })

  it('shows validation error when no company number is checked but no file uploaded', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Company Name/i), {
      target: { value: 'Stellar Productions' },
    })
    fireEvent.change(screen.getByLabelText(/Company Website/i), {
      target: { value: 'https://stellar.com' },
    })
    fireEvent.click(screen.getByLabelText(/I don't have a company registration number/i))
    fireEvent.click(screen.getByText('Submit for Verification'))

    await waitFor(() => {
      expect(
        screen.getByText(/Please upload proof of insurance/i)
      ).toBeInTheDocument()
    })
  })

  // ─── Successful form submission (USA/EIN) ──────────────────────────
  it('submits the form with correct payload for USA region', async () => {
    // First call: initial status fetch
    // Second call: POST /api/production/verify
    // Third call: re-fetch status after submit
    mockFetch
      .mockResolvedValueOnce(makeResponse(unverifiedResponse))
      .mockResolvedValueOnce(makeResponse({ success: true }))
      .mockResolvedValueOnce(makeResponse({ verified: false, verification: pendingVerification }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Company Name/i), {
      target: { value: 'Stellar Productions Inc' },
    })
    fireEvent.change(screen.getByLabelText(/EIN/i), {
      target: { value: '12-3456789' },
    })
    fireEvent.change(screen.getByLabelText(/Company Website/i), {
      target: { value: 'https://stellarproductions.com' },
    })
    fireEvent.click(screen.getByText('Submit for Verification'))

    await waitFor(() => {
      const calls = mockFetch.mock.calls
      const postCall = calls.find(
        ([url, opts]: [string, RequestInit]) =>
          typeof url === 'string' &&
          url.includes('/api/production/verify') &&
          !url.includes('companies-house') &&
          !url.includes('upload') &&
          opts?.method === 'POST'
      )
      expect(postCall).toBeDefined()
      const body = JSON.parse(postCall![1].body as string)
      expect(body.companyName).toBe('Stellar Productions Inc')
      expect(body.region).toBe('usa')
      expect(body.websiteUrl).toBe('https://stellarproductions.com')
      expect(body.ein).toBe('12-3456789')
      expect(body.hasCompanyNumber).toBe(true)
    })
  })

  it('calls toast.success after successful submission', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(unverifiedResponse))
      .mockResolvedValueOnce(makeResponse({ success: true }))
      .mockResolvedValueOnce(makeResponse({ verified: false, verification: pendingVerification }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Company Name/i), {
      target: { value: 'Stellar Productions Inc' },
    })
    fireEvent.change(screen.getByLabelText(/Company Website/i), {
      target: { value: 'https://stellarproductions.com' },
    })
    fireEvent.click(screen.getByText('Submit for Verification'))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Verification submitted')
      )
    })
  })

  it('calls toast.error and shows form error when submission fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(unverifiedResponse))
      .mockResolvedValueOnce(makeResponse({ error: 'Already submitted' }, false, 400))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Company Name/i), {
      target: { value: 'Stellar Productions Inc' },
    })
    fireEvent.change(screen.getByLabelText(/Company Website/i), {
      target: { value: 'https://stellarproductions.com' },
    })
    fireEvent.click(screen.getByText('Submit for Verification'))

    await waitFor(() => {
      expect(screen.getByText('Already submitted')).toBeInTheDocument()
    })
  })

  // ─── UK region: Companies House selection fills form ───────────────
  it('pre-fills company name when a Companies House result is selected', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Region/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: 'UK' } })

    await waitFor(() => {
      expect(screen.getByTestId('ch-select-result')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('ch-select-result'))

    await waitFor(() => {
      const companyNameInput = screen.getByLabelText(/Company Name/i) as HTMLInputElement
      expect(companyNameInput.value).toBe('Acme Productions Ltd')
    })
  })

  it('shows confirmation chip with company number after CH selection', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Region/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: 'UK' } })
    await waitFor(() => {
      expect(screen.getByTestId('ch-select-result')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('ch-select-result'))

    await waitFor(() => {
      expect(screen.getByText('Acme Productions Ltd')).toBeInTheDocument()
      expect(screen.getByText(/#12345678/)).toBeInTheDocument()
    })
  })

  it('sends companyNumber (not ein) for UK region submission', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(unverifiedResponse))
      .mockResolvedValueOnce(makeResponse({ success: true }))
      .mockResolvedValueOnce(makeResponse({ verified: false, verification: pendingVerification }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Region/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: 'UK' } })
    await waitFor(() => {
      expect(screen.getByTestId('ch-select-result')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('ch-select-result'))

    await waitFor(() => {
      expect(screen.getByLabelText(/Company Website/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Company Website/i), {
      target: { value: 'https://acmeproductions.co.uk' },
    })
    fireEvent.click(screen.getByText('Submit for Verification'))

    await waitFor(() => {
      const calls = mockFetch.mock.calls
      const postCall = calls.find(
        ([url, opts]: [string, RequestInit]) =>
          typeof url === 'string' &&
          url.includes('/api/production/verify') &&
          !url.includes('companies-house') &&
          !url.includes('upload') &&
          opts?.method === 'POST'
      )
      expect(postCall).toBeDefined()
      const body = JSON.parse(postCall![1].body as string)
      expect(body.companyNumber).toBe('12345678')
      expect(body).not.toHaveProperty('ein')
      expect(body.region).toBe('uk')
    })
  })

  // ─── Pending status view ───────────────────────────────────────────
  it('shows "Under Review" banner for pending verification', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: pendingVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Under Review')).toBeInTheDocument()
    })
  })

  it('shows submission details in pending view', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: pendingVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Stellar Productions Inc')).toBeInTheDocument()
      expect(screen.getByText('USA')).toBeInTheDocument()
      expect(screen.getByText('https://stellarproductions.com')).toBeInTheDocument()
    })
  })

  it('shows automated checks in pending view', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: pendingVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Domain registration check')).toBeInTheDocument()
      expect(screen.getByText('EIN format check')).toBeInTheDocument()
    })
  })

  it('renders "Check for updates" button in pending view', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: pendingVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Check for updates')).toBeInTheDocument()
    })
  })

  it('triggers a refresh fetch when "Check for updates" is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse({ verified: false, verification: pendingVerification }))
      .mockResolvedValueOnce(makeResponse({ verified: false, verification: pendingVerification }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Check for updates')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Check for updates'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // ─── Approved status view ──────────────────────────────────────────
  it('shows "Verified" banner for approved verification', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: true, verification: approvedVerification })
    )
    renderComponent()
    await waitFor(() => {
      // Multiple "Verified" elements: header badge + banner
      const verifiedElements = screen.getAllByText('Verified')
      expect(verifiedElements.length).toBeGreaterThan(0)
    })
  })

  it('shows verified company name in approved view', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: true, verification: approvedVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getAllByText('Stellar Productions Inc').length).toBeGreaterThan(0)
    })
  })

  it('shows "Verified" header badge when approved', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: true, verification: approvedVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Company Verification')).toBeInTheDocument()
      // The header badge span with "Verified" text
      const badges = screen.getAllByText('Verified')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('does not show "Verified" header badge when pending', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: pendingVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.queryByText('Under Review')).toBeInTheDocument()
    })
    // Header badge should not show for pending
    const verifiedElements = screen.queryAllByText('Verified')
    expect(verifiedElements.length).toBe(0)
  })

  // ─── Auto-approved status view ────────────────────────────────────
  it('shows "Auto-approved" chip for auto_approved status', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: true, verification: autoApprovedVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Auto-approved')).toBeInTheDocument()
    })
  })

  // ─── Rejected status view ──────────────────────────────────────────
  it('shows "Verification Rejected" header for rejected status', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: rejectedVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Verification Rejected')).toBeInTheDocument()
    })
  })

  it('shows the rejection reason text', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: rejectedVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(
        screen.getByText('Company number could not be verified with Companies House.')
      ).toBeInTheDocument()
    })
  })

  it('shows "Resubmit Verification" button in rejected view', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: rejectedVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Resubmit Verification')).toBeInTheDocument()
    })
  })

  it('clicking "Resubmit Verification" shows the form again', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ verified: false, verification: rejectedVerification })
    )
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Resubmit Verification')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Resubmit Verification'))

    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument()
      expect(screen.getByText('Submit for Verification')).toBeInTheDocument()
    })
  })

  // ─── Insurance upload with form submit ────────────────────────────
  it('uploads insurance file before submitting verification when no company number', async () => {
    const mockFile = new File(['insurance content'], 'insurance.pdf', {
      type: 'application/pdf',
    })

    mockFetch
      .mockResolvedValueOnce(makeResponse(unverifiedResponse))
      .mockResolvedValueOnce(makeResponse({ success: true })) // insurance upload
      .mockResolvedValueOnce(makeResponse({ success: true })) // verify submit
      .mockResolvedValueOnce(makeResponse({ verified: false, verification: pendingVerification }))

    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Company Name/i), {
      target: { value: 'Stellar Productions Inc' },
    })
    fireEvent.change(screen.getByLabelText(/Company Website/i), {
      target: { value: 'https://stellarproductions.com' },
    })
    fireEvent.click(screen.getByLabelText(/I don't have a company registration number/i))

    // Simulate file upload via the hidden input
    await waitFor(() => {
      expect(
        screen.getByLabelText('Upload proof of insurance')
      ).toBeInTheDocument()
    })
    const fileInput = screen.getByLabelText('Upload proof of insurance') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [mockFile] } })

    await waitFor(() => {
      expect(screen.getByText('insurance.pdf')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Submit for Verification'))

    await waitFor(() => {
      const uploadCall = mockFetch.mock.calls.find(
        ([url]: [string]) =>
          typeof url === 'string' && url.includes('upload-insurance')
      )
      expect(uploadCall).toBeDefined()
    })
  })

  it('rejects invalid file type and shows error', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    const badFile = new File(['data'], 'virus.exe', { type: 'application/x-msdownload' })

    renderComponent()
    await waitFor(() => {
      expect(screen.getByLabelText(/I don't have a company registration number/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText(/I don't have a company registration number/i))
    await waitFor(() => {
      expect(screen.getByLabelText('Upload proof of insurance')).toBeInTheDocument()
    })

    const fileInput = screen.getByLabelText('Upload proof of insurance') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [badFile] } })

    await waitFor(() => {
      expect(
        screen.getByText('Insurance document must be a PDF, JPG, or PNG file.')
      ).toBeInTheDocument()
    })
  })

  // ─── Fetch called with correct URL ────────────────────────────────
  it('fetches verification status from the correct endpoint', async () => {
    mockFetch.mockResolvedValue(makeResponse(unverifiedResponse))
    renderComponent()
    await waitFor(() => {
      const statusCall = mockFetch.mock.calls.find(
        ([url]: [string]) =>
          typeof url === 'string' && url.includes('/api/production/verification-status')
      )
      expect(statusCall).toBeDefined()
      expect(statusCall![1]).toMatchObject({ credentials: 'include' })
    })
  })
})
