"use client";

import { motion } from "framer-motion";
import { MISSION_REPORT } from "@/lib/mission";
import SpreadForecast from "./SpreadForecast";

const stagger = {
  initial: { opacity: 0, y: 14 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.12, duration: 0.5 },
  }),
};

function BigStat({
  label,
  value,
  sub,
  accent,
  i,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  i: number;
}) {
  return (
    <motion.div variants={stagger} initial="initial" animate="animate" custom={i} className="panel px-4 py-3">
      <div className="hud-label mb-1">{label}</div>
      <div className={`font-mono text-2xl font-bold ${accent ?? "text-hud-text"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-hud-dim">{sub}</div>}
    </motion.div>
  );
}

export default function MissionComplete({ onRestart }: { onRestart: () => void }) {
  const r = MISSION_REPORT;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col gap-3 overflow-y-auto p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-lg font-bold tracking-[0.25em] text-hud-green">
            MISSION COMPLETE
          </div>
          <div className="text-sm text-hud-dim">
            Vineyard Block C · Grapevine · Suspected fungal condition — verified during flight
          </div>
        </div>
        <span className="rounded-sm border border-hud-green/50 bg-hud-green/10 px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-hud-green">
          ✓ VERIFIED IN-FLIGHT
        </span>
      </div>

      {/* impact stats */}
      <div className="grid grid-cols-5 gap-3">
        <BigStat i={0} label="Field Inspected" value={`${r.fieldInspectedAcres} ac`} />
        <BigStat i={1} label="Verified Anomalies" value={String(r.verifiedAnomalies)} accent="text-hud-amber" />
        <BigStat i={2} label="False Alarms Dismissed" value={String(r.falseAlarmsDismissed)} />
        <BigStat
          i={3}
          label="Proposed Treatment Area"
          value={`${r.proposedTreatmentAreaPct}%`}
          sub="of inspected region"
          accent="text-hud-red"
        />
        <BigStat
          i={4}
          label="Est. Reduction in Treated Coverage"
          value={`${r.estimatedCoverageReductionPct}%`}
          sub="1 − (recommended ÷ baseline area)"
          accent="text-hud-green"
        />
      </div>

      {/* spread forecast (prediction layer) + recommendation */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.5fr_1fr] gap-3">
        <motion.div variants={stagger} initial="initial" animate="animate" custom={5} className="panel min-h-[240px] px-3 py-3">
          <SpreadForecast />
        </motion.div>

        <motion.div variants={stagger} initial="initial" animate="animate" custom={6} className="panel flex flex-col px-4 py-3">
          <div className="hud-label mb-2">Standing Recommendation</div>
          <ul className="space-y-2.5">
            {r.recommendations.map((rec, i) => (
              <li key={rec} className="flex gap-2 text-sm">
                <span className={i === 2 ? "text-hud-amber" : "text-hud-green"}>
                  {i === 2 ? "▲" : "→"}
                </span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-3 text-[11px] leading-relaxed text-hud-dim">
            Scout recommends <em>whether</em> intervention may be needed, <em>where</em>, and <em>by when</em> —
            not chemical products or doses. Final treatment decisions require professional review.
          </div>
        </motion.div>
      </div>

      {/* actions */}
      <motion.div variants={stagger} initial="initial" animate="animate" custom={7} className="flex gap-3">
        {["Export Report", "Review Evidence", "Create Follow-Up Mission"].map((label) => (
          <button
            key={label}
            className="panel cursor-pointer px-4 py-2 font-mono text-xs tracking-wider text-hud-text transition-colors hover:border-hud-green/60 hover:text-hud-green"
          >
            {label}
          </button>
        ))}
        <button
          onClick={onRestart}
          className="ml-auto cursor-pointer rounded-sm border border-hud-green/50 bg-hud-green/10 px-4 py-2 font-mono text-xs font-bold tracking-wider text-hud-green transition-colors hover:bg-hud-green/20"
        >
          ↻ Replay Demo
        </button>
      </motion.div>
    </motion.div>
  );
}
