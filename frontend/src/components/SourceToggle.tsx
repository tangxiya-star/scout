"use client";

import { LiveMission } from "@/lib/liveMission";

/**
 * Data-source switch (top-right of the stage). LOCAL is the self-contained
 * scripted demo (default, always reliable). LIVE streams the FastAPI backend
 * — real env + reasoning engine — and shows provenance badges.
 */
export default function SourceToggle({
  mode,
  onLocal,
  onLive,
  live,
}: {
  mode: "local" | "live";
  onLocal: () => void;
  onLive: () => void;
  live: LiveMission;
}) {
  const dot =
    live.state === "streaming" || live.state === "complete"
      ? "bg-hud-green"
      : live.state === "connecting"
        ? "bg-hud-amber"
        : live.state === "error"
          ? "bg-hud-red"
          : "bg-hud-dim";

  return (
    <div className="flex items-center gap-2 rounded-sm border border-hud-border bg-black/70 px-2 py-1 backdrop-blur-sm">
      <button
        onClick={onLocal}
        className={`cursor-pointer px-2 py-0.5 font-mono text-[11px] tracking-wider transition-colors ${
          mode === "local" ? "text-hud-green" : "text-hud-dim hover:text-hud-text"
        }`}
      >
        LOCAL
      </button>
      <span className="text-hud-border">|</span>
      <button
        onClick={onLive}
        className={`flex cursor-pointer items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] tracking-wider transition-colors ${
          mode === "live" ? "text-hud-green" : "text-hud-dim hover:text-hud-text"
        }`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
        LIVE
      </button>

      {mode === "live" && (
        <div className="flex items-center gap-1.5 border-l border-hud-border pl-2 font-mono text-[9px] text-hud-dim">
          {live.envSource && <span>env:{live.envSource}</span>}
          {live.reasoningSource && (
            <span
              className={
                live.reasoningSource === "claude" ? "text-hud-cyan" : ""
              }
            >
              ai:{live.reasoningSource}
            </span>
          )}
          {live.state === "error" && (
            <span className="text-hud-red">backend offline → LOCAL</span>
          )}
        </div>
      )}
    </div>
  );
}
