"use client";

import { Bike, Train, Settings2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BikeSliderProps {
  value: number; // 0–100
  onChange: (value: number) => void;
  disabled?: boolean;
}

const STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function getLabel(value: number): string {
  if (value === 0) return "Max Metro";
  if (value === 100) return "Bike Only";
  if (value <= 20) return "Mostly Metro";
  if (value <= 40) return "More Metro";
  if (value === 50) return "Balanced";
  if (value <= 70) return "More Biking";
  return "Mostly Biking";
}

function getSliderColor(value: number): string {
  // Green for bike-heavy, blue for metro-heavy
  if (value <= 20) return "#003688";
  if (value <= 40) return "#4B7BF5";
  if (value === 50) return "#6366F1";
  if (value <= 70) return "#22C55E";
  return "#16A34A";
}

export function BikeSlider({ value, onChange, disabled }: BikeSliderProps) {
  const color = getSliderColor(value);
  const fillPct = value;

  return (
    <div className={cn("space-y-3", disabled && "opacity-50 pointer-events-none")}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Train size={13} />
          <span>Metro</span>
        </div>
        <div
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {getLabel(value)}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Bike</span>
          <Bike size={13} />
        </div>
      </div>

      {/* Track */}
      <div className="relative h-6 flex items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-gray-100" />

        {/* Filled portion */}
        <div
          className="absolute h-2 rounded-full left-0 transition-all duration-150"
          style={{
            width: `${fillPct}%`,
            backgroundColor: color,
          }}
        />

        {/* Stop markers */}
        {STOPS.filter((s) => s > 0 && s < 100).map((stop) => (
          <div
            key={stop}
            className="absolute w-0.5 h-2 rounded-full -translate-x-0.5 transition-colors"
            style={{
              left: `${stop}%`,
              backgroundColor: stop <= value ? "white" : "#D1D5DB",
              opacity: 0.8,
            }}
          />
        ))}

        {/* Thumb */}
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: 10 }}
        />
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md transition-all duration-150 -translate-x-1/2 pointer-events-none"
          style={{
            left: `${fillPct}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Percentage indicators */}
      <div className="flex justify-between text-[10px] text-gray-300 px-0.5">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ─── Advanced Options ─────────────────────────────────────────────────────────

interface AdvancedOptionsProps {
  allowBus: boolean;
  onAllowBusChange: (v: boolean) => void;
  allowBikeshare: boolean;
  onAllowBikeshareChange: (v: boolean) => void;
}

export function AdvancedOptions({
  allowBus,
  onAllowBusChange,
  allowBikeshare,
  onAllowBikeshareChange,
}: AdvancedOptionsProps) {
  return (
    <div className="space-y-3">
      {/* Allow Metrobus */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={allowBus}
            onChange={(e) => onAllowBusChange(e.target.checked)}
            className="sr-only"
          />
          <div
            className={cn(
              "w-8 h-4.5 rounded-full transition-colors",
              allowBus ? "bg-blue-500" : "bg-gray-200"
            )}
          />
          <div
            className={cn(
              "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform",
              allowBus ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            Allow Metrobus
          </div>
          {allowBus && (
            <div className="mt-1.5 flex gap-1.5 items-start text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>
                Bike rack availability cannot be determined. Most buses carry
                two bikes. If both spaces are occupied you may need to wait or
                bike instead.
              </span>
            </div>
          )}
        </div>
      </label>

      {/* Capital Bikeshare */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={allowBikeshare}
            onChange={(e) => onAllowBikeshareChange(e.target.checked)}
            className="sr-only"
          />
          <div
            className={cn(
              "w-8 h-4.5 rounded-full transition-colors",
              allowBikeshare ? "bg-blue-500" : "bg-gray-200"
            )}
          />
          <div
            className={cn(
              "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform",
              allowBikeshare ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </div>
        <div className="text-sm font-medium text-gray-700">
          Use Capital Bikeshare
        </div>
      </label>
    </div>
  );
}

// ─── Advanced Options Panel (collapsible) ─────────────────────────────────────

interface AdvancedOptionsPanelProps extends AdvancedOptionsProps {
  open: boolean;
  onToggle: () => void;
}

export function AdvancedOptionsPanel({
  open,
  onToggle,
  ...props
}: AdvancedOptionsPanelProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Settings2 size={12} />
        <span>Advanced Options</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <AdvancedOptions {...props} />
        </div>
      )}
    </div>
  );
}
