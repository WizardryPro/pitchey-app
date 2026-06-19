import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const list = vi.fn();
const create = vi.fn();
const revoke = vi.fn();
vi.mock('../../../../services/slate.service', () => ({
  SlateService: {
    listShareLinks: (...a: unknown[]) => list(...a),
    createShareLink: (...a: unknown[]) => create(...a),
    revokeShareLink: (...a: unknown[]) => revoke(...a),
  },
}));

import SlateShareLinks from '../SlateShareLinks';

const link = (over = {}) => ({ id: 1, token: 'tok-abc', label: 'Investor outreach', view_count: 3, revoked_at: null, created_at: '2026-01-01' , ...over });

beforeEach(() => {
  list.mockReset(); create.mockReset(); revoke.mockReset();
  list.mockResolvedValue([]);
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('SlateShareLinks', () => {
  it('shows the publish hint when the slate is not published', async () => {
    render(<SlateShareLinks slateId={5} published={false} />);
    await waitFor(() => expect(list).toHaveBeenCalledWith(5));
    expect(screen.getByText(/Publish this slate/i)).toBeInTheDocument();
  });

  it('lists existing links with their view counts', async () => {
    list.mockResolvedValue([link()]);
    render(<SlateShareLinks slateId={5} published />);
    await waitFor(() => expect(screen.getByText('Investor outreach')).toBeInTheDocument());
    expect(screen.getByText(/3 views/)).toBeInTheDocument();
    expect(screen.queryByText(/Publish this slate/i)).not.toBeInTheDocument();
  });

  it('creates a new link with the typed label, then reloads', async () => {
    list.mockResolvedValueOnce([]).mockResolvedValueOnce([link({ label: 'Cannes' })]);
    create.mockResolvedValue(link({ label: 'Cannes' }));
    render(<SlateShareLinks slateId={5} published />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Share link label'), { target: { value: 'Cannes' } });
    fireEvent.click(screen.getByRole('button', { name: /new link/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(5, 'Cannes'));
    await waitFor(() => expect(screen.getByText('Cannes')).toBeInTheDocument());
  });

  it('copies the share URL to the clipboard', async () => {
    list.mockResolvedValue([link()]);
    render(<SlateShareLinks slateId={5} published />);
    await waitFor(() => expect(screen.getByText('Investor outreach')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
    await waitFor(() => expect((navigator.clipboard.writeText as any)).toHaveBeenCalledWith(expect.stringContaining('/slates/s/tok-abc')));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('revokes a link and reloads', async () => {
    list.mockResolvedValueOnce([link()]).mockResolvedValueOnce([]);
    revoke.mockResolvedValue(true);
    render(<SlateShareLinks slateId={5} published />);
    await waitFor(() => expect(screen.getByText('Investor outreach')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /revoke link/i }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText(/No share links yet/i)).toBeInTheDocument());
  });
});
