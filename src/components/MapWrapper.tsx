"use client";

import dynamic from "next/dynamic";
import type { Place, RouteCandidate } from "@/types";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
        <span className="text-sm">Loading map…</span>
      </div>
    </div>
  ),
});

interface MapWrapperProps {
  origin: Place | null;
  destination: Place | null;
  candidate: RouteCandidate | null;
  onMapClick?: (lat: number, lon: number) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function MapWrapper({
  origin,
  destination,
  candidate,
  onMapClick,
  style,
  className,
}: MapWrapperProps) {
  return (
    <div className={className} style={style}>
      <Map
        origin={origin}
        destination={destination}
        candidate={candidate}
        onMapClick={onMapClick}
      />
    </div>
  );
}
