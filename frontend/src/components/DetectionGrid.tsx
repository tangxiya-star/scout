"use client";

/**
 * Per-cell disease detection grid.
 *
 * Overlays the canopy feed with a scanning grid of many small boxes — most
 * healthy (dim green), a cluster of infected (red) with a suspected ring
 * (amber). A scan line sweeps left→right and the boxes populate progressively
 * as it passes, so the pilot literally watches Scout mark the affected area.
 *
 * Deterministic layout (a fixed hotspot + hashed jitter) so the demo is
 * identical every run. `t` (0..1) drives how far the scan has progressed;
 * pass a growing value to animate the reveal, or 1 to show the finished grid.
 */

import { useEffect, useState } from "react";

const COLS = 22;
const ROWS = 12;
const HOTSPOT = { c: 13.5, r: 6 };

export type CellStatus = "healthy" | "suspected" | "infected";

/** Deterministic pseudo-noise in [0,1) for cell (c,r). */
function jitter(c: number, r: number) {
  const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Classify a cell; `spread` (0..1+) widens the infected/suspected radii. */
export function cellStatus(c: number, r: number, spread = 0): CellStatus {
  const d = Math.hypot((c - HOTSPOT.c) * 1.15, c === r ? 0 : (r - HOTSPOT.r)) - jitter(c, r) * 1.1;
  const inf = 2.1 + spread * 3.4;
  const sus = 3.6 + spread * 3.6;
  if (d < inf) return "infected";
  if (d < sus) return "suspected";
  return "healthy";
}

export function countStatuses(spread = 0) {
  let infected = 0;
  let suspected = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const s = cellStatus(c, r, spread);
      if (s === "infected") infected++;
      else if (s === "suspected") suspected++;
    }
  return { infected, suspected, total: COLS * ROWS };
}

const COLOR: Record<CellStatus, { border: string; bg: string }> = {
  healthy: { border: "rgba(52,211,153,0.28)", bg: "transparent" },
  suspected: { border: "rgba(251,191,36,0.9)", bg: "rgba(251,191,36,0.16)" },
  infected: { border: "rgba(248,113,113,0.95)", bg: "rgba(248,113,113,0.32)" },
};

/**
 * `t` (0..1) is scan progress. Omit it to self-animate a one-time left→right
 * scan on mount (used live over the feed); pass t=1 for a finished grid (used
 * by the forecast panel).
 */
export default function DetectionGrid({ t, spread = 0, scanMs = 2600 }: { t?: number; spread?: number; scanMs?: number }) {
  const [selfT, setSelfT] = useState(t ?? 0);
  useEffect(() => {
    if (t !== undefined) return; // controlled
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / scanMs);
      setSelfT(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [t, scanMs]);
  const effT = t ?? selfT;
  const scanCol = effT * (COLS + 1);
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const revealed = c < scanCol;
      const status = cellStatus(c, r, spread);
      if (status === "healthy" && jitter(r, c) > 0.5) {
        // thin out healthy cells so the infected cluster reads clearly
        cells.push(<div key={`${c}-${r}`} />);
        continue;
      }
      const col = COLOR[status];
      cells.push(
        <div
          key={`${c}-${r}`}
          className="relative m-[1.5px] rounded-[1px] transition-opacity duration-300"
          style={{
            opacity: revealed ? 1 : 0,
            border: `1px solid ${col.border}`,
            background: col.bg,
          }}
        />,
      );
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      >
        {cells}
      </div>
      {/* sweeping scan line */}
      {effT < 1 && (
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-hud-cyan/70"
          style={{ left: `${(scanCol / COLS) * 100}%`, boxShadow: "0 0 12px 2px rgba(103,232,249,0.6)" }}
        />
      )}
    </div>
  );
}
