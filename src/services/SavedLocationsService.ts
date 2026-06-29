/**
 * SavedLocationsService
 *
 * Persists saved locations (Home, Work, etc.) in localStorage.
 * Also caches candidate station pairs for saved location pairs.
 */
import type { SavedLocation, Place } from "@/types";
import { uid } from "@/lib/utils";

const LOCATIONS_KEY = "mbdc_saved_locations";
const STATION_CACHE_KEY = "mbdc_station_cache";

// ─── Saved Locations ─────────────────────────────────────────────────────────

function loadLocations(): SavedLocation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocations(locations: SavedLocation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}

export function getSavedLocations(): SavedLocation[] {
  return loadLocations();
}

export function addSavedLocation(
  location: Omit<SavedLocation, "id" | "createdAt">
): SavedLocation {
  const locations = loadLocations();
  const newLoc: SavedLocation = {
    ...location,
    id: uid(),
    createdAt: Date.now(),
  };
  saveLocations([...locations, newLoc]);
  return newLoc;
}

export function removeSavedLocation(id: string): void {
  const locations = loadLocations().filter((l) => l.id !== id);
  saveLocations(locations);
}

export function updateSavedLocation(
  id: string,
  updates: Partial<Omit<SavedLocation, "id" | "createdAt">>
): void {
  const locations = loadLocations().map((l) =>
    l.id === id ? { ...l, ...updates } : l
  );
  saveLocations(locations);
}

/** Get saved places for autocomplete */
export function getSavedPlaces(): Place[] {
  return loadLocations().map((loc) => ({
    ...loc.place,
    type: "saved" as const,
    savedIcon: loc.icon,
  }));
}

// ─── Station Pair Cache ───────────────────────────────────────────────────────

interface StationCacheEntry {
  key: string; // "originId:destId"
  stationPairs: Array<{ originStation: string; destStation: string }>;
  cachedAt: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function loadStationCache(): StationCacheEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STATION_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStationCache(entries: StationCacheEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATION_CACHE_KEY, JSON.stringify(entries));
}

export function getCachedStationPairs(
  originId: string,
  destId: string
): StationCacheEntry["stationPairs"] | null {
  const key = `${originId}:${destId}`;
  const cache = loadStationCache();
  const entry = cache.find((e) => e.key === key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL) return null;
  return entry.stationPairs;
}

export function cacheStationPairs(
  originId: string,
  destId: string,
  pairs: StationCacheEntry["stationPairs"]
): void {
  const key = `${originId}:${destId}`;
  const cache = loadStationCache().filter((e) => e.key !== key);
  cache.push({ key, stationPairs: pairs, cachedAt: Date.now() });
  // Keep cache bounded
  saveStationCache(cache.slice(-50));
}
