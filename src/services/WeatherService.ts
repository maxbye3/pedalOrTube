/**
 * WeatherService
 *
 * Fetches current weather from the National Weather Service (NWS) API.
 * Completely free, no API key required.
 */
import type { WeatherConditions, WeatherWarning } from "@/types";

const NWS_BASE = "https://api.weather.gov";

/** Get the NWS gridpoint for a lat/lon */
async function getGridpoint(lat: number, lon: number) {
  const url = `${NWS_BASE}/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "metro-bike-dc/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.properties?.forecastHourly as string | undefined;
}

interface NWSPeriod {
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
  isDaytime: boolean;
}

function analyzeConditions(period: NWSPeriod): WeatherWarning[] {
  const warnings: WeatherWarning[] = [];
  const desc = period.shortForecast.toLowerCase();
  const windMph = parseFloat(period.windSpeed) || 0;
  const temp = period.temperature;

  if (desc.includes("rain") || desc.includes("shower")) {
    warnings.push({
      type: "rain",
      message: "Rain expected during cycling section. Consider waterproofs.",
      severity: desc.includes("heavy") ? "warning" : "info",
    });
  }
  if (desc.includes("snow") || desc.includes("flurr")) {
    warnings.push({
      type: "snow",
      message: "Snow conditions — roads and paths may be slippery.",
      severity: "danger",
    });
  }
  if (desc.includes("ice") || desc.includes("freez")) {
    warnings.push({
      type: "ice",
      message: "Ice possible. Extreme caution on bike paths.",
      severity: "danger",
    });
  }
  if (windMph >= 20) {
    warnings.push({
      type: "wind",
      message: `Strong ${period.windDirection} winds (${windMph} mph) expected.`,
      severity: windMph >= 30 ? "warning" : "info",
    });
  }
  if (temp >= 95) {
    warnings.push({
      type: "heat",
      message: `Extreme heat (${temp}°F). Stay hydrated and consider Metro instead.`,
      severity: "warning",
    });
  }
  if (desc.includes("fog") || desc.includes("mist")) {
    warnings.push({
      type: "fog",
      message: "Low visibility. Use lights and be extra cautious.",
      severity: "info",
    });
  }

  return warnings;
}

export async function getWeather(
  lat: number,
  lon: number
): Promise<WeatherConditions | null> {
  try {
    const forecastUrl = await getGridpoint(lat, lon);
    if (!forecastUrl) return null;

    const res = await fetch(forecastUrl, {
      headers: { "User-Agent": "metro-bike-dc/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const periods: NWSPeriod[] = data.properties?.periods;
    if (!periods?.length) return null;

    const current = periods[0];
    const windMph = parseFloat(current.windSpeed) || 0;

    // Parse wind direction to degrees (rough)
    const windDirMap: Record<string, number> = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
      E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
      W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    };
    const windDir = windDirMap[current.windDirection] ?? 0;

    return {
      temperature: current.temperature,
      windSpeed: windMph,
      windDirection: windDir,
      precipitation: 0,
      conditions: current.shortForecast,
      warnings: analyzeConditions(current),
    };
  } catch {
    return null;
  }
}
