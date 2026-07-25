"use client";

/**
 * Manual drone-piloting mode.
 *
 * The pilot flies the real satellite view with WASD / QE / RF and DISCOVERS the
 * anomaly by exploring — no scripted timeline. Flying near the hidden diseased
 * block raises a signal; descending over it trips Scout's reasoning, and diving
 * to leaf level crossfades to the real disease photo and verifies it.
 *
 * This is a separate mode from the deterministic auto-demo (which stays the
 * reliable fallback). It reuses the cockpit panels by synthesizing a
 * MissionPhase from the live pilot state.
 */

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AnimatePresence, motion } from "framer-motion";
import { MISSION_PHASES, MissionPhase } from "@/lib/mission";
import { PILOT_FARM } from "@/lib/globe";
import TelemetryBar from "@/components/TelemetryBar";
import ReasoningPanel from "@/components/ReasoningPanel";
import StatsBar from "@/components/StatsBar";
import MissionComplete from "@/components/MissionComplete";

const ESRI =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Diseased block — flagged by a beacon so the pilot can steer to it. */
const ANOMALY = { lng: PILOT_FARM.lng + 0.0016, lat: PILOT_FARM.lat - 0.0004 };
/** Drone spawns up-field so there is a short flight to the target. */
const START = { lng: PILOT_FARM.lng - 0.0016, lat: PILOT_FARM.lat + 0.0012, zoom: 16.6, bearing: -18 };

const ZOOM_MIN = 15.5; // highest altitude
const ZOOM_MAX = 18.6; // lowest altitude (leaf level)

type PilotState = "PATROL" | "SPOTTED" | "INSPECTING" | "VERIFIED";

const byId = Object.fromEntries(MISSION_PHASES.map((p) => [p.id, p])) as Record<
  MissionPhase["id"],
  MissionPhase
>;

/** Metres between two lng/lat points (equirectangular — fine at this scale). */
function metres(aLng: number, aLat: number, bLng: number, bLat: number) {
  const x = ((aLng - bLng) * Math.cos((aLat * Math.PI) / 180) * Math.PI * 6371000) / 180;
  const y = ((aLat - bLat) * Math.PI * 6371000) / 180;
  return Math.hypot(x, y);
}

/** Zoom → a plausible drone altitude in metres, for the HUD. */
const zoomToAlt = (z: number) => Math.round(9 + (ZOOM_MAX - z) * 11);

