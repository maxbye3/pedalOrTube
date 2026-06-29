"use client";

import {
  Clock,
  Bike,
  Train,
  Footprints,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Zap,
  Leaf,
  AlertTriangle,
  Bus,
} from "lucide-react";
import type { RouteCandidate, RouteLeg } from "@/types";
import {
  formatDuration,
  formatDistance,
  formatTime,
} from "@/lib/utils";
import { METRO_LINE_COLORS } from "@/types";
import { cn } from "@/lib/utils";

// ─── Leg Icon ─────────────────────────────────────────────────────────────────

function LegIcon({ mode, color }: { mode: RouteLeg["mode"]; color?: string }) {
  const baseClass = "w-6 h-6 rounded-full flex items-center justify-center shrink-0";
  switch (mode) {
    case "BICYCLE":
      return (
        <div className={cn(baseClass, "bg-green-100 text-green-600")}>
          <Bike size={13} />
        </div>
      );
    case "SUBWAY":
    case "RAIL":
    case "TRAM":
      return (
        <div
          className={cn(baseClass)}
          style={{
            backgroundColor: color ? `${color}20` : "#003688",
            color: color ?? "#003688",
          }}
        >
          <Train size={12} />
        </div>
      );
    case "BUS":
      return (
        <div className={cn(baseClass, "bg-orange-100 text-orange-600")}>
          <Bus size={12} />
        </div>
      );
    case "WALK":
      return (
        <div className={cn(baseClass, "bg-gray-100 text-gray-500")}>
          <Footprints size={12} />
        </div>
      );
    default:
      return (
        <div className={cn(baseClass, "bg-gray-100 text-gray-500")}>
          <ArrowRight size={12} />
        </div>
      );
  }
}

// ─── Leg Row ─────────────────────────────────────────────────────────────────

function LegRow({ leg }: { leg: RouteLeg }) {
  const metroColor =
    leg.routeShortName ? METRO_LINE_COLORS[leg.routeShortName] : undefined;
  const color = leg.routeColor ?? metroColor;

  return (
    <div className="flex items-center gap-2.5 text-sm">
      <LegIcon mode={leg.mode} color={color} />
      <div className="flex-1 min-w-0">
        {leg.mode === "BICYCLE" && (
          <span className="text-gray-700">
            Bike {formatDistance(leg.distance)} · {formatDuration(leg.duration)}
          </span>
        )}
        {(leg.mode === "SUBWAY" ||
          leg.mode === "RAIL" ||
          leg.mode === "TRAM") && (
          <span>
            <span
              className="font-semibold"
              style={{ color: color ?? "#003688" }}
            >
              {leg.routeShortName ?? "Metro"}
            </span>{" "}
            <span className="text-gray-600">{leg.headsign}</span>
            {leg.transitStopCount && (
              <span className="text-gray-400 text-xs ml-1.5">
                {leg.transitStopCount} stop{leg.transitStopCount !== 1 ? "s" : ""}
              </span>
            )}
          </span>
        )}
        {leg.mode === "BUS" && (
          <span>
            <span className="font-semibold text-orange-600">
              Bus {leg.routeShortName}
            </span>{" "}
            <span className="text-gray-600">{leg.headsign}</span>
            <span className="text-xs text-amber-600 ml-2 inline-flex items-center gap-1">
              <AlertTriangle size={10} />
              Rack availability unknown
            </span>
          </span>
        )}
        {leg.mode === "WALK" && (
          <span className="text-gray-500">
            Walk {formatDistance(leg.distance)} · {formatDuration(leg.duration)}
          </span>
        )}
      </div>
      {leg.realTime && (
        <span className="text-[10px] text-green-600 font-medium shrink-0">
          LIVE
        </span>
      )}
    </div>
  );
}

// ─── Journey Summary ──────────────────────────────────────────────────────────

interface JourneySummaryProps {
  candidate: RouteCandidate;
  units?: "imperial" | "metric";
  onClose?: () => void;
}

