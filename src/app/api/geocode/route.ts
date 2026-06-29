/**
 * GET /api/geocode?q=<query>
 *
 * Proxies requests to Photon geocoding service.
 * This avoids CORS issues when using a self-hosted Photon instance.
 */
import { NextRequest, NextResponse } from "next/server";
import { geocodeAutocomplete } from "@/services/GeocodingService";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  const results = await geocodeAutocomplete(q);
  return NextResponse.json(results);
}
