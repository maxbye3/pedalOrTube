/**
 * GET /api/bikeshare?lat=<lat>&lon=<lon>&radius=<meters>
 */
import { NextRequest, NextResponse } from "next/server";
import { getNearbyStations } from "@/services/BikeShareService";

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");
  const radius = parseInt(req.nextUrl.searchParams.get("radius") ?? "500");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const stations = await getNearbyStations(lat, lon, radius);
  return NextResponse.json(stations);
}
