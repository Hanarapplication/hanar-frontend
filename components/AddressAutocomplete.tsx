'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export type AddressResult = {
  formatted_address: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat?: number;
  lng?: number;
};

type Prediction = { place_id: string; description: string };

type AddressAutocompleteProps = {
  value: string;
  onSelect: (result: AddressResult) => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** 'full' = addresses + places (default). 'locality' = bias to cities/regions for location/zip. */
  mode?: 'full' | 'locality';
  /** Optional: min chars before fetching (default 2). */
  minLength?: number;
};

const DEBOUNCE_MS = 300;

export default function AddressAutocomplete({
  value,
  onSelect,
  onChange,
  placeholder = 'Start typing address or city...',
  className = '',
  inputClassName = '',
  disabled = false,
  mode = 'full',
  minLength = 2,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(
    async (query: string) => {
      if (query.length < minLength) {
        setPredictions([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const types = mode === 'locality' ? '(regions)' : 'geocode';
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(query)}&types=${encodeURIComponent(types)}`
        );
        const data = await res.json();
        const list = Array.isArray(data.predictions) ? data.predictions : [];
        setPredictions(list);
        setOpen(list.length > 0);
        setSelectedIndex(-1);
      } catch {
        setPredictions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [mode, minLength]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange?.(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(v), DEBOUNCE_MS);
  };

  const fetchDetailsAndSelect = useCallback(async (placeId: string, description: string) => {
    setLoading(true);
    setOpen(false);
    setPredictions([]);
    try {
      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get place details');
      setInputValue(description);
      onChange?.(description);
      onSelect({
        formatted_address: data.formatted_address || description,
        street: data.street || '',
        city: data.city || '',
        state: data.state || '',
        zip: data.zip || '',
        country: data.country || '',
        lat: data.lat,
        lng: data.lng,
      });
    } catch (err) {
      setInputValue(description);
      onChange?.(description);
      onSelect({
        formatted_address: description,
        street: '',
        city: '',
        state: '',
        zip: '',
        country: '',
      });
    } finally {
      setLoading(false);
    }
  }, [onSelect, onChange]);

  const handleSelect = (p: Prediction) => {
    fetchDetailsAndSelect(p.place_id, p.description);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || predictions.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i < predictions.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i <= 0 ? predictions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = predictions[selectedIndex >= 0 ? selectedIndex : 0];
      if (p) handleSelect(p);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={inputClassName}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="address-suggestions-list"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">...</span>
      )}
      {open && predictions.length > 0 && (
        <ul
          id="address-suggestions-list"
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        >
          {predictions.map((p, i) => (
            <li
              key={p.place_id}
              role="option"
              aria-selected={i === selectedIndex}
              className={`cursor-pointer px-3 py-2 text-sm text-slate-800 dark:text-gray-200 ${
                i === selectedIndex ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-slate-100 dark:hover:bg-gray-700'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(p);
              }}
            >
              {p.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
