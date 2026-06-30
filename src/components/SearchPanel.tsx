"use client";

import { useState, useCallback, useRef } from "react";
import { ArrowUpDown, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Autocomplete } from "@/components/Autocomplete";
import { BikeSlider, AdvancedOptionsPanel } from "@/components/BikeSlider";
import { JourneySummary, FallbackMessage } from "@/components/JourneySummary";
import type {
  Place,
  JourneyResult,
  RouteCandidate,
} from "@/types";
import { isInDC } from "@/types";
import { selectCandidate } from "@/services/JourneyCalculator";
import { cn } from "@/lib/utils";

interface SearchPanelProps {
  onJourneyUpdate: (result: JourneyResult | null, selected: RouteCandidate | null) => void;
}

type SearchState = "idle" | "loading" | "results" | "error";

export function SearchPanel({ onJourneyUpdate }: SearchPanelProps) {
  const [origin, setOrigin] = useState<Place | null>({
    name: "Foggy Bottom",
    lat: 38.8997,
    lon: -77.0486,
  });
  const [destination, setDestination] = useState<Place | null>({
    name: "Columbia Heights",
    lat: 38.9296,
    lon: -77.0356,
  });
  const [bikePreference, setBikePreference] = useState(50);
  const [allowBus, setAllowBus] = useState(false);
  const [allowBikeshare, setAllowBikeshare] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [state, setState] = useState<SearchState>("idle");
  const [journeyResult, setJourneyResult] = useState<JourneyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const outsideDC =
    (origin && !isInDC(origin.lat, origin.lon)) ||
    (destination && !isInDC(destination.lat, destination.lon));

  const canSearch = !!(origin && destination);

  // Run the search. Pass `allowBus` to override the current toggle state for
  // this run (used by the Metrobus nudge, whose setAllowBus hasn't applied yet).
  const handleSearch = useCallback(async (opts?: { allowBus?: boolean }) => {
    if (!origin || !destination) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const effectiveAllowBus = opts?.allowBus ?? allowBus;

    setState("loading");
    setJourneyResult(null);
    setErrorMsg(null);
    onJourneyUpdate(null, null);

    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          bikePreference,
          allowBus: outsideDC ? false : effectiveAllowBus,
          allowBikeshare: outsideDC ? false : allowBikeshare,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Routing failed");
      const result: JourneyResult = await res.json();

      setJourneyResult(result);
      setState("results");

      const selected = selectCandidate(result.candidates, bikePreference);
      onJourneyUpdate(result, selected);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState("error");
      setErrorMsg("Couldn't find a route. Check your OTP server is running.");
      onJourneyUpdate(null, null);
    }
  }, [origin, destination, bikePreference, allowBus, allowBikeshare, outsideDC, onJourneyUpdate]);

  // Slider change — instant re-rank, no new network calls
  const handleSliderChange = useCallback(
    (value: number) => {
      setBikePreference(value);
      if (!journeyResult) return;
      const selected = selectCandidate(journeyResult.candidates, value);
      onJourneyUpdate(journeyResult, selected);
    },
    [journeyResult, onJourneyUpdate]
  );

  // Swap origin/destination
  function handleSwap() {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
    if (journeyResult) {
      setJourneyResult(null);
      setState("idle");
      onJourneyUpdate(null, null);
    }
  }

  const selectedCandidate =
    journeyResult && state === "results"
      ? selectCandidate(journeyResult.candidates, bikePreference)
      : null;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Search inputs */}
      <div className="relative flex flex-col gap-2">
        <Autocomplete
          value={origin}
          placeholder="Going from…"
          onSelect={(p) => {
            setOrigin(p);
            if (journeyResult) {
              setJourneyResult(null);
              setState("idle");
              onJourneyUpdate(null, null);
            }
          }}
          onClear={() => {
            setOrigin(null);
            setJourneyResult(null);
            setState("idle");
            onJourneyUpdate(null, null);
          }}
          icon={
            <span className="w-2 h-2 rounded-full bg-blue-500 block" />
          }
        />

        {/* Swap button */}
        <button
          onClick={handleSwap}
          disabled={!origin && !destination}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all shadow-sm",
            (!origin && !destination) && "opacity-30 cursor-not-allowed"
          )}
        >
          <ArrowUpDown size={13} />
        </button>

        <Autocomplete
          value={destination}
          placeholder="Going to…"
          onSelect={(p) => {
            setDestination(p);
            if (journeyResult) {
              setJourneyResult(null);
              setState("idle");
              onJourneyUpdate(null, null);
            }
          }}
          onClear={() => {
            setDestination(null);
            setJourneyResult(null);
            setState("idle");
            onJourneyUpdate(null, null);
          }}
          icon={
            <span className="w-2 h-2 rounded-full bg-red-500 block" />
          }
        />
      </div>

      {/* Outside DC notice */}
      {outsideDC && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          Transit routing is currently only supported within Washington, DC.
          Showing bike-only route.
        </div>
      )}

      {/* Bike Preference Slider (hidden when outside DC) */}
      {!outsideDC && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-medium text-gray-600">
              Bike Preference
            </span>
            {journeyResult && state === "results" && (
              <span className="text-[10px] text-gray-400">
                Showing {journeyResult.candidates.length} option
                {journeyResult.candidates.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <BikeSlider
            value={bikePreference}
            onChange={handleSliderChange}
            disabled={false}
          />
        </div>
      )}

      {/* Search button */}
      <button
        onClick={() => handleSearch()}
        disabled={!canSearch || state === "loading"}
        className={cn(
          "w-full py-3 rounded-xl font-semibold text-sm transition-all",
          canSearch && state !== "loading"
            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        )}
      >
        {state === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Finding routes…
          </span>
        ) : (
          "Find Route"
        )}
      </button>

      {/* Advanced options */}
      {!outsideDC && (
        <AdvancedOptionsPanel
          open={showAdvanced}
          onToggle={() => setShowAdvanced((v) => !v)}
          allowBus={allowBus}
          onAllowBusChange={(v) => {
            setAllowBus(v);
            if (state === "results") {
              setJourneyResult(null);
              setState("idle");
              onJourneyUpdate(null, null);
            }
          }}
          allowBikeshare={allowBikeshare}
          onAllowBikeshareChange={setAllowBikeshare}
        />
      )}

      {/* Error */}
      {state === "error" && errorMsg && (
        <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* Fallback / low-variety nudge */}
      {state === "results" &&
        (journeyResult?.fallbackReason || journeyResult?.busNudge) && (
          <FallbackMessage
            reason={journeyResult.fallbackReason}
            busNudge={journeyResult.busNudge}
            onEnableBus={() => {
              setAllowBus(true);
              setShowAdvanced(true);
              handleSearch({ allowBus: true });
            }}
          />
        )}

      {/* Journey Summary */}
      {state === "results" && selectedCandidate && (
        <div className="mt-1">
          <JourneySummary
            candidate={selectedCandidate}
            onClose={() => {
              setJourneyResult(null);
              setState("idle");
              onJourneyUpdate(null, null);
            }}
          />
        </div>
      )}
    </div>
  );
}
