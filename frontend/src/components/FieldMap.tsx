"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MapZones } from "@/lib/mission";

/** Serpentine flight path over the field, in a 400×150 viewBox. */
const PATH_POINTS: [number, number][] = [
  [24, 22], [376, 22], [376, 54], [24, 54], [24, 86], [376, 86], [376, 118], [24, 118],
];

function pathLength(pts: [number, number][]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return L;
}

/** Point at fraction t (0..1) along the polyline. */
function pointAlong(pts: [number, number][], t: number): [number, number] {
  const total = pathLength(pts);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= seg) {
      const f = seg === 0 ? 0 : target / seg;
      return [
        pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
        pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
      ];
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}

const d = "M " + PATH_POINTS.map((p) => p.join(" ")).join(" L ");

// Anomaly location — mid-field, second row ("Row 12, Section B")
const ANOMALY: [number, number] = [212, 54];

export default function FieldMap({
  zones,
  progressPct,
  report = false,
}: {
  zones: MapZones;
  progressPct: number;
  /** report mode: static health map for the mission-complete screen */
  report?: boolean;
}) {
  const t = Math.min(1, progressPct / 100);
  const [dx, dy] = pointAlong(PATH_POINTS, t);

  return (
    <div className="map-grid relative h-full w-full bg-hud-panel2">
      <svg
        className="h-full w-full"
        viewBox="0 0 400 150"
        preserveAspectRatio={report ? "xMidYMid meet" : "none"}
      >
        {/* field boundary */}
        <rect x="12" y="10" width="376" height="120" rx="3" fill="rgba(52,211,153,0.05)" stroke="#1d3328" />

        {/* vine rows */}
        {[22, 54, 86, 118].map((y) => (
          <line key={y} x1="24" y1={y} x2="376" y2={y} stroke="#234433" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
        ))}

        {/* healthy shading in report mode */}
        {report && (
          <rect x="12" y="10" width="376" height="120" rx="3" fill="rgba(52,211,153,0.08)" />
        )}

        {/* flown portion of the path */}
        {!report && (
          <path className="path-anim" d={d} fill="none" stroke="#67e8f9" strokeWidth="1.5" opacity="0.75"
            pathLength={1} strokeDashoffset={0} style={{ strokeDasharray: `${t} 1` }} />
        )}
        {/* full path ghost */}
        <path d={d} fill="none" stroke="#67e8f9" strokeWidth="1" opacity={report ? 0.25 : 0.15} strokeDasharray="3 4" />

        {/* inspection (monitor) zone */}
        <AnimatePresence>
          {zones.inspection && (
            <motion.ellipse
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              cx={ANOMALY[0]} cy={ANOMALY[1]} rx="52" ry="24"
              fill="rgba(251,191,36,0.13)" stroke="#fbbf24" strokeWidth="1" strokeDasharray="4 3"
            />
          )}
        </AnimatePresence>

        {/* localized treatment polygon */}
        <AnimatePresence>
          {zones.treatment && (
            <motion.polygon
              initial={{ opacity: 0, scale: 1.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              style={{ transformOrigin: `${ANOMALY[0]}px ${ANOMALY[1]}px` }}
              points={`${ANOMALY[0] - 26},${ANOMALY[1] - 9} ${ANOMALY[0] + 20},${ANOMALY[1] - 12} ${ANOMALY[0] + 28},${ANOMALY[1] + 8} ${ANOMALY[0] - 6},${ANOMALY[1] + 13} ${ANOMALY[0] - 30},${ANOMALY[1] + 5}`}
              fill="rgba(248,113,113,0.25)" stroke="#f87171" strokeWidth="1.5"
            />
          )}
        </AnimatePresence>

        {/* anomaly marker */}
        <AnimatePresence>
          {zones.anomaly && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <circle cx={ANOMALY[0]} cy={ANOMALY[1]} r="3" fill="#fbbf24" />
              <circle cx={ANOMALY[0]} cy={ANOMALY[1]} r="7" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.6">
                <animate attributeName="r" values="4;11" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            </motion.g>
          )}
        </AnimatePresence>

        {/* drone */}
        {!report && (
          <g transform={`translate(${dx} ${dy})`}>
            <circle r="4.5" fill="#07100c" stroke="#67e8f9" strokeWidth="1.5" />
            <circle r="1.5" fill="#67e8f9" />
          </g>
        )}
      </svg>

      {/* legend */}
      <div className="absolute bottom-1.5 right-2 flex gap-3 font-mono text-[9px] text-hud-dim">
        <span><span className="text-hud-green">■</span> Healthy</span>
        <span><span className="text-hud-amber">■</span> Needs Inspection</span>
        <span><span className="text-hud-red">■</span> Proposed Treatment</span>
      </div>
      <div className="hud-label absolute left-2 top-1.5">Field Map — Block C</div>
    </div>
  );
}
