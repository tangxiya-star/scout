"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMissionDemo } from "@/lib/useMissionDemo";
import TelemetryBar from "@/components/TelemetryBar";
import DroneVideo from "@/components/DroneVideo";
import ReasoningPanel from "@/components/ReasoningPanel";
import FieldMap from "@/components/FieldMap";
import StatsBar from "@/components/StatsBar";
import MissionComplete from "@/components/MissionComplete";
import DemoControls from "@/components/DemoControls";

export default function Home() {
  const demo = useMissionDemo();
  const complete = demo.phase.id === "MISSION_COMPLETE";

  return (
    <div className="flex h-dvh flex-col">
      <TelemetryBar phase={demo.phase} clock={demo.clock} />

      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {complete ? (
            <motion.div key="report" className="h-full" exit={{ opacity: 0 }}>
              <MissionComplete onRestart={demo.restart} />
            </motion.div>
          ) : (
            <motion.div key="live" className="flex h-full flex-col" exit={{ opacity: 0 }}>
              {/* video + reasoning panel */}
              <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
                <DroneVideo phase={demo.phase} />
                <ReasoningPanel phase={demo.phase} />
              </div>
              {/* field map strip */}
              <div className="h-[168px] shrink-0 border-t border-hud-border">
                <FieldMap zones={demo.phase.zones} progressPct={demo.phase.stats.progressPct} />
              </div>
              <StatsBar phase={demo.phase} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* presenter controls (hidden on report screen; keyboard still works) */}
        {!complete && (
          <div className="absolute bottom-2 left-3 z-50">
            <DemoControls demo={demo} />
          </div>
        )}

        {/* start overlay */}
        <AnimatePresence>
          {!demo.playing && demo.clock === 0 && (
            <motion.button
              exit={{ opacity: 0, scale: 1.05 }}
              onClick={demo.play}
              className="absolute inset-0 z-40 flex cursor-pointer flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm"
            >
              <span className="font-mono text-3xl font-bold tracking-[0.4em] text-hud-green">
                SCOUT
              </span>
              <span className="max-w-md text-center text-sm text-hud-dim">
                Autonomous AI copilot for agricultural drones.
                <br />
                The drone doesn&apos;t just see — it thinks.
              </span>
              <span className="mt-2 rounded-sm border border-hud-green/50 bg-hud-green/10 px-5 py-2 font-mono text-sm font-bold tracking-widest text-hud-green">
                ▶ START MISSION
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
