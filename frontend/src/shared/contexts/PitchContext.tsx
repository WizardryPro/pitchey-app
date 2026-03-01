import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { pitchService, type Pitch } from '@/services/pitch.service';

interface PitchContextType {
  pitches: Pitch[];
  currentPitch: Pitch | null;
  isLoading: boolean;
  error: string | null;
  fetchPitches: (params?: any) => Promise<void>;
  fetchPitchById: (id: string) => Promise<void>;
  createPitch: (data: Partial<Pitch>) => Promise<Pitch>;
  updatePitch: (id: string, data: Partial<Pitch>) => Promise<void>;
  deletePitch: (id: string) => Promise<void>;
  setCurrentPitch: (pitch: Pitch | null) => void;
  searchPitches: (query: string) => Promise<void>;
  filterPitches: (filters: any) => Promise<void>;
}

const PitchContext = createContext<PitchContextType | undefined>(undefined);

export const usePitch = () => {
  const context = useContext(PitchContext);
  if (!context) {
    throw new Error('usePitch must be used within PitchProvider');
  }
  return context;
};

interface PitchProviderProps {
  children: ReactNode;
}

export const PitchProvider: React.FC<PitchProviderProps> = ({ children }) => {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [currentPitch, setCurrentPitch] = useState<Pitch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPitches = useCallback(async (params?: any) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await (pitchService as any).getMyPitches(params);
      setPitches(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pitches');
      console.error('Error fetching pitches:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPitchById = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const pitch = await (pitchService as any).getById(id);
      setCurrentPitch(pitch);
      return pitch;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pitch');
      console.error('Error fetching pitch:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPitch = useCallback(async (data: Partial<Pitch>) => {
    try {
      setIsLoading(true);
      setError(null);
      const newPitch = await pitchService.create(data as any);
      setPitches(prev => [...prev, newPitch]);
      return newPitch;
    } catch (err: any) {
      setError(err.message || 'Failed to create pitch');
      console.error('Error creating pitch:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePitch = useCallback(async (id: string, data: Partial<Pitch>) => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedPitch = await pitchService.update(Number(id), data as any);

      // Update in list
      setPitches(prev =>
        prev.map(p => (p.id.toString() === id ? updatedPitch : p))
      );

      // Update current if it's the same
      if (currentPitch?.id.toString() === id) {
        setCurrentPitch(updatedPitch);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update pitch');
      console.error('Error updating pitch:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentPitch]);

  const deletePitch = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await pitchService.delete(Number(id));

      // Remove from list
      setPitches(prev => prev.filter(p => p.id.toString() !== id));

      // Clear current if it's the deleted one
      if (currentPitch?.id.toString() === id) {
        setCurrentPitch(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete pitch');
      console.error('Error deleting pitch:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentPitch]);

  const searchPitches = useCallback(async (query: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const results = await pitchService.getPublicPitches({ search: query });
      setPitches(results.pitches);
    } catch (err: any) {
      setError(err.message || 'Failed to search pitches');
      console.error('Error searching pitches:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filterPitches = useCallback(async (filters: any) => {
    try {
      setIsLoading(true);
      setError(null);
      const results = await pitchService.getMyPitches();
      setPitches(results);
    } catch (err: any) {
      setError(err.message || 'Failed to filter pitches');
      console.error('Error filtering pitches:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: PitchContextType = {
    pitches,
    currentPitch,
    isLoading,
    error,
    fetchPitches,
    fetchPitchById,
    createPitch,
    updatePitch,
    deletePitch,
    setCurrentPitch,
    searchPitches,
    filterPitches,
  };

  return <PitchContext.Provider value={value}>{children}</PitchContext.Provider>;
};