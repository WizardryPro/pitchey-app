import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockGet = vi.fn();
vi.mock('../../../../lib/api-client', () => ({ default: { get: (...a: unknown[]) => mockGet(...a) } }));

import WhoViewedPanel from '../WhoViewedPanel';

const renderPanel = () => render(<MemoryRouter><WhoViewedPanel pitchId={229} /></MemoryRouter>);

beforeEach(() => { mockGet.mockReset(); mockNavigate.mockReset(); });

describe('WhoViewedPanel', () => {
  it('shows a skeleton while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(screen.getByTestId('who-viewed-skeleton')).toBeInTheDocument();
  });

  it('renders nothing when the caller is not the owner', async () => {
    mockGet.mockResolvedValue({ success: true, data: { isOwner: false, locked: true, totalViewers: 0, breakdown: {}, viewers: [] } });
    const { container } = renderPanel();
    await waitFor(() => expect(screen.queryByTestId('who-viewed-skeleton')).not.toBeInTheDocument());
    expect(screen.queryByTestId('who-viewed-panel')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the counts + upsell when locked (free tier), and upgrades on click', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { isOwner: true, locked: true, totalViewers: 3, breakdown: { investor: 2, production: 1 }, viewers: [] },
    });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('who-viewed-panel')).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledWith('/api/views/pitch/229');
    // teaser counts always visible
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2 Investor')).toBeInTheDocument();
    // upsell shown, no names
    expect(screen.getByTestId('who-viewed-upsell')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /upgrade to unlock/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/creator/billing');
  });

  it('shows named viewers + NDA badge when unlocked (paid tier)', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        isOwner: true, locked: false, totalViewers: 2,
        breakdown: { investor: 1, production: 1 },
        viewers: [
          { viewerId: 7, name: 'Dana Investor', role: 'investor', viewCount: 4, lastViewedAt: new Date().toISOString(), totalDuration: 120, ndaSigned: true },
          { viewerId: 9, name: 'Pat Producer', role: 'production', viewCount: 1, lastViewedAt: null, totalDuration: 0, ndaSigned: false },
        ],
      },
    });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('who-viewed-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('who-viewed-upsell')).not.toBeInTheDocument();
    expect(screen.getByText('Dana Investor')).toBeInTheDocument();
    expect(screen.getByText('Pat Producer')).toBeInTheDocument();
    expect(screen.getByText('NDA')).toBeInTheDocument(); // only Dana signed
    expect(screen.getByText(/viewed 4×/)).toBeInTheDocument();
  });
});