export default function PilotMode({ onExit }: { onExit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const stateRef = useRef<PilotState>("PATROL");
  const [state, setState] = useState<PilotState>("PATROL");
  const [signal, setSignal] = useState(0); // 0..1 proximity to anomaly
  const [nav, setNav] = useState({ dist: 0, angle: 0, onScreen: false });
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [alt, setAlt] = useState(zoomToAlt(START.zoom));
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);
  const [report, setReport] = useState(false);

  // Reset the flight so the pilot can fly again from the report screen.
  const flyAgain = () => {
    stateRef.current = "PATROL";
    setState("PATROL");
    setSignal(0);
    setElapsed(0);
    setReport(false);
  };

  // Map + control loop.
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        center: [START.lng, START.lat],
        zoom: START.zoom,
        bearing: START.bearing,
        pitch: 55,
        interactive: false,
        attributionControl: { compact: true, customAttribution: "Imagery © Esri · Maxar" },
        style: {
          version: 8,
          sources: { esri: { type: "raster", tiles: [ESRI], tileSize: 256, maxzoom: 19 } },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#0b1712" } },
            { id: "sat", type: "raster", source: "esri", paint: { "raster-fade-duration": 200 } },
          ],
        },
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    (window as unknown as Record<string, unknown>).__pilotMap = map; // demo/debug handle
    map.on("error", (e: { error?: Error }) => {
      if (e.error?.message?.includes("Failed to fetch") || e.error?.name === "AJAXError") setFailed(true);
    });

    // Beacon over the diseased block so the pilot can actually find it.
    const beacon = document.createElement("div");
    beacon.className = "target-beacon";
    beacon.innerHTML = `<div class="target-ring"></div><div class="target-core"></div><div class="target-label">◎ INVESTIGATE</div>`;
    markerRef.current = new maplibregl.Marker({ element: beacon }).setLngLat([ANOMALY.lng, ANOMALY.lat]).addTo(map);

    let raf = 0;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67; // frames elapsed (~1 at 60fps)
      last = now;
      const k = keys.current;
      const pan = 10 * dt; // screen px/frame — zoom-independent via panBy
      let dx = 0;
      let dy = 0;
      if (k.has("w")) dy -= pan;
      if (k.has("s")) dy += pan;
      if (k.has("a")) dx -= pan;
      if (k.has("d")) dx += pan;
      if (dx || dy) map.panBy([dx, dy], { duration: 0 });
      if (k.has("q")) map.setBearing(map.getBearing() - 1.8 * dt);
      if (k.has("e")) map.setBearing(map.getBearing() + 1.8 * dt);
      if (k.has("r")) map.setZoom(Math.min(ZOOM_MAX, map.getZoom() + 0.022 * dt)); // descend
      if (k.has("f")) map.setZoom(Math.max(ZOOM_MIN, map.getZoom() - 0.022 * dt)); // ascend

      // Discovery logic.
      const c = map.getCenter();
      const z = map.getZoom();
      const d = metres(c.lng, c.lat, ANOMALY.lng, ANOMALY.lat);

      // Throttle HUD state to ~12 Hz to keep re-renders cheap.
      if (++frame % 5 === 0) {
        setSignal(Math.max(0, Math.min(1, 1 - d / 200)));
        setAlt(zoomToAlt(z));
        const brng = (Math.atan2((ANOMALY.lng - c.lng) * Math.cos((c.lat * Math.PI) / 180), ANOMALY.lat - c.lat) * 180) / Math.PI;
        const cont = map.getContainer();
        const p = map.project([ANOMALY.lng, ANOMALY.lat]);
        setNav({
          dist: d,
          angle: brng - map.getBearing(),
          onScreen: p.x >= 0 && p.y >= 0 && p.x <= cont.clientWidth && p.y <= cont.clientHeight,
        });
      }

      const s = stateRef.current;
      let next: PilotState = s;
      if (s === "PATROL" && d < 55) next = "SPOTTED";
      else if (s === "SPOTTED" && d < 45 && z >= 17.55) next = "INSPECTING";
      else if (s === "INSPECTING" && z >= 18.35) next = "VERIFIED";
      // allow backing off before verification
      else if (s === "SPOTTED" && d > 90) next = "PATROL";
      if (next !== s) {
        stateRef.current = next;
        setState(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Keyboard capture.
  useEffect(() => {
    const CONTROL = new Set(["w", "a", "s", "d", "q", "e", "r", "f"]);
    const down = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase();
      if (CONTROL.has(key)) {
        ev.preventDefault();
        keys.current.add(key);
      }
    };
    const up = (ev: KeyboardEvent) => keys.current.delete(ev.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // 1s clock for battery/timer once the anomaly is found (keeps PATROL calm).
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Beacon guides the pilot in; fade it once they are inspecting the target.
  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (el) el.style.opacity = state === "INSPECTING" || state === "VERIFIED" ? "0" : "1";
  }, [state]);

  // Synthesize a MissionPhase for the reused panels.
  const phaseId: MissionPhase["id"] =
    state === "PATROL"
      ? "OPENING"
      : state === "SPOTTED"
      ? "ANOMALY_DETECTED"
      : state === "INSPECTING"
      ? "ADAPTIVE_DECISION"
      : "VERIFICATION";
  const phase: MissionPhase = { ...byId[phaseId], altitudeM: alt };

  const fpv =
    state === "INSPECTING"
      ? { src: "/disease/downy-mildew-leaf.jpg", label: "OIL-SPOT PATTERN", verified: false, credit: "Leaf: Lucyin / Wikimedia · CC BY-SA 4.0" }
      : state === "VERIFIED"
      ? { src: "/disease/downy-mildew-macro.jpg", label: "VERIFIED · DOWNY MILDEW", verified: true, credit: "Macro: Rude / Wikimedia · CC BY-SA 3.0" }
      : null;

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-hud-bg">
        <span className="text-sm text-hud-dim">Satellite tiles unavailable — pilot mode needs network imagery.</span>
        <button onClick={onExit} className="cursor-pointer rounded-sm border border-hud-border px-4 py-2 font-mono text-xs text-hud-dim hover:text-hud-text">
          ← BACK
        </button>
      </div>
    );
  }

  if (report) {
    return (
      <div className="flex h-full flex-col">
        <TelemetryBar phase={byId.MISSION_COMPLETE} clock={elapsed} />
        <div className="min-h-0 flex-1">
          <MissionComplete onRestart={flyAgain} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TelemetryBar phase={phase} clock={elapsed} />

      <main className="relative min-h-0 flex-1">
        <div className="grid h-full min-h-0 grid-cols-[1fr_320px]">
          {/* --- controllable feed --- */}
          <div className="video-fx relative h-full w-full overflow-hidden bg-black">
            {/* maplibre.css forces position:relative — size explicitly, not absolute */}
            <div ref={ref} className="h-full w-full" />

            {/* FPV leaf reveal at low altitude */}
            <AnimatePresence>
              {fpv && (
                <motion.div
                  key={fpv.src}
                  initial={{ opacity: 0, scale: 1.15 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9 }}
                  className="absolute inset-0 z-10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fpv.src} alt="leaf inspection" className="h-full w-full object-cover" />
                  <div className="absolute bottom-2 right-2 z-40 bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-hud-dim">
                    {fpv.credit}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* view label */}
            <div className="absolute left-3 top-3 z-40 border border-hud-cyan/40 bg-black/70 px-2 py-1 font-mono text-[10px] tracking-widest text-hud-cyan">
              {fpv ? "◎ FPV · LEAF-LEVEL" : "SAT VIEW · MANUAL"} · ALT {alt} M
            </div>

            {/* crosshair */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 opacity-50">
              <svg width="52" height="52" viewBox="0 0 52 52">
                <g stroke="#67e8f9" strokeWidth="1" fill="none">
                  <line x1="26" y1="6" x2="26" y2="18" />
                  <line x1="26" y1="34" x2="26" y2="46" />
                  <line x1="6" y1="26" x2="18" y2="26" />
                  <line x1="34" y1="26" x2="46" y2="26" />
                  <circle cx="26" cy="26" r="3" />
                </g>
              </svg>
            </div>

            {/* detection box on the crosshair once spotted */}
            <AnimatePresence>
              {(state === "SPOTTED" || fpv) && (
                <motion.div
                  key={state}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`detect-box absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 border-2 ${
                    fpv?.verified ? "border-hud-red" : "border-hud-amber"
                  }`}
                  style={{ width: "38%", height: "46%" }}
                >
                  <div
                    className={`absolute -top-6 left-0 whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
                      fpv?.verified ? "bg-hud-red text-black" : "bg-hud-amber text-black"
                    }`}
                  >
                    {fpv ? fpv.label : "SUSPICIOUS CROP REGION"} · {state === "VERIFIED" ? "92" : "64"}%
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* objective + signal meter + waypoint guidance */}
            <div className="absolute left-3 top-14 z-40 w-64 rounded-sm border border-hud-border bg-black/60 p-2.5">
              <div className="hud-label mb-1">
                {state === "PATROL"
                  ? "Objective — fly to the flagged block"
                  : state === "SPOTTED"
                  ? "Anomaly found — descend (R) to inspect"
                  : state === "INSPECTING"
                  ? "Hold over target — keep descending (R)"
                  : "Disease verified ✓"}
              </div>
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[10px] text-hud-dim">SIGNAL</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hud-border">
                  <div
                    className="h-full rounded-full transition-[width] duration-150"
                    style={{
                      width: `${Math.round(signal * 100)}%`,
                      background: signal > 0.7 ? "#f87171" : signal > 0.35 ? "#fbbf24" : "#34d399",
                    }}
                  />
                </div>
              </div>
              {(state === "PATROL" || state === "SPOTTED") && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-hud-dim">
                  <span
                    className="inline-block text-sm text-hud-amber"
                    style={{ transform: `rotate(${nav.angle}deg)` }}
                    aria-hidden
                  >
                    ↑
                  </span>
                  <span>
                    ◎ TARGET · {Math.round(nav.dist)} m
                    {!nav.onScreen && <span className="text-hud-amber"> · follow the arrow</span>}
                  </span>
                </div>
              )}
            </div>

            {/* controls hint */}
            <div className="absolute bottom-3 left-3 z-40 flex flex-wrap gap-x-3 gap-y-1 rounded-sm border border-hud-border bg-black/60 px-3 py-1.5 font-mono text-[10px] text-hud-dim">
              <span><span className="text-hud-text">W A S D</span> move</span>
              <span><span className="text-hud-text">Q E</span> rotate</span>
              <span><span className="text-hud-text">R</span> descend</span>
              <span><span className="text-hud-text">F</span> ascend</span>
            </div>

            {/* verified banner + treatment-zone CTA */}
            <AnimatePresence>
              {state === "VERIFIED" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-14 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2 rounded-sm border border-hud-red/50 bg-black/80 px-5 py-3 text-center"
                >
                  <div className="font-mono text-sm font-bold tracking-widest text-hud-red">DOWNY MILDEW CONFIRMED</div>
                  <div className="font-mono text-[10px] text-hud-dim">You flew the drone to the problem and Scout verified it.</div>
                  <button
                    onClick={() => setReport(true)}
                    className="mt-1 cursor-pointer rounded-sm border border-hud-green/60 bg-hud-green/15 px-4 py-2 font-mono text-xs font-bold tracking-widest text-hud-green transition-colors hover:bg-hud-green/25"
                  >
                    ◹ GENERATE TREATMENT ZONE →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* --- reasoning panel (reused) --- */}
          <ReasoningPanel phase={phase} />
        </div>

        {/* exit to menu */}
        <button
          onClick={onExit}
          className="absolute right-3 top-2 z-50 cursor-pointer rounded-sm border border-hud-border bg-black/50 px-3 py-1 font-mono text-[10px] tracking-widest text-hud-dim hover:text-hud-text"
        >
          ✕ EXIT PILOT
        </button>
      </main>

      <StatsBar phase={phase} />
    </div>
  );
}
