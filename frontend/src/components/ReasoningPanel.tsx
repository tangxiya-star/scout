"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MissionPhase } from "@/lib/mission";

const item = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0 },
};

function ConfidenceBar({ value, verified }: { value: number; verified: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="hud-label">Confidence</span>
        <span
          className={`font-mono text-xl font-bold ${
            verified ? "text-hud-red" : pct >= 80 ? "text-hud-green" : "text-hud-amber"
          }`}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-hud-border">
        <motion.div
          className={`h-full rounded-full ${
            verified ? "bg-hud-red" : pct >= 80 ? "bg-hud-green" : "bg-hud-amber"
          }`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function EnvGrid({ phase }: { phase: MissionPhase }) {
  const env = phase.env;
  if (!env) return null;
  const cells: [string, string, string?][] = [
    ["TEMP", `${env.temperatureC}°C`],
    ["HUMIDITY", `${env.humidityPct}%`, "text-hud-amber"],
    ["RAIN 24H", env.recentRainfall ? "YES" : "NO", "text-hud-amber"],
    ["WIND", `${env.windMph} mph`],
    ["SOIL", env.soilMoisture.toUpperCase(), "text-hud-amber"],
    ["RISK", "ELEVATED", "text-hud-red"],
  ];
  return (
    <motion.div {...item} className="grid grid-cols-3 gap-px bg-hud-border">
      {cells.map(([k, v, accent]) => (
        <div key={k} className="bg-hud-panel2 px-2 py-1.5">
          <div className="hud-label text-[9px]">{k}</div>
          <div className={`font-mono text-xs font-semibold ${accent ?? ""}`}>{v}</div>
        </div>
      ))}
    </motion.div>
  );
}

export default function ReasoningPanel({ phase }: { phase: MissionPhase }) {
  const a = phase.assessment;
  const d = phase.decision;

  return (
    <aside className="panel flex h-full flex-col overflow-hidden border-y-0 border-r-0">
      <div className="border-b border-hud-border px-4 py-2.5">
        <div className="hud-label">Scout Reasoning</div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <AnimatePresence mode="popLayout">
          {/* status headline */}
          <motion.div key={`title-${phase.id}`} {...item}>
            <div
              className={`font-semibold ${
                phase.detection?.verified
                  ? "text-hud-red"
                  : phase.detection
                    ? "text-hud-amber"
                    : "text-hud-green"
              }`}
            >
              {phase.title}
            </div>
            {a && <div className="mt-0.5 text-sm text-hud-dim">{a.possibleCondition}</div>}
          </motion.div>

          {a && (
            <motion.div key={`conf-${phase.id}`} {...item}>
              <ConfidenceBar value={a.confidence} verified={!!phase.detection?.verified} />
            </motion.div>
          )}

          {phase.env && <EnvGrid key={`env-${phase.id}`} phase={phase} />}

          {a && a.supportingEvidence.length > 0 && (
            <motion.div key={`ev-${phase.id}`} {...item}>
              <div className="hud-label mb-1.5">Supporting Evidence</div>
              <ul className="space-y-1">
                {a.supportingEvidence.map((e, i) => (
                  <motion.li
                    key={e}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.35 }}
                    className="flex gap-2 text-sm"
                  >
                    <span className="text-hud-green">•</span>
                    <span>{e}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}

          {a && a.uncertainties.length > 0 && (
            <motion.div key={`unc-${phase.id}`} {...item} transition={{ delay: 0.6 }}>
              <div className="hud-label mb-1.5">Uncertainty</div>
              <ul className="space-y-1">
                {a.uncertainties.map((u) => (
                  <li key={u} className="flex gap-2 text-sm text-hud-dim">
                    <span className="text-hud-amber">▲</span>
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* next mission action */}
      <div className="border-t border-hud-border px-4 py-3">
        <div className="hud-label mb-2">Next Mission Action</div>
        <AnimatePresence mode="wait">
          {d ? (
            <motion.div key={d.action + d.headline} {...item}>
              <div className="mb-1.5 inline-block rounded-sm border border-hud-cyan/40 bg-hud-cyan/10 px-2 py-0.5 font-mono text-[11px] font-bold tracking-widest text-hud-cyan">
                {d.action}
              </div>
              <div className="mb-1 text-sm font-medium">{d.headline}</div>
              <ul className="space-y-0.5">
                {d.steps.map((s, i) => (
                  <motion.li
                    key={s}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.3 }}
                    className="font-mono text-xs text-hud-green"
                  >
                    {s}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ) : (
            <motion.div key="scanning" {...item} className="type-caret font-mono text-xs text-hud-dim">
              Monitoring — continue route&nbsp;
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
