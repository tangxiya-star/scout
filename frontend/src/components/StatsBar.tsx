"use client";

import { MissionPhase } from "@/lib/mission";

function Cell({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="hud-label">{label}</span>
      <span className={`font-mono text-sm font-semibold ${accent ?? ""}`}>{value}</span>
    </div>
  );
}

export default function StatsBar({ phase }: { phase: MissionPhase }) {
  const s = phase.stats;
  return (
    <footer className="panel flex items-center justify-between border-x-0 border-b-0 px-4 py-2">
      <div className="flex flex-1 items-center gap-3">
        <span className="hud-label">Mission Progress</span>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-hud-border">
          <div
            className="h-full rounded-full bg-hud-green transition-[width] duration-700"
            style={{ width: `${s.progressPct}%` }}
          />
        </div>
        <span className="font-mono text-sm font-semibold text-hud-green">{s.progressPct}%</span>
      </div>
      <div className="flex items-center gap-8">
        <Cell label="Anomalies" value={s.anomalies} accent="text-hud-amber" />
        <Cell label="Verified" value={s.verified} accent="text-hud-red" />
        <Cell label="Pending Inspection" value={s.pending} />
      </div>
    </footer>
  );
}
