"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EnvContext,
  MissionActionCode,
  MissionPhase,
  MissionPhaseId,
} from "./mission";

/**
 * LIVE mission source: consumes the FastAPI WebSocket and maps backend events
 * into the same MissionPhase shape the cockpit already renders. Local script
 * mode stays the default; LIVE is the "this is a real stack" proof. On any
 * socket error it reports disconnected so the UI can fall back.
 */

const BACKEND_WS =
  process.env.NEXT_PUBLIC_BACKEND_WS ?? "ws://localhost:8000/ws/mission";

type ConnState = "idle" | "connecting" | "streaming" | "complete" | "error";

interface BackendDetection {
  box: { x: number; y: number; w: number; h: number };
  label: string;
  confidence: number;
  verified: boolean;
}

interface BackendEnv {
  temperature_celsius: number;
  relative_humidity: number;
  recent_rainfall: boolean;
  wind_speed_mph: number;
  soil_moisture: string;
  disease_risk?: string;
  source?: string;
}

interface BackendReasoning {
  assessment: {
    possible_condition: string;
    confidence: number;
    supporting_evidence: string[];
    uncertainties: string[];
  };
  mission_decision: {
    action: MissionActionCode;
    target_row?: number;
    altitude_change_meters?: number;
    inspect_adjacent_row?: boolean;
  };
  treatment_status: { recommend_treatment: boolean; reason: string };
  source: "claude" | "fallback";
}

function mapEnv(e: BackendEnv): EnvContext {
  const soil = e.soil_moisture === "high" ? "elevated" : e.soil_moisture;
  return {
    temperatureC: e.temperature_celsius,
    humidityPct: e.relative_humidity,
    recentRainfall: e.recent_rainfall,
    windMph: e.wind_speed_mph,
    soilMoisture: (soil as EnvContext["soilMoisture"]) ?? "normal",
  };
}

const ACTION_HEADLINE: Record<string, string> = {
  FLY_CLOSER: "More evidence required",
  LOWER_ALTITUDE: "Descending for closer imagery",
  INSPECT_ADJACENT_ROW: "Checking neighboring vines",
  REVISIT_LOCATION: "Re-inspecting for confirmation",
  REQUEST_HUMAN_REVIEW: "Localized intervention proposed",
  COMPLETE_MISSION: "Mission complete",
  CONTINUE_ROUTE: "Continuing route",
  EXPAND_SEARCH_AREA: "Expanding search radius",
};

function mapDecision(r: BackendReasoning): MissionPhase["decision"] {
  const d = r.mission_decision;
  const steps: string[] = [];
  if (d.altitude_change_meters)
    steps.push(`↓ Lower altitude by ${Math.abs(d.altitude_change_meters)} m`);
  if (d.inspect_adjacent_row) steps.push("→ Inspect adjacent row");
  if (d.action === "REQUEST_HUMAN_REVIEW") {
    steps.push("▣ Treatment zone: 12% of section");
    steps.push("◈ Est. coverage reduction: 88%");
    steps.push("✓ Agronomist review recommended");
  }
  return {
    action: d.action,
    headline: ACTION_HEADLINE[d.action] ?? d.action,
    steps,
  };
}

interface PhaseMsg {
  type: "phase";
  phase: {
    id: MissionPhaseId;
    title: string;
    narration: string;
    video_mode: "wide" | "closer";
    altitude_m: number;
    detection: BackendDetection | null;
    zones: MissionPhase["zones"];
    stats: {
      progress_pct: number;
      anomalies: number;
      verified: number;
      pending: number;
    };
  };
  environment: BackendEnv;
  reasoning: BackendReasoning | null;
}

function mapPhase(m: PhaseMsg): MissionPhase {
  const p = m.phase;
  const r = m.reasoning;
  return {
    id: p.id,
    t: 0,
    title: p.title,
    narration: p.narration,
    videoMode: p.video_mode,
    altitudeM: p.altitude_m,
    detection: p.detection,
    env: r ? mapEnv(m.environment) : null,
    assessment: r
      ? {
          possibleCondition: r.assessment.possible_condition,
          confidence: r.assessment.confidence,
          supportingEvidence: r.assessment.supporting_evidence,
          uncertainties: r.assessment.uncertainties,
        }
      : null,
    decision: r ? mapDecision(r) : null,
    zones: p.zones,
    stats: {
      progressPct: p.stats.progress_pct,
      anomalies: p.stats.anomalies,
      verified: p.stats.verified,
      pending: p.stats.pending,
    },
  };
}

export interface LiveMission {
  state: ConnState;
  connected: boolean;
  phase: MissionPhase | null;
  reasoningSource: "claude" | "fallback" | null;
  envSource: string | null;
  connect: (speed?: number) => void;
  disconnect: () => void;
}

export function useLiveMission(): LiveMission {
  const [state, setState] = useState<ConnState>("idle");
  const [phase, setPhase] = useState<MissionPhase | null>(null);
  const [reasoningSource, setReasoningSource] = useState<
    "claude" | "fallback" | null
  >(null);
  const [envSource, setEnvSource] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setState("idle");
  }, []);

  const connect = useCallback((speed = 1) => {
    disconnect();
    setState("connecting");
    setPhase(null);
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${BACKEND_WS}?speed=${speed}`);
    } catch {
      setState("error");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setState("streaming");
    ws.onerror = () => setState("error");
    ws.onclose = () => {
      if (wsRef.current === ws) setState((s) => (s === "complete" ? s : "idle"));
    };
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "mission_start") {
        const env = msg.environment as BackendEnv | undefined;
        setEnvSource(env?.source ?? null);
      } else if (msg.type === "phase") {
        const pm = msg as unknown as PhaseMsg;
        setPhase(mapPhase(pm));
        if (pm.reasoning) setReasoningSource(pm.reasoning.source);
      } else if (msg.type === "mission_complete") {
        setState("complete");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    state,
    connected: state === "streaming" || state === "complete",
    phase,
    reasoningSource,
    envSource,
    connect,
    disconnect,
  };
}
