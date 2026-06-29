"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, MapPin, Clock, Star, Home, Briefcase, Dumbbell, Users, X } from "lucide-react";
import type { Place, GeocodingResult } from "@/types";
import { getSavedPlaces } from "@/services/SavedLocationsService";
import { getHistoryPlaces } from "@/services/HistoryService";
import { cn } from "@/lib/utils";

interface AutocompleteProps {
  value: Place | null;
  placeholder: string;
  onSelect: (place: Place) => void;
  onClear: () => void;
  autoFocus?: boolean;
  icon?: React.ReactNode;
}

const SAVED_ICONS = {
  home: Home,
  work: Briefcase,
  gym: Dumbbell,
  friends: Users,
  star: Star,
};

function PlaceIcon({ place }: { place: Place | GeocodingResult }) {
  if ("type" in place) {
    if (place.type === "saved" && "savedIcon" in place && place.savedIcon) {
      const Icon = SAVED_ICONS[place.savedIcon];
      return <Icon size={14} className="text-blue-500 shrink-0" />;
    }
    if (place.type === "history") {
      return <Clock size={14} className="text-gray-400 shrink-0" />;
    }
  }
  return <MapPin size={14} className="text-gray-400 shrink-0" />;
}

export function Autocomplete({
  value,
  placeholder,
  onSelect,
  onClear,
  autoFocus,
  icon,
}: AutocompleteProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync query with external value changes
  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();

    if (q.trim().length < 2) {
      // Show local suggestions (saved + history)
      const saved = getSavedPlaces().slice(0, 3);
      const history = getHistoryPlaces().slice(0, 2);
      const combined = [...saved, ...history].slice(0, 5);
      setSuggestions(combined);
      setIsOpen(combined.length > 0);
      return;
    }

    abortRef.current = new AbortController();
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal }
      );
      const geocodeResults: GeocodingResult[] = await res.json();

      // Blend: saved + history that match query first, then geocoding
      const saved = getSavedPlaces().filter((p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
      );
      const history = getHistoryPlaces().filter((p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
      );

      const geocodePlaces: Place[] = geocodeResults.map((r) => ({
        name: r.name,
        address: r.address,
        lat: r.lat,
        lon: r.lon,
        type: "geocode" as const,
      }));

      // Deduplicate and cap at 5
      const seen = new Set<string>();
      const merged: Place[] = [];
      for (const p of [...saved, ...history, ...geocodePlaces]) {
        const key = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(p);
        }
        if (merged.length >= 5) break;
      }

      setSuggestions(merged);
      setIsOpen(merged.length > 0);
    } catch {
      /* aborted or network error */
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(query), 200);
    return () => clearTimeout(timer);
  }, [query, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(place: Place) {
    onSelect(place);
    setQuery(place.name);
    setIsOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) onClear();
          }}
          onFocus={() => fetchSuggestions(query)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none min-w-0"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              onClear();
              inputRef.current?.focus();
            }}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((place, i) => (
            <li key={`${place.lat}-${place.lon}-${i}`}>
              <button
                className={cn(
                  "w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                  highlighted === i
                    ? "bg-blue-50"
                    : "hover:bg-gray-50"
                )}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => handleSelect(place)}
              >
                <span className="mt-0.5">
                  <PlaceIcon place={place} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 truncate">
                    {place.name}
                  </span>
                  {place.address && (
                    <span className="block text-xs text-gray-400 truncate">
                      {place.address}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Simple search icon for the input
export function SearchIcon() {
  return <Search size={15} />;
}
