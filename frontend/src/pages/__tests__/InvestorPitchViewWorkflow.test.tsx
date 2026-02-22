import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ─── Hoisted mocks ──────────────────────────────────────────────────
const mockNavigate = vi.fn();
const mockGetPublicById = vi.fn();
const mockGetById = vi.fn();
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();
const mockInvest = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '42' }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../lib/api', () => ({
  pitchAPI: {
    getPublicById: (...args: any[]) => mockGetPublicById(...args),
    getById: (...args: any[]) => mockGetById(...args),
  },
}));

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../services/investor.service', () => ({
  InvestorService: {
    addToWatchlist: (...args: any[]) => mockAddToWatchlist(...args),
    removeFromWatchlist: (...args: any[]) => mockRemoveFromWatchlist(...args),
    invest: (...args: any[]) => mockInvest(...args),
  },
}));

vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format }: any) => <span data-testid="format-display">{format ?? 'Film'}</span>,
}));

// ─── Helpers ────────────────────────────────────────────────────────

const makePitch = (overrides: Record<string, any> = {}) => ({
  id: '42',
  userId: 'creator-1',
  creatorName: 'Alex Creator',
  creatorCompany: 'Indie Studios',
  title: 'The Great Adventure',
  logline: 'A thrilling story of discovery',
  genre: 'Drama',
  format: 'Feature Film',
  shortSynopsis: 'An epic tale of exploration.',
  budget: '$5M-$10M',
  estimatedBudget: '7500000',
  productionTimeline: '18 months',
  status: 'published',
  visibility: 'public',
  views: 1500,
  likes: 230,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  hasSignedNDA: false,
  ...overrides,
});

const makeDetail = (overrides: Record<string, any> = {}): any => ({
  totalRaised: 250000,
  investorCount: 5,
  avgInvestment: 50000,
  targetAmount: 500000,
  percentageRaised: 50,
  expectedROI: 120,
  riskLevel: 'medium',
  isWatchlisted: false,
  hasExpressedInterest: false,
  interestLevel: null,
  ...overrides,
});

let InvestorPitchView: React.ComponentType;
beforeAll(async () => {
  const mod = await import('../investor/InvestorPitchView');
  InvestorPitchView = mod.default;
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/investor/pitch/42']}>
      <InvestorPitchView />
    </MemoryRouter>
  );
}

// ─── Workflow Tests ─────────────────────────────────────────────────

