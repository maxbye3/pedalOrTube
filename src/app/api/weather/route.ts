/**
 * GET /api/weather?lat=<lat>&lon=<lon>
 */
import { NextRequest, NextResponse } from "next/server";
import { getWeather } from "@/services/WeatherService";

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const weather = await getWeather(lat, lon);
  if (!weather) {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 503 });
  }

  return NextResponse.json(weather);
}
