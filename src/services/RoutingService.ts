/**
 * RoutingService
 *
 * Queries OpenTripPlanner (OTP2) via the planConnection GraphQL API.
 *
 * Strategy:
 *  1. Pure-bike query   → direct BICYCLE route
 *  2. Transit query     → WALK + SUBWAY/BUS route (OTP does not support
 *                         bike+transit without bike-parking infrastructure)
 *  3. Synthesis         → walk legs in the transit itinerary are replaced
 *                         with bike legs (same distance, ~3× faster), giving
 *                         realistic "bike to station → Metro → bike" options.
 */
import type {
  OTPPlanConnection,
  OTPItinerary,
  OTPLeg,
  OTPPlace,
  RouteLeg,
  LegPlace,
  TransitStopInfo,
  RouteCandidate,
  LegMode,
  JourneySearch,
} from "@/types";
import { decodePolyline, haversineDistance, uid } from "@/lib/utils";

const OTP_BASE =
  process.env.NEXT_PUBLIC_OTP_URL ?? "http://localhost:8080";
const OTP_GRAPHQL = `${OTP_BASE}/otp/gtfs/v1`;

// Average bike speed (m/s) vs walk speed (m/s) — used for synthesis
const BIKE_MS = 4.2;
const WALK_MS = 1.4;
const BIKE_WALK_RATIO = BIKE_MS / WALK_MS; // ≈ 3

// ─── GraphQL query ────────────────────────────────────────────────────────────

const LEG_FIELDS = `
  mode
  start { scheduledTime }
  end   { scheduledTime }
  distance
  duration
  transitLeg
  realTime
  headsign
  from { name lat lon stop { gtfsId code } }
  to   { name lat lon stop { gtfsId code } }
  legGeometry { points length }
  route { shortName longName color mode }
  stopCalls {
    stopLocation {
      ... on Stop { name lat lon gtfsId }
    }
  }
`;

const ITINERARY_FIELDS = `
  duration
  start
  end
  walkTime
  waitingTime
  walkDistance
  numberOfTransfers
  elevationGained
  elevationLost
  legs { ${LEG_FIELDS} }
`;

const PLAN_CONNECTION_QUERY = `
  query PlanConnection(
    $fromLat:  CoordinateValue!
    $fromLon:  CoordinateValue!
    $toLat:    CoordinateValue!
    $toLon:    CoordinateValue!
    $first:    Int
    $dateTime: PlanDateTimeInput
    $modes:    PlanModesInput!
  ) {
    planConnection(
      origin:      { location: { coordinate: { latitude: $fromLat, longitude: $fromLon } } }
      destination: { location: { coordinate: { latitude: $toLat,   longitude: $toLon   } } }
      first:    $first
      dateTime: $dateTime
      modes:    $modes
    ) {
      edges { node { ${ITINERARY_FIELDS} } }
      routingErrors { code description }
    }
  }
`;

// ─── OTP helpers ──────────────────────────────────────────────────────────────

function toOffsetDateTime(ts?: number): string {
  return (ts ? new Date(ts) : new Date()).toISOString();
}

