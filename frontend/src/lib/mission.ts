/**
 * Deterministic mission demo script.
 *
 * The 3-minute demo (PRD §26) is driven by this fixed timeline — no backend,
 * no external calls, nothing that can fail live. Later, the same state shape
 * can be fed by WebSocket events from the FastAPI backend instead.
 */

export type MissionPhaseId =
  | "OPENING"
  | "ANOMALY_DETECTED"
  | "ENV_REASONING"
  | "ADAPTIVE_DECISION"
  | "VERIFICATION"
  | "LOCALIZED_ACTION"
  | "MISSION_COMPLETE";

export type MissionActionCode =
  | "CONTINUE_ROUTE"
  | "FLY_CLOSER"
  | "LOWER_ALTITUDE"
  | "INSPECT_ADJACENT_ROW"
  | "REVISIT_LOCATION"
  | "EXPAND_SEARCH_AREA"
  | "REQUEST_HUMAN_REVIEW"
  | "COMPLETE_MISSION";

/** Mirrors PRD §13 reasoning output (assessment / mission_decision / treatment_status). */
export interface Assessment {
  possibleCondition: string;
  confidence: number; // 0..1
  supportingEvidence: string[];
  uncertainties: string[];
}

export interface MissionDecision {
  action: MissionActionCode;
  headline: string;
  steps: string[]; // e.g. ["↓ Lower altitude by 5m", "→ Inspect adjacent row"]
}

export interface EnvContext {
  temperatureC: number;
  humidityPct: number;
  recentRainfall: boolean;
  windMph: number;
  soilMoisture: "low" | "normal" | "elevated";
}

export interface Detection {
  /** Bounding box in % of the video frame */
  box: { x: number; y: number; w: number; h: number };
  label: string;
  confidence: number;
  verified: boolean;
}

export interface MapZones {
  /** anomaly marker visible on map */
  anomaly: boolean;
  /** amber "needs inspection" region */
  inspection: boolean;
  /** red localized treatment polygon */
  treatment: boolean;
}

export interface MissionPhase {
  id: MissionPhaseId;
  /** phase start time in seconds on the demo clock */
  t: number;
  title: string;
  /** narration line shown in the reasoning panel header area */
  narration: string;
  videoMode: "wide" | "closer";
  altitudeM: number;
  detection: Detection | null;
  env: EnvContext | null;
  assessment: Assessment | null;
  decision: MissionDecision | null;
  zones: MapZones;
  stats: { progressPct: number; anomalies: number; verified: number; pending: number };
}

export const DEMO_DURATION_S = 180;

const ENV: EnvContext = {
  temperatureC: 29,
  humidityPct: 91,
  recentRainfall: true,
  windMph: 4,
  soilMoisture: "elevated",
};

const NO_ZONES: MapZones = { anomaly: false, inspection: false, treatment: false };

