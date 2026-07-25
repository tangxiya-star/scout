"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MissionPhase, Detection } from "@/lib/mission";
import SatelliteFeed from "@/components/SatelliteFeed";

/**
 * Close-range first-person frames: when the drone drops to leaf level the feed
 * crossfades from satellite to a REAL photo of the disease it flew down to
 * inspect. These are genuine CC-BY-SA plant-pathology images of grapevine
 * downy mildew (Plasmopara viticola), cached in /public so the reveal never
 * depends on a live request. `box` places the detection overlay on the actual
 * symptom; it overrides the satellite-tuned box in the mission data.
 */
interface FpvFrame {
  src: string;
  credit: string;
  box: Detection["box"];
  label: string;
  confidence: number;
  verified: boolean;
}
const FPV_FRAMES: Partial<Record<MissionPhase["id"], FpvFrame>> = {
  ADAPTIVE_DECISION: {
    src: "/disease/downy-mildew-leaf.jpg",
    credit: "Leaf imagery: Lucyin / Wikimedia · CC BY-SA 4.0",
    box: { x: 34, y: 22, w: 40, h: 50 },
    label: "OIL-SPOT PATTERN",
    confidence: 0.68,
    verified: false,
  },
  VERIFICATION: {
    src: "/disease/downy-mildew-macro.jpg",
    credit: "Macro: Rude / Wikimedia · CC BY-SA 3.0",
    box: { x: 30, y: 24, w: 40, h: 46 },
    label: "VERIFIED · DOWNY MILDEW",
    confidence: 0.92,
    verified: true,
  },
  LOCALIZED_ACTION: {
    src: "/disease/downy-mildew-macro.jpg",
    credit: "Macro: Rude / Wikimedia · CC BY-SA 3.0",
    box: { x: 30, y: 24, w: 40, h: 46 },
    label: "VERIFIED · DOWNY MILDEW",
    confidence: 0.92,
    verified: true,
  },
};

/**
 * Drone video area.
 *
 * Wide phases show real satellite imagery of the pilot vineyard (SatelliteFeed);
 * close phases crossfade to a real leaf-level disease photo (FPV_FRAMES). If
 * satellite tiles can't load (offline venue) the stylized sim takes over, and
 * `videoSrc` still swaps in real drone footage if we ever get some. The
 * detection overlay works identically on every background.
 */
