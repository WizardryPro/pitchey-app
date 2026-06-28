import { useState, useEffect, useCallback } from 'react';
import { TeamService, Team } from '@/services/team.service';

const TEAM_ID_KEY = 'pitchey:currentTeamId';

export function useCurrentTeam() {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const teams = await TeamService.getTeams();

      if (teams.length === 0) {
        setTeam(null);
        return;
      }

      // Try to restore persisted team ID
      const savedId = localStorage.getItem(TEAM_ID_KEY);
      const matched = savedId ? teams.find(t => String(t.id) === savedId) : null;
      const selected = matched || teams[0];

      localStorage.setItem(TEAM_ID_KEY, String(selected.id));
      setTeam(selected);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to fetch teams:', e);
      setError(e.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  const createDefaultTeam = useCallback(async (name = 'My Team') => {
    try {
      setLoading(true);
      const newTeam = await TeamService.createTeam({ name });
      localStorage.setItem(TEAM_ID_KEY, String(newTeam.id));
      setTeam(newTeam);
      return newTeam;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || 'Failed to create team');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    team,
    teamId: team ? String(team.id) : null,
    loading,
    error,
    refreshTeam: fetchTeam,
    createDefaultTeam,
  };
}
