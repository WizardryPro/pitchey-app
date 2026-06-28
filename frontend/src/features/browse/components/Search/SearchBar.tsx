import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SearchSuggestion {
  query: string;
  type: 'search' | 'genre' | 'format' | 'creator' | 'title';
  count?: number;
  relevance?: number;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  showSuggestions?: boolean;
  showHistory?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Search pitches...",
  showSuggestions = true,
  showHistory = true,
  className = "",
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Size classes
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg'
  };

  // Load search history on mount
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const response = await apiClient.get('/api/search/history?limit=10');
        if (response.success && (response.data as any)?.searchHistory) {
          setSearchHistory((response.data as any).searchHistory);
        }
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    };

    if (showHistory) {
      void loadSearchHistory();
    }
  }, [showHistory]);

  // Debounced suggestion fetching
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get(`/api/search/suggestions?q=${encodeURIComponent(query)}&limit=8`);
      if (response.success && (response.data as any)?.suggestions) {
        setSuggestions((response.data as any).suggestions);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1);

    if (showSuggestions) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        void fetchSuggestions(newValue);
      }, 300);
    }
  };

  // Handle input focus
  const handleFocus = () => {
    setIsOpen(true);
    if (value.length >= 2 && showSuggestions) {
      void fetchSuggestions(value);
    }
  };

  // Handle input blur
  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking on a suggestion
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => setIsOpen(false), 150);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (showHistory && searchHistory.length > 0 ? searchHistory.length : 0);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev <= 0 ? totalItems - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          const allItems = [...suggestions.map(s => s.query), ...(showHistory ? searchHistory : [])];
          const selectedQuery = allItems[selectedIndex];
          if (selectedQuery) {
            handleSearch(selectedQuery);
          }
        } else {
          handleSearch(value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle search execution
  const handleSearch = (query: string) => {
    if (query.trim()) {
      onSearch(query.trim());
      setIsOpen(false);
      
      // Add to search history
      if (showHistory && !searchHistory.includes(query.trim())) {
        setSearchHistory(prev => [query.trim(), ...prev.slice(0, 9)]);
      }
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (query: string) => {
    onChange(query);
    handleSearch(query);
  };

  // Handle clear
  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Get suggestion icon
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'title':
        return '🎬';
      case 'genre':
        return '🎭';
      case 'format':
        return '📺';
      case 'creator':
        return '👤';
      default:
        return '🔍';
    }
  };

  // Get suggestion label
  const getSuggestionLabel = (type: string) => {
    switch (type) {
      case 'title':
        return 'Title';
      case 'genre':
        return 'Genre';
      case 'format':
        return 'Format';
      case 'creator':
        return 'Creator';
      default:
        return 'Search';
    }
  };

  const showDropdown = isOpen && (suggestions.length > 0 || (showHistory && searchHistory.length > 0 && value.length < 2));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`
            block w-full pl-10 pr-10 border border-gray-300 rounded-lg 
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            placeholder-gray-500 bg-white
            ${sizeClasses[size]}
            ${className}
          `}
        />
        
        {value && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            type="button"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
        
        {loading && (
          <div className="absolute inset-y-0 right-8 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {/* Search History */}
          {showHistory && searchHistory.length > 0 && value.length < 2 && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <Clock className="h-3 w-3" />
                Recent Searches
              </div>
              {searchHistory.slice(0, 5).map((historyItem, index) => (
                <button
                  key={`history-${index}`}
                  onClick={() => handleSuggestionClick(historyItem)}
                  className={`
                    w-full text-left px-3 py-2 rounded text-sm
                    hover:bg-gray-50 flex items-center gap-3
                    ${selectedIndex === index ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                  `}
                >
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="truncate">{historyItem}</span>
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              {(showHistory && searchHistory.length > 0 && value.length < 2) && (
                <div className="border-t border-gray-100 my-2"></div>
              )}
              
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <TrendingUp className="h-3 w-3" />
                Suggestions
              </div>
              
              {suggestions.map((suggestion, index) => {
                const adjustedIndex = showHistory && searchHistory.length > 0 && value.length < 2 
                  ? index + Math.min(searchHistory.length, 5)
                  : index;
                
                return (
                  <button
                    key={`suggestion-${index}`}
                    onClick={() => handleSuggestionClick(suggestion.query)}
                    className={`
                      w-full text-left px-3 py-2 rounded text-sm
                      hover:bg-gray-50 flex items-center gap-3
                      ${selectedIndex === adjustedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                    `}
                  >
                    <span className="text-lg">{getSuggestionIcon(suggestion.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{suggestion.query}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{getSuggestionLabel(suggestion.type)}</span>
                        {suggestion.count && (
                          <span>• {suggestion.count} results</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No suggestions */}
          {suggestions.length === 0 && value.length >= 2 && !loading && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No suggestions found
            </div>
          )}
        </div>
      )}
    </div>
  );
};