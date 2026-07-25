"""Deterministic mission timeline (PRD §26).

The backend owns the canonical mission sequence. Each phase carries the vision
detection + mission state that feed the reasoning engine, so the WebSocket can
enrich every phase with live environment + real reasoning while keeping the
sequence itself perfectly reproducible for the demo.
"""

from __future__ import annotations

from typing import Any

# Each phase: id, dwell (seconds on the demo clock before the next phase),
# and the payload the frontend renders + the reasoning input it implies.
MISSION_PHASES: list[dict[str, Any]] = [
    {
        "id": "OPENING",
        "t": 0,
        "title": "Scanning",
        "narration": "Autonomous inspection in progress. Scanning vineyard rows…",
        "video_mode": "wide",
        "altitude_m": 18,
        "detection": None,
        "zones": {"anomaly": False, "inspection": False, "treatment": False},
        "stats": {"progress_pct": 8, "anomalies": 0, "verified": 0, "pending": 0},
        "reasoning_input": None,
    },
    {
        "id": "ANOMALY_DETECTED",
        "t": 20,
        "title": "Anomaly Detected",
        "narration": "Suspicious crop region detected on Row 12. Tracking across frames…",
        "video_mode": "wide",
        "altitude_m": 18,
        "detection": {
            "box": {"x": 38, "y": 34, "w": 26, "h": 22},
            "label": "SUSPICIOUS CROP REGION",
            "confidence": 0.64,
            "verified": False,
        },
        "zones": {"anomaly": True, "inspection": False, "treatment": False},
        "stats": {"progress_pct": 22, "anomalies": 1, "verified": 0, "pending": 1},
        "reasoning_input": {
            "anomaly_type": "leaf_discoloration",
            "confidence": 0.64,
            "affected_area_percentage": 1.2,
            "multiple_plants_detected": False,
            "altitude_meters": 18,
            "current_row": 12,
            "previous_inspections": 0,
        },
        # Deterministic mission action (state machine). Vision drives *what the
        # condition is* + evidence; this drives *what the drone does next*, so
        # the demo storyline always reaches the treatment-zone finale.
        "scripted_decision": {
            "action": "FLY_CLOSER",
            "target_row": 12,
            "altitude_change_meters": -5,
            "inspect_adjacent_row": False,
            "recommend_treatment": False,
            "treatment_reason": "additional visual confirmation required",
        },
    },
    {
        "id": "ENV_REASONING",
        "t": 50,
        "title": "Environmental Reasoning",
        "narration": "Retrieving environmental context and evaluating disease risk…",
        "video_mode": "wide",
        "altitude_m": 18,
        "detection": {
            "box": {"x": 38, "y": 34, "w": 26, "h": 22},
            "label": "SUSPICIOUS CROP REGION",
            "confidence": 0.68,
            "verified": False,
        },
        "zones": {"anomaly": True, "inspection": True, "treatment": False},
        "stats": {"progress_pct": 38, "anomalies": 1, "verified": 0, "pending": 1},
        "reasoning_input": {
            "anomaly_type": "leaf_discoloration",
            "confidence": 0.68,
            "affected_area_percentage": 1.9,
            "multiple_plants_detected": True,
            "altitude_meters": 18,
            "current_row": 12,
            "previous_inspections": 1,
        },
        "scripted_decision": {
            "action": "FLY_CLOSER",
            "target_row": 12,
            "altitude_change_meters": -5,
            "inspect_adjacent_row": True,
            "recommend_treatment": False,
            "treatment_reason": "high-risk infection weather noted; visual confirmation still required",
        },
    },
    {
        "id": "ADAPTIVE_DECISION",
        "t": 80,
        "title": "Adaptive Mission Decision",
        "narration": "Evidence is suggestive but insufficient. Adapting the mission…",
        "video_mode": "closer",
        "altitude_m": 13,
        "detection": {
            "box": {"x": 30, "y": 26, "w": 40, "h": 36},
            "label": "SUSPICIOUS CROP REGION",
            "confidence": 0.68,
            "verified": False,
        },
        "zones": {"anomaly": True, "inspection": True, "treatment": False},
        "stats": {"progress_pct": 55, "anomalies": 2, "verified": 0, "pending": 2},
        "reasoning_input": {
            "anomaly_type": "leaf_discoloration",
            "confidence": 0.68,
            "affected_area_percentage": 1.9,
            "multiple_plants_detected": True,
            "altitude_meters": 18,
            "current_row": 12,
            "previous_inspections": 1,
            # Drone has descended to leaf level — real photo now drives vision.
            "image_filename": "downy-mildew-leaf.jpg",
        },
        "scripted_decision": {
            "action": "LOWER_ALTITUDE",
            "target_row": 12,
            "altitude_change_meters": -5,
            "inspect_adjacent_row": True,
            "recommend_treatment": False,
            "treatment_reason": "descending for confirmatory close-range imagery",
        },
    },
    {
        "id": "VERIFICATION",
        "t": 110,
        "title": "Verification",
        "narration": "Closer imagery confirms consistent symptoms across nearby plants.",
        "video_mode": "closer",
        "altitude_m": 13,
        "detection": {
            "box": {"x": 26, "y": 22, "w": 48, "h": 44},
            "label": "VERIFIED ANOMALY",
            "confidence": 0.92,
            "verified": True,
        },
        "zones": {"anomaly": True, "inspection": True, "treatment": False},
        "stats": {"progress_pct": 74, "anomalies": 3, "verified": 1, "pending": 2},
        "reasoning_input": {
            "anomaly_type": "leaf_discoloration",
            "confidence": 0.92,
            "affected_area_percentage": 3.4,
            "multiple_plants_detected": True,
            "altitude_meters": 13,
            "current_row": 12,
            "previous_inspections": 2,
            # Close-range macro of the leaf underside — the verification frame.
            "image_filename": "downy-mildew-macro.jpg",
        },
        "scripted_decision": {
            "action": "INSPECT_ADJACENT_ROW",
            "target_row": 12,
            "inspect_adjacent_row": True,
            "recommend_treatment": False,
            "treatment_reason": "consistent symptoms confirmed across nearby plants; scoping the affected extent",
        },
    },
    {
        "id": "LOCALIZED_ACTION",
        "t": 140,
        "title": "Localized Treatment Zone",
        "narration": "Generating localized treatment polygon — Row 12, Section B only.",
        "video_mode": "closer",
        "altitude_m": 13,
        "detection": {
            "box": {"x": 26, "y": 22, "w": 48, "h": 44},
            "label": "VERIFIED ANOMALY",
            "confidence": 0.92,
            "verified": True,
        },
        "zones": {"anomaly": True, "inspection": True, "treatment": True},
        "stats": {"progress_pct": 92, "anomalies": 3, "verified": 1, "pending": 2},
        "reasoning_input": {
            "anomaly_type": "leaf_discoloration",
            "confidence": 0.92,
            "affected_area_percentage": 3.4,
            "multiple_plants_detected": True,
            "altitude_meters": 13,
            "current_row": 12,
            "previous_inspections": 3,
            "image_filename": "downy-mildew-macro.jpg",
        },
        # Finale: propose a localized zone + human review (never autonomous
        # treatment). REQUEST_HUMAN_REVIEW is what unlocks the treatment-zone
        # readout in the UI, so the demo climax is guaranteed here.
        "scripted_decision": {
            "action": "REQUEST_HUMAN_REVIEW",
            "target_row": 12,
            "inspect_adjacent_row": False,
            "recommend_treatment": False,
            "treatment_reason": "localized intervention proposed; agronomist review recommended before any application",
        },
    },
    {
        "id": "MISSION_COMPLETE",
        "t": 165,
        "title": "Mission Complete",
        "narration": "Inspection complete. Generating mission report…",
        "video_mode": "closer",
        "altitude_m": 13,
        "detection": None,
        "zones": {"anomaly": True, "inspection": True, "treatment": True},
        "stats": {"progress_pct": 100, "anomalies": 3, "verified": 1, "pending": 2},
        "reasoning_input": None,
    },
]

MISSION_REPORT = {
    "field_inspected_acres": 24.6,
    "verified_anomalies": 4,
    "false_alarms_dismissed": 2,
    "proposed_treatment_area_pct": 12,
    "estimated_coverage_reduction_pct": 88,
    "coverage_metric_label": "estimated reduction in treated field coverage",
    "recommendations": [
        "Inspect Row 12 manually before application.",
        "Consider localized intervention instead of whole-field treatment.",
        "Agronomist review recommended.",
    ],
}
