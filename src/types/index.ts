import type { LineString, Feature } from "geojson";
export type { LineString, Feature };

// ─── Coordinates & Locations ─────────────────────────────────────────────────

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Place extends LatLon {
  name: string;
  address?: string;
  type?: "saved" | "history" | "geocode";
  savedIcon?: "home" | "work" | "gym" | "friends" | "star";
}

// ─── DC Boundary ──────────────────────────────────────────────────────────────

/** Rough bounding box for Washington DC */
export const DC_BOUNDS = {
  north: 38.9958,
  south: 38.7916,
  east: -76.9093,
  west: -77.1198,
} as const;

/** Returns true if the coordinate is within Washington DC bounds */
export function isInDC(lat: number, lon: number): boolean {
  return (
    lat >= DC_BOUNDS.south &&
    lat <= DC_BOUNDS.north &&
    lon >= DC_BOUNDS.west &&
    lon <= DC_BOUNDS.east
  );
}

// ─── Transit ──────────────────────────────────────────────────────────────────

export type TransitMode = "SUBWAY" | "BUS" | "TRAM" | "RAIL";

export interface MetroStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: string[];
}

// WMATA Metro line colors
export const METRO_LINE_COLORS: Record<string, string> = {
  RD: "#BF0D3E",
  OR: "#ED8B00",
  SV: "#919D9D",
  BL: "#003688",
  YL: "#FFD100",
  GR: "#00B140",
};

// ─── Routing ──────────────────────────────────────────────────────────────────

export type LegMode = "BICYCLE" | "SUBWAY" | "BUS" | "WALK" | "TRAM" | "RAIL";

export interface LegPlace {
  name: string;
  lat: number;
  lon: number;
  stopId?: string;
  stopCode?: string;
}

export interface TransitStopInfo {
  name: string;
  lat: number;
  lon: number;
  stopId: string;
}

export interface RouteLeg {
  mode: LegMode;
  from: LegPlace;
  to: LegPlace;
  distance: number; // meters
  duration: number; // seconds
  startTime: number; // Unix ms
  endTime: number;
  geometry: LineString;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  headsign?: string;
  intermediateStops?: TransitStopInfo[];
  transitStopCount?: number; // number of stops boarded/alighted
  realTime?: boolean;
}

export interface RouteCandidate {
  id: string;
  type: "bike-only" | "bike-metro-bike" | "bike-bus-bike";
  legs: RouteLeg[];
  totalTime: number; // seconds
  totalDistance: number; // meters
  bikeDistance: number; // meters
  bikePercentage: number; // 0–100
  walkDistance: number; // meters
  transitDistance: number; // meters
  bikeDuration: number; // seconds
  transitDuration: number; // seconds
  walkDuration: number; // seconds
  waitDuration: number; // seconds
  transfers: number;
  elevationGain?: number; // meters
  elevationLoss?: number; // meters
  bikeLaneScore?: number; // 0–100
  bikeLaneBreakdown?: BikeLaneBreakdown;
  highRiskIntersections?: number;
  calories?: number;
  co2Saved?: number; // grams vs driving
  departureTime: number; // Unix ms
  arrivalTime: number; // Unix ms
  originStation?: LegPlace;
  destinationStation?: LegPlace;
  metroLine?: string;
}

export interface BikeLaneBreakdown {
  protectedPct: number;
  bikeLanePct: number;
  sharedRoadPct: number;
  noInfraPct: number;
}

// ─── Journey / Search ─────────────────────────────────────────────────────────

export interface JourneySearch {
  origin: Place;
  destination: Place;
  departureTime?: number; // Unix ms, defaults to now
  bikePreference: number; // 0–100
  allowBus: boolean;
  allowBikeshare: boolean;
}

export interface JourneyResult {
  search: JourneySearch;
  candidates: RouteCandidate[];
  selected: RouteCandidate | null;
  fallbackReason?: string; // shown when every transit candidate was discarded
  busNudge?: boolean; // suggest enabling bus (OFF) when transit fell back OR slider routes lack variety
  generatedAt: number; // Unix ms
}

