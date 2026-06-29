/**
 * ElevationService
 *
 * Fetches elevation profiles from the USGS 3DEP Elevation Point Query Service.
 * Analyzes bike route geometry to compute ascent, descent, and steep segments.
 */
import type { ElevationProfile, ElevationPoint, SteepSegment } from "@/types";
import { haversineDistance } from "@/lib/utils";

const USGS_BASE =
  "https://epqs.nationalmap.gov/v1/json";

const STEEP_GRADE_THRESHOLD = 5; // %
const STEEP_MIN_DISTANCE = 50; // meters

/** Sample coordinates along a LineString for elevation queries */
function sampleCoordinates(
  coords: [number, number][],
  maxSamples = 50
): [number, number][] {
  if (coords.length <= maxSamples) return coords;
  const step = Math.ceil(coords.length / maxSamples);
  const sampled: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) {
    sampled.push(coords[i]);
  }
  if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
    sampled.push(coords[coords.length - 1]);
  }
  return sampled;
}

async function fetchElevation(lat: number, lon: number): Promise<number> {
  try {
    const url = `${USGS_BASE}?x=${lon}&y=${lat}&units=Meters&output=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 0;
    const data = await res.json();
    return parseFloat(data.value) || 0;
  } catch {
    return 0;
  }
}

export async function getElevationProfile(
  coordinates: [number, number][]
): Promise<ElevationProfile | null> {
  if (!coordinates.length) return null;

  const sampled = sampleCoordinates(coordinates, 40);

  // Fetch elevations in batches to avoid rate limits
  const elevations: number[] = [];
  const batchSize = 10;
  for (let i = 0; i < sampled.length; i += batchSize) {
    const batch = sampled.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(([lon, lat]) => fetchElevation(lat, lon))
    );
    elevations.push(...results);
  }

  // Build elevation points with cumulative distance
  const points: ElevationPoint[] = [];
  let cumulativeDist = 0;

  for (let i = 0; i < sampled.length; i++) {
    if (i > 0) {
      const [lon1, lat1] = sampled[i - 1];
      const [lon2, lat2] = sampled[i];
      cumulativeDist += haversineDistance(lat1, lon1, lat2, lon2);
    }
    points.push({ distance: cumulativeDist, elevation: elevations[i] });
  }

  // Calculate ascent/descent
  let totalAscent = 0;
  let totalDescent = 0;
  let maxGradient = 0;
  const steepSegments: SteepSegment[] = [];

  for (let i = 1; i < points.length; i++) {
    const dElev = points[i].elevation - points[i - 1].elevation;
    const dDist = points[i].distance - points[i - 1].distance;

    if (dElev > 0) totalAscent += dElev;
    else totalDescent += Math.abs(dElev);

    if (dDist > 0) {
      const grade = (dElev / dDist) * 100;
      if (Math.abs(grade) > Math.abs(maxGradient)) maxGradient = grade;

      if (
        Math.abs(grade) >= STEEP_GRADE_THRESHOLD &&
        dDist >= STEEP_MIN_DISTANCE
      ) {
        steepSegments.push({
          startDist: points[i - 1].distance,
          endDist: points[i].distance,
          gradient: grade,
        });
      }
    }
  }

  return {
    points,
    totalAscent,
    totalDescent,
    maxGradient,
    steepSegments,
  };
}
