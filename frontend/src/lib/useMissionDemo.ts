"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEMO_DURATION_S,
  MISSION_PHASES,
  MissionPhase,
  phaseAt,
  phaseIndexAt,
} from "./mission";

export interface MissionDemo {
  clock: number; // seconds on the demo timeline
  playing: boolean;
  speed: number;
  phase: MissionPhase;
  phaseIndex: number;
  /** seconds elapsed inside the current phase (drives staggered reveals) */
  phaseElapsed: number;
  progress: number; // 0..1 of full demo
  play: () => void;
  pause: () => void;
  restart: () => void;
  nextPhase: () => void;
  prevPhase: () => void;
  setSpeed: (s: number) => void;
}

/**
 * Drives the deterministic demo clock. requestAnimationFrame-based so the
 * timeline stays smooth; all displayed state derives from `clock` alone,
 * which keeps every run identical (demo-reliability guardrail).
 */
export function useMissionDemo(): MissionDemo {
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    const tick = (now: number) => {
      if (last.current != null) {
        const dt = ((now - last.current) / 1000) * speedRef.current;
        setClock((c) => Math.min(DEMO_DURATION_S, c + dt));
      }
      last.current = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  // auto-pause at the end
  useEffect(() => {
    if (clock >= DEMO_DURATION_S && playing) setPlaying(false);
  }, [clock, playing]);

  const phase = phaseAt(clock);
  const phaseIndex = phaseIndexAt(clock);

  const play = useCallback(() => {
    setClock((c) => (c >= DEMO_DURATION_S ? 0 : c));
    setPlaying(true);
  }, []);
  const pause = useCallback(() => setPlaying(false), []);
  const restart = useCallback(() => {
    setClock(0);
    setPlaying(true);
  }, []);
  const nextPhase = useCallback(() => {
    setClock((c) => {
      const i = phaseIndexAt(c);
      return i < MISSION_PHASES.length - 1 ? MISSION_PHASES[i + 1].t : DEMO_DURATION_S;
    });
  }, []);
  const prevPhase = useCallback(() => {
    setClock((c) => {
      const i = phaseIndexAt(c);
      // if we're >2s into a phase, jump to its start; otherwise previous phase
      const start = MISSION_PHASES[i].t;
      if (c - start > 2) return start;
      return i > 0 ? MISSION_PHASES[i - 1].t : 0;
    });
  }, []);

  return {
    clock,
    playing,
    speed,
    phase,
    phaseIndex,
    phaseElapsed: clock - phase.t,
    progress: clock / DEMO_DURATION_S,
    play,
    pause,
    restart,
    nextPhase,
    prevPhase,
    setSpeed,
  };
}
