"use client";

import { useEffect, useState } from "react";
import { Cloud, Sun, Wind, Droplets, Snowflake, AlertTriangle } from "lucide-react";
import type { WeatherConditions, WeatherWarningType } from "@/types";

const WARNING_ICONS: Record<WeatherWarningType, React.ComponentType<{ size?: number; className?: string }>> = {
  rain: Droplets,
  snow: Snowflake,
  wind: Wind,
  heat: Sun,
  ice: Snowflake,
  fog: Cloud,
};

interface WeatherWidgetProps {
  lat: number;
  lon: number;
}

export function WeatherWidget({ lat, lon }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherConditions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/weather?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setWeather(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lat, lon]);

  if (loading || !weather) return null;

  const hasWarnings = weather.warnings.length > 0;
  const topWarning = weather.warnings[0];

  if (!hasWarnings) return null;

  const Icon = topWarning ? WARNING_ICONS[topWarning.type] : AlertTriangle;

  const severityStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    danger: "bg-red-50 border-red-200 text-red-800",
  };

  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border text-xs ${
        severityStyles[topWarning?.severity ?? "info"]
      }`}
    >
      <Icon size={13} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">{topWarning?.message}</p>
        {weather.warnings.length > 1 && (
          <p className="mt-0.5 opacity-70">
            +{weather.warnings.length - 1} more weather alert
            {weather.warnings.length > 2 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