export default function DroneVideo({
  phase,
  videoSrc,
}: {
  phase: MissionPhase;
  videoSrc?: string;
}) {
  const closer = phase.videoMode === "closer";
  const [satFailed, setSatFailed] = useState(false);

  // At leaf level, a real disease photo drives both the feed and the box.
  const fpv = FPV_FRAMES[phase.id];
  const det: (Detection & { credit?: string }) | null = fpv
    ? { box: fpv.box, label: fpv.label, confidence: fpv.confidence, verified: fpv.verified }
    : phase.detection;

  return (
    <div className="video-fx relative h-full w-full overflow-hidden bg-black">
      {/* --- feed --- */}
      {videoSrc ? (
        <video
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : !satFailed ? (
        <SatelliteFeed closer={closer} onError={() => setSatFailed(true)} />
      ) : (
        <motion.div
          className="absolute inset-0"
          animate={{ scale: closer ? 2.1 : 1 }}
          transition={{ duration: 2.4, ease: [0.4, 0, 0.2, 1] }}
          style={{ transformOrigin: "51% 45%" }}
        >
          <VineyardSim showDisease={closer} />
        </motion.div>
      )}

      {/* --- FPV leaf-level real-imagery layer (crossfades over the feed) --- */}
      <AnimatePresence>
        {fpv && (
          <motion.div
            key={fpv.src}
            initial={{ opacity: 0, scale: 1.18 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 z-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fpv.src} alt="Drone close-range leaf inspection" className="h-full w-full object-cover" />
            {/* replaces the SAT VIEW label — we're at leaf level now */}
            <div className="absolute left-3 top-3 z-40 border border-hud-cyan/40 bg-black/70 px-2 py-1 font-mono text-[10px] tracking-widest text-hud-cyan">
              ◎ FPV · LEAF-LEVEL INSPECTION · ALT {phase.altitudeM} M
            </div>
            <div className="absolute bottom-2 right-2 z-40 bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-hud-dim">
              {fpv.credit}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HUD corners --- */}
      <Corners />

      {/* --- center crosshair --- */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 opacity-40">
        <svg width="44" height="44" viewBox="0 0 44 44">
          <g stroke="#67e8f9" strokeWidth="1" fill="none">
            <line x1="22" y1="8" x2="22" y2="16" />
            <line x1="22" y1="28" x2="22" y2="36" />
            <line x1="8" y1="22" x2="16" y2="22" />
            <line x1="28" y1="22" x2="36" y2="22" />
            <circle cx="22" cy="22" r="2" />
          </g>
        </svg>
      </div>

      {/* --- detection overlay --- */}
      <AnimatePresence>
        {det && (
          <motion.div
            key={det.label + det.confidence}
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={`detect-box absolute z-30 border-2 ${
              det.verified ? "border-hud-red" : "border-hud-amber"
            }`}
            style={{
              left: `${det.box.x}%`,
              top: `${det.box.y}%`,
              width: `${det.box.w}%`,
              height: `${det.box.h}%`,
            }}
          >
            <div
              className={`absolute -top-6 left-0 whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
                det.verified ? "bg-hud-red text-black" : "bg-hud-amber text-black"
              }`}
            >
              {det.label} · {Math.round(det.confidence * 100)}%
            </div>
            {/* corner ticks */}
            {["-top-px -left-px border-t-2 border-l-2", "-top-px -right-px border-t-2 border-r-2", "-bottom-px -left-px border-b-2 border-l-2", "-bottom-px -right-px border-b-2 border-r-2"].map(
              (cls) => (
                <span
                  key={cls}
                  className={`absolute h-3 w-3 ${cls} ${
                    det.verified ? "border-hud-red" : "border-hud-amber"
                  }`}
                />
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- narration ticker --- */}
      <div className="absolute bottom-3 left-3 z-30 max-w-[70%]">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-black/60 px-3 py-1.5 font-mono text-xs text-hud-cyan backdrop-blur-sm"
          >
            {phase.narration}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* altitude change callout during the adaptive phase */}
      <AnimatePresence>
        {phase.id === "ADAPTIVE_DECISION" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute right-3 top-3 z-30 border border-hud-cyan/40 bg-black/60 px-3 py-2 font-mono text-xs text-hud-cyan backdrop-blur-sm"
          >
            ALT 18m → 13m ↓
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Corners() {
  return (
    <>
      {[
        "top-2 left-2 border-t border-l",
        "top-2 right-2 border-t border-r",
        "bottom-2 left-2 border-b border-l",
        "bottom-2 right-2 border-b border-r",
      ].map((cls) => (
        <span
          key={cls}
          className={`pointer-events-none absolute z-30 h-6 w-6 border-hud-cyan/50 ${cls}`}
        />
      ))}
    </>
  );
}

/** Stylized top-down vineyard: soil + vine rows + optional diseased patch. */
function VineyardSim({ showDisease }: { showDisease: boolean }) {
  const rows = Array.from({ length: 11 }, (_, i) => i);
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2d1f" />
          <stop offset="100%" stopColor="#2c2217" />
        </linearGradient>
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="g" />
          <feComponentTransfer in="g" result="a">
            <feFuncA type="linear" slope="0.08" />
          </feComponentTransfer>
          <feComposite in="a" in2="SourceGraphic" operator="over" />
        </filter>
        <linearGradient id="vine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f7d3a" />
          <stop offset="50%" stopColor="#2f6330" />
          <stop offset="100%" stopColor="#295328" />
        </linearGradient>
        <radialGradient id="blight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a8842c" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#8a7a2e" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#6b7a33" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1000" height="600" fill="url(#soil)" />

      {/* vine rows */}
      <g filter="url(#rough)">
        {rows.map((r) => {
          const y = 30 + r * 52;
          return (
            <g key={r}>
              <rect x="20" y={y} width="960" height="30" rx="15" fill="url(#vine)" />
              {/* canopy texture blobs */}
              {Array.from({ length: 24 }, (_, i) => (
                <circle
                  key={i}
                  cx={40 + i * 40 + ((r * 13) % 17)}
                  cy={y + 15 + (((i * 7 + r * 5) % 10) - 5)}
                  r={10 + ((i * 3 + r) % 5)}
                  fill={(i + r) % 3 === 0 ? "#356c33" : "#2b5c2c"}
                  opacity="0.8"
                />
              ))}
            </g>
          );
        })}
      </g>

      {/* diseased patch on "row 12" (visual row 5-6, center-right) */}
      {showDisease && (
        <g>
          <ellipse cx="510" cy="272" rx="120" ry="55" fill="url(#blight)" />
          <ellipse cx="560" cy="320" rx="70" ry="32" fill="url(#blight)" opacity="0.8" />
          {Array.from({ length: 14 }, (_, i) => (
            <circle
              key={i}
              cx={440 + ((i * 37) % 190)}
              cy={245 + ((i * 23) % 95)}
              r={4 + (i % 4)}
              fill="#b59a3b"
              opacity="0.65"
            />
          ))}
        </g>
      )}
    </svg>
  );
}
