"use client";

/**
 * Disease-spread forecast — Scout's "thinks ahead" layer.
 *
 * Takes the verified infection hotspot and projects it forward: how the
 * affected cells grow at NOW / +24h / +72h under the current agroclimate
 * (high humidity + recent rain = aggressive spread), and what action each
 * horizon calls for. Turns detection into a timed treatment decision and the
 * coverage-reduction case for acting early.
 *
 * Reuses DetectionGrid's deterministic cell model with a per-horizon spread.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import DetectionGrid, { countStatuses } from "@/components/DetectionGrid";

const BLOCK_ACRES = 24.6;
const CELLS = 264; // COLS*ROWS in DetectionGrid
const ACRES_PER_CELL = BLOCK_ACRES / CELLS;

interface Horizon {
  key: string;
  label: string;
  spread: number;
  action: string;
  code: string;
  tone: "green" | "amber" | "red";
}

const HORIZONS: Horizon[] = [
  {
    key: "now",
    label: "NOW",
    spread: 0,
    code: "SPOT_TREAT",
    tone: "green",
    action: "Spot-treat the verified zone only. Localized — no block-wide spray needed.",
  },
  {
    key: "24h",
    label: "+24 H",
    spread: 0.5,
    code: "TREAT_BUFFER",
    tone: "amber",
    action: "91% humidity + rain in last 24 h drives spread to adjacent rows. Treat a one-row buffer or re-inspect tomorrow.",
  },
  {
    key: "72h",
    label: "+72 H",
    spread: 1,
    code: "ESCALATE",
    tone: "red",
    action: "If untreated, infection goes block-wide. Full-block treatment + agronomist review recommended.",
  },
];

const TONE: Record<Horizon["tone"], string> = {
  green: "text-hud-green",
  amber: "text-hud-amber",
  red: "text-hud-red",
};

export default function SpreadForecast() {
  const [i, setI] = useState(0);
  const h = HORIZONS[i];
  const { infected, suspected } = countStatuses(h.spread);
  const infAcres = infected * ACRES_PER_CELL;
  const atRiskAcres = (infected + suspected) * ACRES_PER_CELL;
  // Coverage saved by acting at this horizon vs. treating the whole block.
  const reductionPct = Math.round((1 - infAcres / BLOCK_ACRES) * 100);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="hud-label">Spread Forecast · Block C</div>
        <div className="font-mono text-[10px] text-hud-dim">driver: humidity 91% · rain 24 h · soil elevated</div>
      </div>

      {/* horizon timeline */}
      <div className="mb-2 flex gap-1.5">
        {HORIZONS.map((hz, idx) => (
          <button
            key={hz.key}
            onClick={() => setI(idx)}
            className={`flex-1 cursor-pointer rounded-sm border px-2 py-1 font-mono text-xs tracking-widest transition-colors ${
              idx === i
                ? "border-hud-cyan/60 bg-hud-cyan/10 text-hud-cyan"
                : "border-hud-border text-hud-dim hover:text-hud-text"
            }`}
          >
            {hz.label}
          </button>
        ))}
      </div>

      {/* forecast grid */}
      <div className="relative min-h-[150px] flex-1 overflow-hidden rounded-sm border border-hud-border bg-black/40 map-grid">
        <motion.div key={h.key} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="absolute inset-0">
          <DetectionGrid t={1} spread={h.spread} />
        </motion.div>
        <div className="absolute bottom-1.5 left-2 z-30 font-mono text-[10px] text-hud-dim">
          ■ <span className="text-hud-red">infected</span> · ■ <span className="text-hud-amber">at-risk</span> · projected extent
        </div>
      </div>

      {/* horizon readout */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Stat label="Infected area" value={`${infAcres.toFixed(1)} ac`} accent="text-hud-red" />
        <Stat label="At-risk area" value={`${atRiskAcres.toFixed(1)} ac`} accent="text-hud-amber" />
        <Stat label="Coverage vs block" value={`treat ${Math.round((infAcres / BLOCK_ACRES) * 100)}%`} accent="text-hud-green" sub={`${reductionPct}% less than full-field`} />
      </div>

      <div className="mt-2 rounded-sm border border-hud-border bg-black/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="hud-label">Recommended action</span>
          <span className={`rounded-sm border border-current px-1.5 py-0.5 font-mono text-[10px] font-bold ${TONE[h.tone]}`}>{h.code}</span>
        </div>
        <div className="mt-1 text-sm text-hud-text">{h.action}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="rounded-sm border border-hud-border bg-black/30 px-2.5 py-1.5">
      <div className="hud-label">{label}</div>
      <div className={`font-mono text-base font-bold ${accent ?? "text-hud-text"}`}>{value}</div>
      {sub && <div className="text-[10px] text-hud-dim">{sub}</div>}
    </div>
  );
}
