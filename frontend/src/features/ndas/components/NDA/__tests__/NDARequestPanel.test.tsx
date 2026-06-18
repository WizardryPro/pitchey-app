import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NDARequestPanel from '../NDARequestPanel';

// ─── Hoisted mock functions ─────────────────────────────────────────────────
const {
  mockCanRequestNDA,
  mockGetNDAStatus,
  mockGetTemplates,
  mockRequestNDA,
  mockSendReminder,
  mockDownloadNDA,
  mockSuccess,
  mockError,
} = vi.hoisted(() => ({
  mockCanRequestNDA: vi.fn(),
  mockGetNDAStatus: vi.fn(),
  mockGetTemplates: vi.fn(),
  mockRequestNDA: vi.fn(),
  mockSendReminder: vi.fn(),
  mockDownloadNDA: vi.fn(),
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('@features/ndas/services/nda.service', () => ({
  ndaService: {
    canRequestNDA: (...args: unknown[]) => mockCanRequestNDA(...args),
    getNDAStatus: (...args: unknown[]) => mockGetNDAStatus(...args),
    getTemplates: (...args: unknown[]) => mockGetTemplates(...args),
    requestNDA: (...args: unknown[]) => mockRequestNDA(...args),
    sendReminder: (...args: unknown[]) => mockSendReminder(...args),
    downloadNDA: (...args: unknown[]) => mockDownloadNDA(...args),
  },
}));

vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

// date-fns mock — formatDistanceToNow returns a predictable string
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => 'in 6 months',
}));

// ─── Shared mock data ────────────────────────────────────────────────────────
const defaultProps = {
  pitchId: 42,
  pitchTitle: 'The Iron Sky',
  userId: 7,
};

const makeNDA = (overrides: Record<string, unknown> = {}) => ({
  id: 101,
  pitchId: 42,
  status: 'pending',
  createdAt: '2026-01-10T10:00:00Z',
  respondedAt: null,
  expiresAt: null,
  notes: null,
  rejectionReason: null,
  ...overrides,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const setupCanRequest = () => {
  mockCanRequestNDA.mockResolvedValue({ canRequest: true });
  mockGetNDAStatus.mockResolvedValue({ hasNDA: false });
  mockGetTemplates.mockResolvedValue([]);
};

const setupCannotRequest = (reason = 'You are not eligible to request an NDA.') => {
  mockCanRequestNDA.mockResolvedValue({ canRequest: false, reason });
  mockGetNDAStatus.mockResolvedValue({ hasNDA: false });
  mockGetTemplates.mockResolvedValue([]);
};

const setupExistingNDA = (ndaOverrides: Record<string, unknown> = {}) => {
  const nda = makeNDA(ndaOverrides);
  mockCanRequestNDA.mockResolvedValue({ canRequest: false });
  mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda });
  mockGetTemplates.mockResolvedValue([]);
  return nda;
};

