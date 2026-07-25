"use client";

/**
 * Real-imagery drone feed: a non-interactive MapLibre view over the actual
 * pilot-vineyard block in Carneros/Napa, using Esri World Imagery (sub-meter
 * Maxar capture — individual vine rows are visible at z18–19).
 *
 * Honesty note: this is real, periodically-updated satellite imagery of the
 * real site, not a live video downlink — the HUD labels it SAT VIEW.
 *
 * "wide" mode drifts slowly side to side like a scanning pass; "closer" mode
 * dives toward the anomaly row. If tiles error (offline demo venue), onError
 * lets the parent fall back to the stylized sim.
 */

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PILOT_FARM } from "@/lib/globe";

const ESRI_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** "Row 12, Section B" — inside the dense vine block east of the feed center. */
const ANOMALY = { lng: PILOT_FARM.lng + 0.003, lat: PILOT_FARM.lat - 0.0004 };

export default function SatelliteFeed({
  closer,
  onError,
}: {
  closer: boolean;
  onError?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    // Same Turbopack worker workaround as GlobeView (idempotent).
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        center: [PILOT_FARM.lng, PILOT_FARM.lat],
        zoom: 17.1,
        bearing: -18,
        interactive: false,
        attributionControl: { compact: true, customAttribution: "Imagery © Esri · Maxar" },
        style: {
          version: 8,
          sources: {
            esri: { type: "raster", tiles: [ESRI_TILES], tileSize: 256, maxzoom: 19 },
          },
          layers: [
            { id: "space", type: "background", paint: { "background-color": "#0b1712" } },
            { id: "sat", type: "raster", source: "esri", paint: { "raster-fade-duration": 300 } },
          ],
        },
      });
    } catch {
      onErrorRef.current?.();
      return;
    }
    mapRef.current = map;
    map.on("error", (e: { error?: Error }) => {
      // Tile fetch failures mean no imagery — let the parent switch to the sim.
      if (e.error?.message?.includes("Failed to fetch") || e.error?.name === "AJAXError") {
        onErrorRef.current?.();
      }
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Flight behavior per video mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (closer) {
      map.easeTo({ center: [ANOMALY.lng, ANOMALY.lat], zoom: 18.65, duration: 2600 });
      return;
    }

    // Wide scanning pass: slow serpentine drift across the block.
    map.easeTo({ center: [PILOT_FARM.lng, PILOT_FARM.lat], zoom: 17.1, duration: 1500 });
    let dir = 1;
    const drift = () => {
      const c = map.getCenter();
      map.easeTo({
        center: [c.lng + dir * 0.0012, c.lat + dir * 0.0002],
        duration: 8000,
        easing: (n: number) => n,
      });
      dir *= -1;
    };
    const t0 = window.setTimeout(drift, 1600);
    const timer = window.setInterval(drift, 8200);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(timer);
    };
  }, [closer]);

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" />
      {/* label the feed honestly: satellite imagery, not a live drone downlink */}
      <div className="absolute left-3 top-3 z-30 border border-hud-cyan/40 bg-black/60 px-2 py-1 font-mono text-[10px] tracking-widest text-hud-cyan backdrop-blur-sm">
        SAT VIEW · CARNEROS AVA 38.427°N 122.410°W
      </div>
    </div>
  );
}
