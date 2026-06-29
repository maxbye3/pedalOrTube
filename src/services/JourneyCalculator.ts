/**
 * JourneyCalculator
 *
 * Applies the Bike Preference Slider to rank a fixed candidate list.
 * All ranking is client-side — zero network calls after initial search.
 *
 * Slider semantics:
 *   0%   → maximize Metro (prefer lowest bikePercentage)
 *   50%  → balanced (closest to 50% bike)
 *   100% → bike entire journey (prefer highest bikePercentage)
 *
 * The selected candidate is the one whose bikePercentage is closest
 * to the slider value. Ties broken by total time.
 */
import type { RouteCandidate, JourneyResult, JourneySearch } from "@/types";
import { fetchCandidates } from "@/services/RoutingService";
import { estimateCalories, estimateCO2Saved } from "@/lib/utils";

/** Rank candidates by how close their bikePercentage is to the target */
export function rankCandidates(
  candidates: RouteCandidate[],
  sliderValue: number
): RouteCandidate[] {
  return [...candidates].sort((a, b) => {
    const aDiff = Math.abs(a.bikePercentage - sliderValue);
    const bDiff = Math.abs(b.bikePercentage - sliderValue);
    if (Math.abs(aDiff - bDiff) < 0.5) return a.totalTime - b.totalTime;
    return aDiff - bDiff;
  });
}

/**
 * Minimum spread of bikePercentage (max - min across candidates) for the Bike
 * Preference Slider to produce meaningfully different routes. Below this, every
 * candidate sits in a narrow band, so dragging the slider barely changes the
 * selected route - a signal that Metrobus might open up more varied options.
 *
 * Product heuristic, intentionally on the conservative side so we bias toward
 * NOT nudging when there are already genuinely varied options (avoids false
 * positives). The captain may tune this single constant later.
 */
export const MIN_BIKE_SPREAD_FOR_VARIETY = 25; // percentage points

/**
 * The slider needs at least this many candidates to be meaningful. With fewer,
 * there is nothing to vary between regardless of bikePercentage spread.
 */
export const MIN_CANDIDATES_FOR_VARIETY = 2;

/**
 * Returns true when the candidate set is too clustered for the Bike Preference
 * Slider to produce varied routes: either too few candidates, or their
 * bikePercentage values all sit within a narrow band ({@link
 * MIN_BIKE_SPREAD_FOR_VARIETY}). An empty set is NOT low-variety - there is
 * nothing to show, so a Metrobus nudge would be pointless.
 */
export function hasLowRouteVariety(candidates: RouteCandidate[]): boolean {
  if (candidates.length === 0) return false;
  if (candidates.length < MIN_CANDIDATES_FOR_VARIETY) return true;
  const pcts = candidates.map((c) => c.bikePercentage);
  const spread = Math.max(...pcts) - Math.min(...pcts);
  return spread < MIN_BIKE_SPREAD_FOR_VARIETY;
}

/** Select the best candidate for a given slider value */
export function selectCandidate(
  candidates: RouteCandidate[],
  sliderValue: number
): RouteCandidate | null {
  if (!candidates.length) return null;
  const ranked = rankCandidates(candidates, sliderValue);
  return ranked[0];
}

/** Add derived display fields to a candidate */
function enrichCandidate(candidate: RouteCandidate): RouteCandidate {
  return {
    ...candidate,
    calories: estimateCalories(candidate.bikeDistance),
    co2Saved: estimateCO2Saved(candidate.totalDistance),
  };
}

/**
 * Run the full journey search. Fetches candidates from OTP, applies
 * discard rules (in RoutingService), and returns the JourneyResult.
 */
export async function computeJourney(
  search: JourneySearch
): Promise<JourneyResult> {
  const rawCandidates = await fetchCandidates(search);
  const candidates = rawCandidates.map(enrichCandidate);

  const transitCandidates = candidates.filter((c) => c.type !== "bike-only");
  const hasBikeOnly = candidates.some((c) => c.type === "bike-only");

  let fallbackReason: string | undefined;
  let busNudge: boolean | undefined;

  if (transitCandidates.length === 0 && hasBikeOnly) {
    fallbackReason =
      "Transit doesn't save meaningful time for this trip - showing the bike route.";
    if (!search.allowBus) {
      busNudge = true;
    }
  } else if (!search.allowBus && hasLowRouteVariety(candidates)) {
    // The slider ranks purely by bikePercentage, so a clustered candidate set
    // makes it nearly inert. With bus off, Metrobus may surface routes in a
    // different bikePercentage band and restore meaningful slider variety.
    busNudge = true;
  }

  const selected = selectCandidate(candidates, search.bikePreference);

  return {
    search,
    candidates,
    selected,
    fallbackReason,
    busNudge,
    generatedAt: Date.now(),
  };
}
