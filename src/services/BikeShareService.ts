/**
 * BikeShareService
 *
 * Fetches Capital Bikeshare station data from their free GBFS feed.
 */
import type { BikeShareStation } from "@/types";
import { haversineDistance } from "@/lib/utils";

const GBFS_BASE = "https://gbfs.capitalbikeshare.com/gbfs";

interface GBFSStationInfo {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
}

interface GBFSStationStatus {
  station_id: string;
  num_bikes_available: number;
  num_ebikes_available?: number;
  num_docks_available: number;
  is_renting: number;
  is_returning: number;
}

let stationInfoCache: GBFSStationInfo[] | null = null;
let stationInfoFetchedAt = 0;
const INFO_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getStationInfo(): Promise<GBFSStationInfo[]> {
  const now = Date.now();
  if (stationInfoCache && now - stationInfoFetchedAt < INFO_CACHE_TTL) {
    return stationInfoCache;
  }
  try {
    const res = await fetch(`${GBFS_BASE}/en/station_information.json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    stationInfoCache = data.data?.stations ?? [];
    stationInfoFetchedAt = now;
    return stationInfoCache ?? [];
  } catch {
    return stationInfoCache ?? [];
  }
}

async function getStationStatus(): Promise<Map<string, GBFSStationStatus>> {
  const map = new Map<string, GBFSStationStatus>();
  try {
    const res = await fetch(`${GBFS_BASE}/en/station_status.json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return map;
    const data = await res.json();
    const statuses: GBFSStationStatus[] = data.data?.stations ?? [];
    for (const s of statuses) map.set(s.station_id, s);
  } catch {
    /* return empty */
  }
  return map;
}

/** Find the nearest bikeshare stations within `radiusMeters` of a point */
export async function getNearbyStations(
  lat: number,
  lon: number,
  radiusMeters = 500,
  limit = 3
): Promise<BikeShareStation[]> {
  const [infos, statuses] = await Promise.all([
    getStationInfo(),
    getStationStatus(),
  ]);

  return infos
    .map((info) => {
      const dist = haversineDistance(lat, lon, info.lat, info.lon);
      const status = statuses.get(info.station_id);
      return {
        id: info.station_id,
        name: info.name,
        lat: info.lat,
        lon: info.lon,
        bikesAvailable: status?.num_bikes_available ?? 0,
        eBikesAvailable: status?.num_ebikes_available ?? 0,
        docksAvailable: status?.num_docks_available ?? 0,
        capacity: info.capacity,
        isRenting: !!status?.is_renting,
        isReturning: !!status?.is_returning,
        distance: dist,
      };
    })
    .filter((s) => (s.distance ?? Infinity) <= radiusMeters)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    .slice(0, limit);
}