describe('InvestorPitchView — Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicById.mockResolvedValue(makePitch());
    mockGet.mockResolvedValue({ success: true, data: makeDetail() });
    mockPost.mockResolvedValue({ success: true, data: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('view pitch → add to watchlist → button toggles to Watchlisted', async () => {
    mockAddToWatchlist.mockResolvedValue({ id: 1 });

    renderPage();
    const user = userEvent.setup();

    // Wait for pitch to load
    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
    });

    // Verify initial state
    expect(screen.getByText('Add to Watchlist')).toBeInTheDocument();

    // Click watchlist
    await user.click(screen.getByText('Add to Watchlist'));

    await waitFor(() => {
      expect(mockAddToWatchlist).toHaveBeenCalledWith(42);
    });

    // Button should toggle
    await waitFor(() => {
      expect(screen.getByText('Watchlisted')).toBeInTheDocument();
    });
  });

  it('watchlist → express interest → interest button disables', async () => {
    mockAddToWatchlist.mockResolvedValue({ id: 1 });
    mockInvest.mockResolvedValue({ id: 1, pitchId: 42, amount: 50000, status: 'pending' });

    // After expressing interest, re-fetch returns hasExpressedInterest: true
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        return Promise.resolve({ success: true, data: makeDetail() });
      }
      return Promise.resolve({ success: true, data: makeDetail({ hasExpressedInterest: true }) });
    });

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
    });

    // Step 1: Add to watchlist
    await user.click(screen.getByText('Add to Watchlist'));
    await waitFor(() => expect(mockAddToWatchlist).toHaveBeenCalled());

    // Step 2: Express interest
    await user.click(screen.getByText('Express Interest'));
    await waitFor(() => {
      expect(screen.getByText('Investment Amount ($) *')).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText('e.g. 50000'), '50000');
    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockInvest).toHaveBeenCalled();
    });

    // Interest button should become disabled
    await waitFor(() => {
      expect(screen.getByText('Interest Expressed')).toBeInTheDocument();
    });
  });

  it('express interest → schedule meeting (sequential actions)', async () => {
    mockInvest.mockResolvedValue({ id: 1 });
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        return Promise.resolve({ success: true, data: makeDetail() });
      }
      return Promise.resolve({ success: true, data: makeDetail({ hasExpressedInterest: true }) });
    });

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
    });

    // Step 1: Express interest
    await user.click(screen.getByText('Express Interest'));
    await user.type(screen.getByPlaceholderText('e.g. 50000'), '25000');
    await user.click(screen.getByText('Submit'));
    await waitFor(() => expect(mockInvest).toHaveBeenCalled());

    // Step 2: Schedule meeting
    await waitFor(() => {
      const buttons = screen.getAllByText('Schedule Meeting');
      expect(buttons.length).toBeGreaterThan(0);
    });

    const meetingButtons = screen.getAllByText('Schedule Meeting');
    await user.click(meetingButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Date & Time *')).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText('Date & Time *'), '2026-04-01T14:00');
    await user.click(screen.getByText('Schedule'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/api/meetings/schedule',
        expect.objectContaining({ pitchId: 42 })
      );
    });
  });

  it('request info → then invest (sequential actions)', async () => {
    mockInvest.mockResolvedValue({ id: 1 });
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        return Promise.resolve({ success: true, data: makeDetail() });
      }
      return Promise.resolve({ success: true, data: makeDetail({ hasExpressedInterest: true }) });
    });

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
    });

    // Step 1: Request more info
    const infoButtons = screen.getAllByText('Request More Info');
    await user.click(infoButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Information Categories')).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText('Describe what information you need...'),
      'Need financial details'
    );
    await user.click(screen.getByText('Send Request'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/api/info-requests',
        expect.objectContaining({ pitchId: 42, message: 'Need financial details' })
      );
    });

    // Step 2: Express interest
    await waitFor(() => {
      expect(screen.getByText('Express Interest')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Express Interest'));
    await user.type(screen.getByPlaceholderText('e.g. 50000'), '75000');
    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockInvest).toHaveBeenCalledWith(
        expect.objectContaining({ pitchId: 42, amount: 75000 })
      );
    });
  });

  it('error recovery: failed interest → retry succeeds', async () => {
    // First attempt fails
    mockInvest.mockRejectedValueOnce(new Error('Server error'));
    // Second attempt succeeds
    mockInvest.mockResolvedValueOnce({ id: 1 });

    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({ success: true, data: makeDetail() });
      }
      return Promise.resolve({ success: true, data: makeDetail({ hasExpressedInterest: true }) });
    });

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Express Interest')).toBeInTheDocument();
    });

    // First attempt — fails
    await user.click(screen.getByText('Express Interest'));
    await user.type(screen.getByPlaceholderText('e.g. 50000'), '50000');
    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });

    // Retry — close and reopen modal, try again
    // The modal stays open on error, so just clear and resubmit
    const amountInput = screen.getByPlaceholderText('e.g. 50000') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '50000');
    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockInvest).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText('Interest expressed successfully!')).toBeInTheDocument();
    });
  });

  it('investment detail refreshes after expressing interest', async () => {
    mockInvest.mockResolvedValue({ id: 1 });

    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        return Promise.resolve({ success: true, data: makeDetail() });
      }
      // After interest, detail shows updated data
      return Promise.resolve({
        success: true,
        data: makeDetail({ hasExpressedInterest: true, investorCount: 6, totalRaised: 300000 }),
      });
    });

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Initial investor count
    });

    // Express interest
    await user.click(screen.getByText('Express Interest'));
    await user.type(screen.getByPlaceholderText('e.g. 50000'), '50000');
    await user.click(screen.getByText('Submit'));

    // After submit, fetchInvestmentDetail is called again
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });

  it('full journey: view → watchlist → request info → express interest → schedule meeting', async () => {
    mockAddToWatchlist.mockResolvedValue({ id: 1 });
    mockInvest.mockResolvedValue({ id: 1 });

    let detailCallCount = 0;
    mockGet.mockImplementation(() => {
      detailCallCount++;
      if (detailCallCount <= 2) {
        return Promise.resolve({ success: true, data: makeDetail() });
      }
      return Promise.resolve({ success: true, data: makeDetail({ hasExpressedInterest: true }) });
    });

    renderPage();
    const user = userEvent.setup();

    // 1. View — wait for pitch
    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
    });

    // 2. Watchlist
    await user.click(screen.getByText('Add to Watchlist'));
    await waitFor(() => expect(mockAddToWatchlist).toHaveBeenCalled());

    // 3. Request info
    const infoButtons = screen.getAllByText('Request More Info');
    await user.click(infoButtons[0]);
    await user.type(
      screen.getByPlaceholderText('Describe what information you need...'),
      'Detailed budget please'
    );
    await user.click(screen.getByText('Send Request'));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/api/info-requests',
        expect.objectContaining({ message: 'Detailed budget please' })
      );
    });

    // 4. Express interest
    await waitFor(() => {
      expect(screen.getByText('Express Interest')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Express Interest'));
    await user.type(screen.getByPlaceholderText('e.g. 50000'), '100000');
    await user.click(screen.getByText('Submit'));
    await waitFor(() => expect(mockInvest).toHaveBeenCalled());

    // 5. Schedule meeting
    await waitFor(() => {
      const buttons = screen.getAllByText('Schedule Meeting');
      expect(buttons.length).toBeGreaterThan(0);
    });
    const meetingButtons = screen.getAllByText('Schedule Meeting');
    await user.click(meetingButtons[0]);
    await user.type(screen.getByLabelText('Date & Time *'), '2026-05-01T09:00');
    await user.click(screen.getByText('Schedule'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/api/meetings/schedule',
        expect.objectContaining({ pitchId: 42 })
      );
    });
  });

  it('notes persist through modal interactions', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
    });

    // Switch to notes tab
    await user.click(screen.getByText('notes'));

    await waitFor(() => {
      expect(screen.getByText('Private Notes')).toBeInTheDocument();
    });

    // Add a note
    await user.type(
      screen.getByPlaceholderText('Add a private note...'),
      'This pitch has strong market potential'
    );
    await user.click(screen.getByText('Add Note'));

    // Note should be visible
    await waitFor(() => {
      expect(screen.getByText('This pitch has strong market potential')).toBeInTheDocument();
    });

    // Open and close a modal
    // Switch back to overview to access sidebar buttons
    await user.click(screen.getByText('overview'));

    const infoButtons = screen.getAllByText('Request More Info');
    await user.click(infoButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Information Categories')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Cancel'));

    // Switch back to notes tab — note should still be there
    await user.click(screen.getByText('notes'));
    await waitFor(() => {
      expect(screen.getByText('This pitch has strong market potential')).toBeInTheDocument();
    });
  });

  it('sidebar metrics reflect initial investment data', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: makeDetail({
        totalRaised: 750000,
        investorCount: 15,
        avgInvestment: 50000,
        expectedROI: 200,
        targetAmount: 1000000,
        percentageRaised: 75,
      }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('$750,000')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('200%')).toBeInTheDocument();
    });
  });

  it('shows "No investments yet" when totalRaised is 0', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: makeDetail({ totalRaised: 0, investorCount: 0, avgInvestment: 0 }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No investments yet')).toBeInTheDocument();
    });
  });

  it('shows N/A for ROI when expectedROI is null', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: makeDetail({ expectedROI: null }),
    });

    renderPage();

    await waitFor(() => {
      // Find "Expected ROI" label's sibling value
      const roiTexts = screen.getAllByText('N/A');
      expect(roiTexts.length).toBeGreaterThanOrEqual(1);
    });
  });
});
