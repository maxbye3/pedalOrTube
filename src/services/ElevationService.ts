/**
 * ElevationService
 *
 * Fetches elevation profiles from the USGS 3DEP Elevation Point Query Service.
 * Analyzes bike route geometry to compute ascent, descent, and steep segments.
 */
import type {
  ElevationProfile,
  ElevationPoint,
  HillSegment,
  SteepSegment,
} from "@/types";
import { haversineDistance } from "@/lib/utils";

const USGS_BASE =
  "https://epqs.nationalmap.gov/v1/json";

const STEEP_GRADE_THRESHOLD = 5; // %
const STEEP_MIN_DISTANCE = 50; // meters
const HILL_MIN_GAIN = 5; // meters

/** Sample coordinates along a LineString for elevation queries */
function sampleCoordinates(
  coords: [number, number][],
  maxSamples = 50
): [number, number][] {
  if (coords.length <= 2) return coords;

  const cumulativeDistances = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    cumulativeDistances.push(
      cumulativeDistances[i - 1] + haversineDistance(lat1, lon1, lat2, lon2)
    );
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  if (totalDistance === 0) return [coords[0], coords[coords.length - 1]];

  const sampleCount = Math.min(maxSamples, Math.max(2, Math.ceil(totalDistance / 100) + 1));
  const sampled: [number, number][] = [];

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const targetDistance =
      (totalDistance * sampleIndex) / Math.max(sampleCount - 1, 1);
    const segmentIndex = cumulativeDistances.findIndex(
      (distance) => distance >= targetDistance
    );

    if (segmentIndex === -1) {
      sampled.push(coords[coords.length - 1]);
      continue;
    }

    if (segmentIndex <= 0) {
      sampled.push(coords[0]);
      continue;
    }

    const prevDistance = cumulativeDistances[segmentIndex - 1];
    const nextDistance = cumulativeDistances[segmentIndex];
    const fraction =
      nextDistance > prevDistance
        ? (targetDistance - prevDistance) / (nextDistance - prevDistance)
        : 0;
    const [prevLon, prevLat] = coords[segmentIndex - 1];
    const [nextLon, nextLat] = coords[segmentIndex];

    sampled.push([
      prevLon + (nextLon - prevLon) * fraction,
      prevLat + (nextLat - prevLat) * fraction,
    ]);
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
  const hillSegments: HillSegment[] = [];

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
        const steepSegment: SteepSegment = {
          startDist: points[i - 1].distance,
          endDist: points[i].distance,
          gradient: grade,
        };
        steepSegments.push(steepSegment);

        if (grade > 0 && dElev >= HILL_MIN_GAIN) {
          hillSegments.push({
            ...steepSegment,
            distance: dDist,
            elevationGain: dElev,
            geometry: {
              type: "LineString",
              coordinates: [sampled[i - 1], sampled[i]],
            },
          });
        }
      }
    }
  }

  return {
    points,
    totalAscent,
    totalDescent,
    maxGradient,
    steepSegments,
    hillSegments,
  };
}
