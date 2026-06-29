"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RouteCandidate, RouteLeg, Place } from "@/types";
import { METRO_LINE_COLORS } from "@/types";

// MapLibre colors per leg mode
const LEG_COLORS: Record<string, string> = {
  BICYCLE: "#16A34A",
  WALK: "#9CA3AF",
  SUBWAY: "#003688",
  RAIL: "#003688",
  TRAM: "#003688",
  BUS: "#ED8B00",
};

// Default DC center
const DC_CENTER: [number, number] = [-77.0369, 38.9072];
const DC_ZOOM = 12;

interface MapProps {
  origin: Place | null;
  destination: Place | null;
  candidate: RouteCandidate | null;
  onMapClick?: (lat: number, lon: number) => void;
  style?: React.CSSProperties;
}

export default function Map({
  origin,
  destination,
  candidate,
  onMapClick,
  style,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let map: maplibregl.Map;

    import("maplibre-gl").then((maplibregl) => {
      if (!mapContainerRef.current) return;

      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style:
          "https://tiles.openfreemap.org/styles/liberty",
        center: DC_CENTER,
        zoom: DC_ZOOM,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right"
      );
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "bottom-right"
      );

      map.on("load", () => {
        setMapLoaded(true);
      });

      if (onMapClick) {
        map.on("click", (e) => {
          onMapClick(e.lngLat.lat, e.lngLat.lng);
        });
      }

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers for origin/destination
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    import("maplibre-gl").then((maplibregl) => {
      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (origin) {
        const el = createMarkerEl("#1D4ED8", "A");
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([origin.lon, origin.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }

      if (destination) {
        const el = createMarkerEl("#DC2626", "B");
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([destination.lon, destination.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    });
  }, [mapLoaded, origin, destination]);

  // Draw route
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Remove old route layers/sources
    const existingSourceIds = (
      map.getStyle()?.sources
        ? Object.keys(map.getStyle()!.sources)
        : []
    ).filter((id) => id.startsWith("route-leg-"));

    existingSourceIds.forEach((id) => {
      const layerId = `layer-${id}`;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(id)) map.removeSource(id);
    });

    if (!candidate) return;

    // Collect all route coordinates and compute raw bounds
    const allCoords: [number, number][] = [];
    candidate.legs.forEach((leg, i) => {
      if (!leg.geometry?.coordinates?.length) return;
      const sourceId = `route-leg-${i}`;
      const layerId = `layer-${sourceId}`;
      const color =
        leg.mode === "SUBWAY" && leg.routeShortName
          ? METRO_LINE_COLORS[leg.routeShortName] ?? LEG_COLORS["SUBWAY"]
          : LEG_COLORS[leg.mode] ?? "#6B7280";

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: leg.geometry,
          properties: {},
        },
      });

      const isDashed = leg.mode === "WALK";

      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": color,
          "line-width": leg.mode === "WALK" ? 2 : 4,
          "line-opacity": leg.mode === "WALK" ? 0.6 : 0.9,
          ...(isDashed ? { "line-dasharray": [2, 2] } : {}),
        },
      });

      leg.geometry.coordinates.forEach((coord) => {
        allCoords.push([coord[0], coord[1]]);
      });
    });

    if (allCoords.length === 0) return;

    // Compute raw extents
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of allCoords) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }

    // Clamp to a sane radius around the origin–destination midpoint so that
    // long transit detours (e.g. Blue Line east then Green Line north) don't
    // zoom the map out to show all of DC.
    const originLng = origin?.lon ?? (minLng + maxLng) / 2;
    const originLat = origin?.lat ?? (minLat + maxLat) / 2;
    const destLng   = destination?.lon ?? originLng;
    const destLat   = destination?.lat ?? originLat;
    const midLng = (originLng + destLng) / 2;
    const midLat = (originLat + destLat) / 2;
    // Max allowed distance from midpoint = 1.5× the origin-destination span, min 0.02°
    const spanLng = Math.max(Math.abs(destLng - originLng), 0.02) * 1.5;
    const spanLat = Math.max(Math.abs(destLat - originLat), 0.02) * 1.5;

    const bounds: [[number, number], [number, number]] = [
      [Math.max(minLng, midLng - spanLng), Math.max(minLat, midLat - spanLat)],
      [Math.min(maxLng, midLng + spanLng), Math.min(maxLat, midLat + spanLat)],
    ];

    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
  }, [mapLoaded, candidate, origin, destination]);

  // Fly to origin when set without a route
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || candidate) return;
    if (origin && !destination) {
      mapRef.current.flyTo({
        center: [origin.lon, origin.lat],
        zoom: 14,
        duration: 600,
      });
    }
  }, [mapLoaded, origin, destination, candidate]);

  return (
    <div
      ref={mapContainerRef}
      style={style}
      className="w-full h-full"
    />
  );
}

function createMarkerEl(color: string, label: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 50% 50% 50% 0;
    background-color: ${color};
    transform: rotate(-45deg);
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  const inner = document.createElement("span");
  inner.style.cssText = `
    transform: rotate(45deg);
    color: white;
    font-size: 11px;
    font-weight: 700;
    font-family: system-ui, sans-serif;
  `;
  inner.textContent = label;
  el.appendChild(inner);
  return el;
}