async function queryPlanConnection(
  variables: Record<string, unknown>
): Promise<OTPPlanConnection | null> {
  try {
    const res = await fetch(OTP_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "OTPTimeout": "14000",
      },
      body: JSON.stringify({ query: PLAN_CONNECTION_QUERY, variables }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json: {
      data?: { planConnection?: OTPPlanConnection };
      errors?: unknown[];
    } = await res.json();
    if (json.errors?.length) console.warn("OTP errors:", json.errors);
    return json.data?.planConnection ?? null;
  } catch (err) {
    console.error("OTP query failed:", err);
    return null;
  }
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

function otpPlaceToLegPlace(p: OTPPlace): LegPlace {
  return {
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    stopId: p.stop?.gtfsId,
    stopCode: p.stop?.code,
  };
}

function otpLegToRouteLeg(leg: OTPLeg): RouteLeg {
  const coords = decodePolyline(leg.legGeometry.points);

  const intermediateStops: TransitStopInfo[] | undefined = leg.stopCalls
    ?.map((sc) => sc.stopLocation)
    .filter((loc): loc is NonNullable<typeof loc> => loc != null)
    .filter((loc) => loc.gtfsId != null)
    .map((loc) => ({
      name: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      stopId: loc.gtfsId!,
    }));

  return {
    mode: leg.mode as LegMode,
    from: otpPlaceToLegPlace(leg.from),
    to: otpPlaceToLegPlace(leg.to),
    distance: leg.distance,
    duration: leg.duration,
    startTime: new Date(leg.start.scheduledTime).getTime(),
    endTime: new Date(leg.end.scheduledTime).getTime(),
    geometry: { type: "LineString", coordinates: coords },
    routeShortName: leg.route?.shortName,
    routeLongName: leg.route?.longName,
    routeColor: leg.route?.color ? `#${leg.route.color}` : undefined,
    headsign: leg.headsign ?? undefined,
    intermediateStops: intermediateStops?.length ? intermediateStops : undefined,
    transitStopCount: intermediateStops?.length
      ? intermediateStops.length + 1
      : undefined,
    realTime: leg.realTime ?? false,
  };
}

function buildCandidate(
  itin: OTPItinerary,
  type: RouteCandidate["type"],
  overrideLegs?: RouteLeg[]
): RouteCandidate {
  const legs = overrideLegs ?? itin.legs.map(otpLegToRouteLeg);

  const bikeLegs    = legs.filter((l) => l.mode === "BICYCLE");
  const transitLegs = legs.filter((l) =>
    (["SUBWAY", "BUS", "TRAM", "RAIL"] as LegMode[]).includes(l.mode)
  );
  const walkLegs = legs.filter((l) => l.mode === "WALK");

  const bikeDistance    = bikeLegs.reduce((s, l) => s + l.distance, 0);
  const transitDistance = transitLegs.reduce((s, l) => s + l.distance, 0);
  const walkDistance    = walkLegs.reduce((s, l) => s + l.distance, 0);
  const totalDistance   = bikeDistance + transitDistance + walkDistance;

  const bikeDuration    = bikeLegs.reduce((s, l) => s + l.duration, 0);
  const transitDuration = transitLegs.reduce((s, l) => s + l.duration, 0);
  const walkDuration    = walkLegs.reduce((s, l) => s + l.duration, 0);
  const waitDuration    = itin.waitingTime ?? 0;
  const totalTime       = bikeDuration + transitDuration + walkDuration + waitDuration;

  const bikePercentage =
    totalDistance > 0 ? (bikeDistance / totalDistance) * 100 : 100;

  const firstTransitLeg = transitLegs[0];
  const lastTransitLeg  = transitLegs[transitLegs.length - 1];

  return {
    id: uid(),
    type,
    legs,
    totalTime,
    totalDistance,
    bikeDistance,
    bikePercentage,
    walkDistance,
    transitDistance,
    bikeDuration,
    transitDuration,
    walkDuration,
    waitDuration,
    transfers: itin.numberOfTransfers,
    elevationGain: itin.elevationGained,
    elevationLoss: itin.elevationLost,
    departureTime: new Date(itin.start).getTime(),
    arrivalTime:   new Date(itin.start).getTime() + totalTime * 1000,
    originStation:      firstTransitLeg?.from,
    destinationStation: lastTransitLeg?.to,
    metroLine: firstTransitLeg?.routeShortName,
  };
}

/**
 * Synthesize a bike+transit candidate from a walk+transit itinerary.
 * Walk legs are replaced with bike legs at ~3× the speed, shortening total time.
 */
function synthesizeBikeTransit(
  itin: OTPItinerary,
  type: RouteCandidate["type"]
): RouteCandidate {
  const bikeLegs: RouteLeg[] = itin.legs.map((leg) => {
    const base = otpLegToRouteLeg(leg);
    if (leg.transitLeg || leg.mode !== "WALK") return base;
    const bikeDuration = Math.round(base.duration / BIKE_WALK_RATIO);
    return {
      ...base,
      mode: "BICYCLE" as LegMode,
      duration: bikeDuration,
      endTime: base.startTime + bikeDuration * 1000,
    };
  });

  return buildCandidate(itin, type, bikeLegs);
}

// ─── Discard rules ────────────────────────────────────────────────────────────

const MIN_METRO_STOPS = 1;
const MIN_BUS_STOPS   = 4;

function shouldDiscard(candidate: RouteCandidate): boolean {
  if (candidate.type === "bike-only") return false;

  for (const leg of candidate.legs) {
    if (
      leg.mode === "SUBWAY" ||
      leg.mode === "RAIL" ||
      leg.mode === "TRAM"
    ) {
      if ((leg.transitStopCount ?? 0) <= MIN_METRO_STOPS) return true;
    }
    if (leg.mode === "BUS") {
      if ((leg.transitStopCount ?? 0) < MIN_BUS_STOPS) return true;
    }
  }
  return false;
}

// ─── Station-sweep helpers ────────────────────────────────────────────────────

/** Linear interpolation between two lat/lon points */
function interpolateCoord(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  fraction: number
): { lat: number; lon: number } {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lon: from.lon + (to.lon - from.lon) * fraction,
  };
}

/**
 * Lateral offsets (degrees) applied perpendicular to the travel direction at
 * each sweep fraction. Three scales per side covers a corridor roughly
 * 0–2.7 km either side of the straight line — wide enough to reach stations
 * like Gallery Place, Mount Vernon Square, or Shaw-Howard that sit well east
 * of a Foggy Bottom → Columbia Heights straight line.
 */
const LATERAL_OFFSETS_DEG = [0, 0.009, 0.018, 0.027, -0.009, -0.018, -0.027];

function sweepGrid(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): { lat: number; lon: number }[] {
  const dlat = to.lat - from.lat;
  const dlon = to.lon - from.lon;
  const len = Math.sqrt(dlat * dlat + dlon * dlon);
  // Perpendicular unit vector (rotated 90° clockwise = right side of travel)
  const perpLat = len > 0 ? -dlon / len : 0;
  const perpLon = len > 0 ?  dlat / len : 0;

  const points: { lat: number; lon: number }[] = [];
  for (const f of SWEEP_FRACTIONS) {
    const mid = interpolateCoord(from, to, f);
    for (const offset of LATERAL_OFFSETS_DEG) {
      points.push({
        lat: mid.lat + perpLat * offset,
        lon: mid.lon + perpLon * offset,
      });
    }
  }
  return points;
}

/**
 * Build a candidate where the rider bikes from their real origin to the point
 * where an intermediate OTP transit itinerary starts, then takes that transit.
 * This produces "bike further to a mid-route station" options — the key
 * mechanism that lets the slider surface higher bike-percentage alternatives.
 */
function buildSweptCandidate(
  itin: OTPItinerary,
  origin: { lat: number; lon: number; name: string },
  type: RouteCandidate["type"]
): RouteCandidate | null {
  const hasTransit = itin.legs.some((l) => l.transitLeg);
  if (!hasTransit) return null;

  // Synthesize: replace walk legs with bike legs (same as synthesizeBikeTransit)
  const synthesizedLegs: RouteLeg[] = itin.legs.map((leg) => {
    const base = otpLegToRouteLeg(leg);
    if (leg.transitLeg || leg.mode !== "WALK") return base;
    const bikeDuration = Math.round(base.duration / BIKE_WALK_RATIO);
    return {
      ...base,
      mode: "BICYCLE" as LegMode,
      duration: bikeDuration,
      endTime: base.startTime + bikeDuration * 1000,
    };
  });

  const firstLeg = synthesizedLegs[0];
  if (!firstLeg) return null;

  // Straight-line distance from real origin to the OTP query start point
  const bikeDistToStart = haversineDistance(
    origin.lat, origin.lon,
    firstLeg.from.lat, firstLeg.from.lon
  );
  const bikeDurToStart = Math.round(bikeDistToStart / BIKE_MS);

  // Synthetic prefix bike leg: real origin → intermediate point
  const prefixLeg: RouteLeg = {
    mode: "BICYCLE",
    from: { name: origin.name, lat: origin.lat, lon: origin.lon },
    to: firstLeg.from,
    distance: bikeDistToStart,
    duration: bikeDurToStart,
    startTime: firstLeg.startTime - bikeDurToStart * 1000,
    endTime: firstLeg.startTime,
    geometry: {
      type: "LineString",
      coordinates: [
        [origin.lon, origin.lat],
        [firstLeg.from.lon, firstLeg.from.lat],
      ],
    },
  };

  const c = buildCandidate(itin, type, [prefixLeg, ...synthesizedLegs]);

  // buildCandidate uses itin.start for departureTime, which is the OTP intermediate
  // query start — not the actual departure from the real origin. Fix both timestamps.
  const actualDepartureMs = prefixLeg.startTime;
  return { ...c, departureTime: actualDepartureMs, arrivalTime: actualDepartureMs + c.totalTime * 1000 };
}

/** Key for deduplicating candidates by their first transit boarding stop */
function boardingStopKey(c: RouteCandidate): string {
  const firstTransit = c.legs.find(
    (l) => l.mode === "SUBWAY" || l.mode === "BUS" || l.mode === "RAIL" || l.mode === "TRAM"
  );
  return firstTransit?.from.stopId ?? firstTransit?.from.name ?? "unknown";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RoutingOptions {
  allowBus: boolean;
  departureTime?: number;
}

/**
 * Fractions along the origin→destination straight line at which to issue
 * additional transit queries. Each gives OTP a head-start closer to the
 * destination, so it naturally picks a different (further) boarding station —
 * generating the "bike further, fewer Metro stops" candidates the slider needs.
 *
 * Using a dense sweep (every ~10%) so that intermediate stations are reliably
 * hit even when the straight line doesn't pass directly through them.
 */
const SWEEP_FRACTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

export async function fetchCandidates(
  search: JourneySearch
): Promise<RouteCandidate[]> {
  const { origin, destination, departureTime, allowBus } = search;
  const dt = toOffsetDateTime(departureTime);

  const transitModes = [{ mode: "SUBWAY" }];
  if (allowBus) transitModes.push({ mode: "BUS" });

  const transitQueryVars = (fromLat: number, fromLon: number, first: number) => ({
    fromLat,
    fromLon,
    toLat:    destination.lat,
    toLon:    destination.lon,
    dateTime: { earliestDeparture: dt },
    first,
    modes: {
      transit: {
        access:   ["WALK"],
        egress:   ["WALK"],
        transfer: ["WALK"],
        transit:  transitModes,
      },
    },
  });

  const sweepPoints = sweepGrid(origin, destination);

  const [bikeResult, transitResult, ...sweepResults] = await Promise.all([
    // 1. Pure bike
    queryPlanConnection({
      fromLat: origin.lat,
      fromLon: origin.lon,
      toLat:   destination.lat,
      toLon:   destination.lon,
      dateTime: { earliestDeparture: dt },
      first: 1,
      modes: { direct: ["BICYCLE"] },
    }),
    // 2. Walk+transit from origin (synthesized into bike+transit)
    queryPlanConnection(transitQueryVars(origin.lat, origin.lon, 10)),
    // 3. Station sweep: transit from intermediate points along the route
    ...sweepPoints.map((pt) => queryPlanConnection(transitQueryVars(pt.lat, pt.lon, 3))),
  ]);

  const candidates: RouteCandidate[] = [];
  const seenBoardingStops = new Set<string>();

  // Bike-only candidate
  const bikeItin = bikeResult?.edges[0]?.node;
  if (bikeItin) {
    candidates.push(buildCandidate(bikeItin, "bike-only"));
  }

  // Synthesized bike+transit candidates from origin
  if (transitResult?.edges.length) {
    for (const { node: itin } of transitResult.edges) {
      if (!itin.legs.some((l) => l.transitLeg)) continue;

      const type: RouteCandidate["type"] =
        allowBus && itin.legs.some((l) => l.mode === "BUS")
          ? "bike-bus-bike"
          : "bike-metro-bike";

      const c = synthesizeBikeTransit(itin, type);
      if (shouldDiscard(c)) continue;

      const key = boardingStopKey(c);
      seenBoardingStops.add(key);
      candidates.push(c);
    }
  }

  // Station-sweep candidates: bike from real origin to a further boarding station
  for (const result of sweepResults) {
    if (!result?.edges.length) continue;
    for (const { node: itin } of result.edges) {
      if (!itin.legs.some((l) => l.transitLeg)) continue;

      const type: RouteCandidate["type"] =
        allowBus && itin.legs.some((l) => l.mode === "BUS")
          ? "bike-bus-bike"
          : "bike-metro-bike";

      const c = buildSweptCandidate(itin, origin, type);
      if (!c || shouldDiscard(c)) continue;

      // Skip if another candidate already boards at the same stop
      const key = boardingStopKey(c);
      if (seenBoardingStops.has(key)) continue;
      seenBoardingStops.add(key);
      candidates.push(c);
    }
  }

  return candidates;
}
