import { useState, useCallback, useRef } from 'react';
import { pitchAPI } from '@/lib/api';
import type { Pitch } from '@/lib/api';

interface UseSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
}

interface SearchState {
  query: string;
  results: Pitch[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
}

export const useSearch = (options: UseSearchOptions = {}) => {
  const { debounceMs = 300, minQueryLength = 2 } = options;
  
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    loading: false,
    error: null,
    hasSearched: false
  });

  const debounceRef = useRef<NodeJS.Timeout>();

  const search = useCallback(async (query: string) => {
    if (query.length < minQueryLength) {
      setState(prev => ({
        ...prev,
        query,
        results: [],
        error: null,
        hasSearched: false
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      query,
      loading: true,
      error: null
    }));

    try {
      const results = await pitchAPI.search(query);
      setState(prev => ({
        ...prev,
        results,
        loading: false,
        hasSearched: true
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        results: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Search failed',
        hasSearched: true
      }));
    }
  }, [minQueryLength]);

  const debouncedSearch = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void search(query);
    }, debounceMs);
  }, [search, debounceMs]);

  const setQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, query }));
    debouncedSearch(query);
  }, [debouncedSearch]);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setState({
      query: '',
      results: [],
      loading: false,
      error: null,
      hasSearched: false
    });
  }, []);

  return {
    ...state,
    setQuery,
    search,
    clearSearch
  };
};