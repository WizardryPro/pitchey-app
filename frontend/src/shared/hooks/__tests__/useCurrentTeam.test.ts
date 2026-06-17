import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mock TeamService ──────────────────────────────────────────────────────
const mockGetTeams = vi.fn();
const mockCreateTeam = vi.fn();

vi.mock('@/services/team.service', () => ({
  TeamService: {
    getTeams: (...args: any[]) => mockGetTeams(...args),
    createTeam: (...args: any[]) => mockCreateTeam(...args),
  },
}));

import { useCurrentTeam } from '../useCurrentTeam';

const TEAM_ID_KEY = 'pitchey:currentTeamId';

const mockTeamA = { id: 10, name: 'Alpha Studio', description: 'First team' };
const mockTeamB = { id: 20, name: 'Beta Pictures', description: 'Second team' };

describe('useCurrentTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage mock behaviour
    (localStorage.getItem as any).mockReturnValue(null);
    (localStorage.setItem as any).mockReset();
    (localStorage.removeItem as any).mockReset();
  });

  // =========================================================================
  // Initial loading
  // =========================================================================
  describe('initial fetch on mount', () => {
    it('starts in loading state', () => {
      mockGetTeams.mockReturnValue(new Promise(() => {})); // never resolves
      const { result } = renderHook(() => useCurrentTeam());
      expect(result.current.loading).toBe(true);
    });

    it('sets loading false after fetch resolves', async () => {
      mockGetTeams.mockResolvedValue([mockTeamA]);
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it('sets team to first team when multiple teams returned', async () => {
      mockGetTeams.mockResolvedValue([mockTeamA, mockTeamB]);
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.team).toEqual(mockTeamA));
    });

    it('sets team to null when no teams returned', async () => {
      mockGetTeams.mockResolvedValue([]);
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.team).toBeNull();
      });
    });

    it('persists selected team id to localStorage', async () => {
      mockGetTeams.mockResolvedValue([mockTeamA]);
      renderHook(() => useCurrentTeam());

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(TEAM_ID_KEY, '10');
      });
    });
  });

  // =========================================================================
  // Persisted team selection
  // =========================================================================
  describe('persisted team id restoration', () => {
    it('restores the saved team when it matches', async () => {
      (localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === TEAM_ID_KEY) return '20';
        return null;
      });
      mockGetTeams.mockResolvedValue([mockTeamA, mockTeamB]);
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.team).toEqual(mockTeamB));
    });

    it('falls back to first team if saved id not in list', async () => {
      (localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === TEAM_ID_KEY) return '999'; // not in list
        return null;
      });
      mockGetTeams.mockResolvedValue([mockTeamA, mockTeamB]);
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.team).toEqual(mockTeamA));
    });
  });

  // =========================================================================
  // teamId derived field
  // =========================================================================
  describe('teamId', () => {
    it('returns string id when team is set', async () => {
      mockGetTeams.mockResolvedValue([mockTeamA]);
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.teamId).toBe('10'));
    });

    it('returns null when no team', async () => {
      mockGetTeams.mockResolvedValue([]);
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.teamId).toBeNull());
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================
  describe('error handling', () => {
    it('sets error when getTeams throws', async () => {
      mockGetTeams.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.error).toBe('Network error'));
      expect(result.current.loading).toBe(false);
      expect(result.current.team).toBeNull();
    });

    it('handles non-Error thrown values', async () => {
      mockGetTeams.mockRejectedValue('unexpected failure');
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.error).toBe('unexpected failure'));
    });
  });

  // =========================================================================
  // refreshTeam
  // =========================================================================
  describe('refreshTeam', () => {
    it('re-fetches and updates team', async () => {
      mockGetTeams.mockResolvedValueOnce([mockTeamA]).mockResolvedValueOnce([mockTeamB]);
      const { result } = renderHook(() => useCurrentTeam());

      await waitFor(() => expect(result.current.team).toEqual(mockTeamA));

      await act(async () => {
        await result.current.refreshTeam();
      });

      expect(result.current.team).toEqual(mockTeamB);
    });
  });

  // =========================================================================
  // createDefaultTeam
  // =========================================================================
  describe('createDefaultTeam', () => {
    it('creates a team with provided name and sets it as current', async () => {
      mockGetTeams.mockResolvedValue([]);
      mockCreateTeam.mockResolvedValue({ id: 99, name: 'My Studio' });

      const { result } = renderHook(() => useCurrentTeam());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let created: any;
      await act(async () => {
        created = await result.current.createDefaultTeam('My Studio');
      });

      expect(mockCreateTeam).toHaveBeenCalledWith({ name: 'My Studio' });
      expect(result.current.team).toEqual({ id: 99, name: 'My Studio' });
      expect(created).toEqual({ id: 99, name: 'My Studio' });
    });

    it('uses "My Team" as default name', async () => {
      mockGetTeams.mockResolvedValue([]);
      mockCreateTeam.mockResolvedValue({ id: 5, name: 'My Team' });

      const { result } = renderHook(() => useCurrentTeam());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.createDefaultTeam();
      });

      expect(mockCreateTeam).toHaveBeenCalledWith({ name: 'My Team' });
    });

    it('persists new team id to localStorage', async () => {
      mockGetTeams.mockResolvedValue([]);
      mockCreateTeam.mockResolvedValue({ id: 77, name: 'New Team' });

      const { result } = renderHook(() => useCurrentTeam());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.createDefaultTeam('New Team');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(TEAM_ID_KEY, '77');
    });

    it('sets error and re-throws when createTeam fails', async () => {
      mockGetTeams.mockResolvedValue([]);
      mockCreateTeam.mockRejectedValue(new Error('Create failed'));

      const { result } = renderHook(() => useCurrentTeam());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let threw = false;
      await act(async () => {
        try {
          await result.current.createDefaultTeam();
        } catch {
          threw = true;
        }
      });

      expect(threw).toBe(true);
      expect(result.current.error).toBe('Create failed');
      expect(result.current.loading).toBe(false);
    });
  });
});
