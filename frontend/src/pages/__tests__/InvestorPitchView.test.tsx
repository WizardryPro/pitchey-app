import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  shortSynopsis: 'An epic tale of exploration and self-discovery.',
  longSynopsis: 'Extended synopsis here...',
  budget: '$5M-$10M',
  estimatedBudget: '7500000',
  productionTimeline: '18 months',
  targetAudience: 'Adults 18-45',
  comparableFilms: 'The Revenant, Into the Wild',
  status: 'published',
  visibility: 'public',
  views: 1500,
  likes: 230,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  hasSignedNDA: false,
  marketPotential: 'Strong global market',
  revenueProjections: '$20M projected',
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

// ─── Tests ──────────────────────────────────────────────────────────

describe('InvestorPitchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default happy-path mocks
    mockGetPublicById.mockResolvedValue(makePitch());
    mockGet.mockResolvedValue({ success: true, data: makeDetail() });
    mockPost.mockResolvedValue({ success: true, data: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Loading & Error States ─────────────────────────────────────

  describe('Loading & Error States', () => {
    it('shows spinner while loading', () => {
      mockGetPublicById.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('shows error when pitch fetch fails', async () => {
      mockGetPublicById.mockRejectedValue(new Error('Not found'));
      mockGetById.mockRejectedValue(new Error('Not found'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Error Loading Pitch')).toBeInTheDocument();
      });
    });

    it('shows "Pitch not found" when pitch is null', async () => {
      mockGetPublicById.mockRejectedValue(new Error('Not found'));
      mockGetById.mockRejectedValue(new Error('Not found'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Pitch not found|Failed to load/)).toBeInTheDocument();
      });
    });

    it('shows Back to Browse button on error', async () => {
      mockGetPublicById.mockRejectedValue(new Error('fail'));
      mockGetById.mockRejectedValue(new Error('fail'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Back to Browse')).toBeInTheDocument();
      });
    });
  });

  // ─── Pitch Data Display ─────────────────────────────────────────

  describe('Pitch Data Display', () => {
    it('renders pitch title', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
      });
    });

    it('renders creator name and company', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Alex Creator/)).toBeInTheDocument();
        expect(screen.getByText(/Indie Studios/)).toBeInTheDocument();
      });
    });

    it('renders genre and budget badges', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Drama')).toBeInTheDocument();
        expect(screen.getByText('$5M-$10M')).toBeInTheDocument();
      });
    });

    it('renders synopsis', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/epic tale of exploration/)).toBeInTheDocument();
      });
    });
  });

  // ─── Tab Navigation ─────────────────────────────────────────────

  describe('Tab Navigation', () => {
    it('shows overview tab content by default', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Investment Opportunity')).toBeInTheDocument();
      });
    });

    it('switches to financials tab', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
      });

      await user.click(screen.getByText('financials'));

      await waitFor(() => {
        expect(screen.getByText('Financial Analysis')).toBeInTheDocument();
      });
    });

    it('switches to notes tab', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
      });

      await user.click(screen.getByText('notes'));

      await waitFor(() => {
        expect(screen.getByText('Private Notes')).toBeInTheDocument();
      });
    });
  });

  // ─── Watchlist Toggle ───────────────────────────────────────────

  describe('Watchlist Toggle', () => {
    it('shows "Add to Watchlist" when not watchlisted', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Add to Watchlist')).toBeInTheDocument();
      });
    });

    it('shows "Watchlisted" when already watchlisted', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: makeDetail({ isWatchlisted: true }),
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Watchlisted')).toBeInTheDocument();
      });
    });

    it('calls addToWatchlist on click when not watchlisted', async () => {
      mockAddToWatchlist.mockResolvedValue({ id: 1 });
      renderPage();
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Add to Watchlist')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Add to Watchlist'));

      await waitFor(() => {
        expect(mockAddToWatchlist).toHaveBeenCalledWith(42);
      });
    });

    it('calls removeFromWatchlist when already watchlisted', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: makeDetail({ isWatchlisted: true }),
      });
      mockRemoveFromWatchlist.mockResolvedValue(undefined);
      renderPage();
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Watchlisted')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Watchlisted'));

      await waitFor(() => {
        expect(mockRemoveFromWatchlist).toHaveBeenCalledWith(42);
      });
    });
  });

  // ─── Express Interest Modal ─────────────────────────────────────

  describe('Express Interest Modal', () => {
    it('opens modal when Express Interest is clicked', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Express Interest')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Express Interest'));

      await waitFor(() => {
        expect(screen.getByText('Investment Amount ($) *')).toBeInTheDocument();
      });
    });

    it('closes modal when Cancel is clicked', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Express Interest')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Express Interest'));
      await waitFor(() => {
        expect(screen.getByText('Investment Amount ($) *')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Investment Amount ($) *')).not.toBeInTheDocument();
      });
    });

    it('submit button is disabled without amount', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Express Interest')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Express Interest'));

      await waitFor(() => {
        expect(screen.getByText('Submit')).toBeInTheDocument();
      });
      expect(screen.getByText('Submit').closest('button')).toBeDisabled();
    });

    it('submits interest with amount and calls InvestorService.invest', async () => {
      mockInvest.mockResolvedValue({ id: 1, pitchId: 42, amount: 50000, status: 'pending' });
      // First call returns default, re-fetch after submit returns updated
      let callCount = 0;
      mockGet.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) return Promise.resolve({ success: true, data: makeDetail() });
        return Promise.resolve({ success: true, data: makeDetail({ hasExpressedInterest: true }) });
      });

      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Express Interest')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Express Interest'));

      const amountInput = screen.getByPlaceholderText('e.g. 50000');
      await user.type(amountInput, '50000');
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(mockInvest).toHaveBeenCalledWith({
          pitchId: 42,
          amount: 50000,
          message: undefined,
        });
      });
    });

    it('shows success toast after successful submission', async () => {
      mockInvest.mockResolvedValue({ id: 1 });
      let callCount = 0;
      mockGet.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) return Promise.resolve({ success: true, data: makeDetail() });
        return Promise.resolve({ success: true, data: makeDetail({ hasExpressedInterest: true }) });
      });

      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Express Interest')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Express Interest'));
      await user.type(screen.getByPlaceholderText('e.g. 50000'), '25000');
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByText('Interest expressed successfully!')).toBeInTheDocument();
      });
    });

    it('shows error when submission fails', async () => {
      mockInvest.mockRejectedValue(new Error('Insufficient funds'));

      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Express Interest')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Express Interest'));
      await user.type(screen.getByPlaceholderText('e.g. 50000'), '50000');
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByText('Insufficient funds')).toBeInTheDocument();
      });
    });

    it('disables Express Interest button when already expressed', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: makeDetail({ hasExpressedInterest: true }),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Interest Expressed')).toBeInTheDocument();
      });
      expect(screen.getByText('Interest Expressed').closest('button')).toBeDisabled();
    });
  });

  // ─── Schedule Meeting Modal ─────────────────────────────────────

  describe('Schedule Meeting Modal', () => {
    it('opens modal when Schedule Meeting is clicked', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Schedule Meeting')).toBeInTheDocument();
      });

      // Click the sidebar "Schedule Meeting" button (not the modal heading)
      const buttons = screen.getAllByText('Schedule Meeting');
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText('Date & Time *')).toBeInTheDocument();
      });
    });

    it('closes modal when Cancel is clicked', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Schedule Meeting')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Schedule Meeting');
      await user.click(buttons[0]);
      await waitFor(() => {
        expect(screen.getByText('Date & Time *')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Date & Time *')).not.toBeInTheDocument();
      });
    });

    it('submits meeting with dateTime and type', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Schedule Meeting')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Schedule Meeting');
      await user.click(buttons[0]);

      const dateInput = screen.getByLabelText('Date & Time *');
      await user.type(dateInput, '2026-03-15T10:00');

      await user.click(screen.getByText('Schedule'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/api/meetings/schedule',
          expect.objectContaining({
            pitchId: 42,
            creatorId: 'creator-1',
            meetingType: 'video',
            duration: 60,
          })
        );
      });
    });

    it('shows success toast after scheduling', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Schedule Meeting')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Schedule Meeting');
      await user.click(buttons[0]);
      await user.type(screen.getByLabelText('Date & Time *'), '2026-03-15T10:00');
      await user.click(screen.getByText('Schedule'));

      await waitFor(() => {
        expect(screen.getByText('Meeting scheduled successfully!')).toBeInTheDocument();
      });
    });
  });

  // ─── Request Info Modal ─────────────────────────────────────────

  describe('Request Info Modal', () => {
    it('opens modal when Request More Info is clicked', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Request More Info')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Request More Info');
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText('Information Categories')).toBeInTheDocument();
      });
    });

    it('toggles category buttons', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Request More Info')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Request More Info');
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText('Financial Details')).toBeInTheDocument();
      });

      // Click to select
      await user.click(screen.getByText('Financial Details'));
      // Category button should now be selected (blue bg class)
      expect(screen.getByText('Financial Details').className).toContain('bg-blue-600');

      // Click again to deselect
      await user.click(screen.getByText('Financial Details'));
      expect(screen.getByText('Financial Details').className).toContain('bg-gray-100');
    });

    it('submit is disabled without message', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Request More Info')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Request More Info');
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText('Send Request')).toBeInTheDocument();
      });
      expect(screen.getByText('Send Request').closest('button')).toBeDisabled();
    });

    it('submits info request with message and categories', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('Request More Info')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Request More Info');
      await user.click(buttons[0]);

      await user.click(screen.getByText('Financial Details'));
      await user.click(screen.getByText('Team Background'));
      await user.type(
        screen.getByPlaceholderText('Describe what information you need...'),
        'Please share the budget breakdown'
      );
      await user.click(screen.getByText('Send Request'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/api/info-requests',
          expect.objectContaining({
            targetUserId: 'creator-1',
            pitchId: 42,
            message: 'Please share the budget breakdown',
            categories: ['Financial Details', 'Team Background'],
          })
        );
      });
    });
  });

  // ─── Investment Metrics Sidebar ─────────────────────────────────

  describe('Investment Metrics Sidebar', () => {
    it('renders real metrics from pitchDetail', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('$250,000')).toBeInTheDocument();
        expect(screen.getByText('120%')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('$50,000')).toBeInTheDocument();
      });
    });

    it('shows funding progress bar when targetAmount is set', async () => {
      renderPage();
      await waitFor(() => {
        // "50%" and "Funding Progress" appear in both Investment Metrics and Risk Assessment
        const progressTexts = screen.getAllByText('50%');
        expect(progressTexts.length).toBeGreaterThanOrEqual(1);
        const fundingLabels = screen.getAllByText('Funding Progress');
        expect(fundingLabels.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ─── Risk Assessment Sidebar ────────────────────────────────────

  describe('Risk Assessment Sidebar', () => {
    it('renders risk level from pitchDetail', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: makeDetail({ riskLevel: 'low' }),
      });
      renderPage();
      await waitFor(() => {
        const riskTexts = screen.getAllByText('low');
        expect(riskTexts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders funding progress in risk section', async () => {
      renderPage();
      await waitFor(() => {
        // Risk section also has funding progress
        const progressTexts = screen.getAllByText('Funding Progress');
        expect(progressTexts.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ─── ROI Calculator ──────────────────────────────────────────────

  describe('ROI Calculator', () => {
    it('uses expectedROI from pitchDetail for calculation', async () => {
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
      });

      // Navigate to financials tab
      await user.click(screen.getByText('financials'));

      await waitFor(() => {
        expect(screen.getByText(/using 120% genre avg ROI/)).toBeInTheDocument();
      });
    });
  });
});