// ─── Elevation ────────────────────────────────────────────────────────────────

export interface ElevationPoint {
  distance: number; // meters along route
  elevation: number; // meters ASL
}

export interface ElevationProfile {
  points: ElevationPoint[];
  totalAscent: number; // meters
  totalDescent: number; // meters
  maxGradient: number; // % grade
  steepSegments: SteepSegment[];
}

export interface SteepSegment {
  startDist: number;
  endDist: number;
  gradient: number; // %
}

// ─── Weather ──────────────────────────────────────────────────────────────────

export type WeatherWarningType =
  | "rain"
  | "snow"
  | "wind"
  | "heat"
  | "ice"
  | "fog";

export interface WeatherWarning {
  type: WeatherWarningType;
  message: string;
  severity: "info" | "warning" | "danger";
}

export interface WeatherConditions {
  temperature: number; // °F
  windSpeed: number; // mph
  windDirection: number; // degrees
  precipitation: number; // in/hr
  conditions: string;
  warnings: WeatherWarning[];
}

// ─── Capital Bikeshare ────────────────────────────────────────────────────────

export interface BikeShareStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  bikesAvailable: number;
  eBikesAvailable: number;
  docksAvailable: number;
  capacity: number;
  isRenting: boolean;
  isReturning: boolean;
  distance?: number; // meters from search point
}

// ─── Saved Locations ──────────────────────────────────────────────────────────

export interface SavedLocation {
  id: string;
  label: string;
  icon: "home" | "work" | "gym" | "friends" | "star";
  place: Place;
  createdAt: number;
}

// ─── Ride History ─────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  origin: Place;
  destination: Place;
  date: number; // Unix ms
  bikePreference: number;
  journeyTime: number; // seconds
  routeType: RouteCandidate["type"];
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  units: "imperial" | "metric";
  darkMode: boolean;
  defaultBikePreference: number; // 0–100
  defaultAllowBus: boolean;
  defaultAllowBikeshare: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  units: "imperial",
  darkMode: false,
  defaultBikePreference: 50,
  defaultAllowBus: false,
  defaultAllowBikeshare: false,
};

// ─── OTP API types (planConnection) ──────────────────────────────────────────

export interface OTPPlanConnection {
  edges: { node: OTPItinerary }[];
  routingErrors?: { code: string; description: string }[];
}

export interface OTPItinerary {
  duration: number; // seconds
  start: string; // OffsetDateTime ISO string
  end: string;   // OffsetDateTime ISO string
  walkTime: number;
  waitingTime: number;
  walkDistance: number;
  numberOfTransfers: number;
  elevationGained: number;
  elevationLost: number;
  legs: OTPLeg[];
}

export interface OTPLeg {
  mode: string;
  start: { scheduledTime: string }; // OffsetDateTime ISO string
  end: { scheduledTime: string };
  distance: number;
  duration: number;
  from: OTPPlace;
  to: OTPPlace;
  legGeometry: { points: string; length: number };
  route?: OTPRoute;
  transitLeg: boolean;
  stopCalls?: OTPStopCall[];
  realTime?: boolean;
  headsign?: string;
}

export interface OTPPlace {
  name: string;
  lat: number;
  lon: number;
  stop?: { gtfsId?: string; code?: string };
}

export interface OTPRoute {
  shortName: string;
  longName: string;
  color?: string;
  mode?: string;
}

export interface OTPStopCall {
  stopLocation: OTPStopCallLocation | null;
}

export interface OTPStopCallLocation {
  name: string;
  lat: number;
  lon: number;
  gtfsId?: string; // only present on Stop, not Location/LocationGroup
}

/** @deprecated kept for internal mapping only */
export interface OTPStop {
  name: string;
  lat: number;
  lon: number;
  stopId: string;
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

export interface GeocodingResult {
  name: string;
  address: string;
  lat: number;
  lon: number;
  type: "place" | "street" | "poi";
}
