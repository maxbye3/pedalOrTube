import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RouteCandidate, JourneySearch } from "@/types";

// fetchCandidates hits OTP over the network; stub it so computeJourney runs offline.
vi.mock("@/services/RoutingService", () => ({
  fetchCandidates: vi.fn(),
}));
vi.mock("@/services/ElevationService", () => ({
  getElevationProfile: vi.fn(),
}));

import { fetchCandidates } from "@/services/RoutingService";
import { getElevationProfile } from "@/services/ElevationService";
import {
  computeJourney,
  hasLowRouteVariety,
  MIN_BIKE_SPREAD_FOR_VARIETY,
} from "@/services/JourneyCalculator";

const mockFetch = vi.mocked(fetchCandidates);
const mockElevation = vi.mocked(getElevationProfile);

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
  beforeEach(() => {
    mockFetch.mockReset();
    mockElevation.mockReset();
    mockElevation.mockResolvedValue(null);
  });

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

  it("attaches hill data to the selected bike route", async () => {
    mockFetch.mockResolvedValue([
      candidate({
        id: "a",
        type: "bike-only",
        bikePercentage: 100,
        legs: [
          {
            mode: "BICYCLE",
            from: { name: "Dupont Circle", lat: 38.9096, lon: -77.0434 },
            to: { name: "National Zoo", lat: 38.9296, lon: -77.0498 },
            distance: 2400,
            duration: 600,
            startTime: 0,
            endTime: 600000,
            geometry: {
              type: "LineString",
              coordinates: [
                [-77.0434, 38.9096],
                [-77.0498, 38.9296],
              ],
            },
          },
        ],
      }),
    ]);
    mockElevation.mockResolvedValue({
      points: [],
      totalAscent: 28,
      totalDescent: 3,
      maxGradient: 7,
      steepSegments: [{ startDist: 300, endDist: 700, gradient: 7 }],
      hillSegments: [
        {
          startDist: 300,
          endDist: 700,
          gradient: 7,
          distance: 400,
          elevationGain: 28,
          geometry: {
            type: "LineString",
            coordinates: [
              [-77.045, 38.914],
              [-77.047, 38.918],
            ],
          },
        },
      ],
    });

    const result = await computeJourney({ ...search(false), bikePreference: 100 });

    expect(result.selected?.elevationGain).toBe(28);
    expect(result.selected?.legs[0].hillSegments).toHaveLength(1);
    expect(result.candidates[0].legs[0].hillSegments).toHaveLength(1);
  });
});