export function JourneySummary({
  candidate,
  units = "imperial",
  onClose,
}: JourneySummaryProps) {
  const {
    legs,
    totalTime,
    bikeDistance,
    bikePercentage,
    bikeDuration,
    transitDuration,
    walkDuration,
    waitDuration,
    transfers,
    elevationGain,
    elevationLoss,
    calories,
    co2Saved,
    departureTime,
    arrivalTime,
    type,
  } = candidate;

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {formatDuration(totalTime)}
            </span>
            <span className="text-sm text-gray-400">
              {formatTime(departureTime)} → {formatTime(arrivalTime)}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-gray-500 text-xs"
            >
              Change route
            </button>
          )}
        </div>

        {/* Route type badge */}
        <div className="flex gap-2">
          {type === "bike-only" ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              <Bike size={10} />
              Bike only
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                <Bike size={10} />
                {Math.round(bikePercentage)}% bike
              </span>
              {transfers > 0 && (
                <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-50">
                  {transfers} transfer{transfers !== 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 border-b border-gray-100">
        <StatCell
          icon={<Bike size={13} className="text-green-500" />}
          label="Biking"
          value={formatDuration(bikeDuration)}
          sub={formatDistance(bikeDistance, units)}
        />
        {transitDuration > 0 ? (
          <StatCell
            icon={<Train size={13} className="text-blue-600" />}
            label="Transit"
            value={formatDuration(transitDuration)}
          />
        ) : (
          <StatCell
            icon={<Footprints size={13} className="text-gray-400" />}
            label="Walking"
            value={formatDuration(walkDuration)}
          />
        )}
        <StatCell
          icon={<Clock size={13} className="text-amber-500" />}
          label={transitDuration > 0 ? "Wait" : "Total"}
          value={
            transitDuration > 0
              ? formatDuration(waitDuration)
              : formatDuration(totalTime)
          }
        />
      </div>

      {/* Elevation & extras */}
      {(elevationGain !== undefined || calories !== undefined) && (
        <div className="grid grid-cols-4 border-b border-gray-100">
          {elevationGain !== undefined && (
            <StatCell
              icon={<TrendingUp size={12} className="text-orange-500" />}
              label="Gain"
              value={`+${Math.round(elevationGain)}m`}
              compact
            />
          )}
          {elevationLoss !== undefined && (
            <StatCell
              icon={<TrendingDown size={12} className="text-blue-400" />}
              label="Loss"
              value={`-${Math.round(elevationLoss)}m`}
              compact
            />
          )}
          {calories !== undefined && (
            <StatCell
              icon={<Zap size={12} className="text-yellow-500" />}
              label="Calories"
              value={`~${calories}`}
              compact
            />
          )}
          {co2Saved !== undefined && (
            <StatCell
              icon={<Leaf size={12} className="text-green-500" />}
              label="CO₂ saved"
              value={`${(co2Saved / 1000).toFixed(1)}kg`}
              compact
            />
          )}
        </div>
      )}

      {/* Leg list */}
      <div className="px-4 py-3 space-y-2.5">
        {legs.map((leg, i) => (
          <LegRow key={i} leg={leg} />
        ))}
      </div>
    </div>
  );
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({
  icon,
  label,
  value,
  sub,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center py-2.5 px-2", compact && "py-2")}>
      <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <span className={cn("font-semibold text-gray-800", compact ? "text-sm" : "text-base")}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
    </div>
  );
}

// ─── Fallback message ─────────────────────────────────────────────────────────

/** Shown above the Metrobus nudge when routes are too similar for the slider. */
const VARIETY_NUDGE_MESSAGE =
  "These routes are all pretty similar, so the Bike Preference slider won't change much.";

export function FallbackMessage({
  reason,
  busNudge,
  onEnableBus,
}: {
  reason?: string;
  busNudge?: boolean;
  onEnableBus?: () => void;
}) {
  return (
    <div className="flex gap-2.5 items-start bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
      <div>
        <p>{reason ?? VARIETY_NUDGE_MESSAGE}</p>
        {busNudge && onEnableBus && (
          <button
            onClick={onEnableBus}
            className="mt-1 text-xs font-medium text-amber-700 underline underline-offset-2"
          >
            Turn on Metrobus in Advanced Options
          </button>
        )}
      </div>
    </div>
  );
}
