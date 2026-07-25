"""Centralized AI reasoning engine (PRD §12/§13).

One Claude call in, one validated structured object out. No free prose is
trusted — the model is forced through a tool schema and the result is parsed
into ReasoningOutput. If the API key is missing or the call fails, we fall
back to a deterministic scripted assessment so the demo never breaks.
"""

from __future__ import annotations

import base64
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

# Real leaf-level photos live in the frontend's public dir; the reasoning
# engine reads them straight off disk to attach as image blocks.
_DISEASE_IMAGE_DIR = (
    Path(__file__).resolve().parents[2] / "frontend" / "public" / "disease"
)


def _load_image_block(filename: str | None) -> dict[str, Any] | None:
    """Read a disease photo and wrap it as an Anthropic image content block.

    Returns None if there's no filename or the file can't be read — the caller
    then falls back to a text-only, detector-numbers assessment.
    """
    if not filename:
        return None
    path = _DISEASE_IMAGE_DIR / filename
    try:
        raw = path.read_bytes()
    except Exception:
        return None
    media = "image/png" if filename.lower().endswith(".png") else "image/jpeg"
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media,
            "data": base64.standard_b64encode(raw).decode("ascii"),
        },
    }


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
- When a leaf-level photo is attached, ground your visual assessment in what \
is ACTUALLY visible in the image — symptom morphology, colour, texture, and \
distribution (e.g. upper-surface oil-spots and lower-surface white sporulation \
suggest downy mildew; white powdery growth on the upper surface suggests \
powdery mildew). Treat the numeric detector fields as a preliminary onboard \
signal to verify against the pixels, not as ground truth.
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

        image_block = _load_image_block(inp.visual_observation.image_filename)
        if image_block is not None:
            instruction = (
                "A real close-range leaf photo captured by the drone is "
                "attached. Assess the crop condition from what you actually see "
                "in the image, then return the tool output. The numeric fields "
                "below are a preliminary onboard-detector signal to verify.\n"
            )
        else:
            instruction = "Assess this mission frame and return the tool output.\n"

        # Image first, then the text payload (image-before-text reads best).
        content: list[dict[str, Any]] = []
        if image_block is not None:
            content.append(image_block)
        content.append(
            {"type": "text", "text": instruction + json.dumps(user_payload, indent=2)}
        )

        msg = await client.messages.create(
            model=os.environ.get("SCOUT_MODEL", "claude-sonnet-5"),
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[_TOOL],
            tool_choice={"type": "tool", "name": "emit_assessment"},
            messages=[{"role": "user", "content": content}],
        )

        tool_use = next(
            (b for b in msg.content if getattr(b, "type", None) == "tool_use"), None
        )
        if tool_use is None:
            return _fallback(inp)

        return _reasoning_from_flat(dict(tool_use.input))
    except Exception:
        return _fallback(inp)
