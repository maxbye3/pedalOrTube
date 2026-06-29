/**
 * HistoryService
 *
 * Stores the last 200 journeys in localStorage. Provides autocomplete
 * suggestions by extracting unique origin/destination Places.
 */
import type { HistoryEntry, Place } from "@/types";
import { uid } from "@/lib/utils";

const STORAGE_KEY = "mbdc_history";
const MAX_ENTRIES = 200;

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addHistoryEntry(
  entry: Omit<HistoryEntry, "id" | "date">
): void {
  const entries = load();
  const newEntry: HistoryEntry = { ...entry, id: uid(), date: Date.now() };
  const updated = [newEntry, ...entries].slice(0, MAX_ENTRIES);
  save(updated);
}

export function getHistory(): HistoryEntry[] {
  return load();
}

export function clearHistory(): void {
  save([]);
}

/** Extract unique places from history for autocomplete suggestions */
export function getHistoryPlaces(): Place[] {
  const entries = load();
  const seen = new Set<string>();
  const places: Place[] = [];

  for (const e of entries) {
    for (const p of [e.origin, e.destination]) {
      const key = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
      if (!seen.has(key)) {
        seen.add(key);
        places.push({ ...p, type: "history" });
      }
    }
  }

  return places;
}
