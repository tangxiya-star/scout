"""Centralized AI reasoning engine (PRD §12/§13).

One Claude call in, one validated structured object out. No free prose is
trusted — the model is forced through a tool schema and the result is parsed
into ReasoningOutput. If the API key is missing or the call fails, we fall
back to a deterministic scripted assessment so the demo never breaks.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .schemas import (
    Assessment,
    MissionDecision,
    ReasoningInput,
    ReasoningOutput,
    TreatmentStatus,
)

_DISEASE_PROFILE_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "disease_profile.json"
)


def _load_disease_profile() -> dict[str, Any]:
    try:
        return json.loads(_DISEASE_PROFILE_PATH.read_text())
    except Exception:
        return {"crop": "grapevine", "condition": "downy_mildew"}


SYSTEM_PROMPT = """You are Scout, the centralized reasoning engine for an \
autonomous agricultural-drone mission over a vineyard.

You receive: a vision detection, current environmental conditions, the crop's \
disease profile, and the drone's mission state. You output a single structured \
assessment. You are cautious and evidence-based.

Rules:
- Distinguish observation vs suspected vs verified. Do not over-claim.
- NEVER emit a chemical product or dose. Treatment output is only whether \
intervention may be needed and whether expert review is required.
- Confidence must reflect the evidence; low-resolution single observations \
stay uncertain.
- Choose the mission action that best closes the biggest evidence gap.
"""


def _fallback(inp: ReasoningInput) -> ReasoningOutput:
    """Deterministic scripted reasoning — mirrors the demo storyline."""
    conf = inp.visual_observation.confidence
    verified = conf >= 0.85
    env = inp.environment
    evidence = ["leaf discoloration"]
    if env.relative_humidity >= 85:
        evidence.append(f"high relative humidity ({env.relative_humidity:.0f}%)")
    if env.recent_rainfall:
        evidence.append("recent rainfall")
    if inp.visual_observation.multiple_plants_detected:
        evidence.append("multiple nearby plants affected")

    if verified:
        assessment = Assessment(
            possible_condition="suspected fungal disease (verified visual pattern)",
            confidence=conf,
            supporting_evidence=evidence + ["disease-consistent pattern at close range"],
            uncertainties=["species-level identification requires expert review"],
        )
        decision = MissionDecision(
            action="REQUEST_HUMAN_REVIEW",
            target_row=inp.mission_state.current_row,
            inspect_adjacent_row=False,
        )
        treatment = TreatmentStatus(
            recommend_treatment=False,
            reason="localized intervention proposed; agronomist review recommended "
            "before any application",
        )
    else:
        assessment = Assessment(
            possible_condition="possible fungal condition",
            confidence=conf,
            supporting_evidence=evidence,
            uncertainties=[
                "image resolution insufficient to rule out nutrient stress"
            ],
        )
        decision = MissionDecision(
            action="FLY_CLOSER",
            target_row=inp.mission_state.current_row,
            altitude_change_meters=-5,
            inspect_adjacent_row=True,
        )
        treatment = TreatmentStatus(
            recommend_treatment=False,
            reason="additional visual confirmation is required",
        )

    return ReasoningOutput(
        assessment=assessment,
        mission_decision=decision,
        treatment_status=treatment,
        source="fallback",
    )


# Anthropic tool schema — FLAT on purpose. A deeply nested schema makes some
# models serialize the whole object into one string field; a flat schema is
# filled reliably. We reconstruct the nested ReasoningOutput from the flat dict.
_TOOL = {
    "name": "emit_assessment",
    "description": "Return Scout's structured mission assessment as flat fields.",
    "input_schema": {
        "type": "object",
        "properties": {
            "possible_condition": {
                "type": "string",
                "description": "Most plausible condition, hedged appropriately.",
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "supporting_evidence": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Short evidence phrases.",
            },
            "uncertainties": {
                "type": "array",
                "items": {"type": "string"},
            },
            "action": {
                "type": "string",
                "enum": [
                    "CONTINUE_ROUTE",
                    "FLY_CLOSER",
                    "LOWER_ALTITUDE",
                    "INSPECT_ADJACENT_ROW",
                    "REVISIT_LOCATION",
                    "EXPAND_SEARCH_AREA",
                    "REQUEST_HUMAN_REVIEW",
                    "COMPLETE_MISSION",
                ],
                "description": "The next mission action.",
            },
            "target_row": {"type": "integer"},
            "altitude_change_meters": {
                "type": "number",
                "description": "Negative = descend, e.g. -5.",
            },
            "inspect_adjacent_row": {"type": "boolean"},
            "recommend_treatment": {"type": "boolean"},
            "treatment_reason": {"type": "string"},
        },
        "required": [
            "possible_condition",
            "confidence",
            "supporting_evidence",
            "uncertainties",
            "action",
            "recommend_treatment",
            "treatment_reason",
        ],
    },
}


def _reasoning_from_flat(flat: dict[str, Any]) -> ReasoningOutput:
    """Reconstruct the nested §13 output from the flat tool payload."""
    return ReasoningOutput(
        assessment=Assessment(
            possible_condition=flat["possible_condition"],
            confidence=flat["confidence"],
            supporting_evidence=flat.get("supporting_evidence", []),
            uncertainties=flat.get("uncertainties", []),
        ),
        mission_decision=MissionDecision(
            action=flat["action"],
            target_row=flat.get("target_row"),
            altitude_change_meters=flat.get("altitude_change_meters"),
            inspect_adjacent_row=flat.get("inspect_adjacent_row", False),
        ),
        treatment_status=TreatmentStatus(
            recommend_treatment=flat["recommend_treatment"],
            reason=flat["treatment_reason"],
        ),
        source="claude",
    )


async def run_reasoning(inp: ReasoningInput) -> ReasoningOutput:
    """Call Claude for a structured assessment; fall back on any failure."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _fallback(inp)

    try:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=api_key)
        profile = _load_disease_profile()

        user_payload = {
            "reasoning_input": inp.model_dump(),
            "disease_profile": profile,
        }

        msg = await client.messages.create(
            model=os.environ.get("SCOUT_MODEL", "claude-sonnet-5"),
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[_TOOL],
            tool_choice={"type": "tool", "name": "emit_assessment"},
            messages=[
                {
                    "role": "user",
                    "content": "Assess this mission frame and return the tool "
                    "output.\n" + json.dumps(user_payload, indent=2),
                }
            ],
        )

        tool_use = next(
            (b for b in msg.content if getattr(b, "type", None) == "tool_use"), None
        )
        if tool_use is None:
            return _fallback(inp)

        return _reasoning_from_flat(dict(tool_use.input))
    except Exception:
        return _fallback(inp)
