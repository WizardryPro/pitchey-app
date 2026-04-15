import { useEffect, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';

export interface CompaniesHouseResult {
  companyNumber: string;
  title: string;
  status: string;
  address: string;
  dateOfCreation: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: CompaniesHouseResult) => void;
  placeholder?: string;
  label?: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-green-700 bg-green-50',
  dissolved: 'text-red-700 bg-red-50',
  liquidation: 'text-orange-700 bg-orange-50',
  unknown: 'text-gray-600 bg-gray-50',
};

export default function CompaniesHouseAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing your company name…',
  label = 'Companies House Number',
}: Props) {
  const [results, setResults] = useState<CompaniesHouseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search — fires 300ms after the last keystroke.
  // Only triggers on free-text queries (≥2 chars). Once the user picks
  // a result we don't re-search on the resulting selection text.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      fetch(`${API_URL}/api/production/verify/companies-house/search?q=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data: { results?: CompaniesHouseResult[]; message?: string }) => {
          setResults(data.results || []);
          setOpen(true);
          if (data.message && !data.results?.length) setError(data.message);
        })
        .catch((err) => {
          if ((err as { name?: string }).name !== 'AbortError') {
            setError('Search failed. Try again or enter the number manually.');
          }
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(handle);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handlePick = (result: CompaniesHouseResult) => {
    onSelect(result);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="ch-search" className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          id="ch-search"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-portal-production/30 focus:border-brand-portal-production"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Type your company name or number — we'll look it up on Companies House.
      </p>

      {open && (results.length > 0 || error) && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {error && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-gray-500">{error}</div>
          )}
          {results.map((r) => {
            const statusKey = r.status.toLowerCase();
            const statusClass = STATUS_COLOR[statusKey] || STATUS_COLOR.unknown;
            return (
              <button
                key={r.companyNumber}
                type="button"
                onClick={() => handlePick(r)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">{r.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase shrink-0 ${statusClass}`}>
                    {r.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  <span className="font-mono">#{r.companyNumber}</span>
                  {r.address && <span className="truncate">· {r.address}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
