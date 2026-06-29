"use client";

import { useState, useCallback } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { SearchPanel } from "@/components/SearchPanel";
import { WeatherWidget } from "@/components/WeatherWidget";
import type { JourneyResult, Place, RouteCandidate } from "@/types";

// DC center for weather (White House coords)
const DC_LAT = 38.8951;
const DC_LON = -77.0369;

export default function Home() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [selectedCandidate, setSelectedCandidate] =
    useState<RouteCandidate | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(true);

  const handleJourneyUpdate = useCallback(
    (result: JourneyResult | null, selected: RouteCandidate | null) => {
      setSelectedCandidate(selected);
      if (result?.search) {
        setOrigin(result.search.origin);
        setDestination(result.search.destination);
      }
      if (selected) setPanelExpanded(false);
    },
    []
  );

  return (
    <main className="relative w-full h-full flex flex-col md:flex-row overflow-hidden">
      {/* ── Map (full-bleed background) ──────────────────────────────────── */}
      <MapWrapper
        origin={origin}
        destination={destination}
        candidate={selectedCandidate}
        className="absolute inset-0 z-0"
      />

      {/* ── Left / bottom panel ──────────────────────────────────────────── */}
      <aside
        className="
          relative z-10
          w-full md:w-[380px] md:max-w-[380px]
          h-auto md:h-full
          flex flex-col
          md:overflow-hidden
        "
      >
        {/* App header */}
        <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">
              Bike + Metro DC
            </h1>
            <p className="text-[10px] text-gray-400 leading-tight">
              Multimodal journey planner
            </p>
          </div>
        </div>

        {/* Scrollable search area */}
        <div
          className="
            flex-1 overflow-y-auto
            bg-gray-50/95 backdrop-blur-sm
            px-3 py-3 space-y-3
          "
        >
          {/* Weather */}
          <WeatherWidget lat={DC_LAT} lon={DC_LON} />

          {/* Search & results */}
          <SearchPanel onJourneyUpdate={handleJourneyUpdate} />

          {/* Bottom padding for mobile */}
          <div className="h-4" />
        </div>
      </aside>

      {/* ── Mobile: tap-to-expand toggle ────────────────────────────────── */}
      <div className="md:hidden fixed bottom-4 right-4 z-20">
        <button
          onClick={() => setPanelExpanded((v) => !v)}
          className="bg-white shadow-lg rounded-full px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 flex items-center gap-2"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search
        </button>
      </div>
    </main>
  );
}
