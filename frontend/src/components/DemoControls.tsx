"use client";

import { useEffect } from "react";
import { MissionDemo } from "@/lib/useMissionDemo";
import { MISSION_PHASES } from "@/lib/mission";

/**
 * Presenter controls (bottom-left, subtle). Keyboard:
 *   Space — play/pause · → next phase · ← prev phase · R — restart
 */
export default function DemoControls({ demo }: { demo: MissionDemo }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        demo.playing ? demo.pause() : demo.play();
      } else if (e.code === "ArrowRight") demo.nextPhase();
      else if (e.code === "ArrowLeft") demo.prevPhase();
      else if (e.code === "KeyR") demo.restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demo]);

  const btn =
    "cursor-pointer px-2 py-1 font-mono text-xs text-hud-dim hover:text-hud-green transition-colors";

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-sm border border-hud-border bg-black/70 px-2 py-1 backdrop-blur-sm">
      <button className={btn} onClick={demo.prevPhase} title="Prev phase (←)">
        ⏮
      </button>
      <button
        className={`${btn} text-hud-green`}
        onClick={demo.playing ? demo.pause : demo.play}
        title="Play/Pause (Space)"
      >
        {demo.playing ? "⏸" : "▶"}
      </button>
      <button className={btn} onClick={demo.nextPhase} title="Next phase (→)">
        ⏭
      </button>
      <button className={btn} onClick={demo.restart} title="Restart (R)">
        ↻
      </button>
      <button
        className={`${btn} ${demo.speed !== 1 ? "text-hud-amber" : ""}`}
        onClick={() => demo.setSpeed(demo.speed === 1 ? 4 : 1)}
        title="Speed"
      >
        {demo.speed}×
      </button>
      <span className="ml-1 font-mono text-[10px] text-hud-dim">
        {demo.phaseIndex + 1}/{MISSION_PHASES.length} {demo.phase.title}
      </span>
    </div>
  );
}
