"use client";

/**
 * Globe entry screen — the "where Scout operates" view.
 *
 * MapLibre GL globe (no access token) + NASA GIBS Blue Marble raster tiles.
 * Everything interactive is pre-baked GeoJSON from src/lib/globe.ts; if the
 * GIBS tiles fail to load, the bundled Natural Earth landmass layer beneath
 * still renders, so the demo never blocks on the network (CLAUDE.md guardrail).
 */

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AnimatePresence, motion } from "framer-motion";
import { GRAIN_BELTS, VINEYARD_HUBS, PILOT_FARM, RegionProps } from "@/lib/globe";

const GIBS_TILES =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";

/** Degrees the globe drifts per second while idle. */
const SPIN_DEG_PER_SEC = 3;

export default function GlobeView({ onEnterMission }: { onEnterMission: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const spinRef = useRef(true);
  const [selected, setSelected] = useState<RegionProps | null>(null);
  const [entering, setEntering] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      // Turbopack mangles MapLibre's own worker URL (it resolves to the page
      // root and every GeoJSON source silently stays empty). Serve the stock
      // worker from /public instead. Files copied from maplibre-gl/dist.
      maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
      map = new maplibregl.Map({
        container: containerRef.current,
        center: [-100, 30],
        zoom: 1.7,
        minZoom: 1.1,
        attributionControl: { compact: true, customAttribution: "NASA GIBS · Natural Earth" },
        style: {
          version: 8,
          projection: { type: "globe" },
          sky: {
            "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
          },
          sources: {
            countries: { type: "geojson", data: "/geo/countries.geojson" },
            gibs: {
              type: "raster",
              tiles: [GIBS_TILES],
              tileSize: 256,
              maxzoom: 8,
            },
            "grain-belts": { type: "geojson", data: GRAIN_BELTS },
            vineyards: { type: "geojson", data: VINEYARD_HUBS },
          },
          layers: [
            { id: "space", type: "background", paint: { "background-color": "#03060b" } },
            // Offline fallback landmass — only visible if GIBS tiles fail.
            {
              id: "land-fallback",
              type: "fill",
              source: "countries",
              paint: { "fill-color": "#10231a" },
            },
            { id: "gibs", type: "raster", source: "gibs", paint: { "raster-opacity": 0.92 } },
            {
              id: "borders",
              type: "line",
              source: "countries",
              paint: { "line-color": "rgba(215, 230, 220, 0.14)", "line-width": 0.5 },
            },
            {
              id: "grain-fill",
              type: "fill",
              source: "grain-belts",
              paint: { "fill-color": "#fbbf24", "fill-opacity": 0.16 },
            },
            {
              id: "grain-line",
              type: "line",
              source: "grain-belts",
              paint: { "line-color": "#fbbf24", "line-opacity": 0.55, "line-width": 1 },
            },
            {
              id: "vine-halo",
              type: "circle",
              source: "vineyards",
              paint: {
                "circle-color": "#34d399",
                "circle-opacity": 0.22,
                "circle-blur": 0.6,
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 9, 5, 16],
              },
            },
            {
              id: "vine-dot",
              type: "circle",
              source: "vineyards",
              paint: {
                "circle-color": "#34d399",
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3, 5, 6],
                "circle-stroke-color": "rgba(215, 230, 220, 0.8)",
                "circle-stroke-width": 1,
              },
            },
          ],
        },
      });
    } catch {
      // No WebGL (old GPU / headless) — offer a direct path into the cockpit.
      setWebglFailed(true);
      return;
    }
    mapRef.current = map;
    // debug handle for the browser console / demo-day troubleshooting
    (window as unknown as Record<string, unknown>).__scoutMap = map;

    // Pulsing DOM marker for the Scout-enabled pilot farm.
    const el = document.createElement("div");
    el.className = "pilot-marker";
    el.innerHTML = `<div class="pilot-ring"></div><div class="pilot-core"></div><div class="pilot-label">SCOUT PILOT FARM</div>`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      spinRef.current = false;
      setSelected({
        id: PILOT_FARM.id,
        kind: "pilot",
        name: PILOT_FARM.name,
        country: PILOT_FARM.country,
        crops: PILOT_FARM.crops,
        note: PILOT_FARM.note,
      });
      map.flyTo({ center: [PILOT_FARM.lng, PILOT_FARM.lat], zoom: 5.5, duration: 2000 });
    });
    new maplibregl.Marker({ element: el }).setLngLat([PILOT_FARM.lng, PILOT_FARM.lat]).addTo(map);

    // Idle spin — classic rotating-globe loop; any user interaction stops it.
    const spin = () => {
      if (!spinRef.current || map.getZoom() > 4) return;
      const center = map.getCenter();
      center.lng += SPIN_DEG_PER_SEC;
      map.easeTo({ center, duration: 1000, easing: (n: number) => n });
    };
    map.on("moveend", spin);
    const stopSpin = () => (spinRef.current = false);
    map.on("mousedown", stopSpin);
    map.on("touchstart", stopSpin);
    map.on("wheel", stopSpin);
    spin();

    // Region interactions.
    const clickable = ["vine-dot", "vine-halo", "grain-fill"];
    for (const layer of clickable) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("click", (e: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: clickable });
      if (!hits.length) {
        setSelected(null);
        return;
      }
      spinRef.current = false;
      const props = hits[0].properties as unknown as RegionProps;
      setSelected(props);
      const isPoint = hits[0].geometry.type === "Point";
      map.flyTo({
        center: isPoint
          ? ((hits[0].geometry as GeoJSON.Point).coordinates as [number, number])
          : e.lngLat,
        zoom: Math.max(map.getZoom(), isPoint ? 5.5 : 4),
        duration: 1600,
      });
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  /** Fly all the way into the pilot farm, then hand off to the mission cockpit. */
  const enterPilotFarm = () => {
    const map = mapRef.current;
    if (!map) {
      onEnterMission();
      return;
    }
    spinRef.current = false;
    setSelected(null);
    setEntering(true);
    map.flyTo({ center: [PILOT_FARM.lng, PILOT_FARM.lat], zoom: 9.4, duration: 3200, essential: true });
    map.once("moveend", onEnterMission);
  };

  if (webglFailed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <span className="font-mono text-2xl font-bold tracking-[0.4em] text-hud-green">SCOUT</span>
        <span className="text-sm text-hud-dim">Globe view needs WebGL — jumping straight to the cockpit.</span>
        <button
          onClick={onEnterMission}
          className="cursor-pointer rounded-sm border border-hud-green/50 bg-hud-green/10 px-5 py-2 font-mono text-sm font-bold tracking-widest text-hud-green hover:bg-hud-green/20"
        >
          ▶ ENTER COCKPIT
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* NOTE: maplibre.css forces `.maplibregl-map { position: relative }`, so
          absolute-positioning classes get overridden — size it explicitly. */}
      <div ref={containerRef} className="h-full w-full" />

      {/* header */}
      <div className="pointer-events-none absolute left-4 top-3 z-10">
        <div className="font-mono text-xl font-bold tracking-[0.4em] text-hud-green">SCOUT</div>
        <div className="hud-label mt-1">GLOBAL CROP WATCH · SELECT A REGION</div>
      </div>

      {/* skip — presenter escape hatch, demo must never depend on the globe */}
      <button
        onClick={onEnterMission}
        className="absolute right-4 top-3 z-10 cursor-pointer rounded-sm border border-hud-border bg-black/50 px-3 py-1.5 font-mono text-xs tracking-widest text-hud-dim hover:text-hud-text"
      >
        SKIP → COCKPIT
      </button>

      {/* legend */}
      <div className="pointer-events-none absolute bottom-8 left-4 z-10 flex flex-col gap-1.5 font-mono text-[11px] text-hud-dim">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-hud-green" /> Vineyard region
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-hud-amber/60" /> Grain belt
        </span>
        <span className="flex items-center gap-2">
          <span className="relative inline-block h-2.5 w-2.5 rounded-full bg-hud-green">
            <span className="absolute inset-0 animate-ping rounded-full bg-hud-green/60" />
          </span>
          Scout pilot farm — click to fly the mission
        </span>
      </div>

      {/* region card */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="panel absolute right-4 top-16 z-10 w-[300px] rounded-sm p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="hud-label">{selected.country}</div>
                <div className="mt-0.5 text-sm font-bold text-hud-text">{selected.name}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="cursor-pointer font-mono text-xs text-hud-dim hover:text-hud-text"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-hud-dim">
              <div>
                <span className="text-hud-cyan">CROPS</span> · {selected.crops}
              </div>
              <div>{selected.note}</div>
              <div className="pt-1">🛰 Satellite crop-health imagery available (Sentinel-2 / NASA)</div>
            </div>
            {selected.kind === "pilot" ? (
              <button
                onClick={enterPilotFarm}
                className="mt-4 w-full cursor-pointer rounded-sm border border-hud-green/50 bg-hud-green/10 px-4 py-2 font-mono text-xs font-bold tracking-widest text-hud-green hover:bg-hud-green/20"
              >
                ◉ LAUNCH DRONE MISSION →
              </button>
            ) : (
              <div className="mt-4 rounded-sm border border-hud-border bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-hud-dim">
                🛸 Drone coverage not yet deployed in this region —{" "}
                <span className="text-hud-amber">join the pilot program</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* fade-to-black handoff into the cockpit */}
      <AnimatePresence>
        {entering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2, duration: 1 }}
            className="pointer-events-none absolute inset-0 z-20 bg-black"
          >
            <div className="flex h-full items-center justify-center">
              <span className="font-mono text-xs tracking-[0.3em] text-hud-green">
                SWITCHING TO DRONE FEED…
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