/** The locked demo storyline: grapevine + suspected fungal condition. */
export const MISSION_PHASES: MissionPhase[] = [
  {
    id: "OPENING",
    t: 0,
    title: "Scanning",
    narration: "Autonomous inspection in progress. Scanning vineyard rows…",
    videoMode: "wide",
    altitudeM: 18,
    detection: null,
    env: null,
    assessment: null,
    decision: null,
    zones: NO_ZONES,
    stats: { progressPct: 8, anomalies: 0, verified: 0, pending: 0 },
  },
  {
    id: "ANOMALY_DETECTED",
    t: 20,
    title: "Anomaly Detected",
    narration: "Suspicious crop region detected on Row 12. Tracking across frames…",
    videoMode: "wide",
    altitudeM: 18,
    detection: {
      box: { x: 38, y: 34, w: 26, h: 22 },
      label: "SUSPICIOUS CROP REGION",
      confidence: 0.64,
      verified: false,
    },
    env: null,
    assessment: {
      possibleCondition: "Possible fungal condition",
      confidence: 0.64,
      supportingEvidence: ["Abnormal leaf discoloration", "Pattern differs from neighboring vines"],
      uncertainties: ["Single observation — needs multi-frame confirmation"],
    },
    decision: null,
    zones: { anomaly: true, inspection: false, treatment: false },
    stats: { progressPct: 22, anomalies: 1, verified: 0, pending: 1 },
  },
  {
    id: "ENV_REASONING",
    t: 50,
    title: "Environmental Reasoning",
    narration: "Retrieving environmental context and evaluating disease risk…",
    videoMode: "wide",
    altitudeM: 18,
    detection: {
      box: { x: 38, y: 34, w: 26, h: 22 },
      label: "SUSPICIOUS CROP REGION",
      confidence: 0.68,
      verified: false,
    },
    env: ENV,
    assessment: {
      possibleCondition: "Possible fungal condition",
      confidence: 0.68,
      supportingEvidence: [
        "Leaf discoloration",
        "High humidity (91%)",
        "Recent rainfall",
        "Multiple plants affected",
      ],
      uncertainties: [
        "Image resolution insufficient to rule out nutrient stress",
      ],
    },
    decision: null,
    zones: { anomaly: true, inspection: true, treatment: false },
    stats: { progressPct: 38, anomalies: 1, verified: 0, pending: 1 },
  },
  {
    id: "ADAPTIVE_DECISION",
    t: 80,
    title: "Adaptive Mission Decision",
    narration: "Evidence is suggestive but insufficient. Adapting the mission…",
    videoMode: "closer",
    altitudeM: 13,
    detection: {
      box: { x: 30, y: 26, w: 40, h: 36 },
      label: "SUSPICIOUS CROP REGION",
      confidence: 0.68,
      verified: false,
    },
    env: ENV,
    assessment: {
      possibleCondition: "Possible fungal condition",
      confidence: 0.68,
      supportingEvidence: [
        "Leaf discoloration",
        "High humidity (91%)",
        "Recent rainfall",
        "Multiple plants affected",
      ],
      uncertainties: [
        "Image resolution insufficient to rule out nutrient stress",
      ],
    },
    decision: {
      action: "FLY_CLOSER",
      headline: "More evidence required",
      steps: ["↓ Lower altitude by 5 m", "→ Inspect adjacent row"],
    },
    zones: { anomaly: true, inspection: true, treatment: false },
    stats: { progressPct: 55, anomalies: 2, verified: 0, pending: 2 },
  },
  {
    id: "VERIFICATION",
    t: 110,
    title: "Verification",
    narration: "Closer imagery confirms consistent symptoms across nearby plants.",
    videoMode: "closer",
    altitudeM: 13,
    detection: {
      box: { x: 26, y: 22, w: 48, h: 44 },
      label: "VERIFIED ANOMALY",
      confidence: 0.92,
      verified: true,
    },
    env: ENV,
    assessment: {
      possibleCondition: "Suspected fungal disease (verified visual pattern)",
      confidence: 0.92,
      supportingEvidence: [
        "Disease-consistent pattern at close range",
        "Multiple adjacent plants affected",
        "High humidity + recent rainfall",
        "Elevated soil moisture",
      ],
      uncertainties: ["Species-level identification requires expert review"],
    },
    decision: {
      action: "REVISIT_LOCATION",
      headline: "Confidence 64% → 92%",
      steps: ["✓ Multi-plant confirmation", "→ Bounding affected zone"],
    },
    zones: { anomaly: true, inspection: true, treatment: false },
    stats: { progressPct: 74, anomalies: 3, verified: 1, pending: 2 },
  },
  {
    id: "LOCALIZED_ACTION",
    t: 140,
    title: "Localized Treatment Zone",
    narration: "Generating localized treatment polygon — Row 12, Section B only.",
    videoMode: "closer",
    altitudeM: 13,
    detection: {
      box: { x: 26, y: 22, w: 48, h: 44 },
      label: "VERIFIED ANOMALY",
      confidence: 0.92,
      verified: true,
    },
    env: ENV,
    assessment: {
      possibleCondition: "Suspected fungal disease (verified visual pattern)",
      confidence: 0.92,
      supportingEvidence: [
        "Disease-consistent pattern at close range",
        "Multiple adjacent plants affected",
        "High humidity + recent rainfall",
      ],
      uncertainties: ["Agronomist review recommended before application"],
    },
    decision: {
      action: "REQUEST_HUMAN_REVIEW",
      headline: "Localized intervention proposed",
      steps: [
        "▣ Treatment zone: 12% of section",
        "◈ Est. coverage reduction: 88%",
        "✓ Agronomist review recommended",
      ],
    },
    zones: { anomaly: true, inspection: true, treatment: true },
    stats: { progressPct: 92, anomalies: 3, verified: 1, pending: 2 },
  },
  {
    id: "MISSION_COMPLETE",
    t: 165,
    title: "Mission Complete",
    narration: "Inspection complete. Generating mission report…",
    videoMode: "closer",
    altitudeM: 13,
    detection: null,
    env: ENV,
    assessment: null,
    decision: { action: "COMPLETE_MISSION", headline: "Mission complete", steps: [] },
    zones: { anomaly: true, inspection: true, treatment: true },
    stats: { progressPct: 100, anomalies: 3, verified: 1, pending: 2 },
  },
];

/** Mission-complete report content (PRD §22). */
export const MISSION_REPORT = {
  fieldInspectedAcres: 24.6,
  verifiedAnomalies: 4,
  falseAlarmsDismissed: 2,
  proposedTreatmentAreaPct: 12,
  estimatedCoverageReductionPct: 88,
  recommendations: [
    "Inspect Row 12 manually before application.",
    "Consider localized intervention instead of whole-field treatment.",
    "Agronomist review recommended.",
  ],
};

export function phaseAt(clock: number): MissionPhase {
  let current = MISSION_PHASES[0];
  for (const p of MISSION_PHASES) {
    if (clock >= p.t) current = p;
    else break;
  }
  return current;
}

export function phaseIndexAt(clock: number): number {
  let idx = 0;
  MISSION_PHASES.forEach((p, i) => {
    if (clock >= p.t) idx = i;
  });
  return idx;
}
