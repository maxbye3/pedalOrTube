import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format seconds into a human-readable duration string */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Format meters into miles or km string */
export function formatDistance(
  meters: number,
  units: "imperial" | "metric" = "imperial"
): string {
  if (units === "metric") {
    const km = meters / 1000;
    return km < 1 ? `${Math.round(meters)}m` : `${km.toFixed(1)}km`;
  }
  const miles = meters / 1609.34;
  return miles < 0.1
    ? `${Math.round(meters * 3.28084)}ft`
    : `${miles.toFixed(1)}mi`;
}

/** Format a Unix ms timestamp into HH:MM */
export function formatTime(unixMs: number): string {
  const d = new Date(unixMs);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
}

/** Haversine distance between two lat/lon points in meters */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Estimated calories burned cycling (rough: 40 cal/km) */
export function estimateCalories(bikeMeters: number): number {
  return Math.round((bikeMeters / 1000) * 40);
}

/** CO2 saved vs average car trip in grams */
export function estimateCO2Saved(totalMeters: number): number {
  // Average car emits ~192g CO2/km
  return Math.round((totalMeters / 1000) * 192);
}

/** Decode a Google/OTP polyline into [lon, lat] pairs for GeoJSON */
export function decodePolyline(
  encoded: string
): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

/** Generate a unique ID */
export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