describe('NDARequestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  describe('loading state', () => {
    it('shows a spinner while data is loading', () => {
      mockCanRequestNDA.mockImplementation(() => new Promise(() => {}));
      mockGetNDAStatus.mockImplementation(() => new Promise(() => {}));
      mockGetTemplates.mockResolvedValue([]);

      render(<NDARequestPanel {...defaultProps} />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides the spinner once data has loaded', async () => {
      setupCanRequest();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  // ── Can-request branch (no existing NDA) ──────────────────────────────────
  describe('when user can request an NDA', () => {
    it('renders the pitch title and request button', async () => {
      setupCanRequest();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/The Iron Sky/)).toBeInTheDocument();
      expect(screen.getAllByText('Request NDA Access').length).toBeGreaterThanOrEqual(1);
    });

    it('shows the request form when the button is clicked', async () => {
      setupCanRequest();
      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));

      expect(screen.getByPlaceholderText(/Introduce yourself/i)).toBeInTheDocument();
      expect(screen.getByText(/Standard Request/i)).toBeInTheDocument();
      expect(screen.getByText(/Priority Request/i)).toBeInTheDocument();
    });

    it('can cancel the form and return to the intro view', async () => {
      setupCanRequest();
      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));
      expect(screen.getByPlaceholderText(/Introduce yourself/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Introduce yourself/i)).not.toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
    });
  });

  // ── Cannot-request branch ─────────────────────────────────────────────────
  describe('when user cannot request an NDA', () => {
    it('renders the access-denied panel with the reason', async () => {
      setupCannotRequest('You must be an investor to request NDA access.');
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('NDA Request Not Available')).toBeInTheDocument();
      });

      expect(screen.getByText('You must be an investor to request NDA access.')).toBeInTheDocument();
    });

    it('renders the access-denied panel with the default reason when none provided', async () => {
      mockCanRequestNDA.mockResolvedValue({ canRequest: false });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);

      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('NDA Request Not Available')).toBeInTheDocument();
      });

      expect(screen.getByText(/You cannot request an NDA for this pitch at this time/)).toBeInTheDocument();
    });

    it('renders the error detail when ndaRules.error is set', async () => {
      mockCanRequestNDA.mockResolvedValue({
        canRequest: false,
        reason: 'Not eligible.',
        error: 'Underlying error detail',
      });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);

      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Underlying error detail')).toBeInTheDocument();
      });
    });
  });

  // ── Submitting a request ───────────────────────────────────────────────────
  describe('form submission', () => {
    const submittedNDA = makeNDA({ status: 'pending' });

    it('calls ndaService.requestNDA with correct pitchId and message', async () => {
      // First load: can request
      mockCanRequestNDA.mockResolvedValueOnce({ canRequest: true });
      mockGetNDAStatus.mockResolvedValueOnce({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);
      // After submission re-check: show pending status
      mockCanRequestNDA.mockResolvedValue({ canRequest: false });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda: submittedNDA });
      mockRequestNDA.mockResolvedValue(submittedNDA);

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));
      await user.type(
        screen.getByPlaceholderText(/Introduce yourself/i),
        'Hello, I am an investor interested in this project.'
      );

      await user.click(screen.getByRole('button', { name: /Send NDA Request/i }));

      await waitFor(() => {
        expect(mockRequestNDA).toHaveBeenCalledWith(
          expect.objectContaining({
            pitchId: 42,
            message: 'Hello, I am an investor interested in this project.',
          })
        );
      });
    });

    it('shows success toast on successful submission', async () => {
      mockCanRequestNDA.mockResolvedValueOnce({ canRequest: true });
      mockGetNDAStatus.mockResolvedValueOnce({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);
      mockCanRequestNDA.mockResolvedValue({ canRequest: false });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda: submittedNDA });
      mockRequestNDA.mockResolvedValue(submittedNDA);

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));
      await user.type(screen.getByPlaceholderText(/Introduce yourself/i), 'Interested investor.');
      await user.click(screen.getByRole('button', { name: /Send NDA Request/i }));

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'NDA Request Submitted',
          'Your NDA request has been sent to the creator for review.'
        );
      });
    });

    it('calls onRequestSubmitted callback with the returned NDA', async () => {
      mockCanRequestNDA.mockResolvedValueOnce({ canRequest: true });
      mockGetNDAStatus.mockResolvedValueOnce({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);
      mockCanRequestNDA.mockResolvedValue({ canRequest: false });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda: submittedNDA });
      mockRequestNDA.mockResolvedValue(submittedNDA);

      const onRequestSubmitted = vi.fn();
      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} onRequestSubmitted={onRequestSubmitted} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));
      await user.type(screen.getByPlaceholderText(/Introduce yourself/i), 'Interested investor.');
      await user.click(screen.getByRole('button', { name: /Send NDA Request/i }));

      await waitFor(() => {
        expect(onRequestSubmitted).toHaveBeenCalledWith(submittedNDA);
      });
    });

    it('calls onStatusChange with "pending" after successful submission', async () => {
      mockCanRequestNDA.mockResolvedValueOnce({ canRequest: true });
      mockGetNDAStatus.mockResolvedValueOnce({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);
      mockCanRequestNDA.mockResolvedValue({ canRequest: false });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda: submittedNDA });
      mockRequestNDA.mockResolvedValue(submittedNDA);

      const onStatusChange = vi.fn();
      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} onStatusChange={onStatusChange} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));
      await user.type(screen.getByPlaceholderText(/Introduce yourself/i), 'Interested investor.');
      await user.click(screen.getByRole('button', { name: /Send NDA Request/i }));

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('pending');
      });
    });

    it('shows error toast when message is empty and form is submitted', async () => {
      mockCanRequestNDA.mockResolvedValue({ canRequest: true });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));
      // Do NOT type a message — submit the form directly to bypass native required validation
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Message Required',
          'Please provide a message explaining your request.'
        );
      });
      expect(mockRequestNDA).not.toHaveBeenCalled();
    });

    it('shows error toast when ndaService.requestNDA throws', async () => {
      mockCanRequestNDA.mockResolvedValue({ canRequest: true });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: false });
      mockRequestNDA.mockRejectedValue(new Error('Server error'));
      mockGetTemplates.mockResolvedValue([]);

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));
      await user.type(screen.getByPlaceholderText(/Introduce yourself/i), 'Interested investor.');
      await user.click(screen.getByRole('button', { name: /Send NDA Request/i }));

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Request Failed', 'Server error');
      });
    });
  });

  // ── Priority request shows business justification field ──────────────────
  describe('priority request flow', () => {
    it('shows business justification field when priority is selected', async () => {
      mockCanRequestNDA.mockResolvedValue({ canRequest: true });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);
      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));

      // Select priority radio
      const priorityRadio = screen.getByDisplayValue('priority');
      await user.click(priorityRadio);

      expect(screen.getByPlaceholderText(/Please explain why you need priority processing/i)).toBeInTheDocument();
    });

    it('includes metadata with urgency high in request payload for priority', async () => {
      const submittedNDA = makeNDA({ status: 'pending' });
      mockCanRequestNDA.mockResolvedValueOnce({ canRequest: true });
      mockGetNDAStatus.mockResolvedValueOnce({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([]);
      mockRequestNDA.mockResolvedValue(submittedNDA);
      mockCanRequestNDA.mockResolvedValue({ canRequest: false });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda: submittedNDA });

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));

      await user.click(screen.getByDisplayValue('priority'));

      await user.type(
        screen.getByPlaceholderText(/Please explain why you need priority processing/i),
        'Investor meeting next week.'
      );
      await user.type(
        screen.getByPlaceholderText(/Introduce yourself/i),
        'Senior fund manager at Acme Capital.'
      );

      await user.click(screen.getByRole('button', { name: /Send NDA Request/i }));

      await waitFor(() => {
        expect(mockRequestNDA).toHaveBeenCalledWith(
          expect.objectContaining({
            pitchId: 42,
            metadata: expect.objectContaining({ urgency: 'high' }),
          })
        );
      });
    });
  });

  // ── Template selection ────────────────────────────────────────────────────
  describe('template selection', () => {
    it('renders the template dropdown when templates are available', async () => {
      mockCanRequestNDA.mockResolvedValue({ canRequest: true });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: false });
      mockGetTemplates.mockResolvedValue([
        { id: 1, name: 'Standard NDA', isDefault: true, content: '', createdBy: 1, createdAt: '', updatedAt: '' },
        { id: 2, name: 'Comprehensive NDA', isDefault: false, content: '', createdBy: 1, createdAt: '', updatedAt: '' },
      ]);

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));

      expect(screen.getByText('NDA Template')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Standard NDA \(Default\)/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Comprehensive NDA/i })).toBeInTheDocument();
    });

    it('does not render the template dropdown when no templates exist', async () => {
      setupCanRequest();
      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request NDA Access/i }));

      expect(screen.queryByText('NDA Template')).not.toBeInTheDocument();
    });
  });

  // ── Existing NDA — pending status ─────────────────────────────────────────
  describe('existing NDA — pending status', () => {
    it('renders pending status panel with correct title and description', async () => {
      setupExistingNDA({ status: 'pending' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Request Pending')).toBeInTheDocument();
      });

      expect(screen.getByText('NDA Status')).toBeInTheDocument();
      expect(screen.getByText(/Your NDA request is being reviewed by the creator/)).toBeInTheDocument();
    });

    it('renders "Send Reminder" button for pending NDA', async () => {
      setupExistingNDA({ status: 'pending' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Send Reminder/i })).toBeInTheDocument();
      });
    });

    it('calls ndaService.sendReminder with the NDA id when reminder is clicked', async () => {
      setupExistingNDA({ status: 'pending', id: 101 });
      mockSendReminder.mockResolvedValue(undefined);

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Send Reminder/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Send Reminder/i }));

      await waitFor(() => {
        expect(mockSendReminder).toHaveBeenCalledWith(101);
      });
      expect(mockSuccess).toHaveBeenCalledWith('Reminder Sent', 'A reminder has been sent to the creator.');
    });

    it('shows error toast when sendReminder fails', async () => {
      setupExistingNDA({ status: 'pending' });
      mockSendReminder.mockRejectedValue(new Error('Network'));

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Send Reminder/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Send Reminder/i }));

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Reminder Failed', 'Unable to send reminder. Please try again.');
      });
    });

    it('shows the request date', async () => {
      setupExistingNDA({ status: 'pending', createdAt: '2026-01-10T10:00:00Z' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Requested:/)).toBeInTheDocument();
      });
    });

    it('does not show Download or Request New NDA buttons for pending status', async () => {
      setupExistingNDA({ status: 'pending' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Request Pending')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Download Signed NDA/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Request New NDA/i })).not.toBeInTheDocument();
    });
  });

  // ── Existing NDA — approved status ────────────────────────────────────────
  describe('existing NDA — approved status', () => {
    it('renders approved status panel', async () => {
      setupExistingNDA({ status: 'approved' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('NDA Approved')).toBeInTheDocument();
      });

      expect(screen.getByText(/You now have access to confidential materials/)).toBeInTheDocument();
    });

    it('renders "Download Signed NDA" button for approved NDA', async () => {
      setupExistingNDA({ status: 'approved' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download Signed NDA/i })).toBeInTheDocument();
      });
    });

    it('shows expiry date for approved NDA when expiresAt is set', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString();
      setupExistingNDA({ status: 'approved', expiresAt: futureDate });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Expires:/)).toBeInTheDocument();
      });
      // formatDistanceToNow is mocked to return 'in 6 months'
      expect(screen.getByText(/in 6 months/)).toBeInTheDocument();
    });

    it('shows the creator note when notes are present', async () => {
      setupExistingNDA({ status: 'approved', notes: 'Please keep this confidential.' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Creator's Note:")).toBeInTheDocument();
      });
      expect(screen.getByText('Please keep this confidential.')).toBeInTheDocument();
    });

    it('initiates download when Download Signed NDA is clicked', async () => {
      setupExistingNDA({ status: 'approved', id: 101 });
      const fakeBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
      mockDownloadNDA.mockResolvedValue(fakeBlob);

      // Mock URL API
      const createObjectURL = vi.fn(() => 'blob:fake-url');
      const revokeObjectURL = vi.fn();
      window.URL.createObjectURL = createObjectURL;
      window.URL.revokeObjectURL = revokeObjectURL;

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download Signed NDA/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Download Signed NDA/i }));

      await waitFor(() => {
        expect(mockDownloadNDA).toHaveBeenCalledWith(101, true);
      });
      expect(mockSuccess).toHaveBeenCalledWith('Download Started', 'NDA document download has started.');
    });

    it('shows error toast when download fails', async () => {
      setupExistingNDA({ status: 'approved' });
      mockDownloadNDA.mockRejectedValue(new Error('Download failed'));

      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download Signed NDA/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Download Signed NDA/i }));

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Download Failed', 'Unable to download NDA document.');
      });
    });
  });

  // ── Existing NDA — rejected status ────────────────────────────────────────
  describe('existing NDA — rejected status', () => {
    it('renders rejected status panel', async () => {
      setupExistingNDA({ status: 'rejected' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Request Rejected')).toBeInTheDocument();
      });

      expect(screen.getByText(/Your NDA request was not approved at this time/)).toBeInTheDocument();
    });

    it('shows the rejection reason when provided', async () => {
      setupExistingNDA({
        status: 'rejected',
        rejectionReason: 'Insufficient investment background provided.',
      });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Rejection Reason:')).toBeInTheDocument();
      });
      expect(screen.getByText('Insufficient investment background provided.')).toBeInTheDocument();
    });

    it('shows "Request New NDA" button when canRequest is true after rejection', async () => {
      const nda = makeNDA({ status: 'rejected' });
      mockCanRequestNDA.mockResolvedValue({ canRequest: true });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda });
      mockGetTemplates.mockResolvedValue([]);

      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request New NDA/i })).toBeInTheDocument();
      });
    });

    it('does NOT show "Request New NDA" button when canRequest is false after rejection', async () => {
      const nda = makeNDA({ status: 'rejected' });
      mockCanRequestNDA.mockResolvedValue({ canRequest: false });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda });
      mockGetTemplates.mockResolvedValue([]);

      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Request Rejected')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Request New NDA/i })).not.toBeInTheDocument();
    });
  });

  // ── Existing NDA — expired status ─────────────────────────────────────────
  describe('existing NDA — expired status', () => {
    it('renders expired status panel', async () => {
      setupExistingNDA({ status: 'expired' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('NDA Expired')).toBeInTheDocument();
      });

      expect(screen.getByText(/Your NDA access has expired/)).toBeInTheDocument();
    });

    it('shows "Request New NDA" button when canRequest is true after expiry', async () => {
      const nda = makeNDA({ status: 'expired' });
      mockCanRequestNDA.mockResolvedValue({ canRequest: true });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda });
      mockGetTemplates.mockResolvedValue([]);

      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request New NDA/i })).toBeInTheDocument();
      });
    });
  });

  // ── Error handling during status check ────────────────────────────────────
  describe('error handling on mount', () => {
    it('shows error toast when status check fails', async () => {
      mockCanRequestNDA.mockRejectedValue(new Error('Network failure'));
      mockGetNDAStatus.mockRejectedValue(new Error('Network failure'));
      mockGetTemplates.mockResolvedValue([]);

      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Status Check Failed',
          'Unable to verify NDA status. Please refresh and try again.'
        );
      });
    });
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────
  describe('callbacks', () => {
    it('calls onStatusChange with "none" when no existing NDA', async () => {
      setupCanRequest();
      const onStatusChange = vi.fn();
      render(<NDARequestPanel {...defaultProps} onStatusChange={onStatusChange} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Request NDA Access/i })).toBeInTheDocument();
      });

      expect(onStatusChange).toHaveBeenCalledWith('none');
    });

    it('calls onStatusChange with the NDA status when existing NDA exists', async () => {
      setupExistingNDA({ status: 'approved' });
      const onStatusChange = vi.fn();
      render(<NDARequestPanel {...defaultProps} onStatusChange={onStatusChange} />);

      await waitFor(() => {
        expect(screen.getByText('NDA Approved')).toBeInTheDocument();
      });

      expect(onStatusChange).toHaveBeenCalledWith('approved');
    });
  });

  // ── Refresh button ─────────────────────────────────────────────────────────
  describe('refresh status button', () => {
    it('renders the Refresh Status button for existing NDA', async () => {
      setupExistingNDA({ status: 'pending' });
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh Status/i })).toBeInTheDocument();
      });
    });

    it('re-calls checkNDAStatus when Refresh Status is clicked', async () => {
      setupExistingNDA({ status: 'pending' });
      const user = userEvent.setup();
      render(<NDARequestPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh Status/i })).toBeInTheDocument();
      });

      // Clear counts before the refresh click
      mockCanRequestNDA.mockClear();
      mockGetNDAStatus.mockClear();

      // Re-setup for the refresh call
      const nda = makeNDA({ status: 'pending' });
      mockCanRequestNDA.mockResolvedValue({ canRequest: false });
      mockGetNDAStatus.mockResolvedValue({ hasNDA: true, nda });

      await user.click(screen.getByRole('button', { name: /Refresh Status/i }));

      await waitFor(() => {
        expect(mockCanRequestNDA).toHaveBeenCalledWith(42);
        expect(mockGetNDAStatus).toHaveBeenCalledWith(42);
      });
    });
  });
});
