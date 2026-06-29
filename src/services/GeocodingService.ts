/**
 * GeocodingService
 *
 * Uses Photon (self-hosted or Komoot's public instance) for geocoding and
 * autocomplete, filtered to the Washington DC area.
 */
import type { GeocodingResult } from "@/types";

const PHOTON_BASE =
  process.env.NEXT_PUBLIC_PHOTON_URL ?? "https://photon.komoot.io";

// DC bounding box for biasing results
const DC_BBOX = "-77.1198,38.7916,-76.9093,38.9958";

export interface PhotonFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    type?: string;
    osm_type?: string;
    osm_id?: number;
  };
}

function photonToResult(f: PhotonFeature): GeocodingResult {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;

  const nameParts: string[] = [];
  if (p.name) nameParts.push(p.name);
  else if (p.housenumber && p.street)
    nameParts.push(`${p.housenumber} ${p.street}`);
  else if (p.street) nameParts.push(p.street);

  const addrParts: string[] = [];
  if (p.housenumber && p.street && p.name)
    addrParts.push(`${p.housenumber} ${p.street}`);
  if (p.city) addrParts.push(p.city);

  return {
    name: nameParts.join(", ") || p.city || "Unknown",
    address: addrParts.join(", ") || "",
    lat,
    lon,
    type: p.osm_type === "way" ? "street" : p.name ? "poi" : "street",
  };
}

export async function geocodeAutocomplete(
  query: string,
  signal?: AbortSignal
): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 2) return [];

  const url = new URL(`${PHOTON_BASE}/api`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("bbox", DC_BBOX);
  url.searchParams.set("lang", "en");

  try {
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return [];
    const data: { features: PhotonFeature[] } = await res.json();
    return data.features.map(photonToResult);
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<GeocodingResult | null> {
  const url = new URL(`${PHOTON_BASE}/reverse`);
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lon.toString());

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data: { features: PhotonFeature[] } = await res.json();
    if (!data.features.length) return null;
    return photonToResult(data.features[0]);
  } catch {
    return null;
  }
}
