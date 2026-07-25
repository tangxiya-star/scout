"""Pydantic schemas — mirror PRD §13 reasoning I/O and the mission event shape.

These are the validated contract for anything the reasoning engine emits and
anything the WebSocket streams to the frontend. Free-form model text is never
trusted directly; it must parse into these models or we fall back.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# --- Reasoning input (PRD §13) ---


class VisualObservation(BaseModel):
    anomaly_type: str
    confidence: float = Field(ge=0, le=1)
    affected_area_percentage: float = 0
    multiple_plants_detected: bool = False
    # When set, the real leaf-level photo for this frame (a filename under
    # frontend/public/disease/). If present, the reasoning engine attaches it
    # as an image block so Claude assesses the disease from actual pixels, not
    # just the preliminary detector numbers above.
    image_filename: Optional[str] = None


class Environment(BaseModel):
    temperature_celsius: float
    relative_humidity: float
    recent_rainfall: bool
    wind_speed_mph: float
    soil_moisture: Literal["low", "normal", "high", "elevated"]


class MissionStateIn(BaseModel):
    altitude_meters: float
    current_row: int
    previous_inspections: int = 0


class ReasoningInput(BaseModel):
    mission_id: str = "mission_001"
    crop: str = "grapevine"
    growth_stage: str = "active_canopy"
    visual_observation: VisualObservation
    environment: Environment
    mission_state: MissionStateIn


# --- Reasoning output (PRD §13) ---

ActionCode = Literal[
    "CONTINUE_ROUTE",
    "FLY_CLOSER",
    "LOWER_ALTITUDE",
    "INSPECT_ADJACENT_ROW",
    "REVISIT_LOCATION",
    "EXPAND_SEARCH_AREA",
    "REQUEST_HUMAN_REVIEW",
    "COMPLETE_MISSION",
]


class Assessment(BaseModel):
    possible_condition: str
    confidence: float = Field(ge=0, le=1)
    supporting_evidence: list[str]
    uncertainties: list[str]


class MissionDecision(BaseModel):
    action: ActionCode
    target_row: Optional[int] = None
    altitude_change_meters: Optional[float] = None
    inspect_adjacent_row: bool = False


class TreatmentStatus(BaseModel):
    recommend_treatment: bool
    reason: str


class ReasoningOutput(BaseModel):
    assessment: Assessment
    mission_decision: MissionDecision
    treatment_status: TreatmentStatus
    # provenance so the UI can honestly label "live reasoning" vs "scripted"
    source: Literal["claude", "fallback"] = "fallback"
