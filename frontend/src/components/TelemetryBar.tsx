"use client";

import { MissionPhase } from "@/lib/mission";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="hud-label">{label}</span>
      <span className={`font-mono text-sm ${accent ?? "text-hud-text"}`}>{value}</span>
    </div>
  );
}

export default function TelemetryBar({
  phase,
  clock,
}: {
  phase: MissionPhase;
  clock: number;
}) {
  // deterministic battery drain: 92% at t=0, ~86% at end
  const battery = Math.max(0, 92 - clock * 0.033).toFixed(0);
  const mm = String(Math.floor(clock / 60)).padStart(2, "0");
  const ss = String(Math.floor(clock % 60)).padStart(2, "0");

  return (
    <header className="panel flex items-center justify-between border-x-0 border-t-0 px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-base font-bold tracking-[0.3em] text-hud-green">
          SCOUT
        </span>
        <span className="hud-label">Live Mission — Vineyard · Grapevine</span>
      </div>

      <div className="flex items-center gap-6">
        <Stat label="T+" value={`${mm}:${ss}`} />
        <Stat
          label="Battery"
          value={`${battery}%`}
          accent={Number(battery) > 30 ? "text-hud-green" : "text-hud-amber"}
        />
        <Stat label="Altitude" value={`${phase.altitudeM} m`} accent="text-hud-cyan" />
        <Stat label="Wind" value="4 mph" />
        {phase.id === "MISSION_COMPLETE" ? (
          <div className="flex items-center gap-1.5 rounded-sm border border-hud-green/50 bg-hud-green/10 px-2 py-0.5">
            <span className="inline-block h-2 w-2 rounded-full bg-hud-green" />
            <span className="font-mono text-xs font-semibold tracking-widest text-hud-green">
              COMPLETE
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-sm border border-hud-red/50 bg-hud-red/10 px-2 py-0.5">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-hud-red" />
            <span className="font-mono text-xs font-semibold tracking-widest text-hud-red">
              LIVE
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
