import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RouteCandidate, JourneySearch } from "@/types";

// fetchCandidates hits OTP over the network; stub it so computeJourney runs offline.
vi.mock("@/services/RoutingService", () => ({
  fetchCandidates: vi.fn(),
}));

import { fetchCandidates } from "@/services/RoutingService";
import {
  computeJourney,
  hasLowRouteVariety,
  MIN_BIKE_SPREAD_FOR_VARIETY,
} from "@/services/JourneyCalculator";

const mockFetch = vi.mocked(fetchCandidates);

/** Build a RouteCandidate fixture; only the fields the logic reads matter. */
function candidate(
  partial: Partial<RouteCandidate> & { bikePercentage: number }
): RouteCandidate {
  return {
    id: "c",
    type: "bike-metro-bike",
    legs: [],
    totalTime: 1200,
    totalDistance: 5000,
    bikeDistance: 1000,
    walkDistance: 0,
    transitDistance: 4000,
    bikeDuration: 300,
    transitDuration: 600,
    walkDuration: 0,
    waitDuration: 0,
    transfers: 0,
    departureTime: 0,
    arrivalTime: 0,
    ...partial,
  } as RouteCandidate;
}

function search(allowBus: boolean): JourneySearch {
  return {
    origin: { name: "A", lat: 38.9, lon: -77.0 },
    destination: { name: "B", lat: 38.92, lon: -77.03 },
    bikePreference: 50,
    allowBus,
    allowBikeshare: false,
  };
}

describe("hasLowRouteVariety", () => {
  it("treats an empty set as not low-variety (nothing to show)", () => {
    expect(hasLowRouteVariety([])).toBe(false);
  });

  it("treats a single candidate as low-variety (slider has no choice)", () => {
    expect(hasLowRouteVariety([candidate({ bikePercentage: 50 })])).toBe(true);
  });

  it("flags clustered candidates as low-variety", () => {
    expect(
      hasLowRouteVariety([
        candidate({ bikePercentage: 40 }),
        candidate({ bikePercentage: 50 }),
      ])
    ).toBe(true);
  });

  it("does not flag widely-spread candidates", () => {
    expect(
      hasLowRouteVariety([
        candidate({ bikePercentage: 10 }),
        candidate({ bikePercentage: 90 }),
      ])
    ).toBe(false);
  });

  it("does not flag a spread sitting exactly at the threshold", () => {
    expect(
      hasLowRouteVariety([
        candidate({ bikePercentage: 20 }),
        candidate({ bikePercentage: 20 + MIN_BIKE_SPREAD_FOR_VARIETY }),
      ])
    ).toBe(false);
  });
});

describe("computeJourney busNudge", () => {
  beforeEach(() => mockFetch.mockReset());

  it("nudges when slider routes lack variety and bus is off", async () => {
    mockFetch.mockResolvedValue([
      candidate({ id: "a", type: "bike-metro-bike", bikePercentage: 40 }),
      candidate({ id: "b", type: "bike-metro-bike", bikePercentage: 50 }),
    ]);
    const result = await computeJourney(search(false));
    expect(result.busNudge).toBe(true);
    expect(result.fallbackReason).toBeUndefined();
  });

  it("does not nudge when candidates are genuinely varied", async () => {
    mockFetch.mockResolvedValue([
      candidate({ id: "a", type: "bike-metro-bike", bikePercentage: 10 }),
      candidate({ id: "b", type: "bike-only", bikePercentage: 100 }),
    ]);
    const result = await computeJourney(search(false));
    expect(result.busNudge).toBeUndefined();
  });

  it("does not nudge for low variety when bus is already on", async () => {
    mockFetch.mockResolvedValue([
      candidate({ id: "a", type: "bike-bus-bike", bikePercentage: 40 }),
      candidate({ id: "b", type: "bike-bus-bike", bikePercentage: 50 }),
    ]);
    const result = await computeJourney(search(true));
    expect(result.busNudge).toBeUndefined();
  });

  it("still nudges in the no-transit fallback case (bus off)", async () => {
    mockFetch.mockResolvedValue([
      candidate({ id: "a", type: "bike-only", bikePercentage: 100 }),
    ]);
    const result = await computeJourney(search(false));
    expect(result.busNudge).toBe(true);
    expect(result.fallbackReason).toBeDefined();
  });
});
