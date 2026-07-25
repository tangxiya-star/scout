"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMissionDemo } from "@/lib/useMissionDemo";
import { useLiveMission } from "@/lib/liveMission";
import { MISSION_PHASES } from "@/lib/mission";
import TelemetryBar from "@/components/TelemetryBar";
import DroneVideo from "@/components/DroneVideo";
import ReasoningPanel from "@/components/ReasoningPanel";
import FieldMap from "@/components/FieldMap";
import StatsBar from "@/components/StatsBar";
import MissionComplete from "@/components/MissionComplete";
import DemoControls from "@/components/DemoControls";
import SourceToggle from "@/components/SourceToggle";

export default function Home() {
  const demo = useMissionDemo();
  const live = useLiveMission();
  const [mode, setMode] = useState<"local" | "live">("local");

  // Auto-fall back to LOCAL if the backend errors mid-demo (reliability guardrail).
  useEffect(() => {
    if (mode === "live" && live.state === "error") setMode("local");
  }, [mode, live.state]);

  const useLive = mode === "live" && live.phase != null;
  // In LIVE mode the backend drives phases; before the first event arrives,
  // hold on the opening phase so the cockpit is never empty.
  const phase = useLive ? live.phase! : demo.phase;
  const clock = useLive ? 0 : demo.clock;
  const complete = phase.id === "MISSION_COMPLETE";

  const startLive = () => {
    setMode("live");
    live.connect(1);
  };
  const startLocal = () => {
    setMode("local");
    live.disconnect();
  };

  return (
    <div className="flex h-dvh flex-col">
      <TelemetryBar phase={phase} clock={clock} />

      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {complete ? (
            <motion.div key="report" className="h-full" exit={{ opacity: 0 }}>
              <MissionComplete onRestart={useLive ? () => live.connect(1) : demo.restart} />
            </motion.div>
          ) : (
            <motion.div key="live" className="flex h-full flex-col" exit={{ opacity: 0 }}>
              <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
                <DroneVideo phase={phase} />
                <ReasoningPanel phase={phase} />
              </div>
              <div className="h-[168px] shrink-0 border-t border-hud-border">
                <FieldMap zones={phase.zones} progressPct={phase.stats.progressPct} />
              </div>
              <StatsBar phase={phase} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* data-source toggle */}
        <div className="absolute right-3 top-2 z-50">
          <SourceToggle mode={mode} onLocal={startLocal} onLive={startLive} live={live} />
        </div>

        {/* presenter controls — local mode only (backend owns live timing) */}
        {!complete && mode === "local" && (
          <div className="absolute bottom-2 left-3 z-50">
            <DemoControls demo={demo} />
          </div>
        )}

        {/* live connecting hint */}
        {mode === "live" && live.state === "connecting" && (
          <div className="absolute bottom-2 left-3 z-50 rounded-sm border border-hud-border bg-black/70 px-3 py-1 font-mono text-xs text-hud-amber">
            connecting to backend…
          </div>
        )}

        {/* start overlay (local mode) */}
        <AnimatePresence>
          {mode === "local" && !demo.playing && demo.clock === 0 && (
            <motion.div
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm"
            >
              <span className="font-mono text-3xl font-bold tracking-[0.4em] text-hud-green">
                SCOUT
              </span>
              <span className="max-w-md text-center text-sm text-hud-dim">
                Autonomous AI copilot for agricultural drones.
                <br />
                The drone doesn&apos;t just see — it thinks.
              </span>
              <div className="mt-2 flex gap-3">
                <button
                  onClick={demo.play}
                  className="cursor-pointer rounded-sm border border-hud-green/50 bg-hud-green/10 px-5 py-2 font-mono text-sm font-bold tracking-widest text-hud-green transition-colors hover:bg-hud-green/20"
                >
                  ▶ START MISSION
                </button>
                <button
                  onClick={startLive}
                  className="cursor-pointer rounded-sm border border-hud-border px-5 py-2 font-mono text-sm tracking-widest text-hud-dim transition-colors hover:text-hud-text"
                >
                  ◉ LIVE BACKEND
                </button>
              </div>
              <span className="font-mono text-[10px] text-hud-dim">
                {MISSION_PHASES.length} phases · deterministic 3-min demo
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
