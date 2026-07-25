"""Scout backend — FastAPI.

Endpoints:
  GET  /api/health         — liveness + whether live reasoning is configured
  GET  /api/environment    — live env context (Open-Meteo + NASA POWER, cached)
  POST /api/reason         — run the reasoning engine on one frame (§13)
  WS   /ws/mission         — stream the deterministic mission timeline (§26),
                             enriched with live env + real reasoning per phase

Demo-reliability: env + reasoning both fall back to hardcoded values, so the
WebSocket always produces a complete, coherent mission even fully offline.
"""

from __future__ import annotations

import asyncio
import os

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .environment import (
    DEMO_FIELD,
    FALLBACK,
    fetch_environment,
    fetch_nasa_power_context,
)
from .mission_script import MISSION_PHASES, MISSION_REPORT
from .reasoning import run_reasoning
from .schemas import (
    Environment,
    MissionDecision,
    MissionStateIn,
    ReasoningInput,
    TreatmentStatus,
    VisualObservation,
)

load_dotenv()

app = FastAPI(title="Scout Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "live_reasoning": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "demo_field": DEMO_FIELD,
    }


@app.get("/api/environment")
async def environment(
    lat: float = DEMO_FIELD["lat"], lon: float = DEMO_FIELD["lon"]
) -> dict:
    current, nasa = await asyncio.gather(
        fetch_environment(lat, lon),
        fetch_nasa_power_context(lat, lon),
    )
    return {"current": current, "nasa_power_context": nasa}


@app.post("/api/reason")
async def reason(inp: ReasoningInput) -> dict:
    out = await run_reasoning(inp)
    return out.model_dump()


def _build_reasoning_input(env: dict, ri: dict) -> ReasoningInput:
    """Assemble a §13 reasoning input from a phase's implied vision + live env."""
    soil = env.get("soil_moisture", "elevated")
    if soil == "elevated":
        soil = "high"
    return ReasoningInput(
        visual_observation=VisualObservation(
            anomaly_type=ri["anomaly_type"],
            confidence=ri["confidence"],
            affected_area_percentage=ri["affected_area_percentage"],
            multiple_plants_detected=ri["multiple_plants_detected"],
            image_filename=ri.get("image_filename"),
        ),
        environment=Environment(
            temperature_celsius=env["temperature_celsius"],
            relative_humidity=env["relative_humidity"],
            recent_rainfall=env["recent_rainfall"],
            wind_speed_mph=env["wind_speed_mph"],
            soil_moisture=soil,
        ),
        mission_state=MissionStateIn(
            altitude_meters=ri["altitude_meters"],
            current_row=ri["current_row"],
            previous_inspections=ri["previous_inspections"],
        ),
    )


@app.websocket("/ws/mission")
async def mission_stream(ws: WebSocket) -> None:
    """Play the mission timeline. Query param `speed` scales dwell time.

    Protocol (server → client), one JSON message per event:
      {type: "mission_start", field, report_preview}
      {type: "phase", phase: {...}, environment: {...}, reasoning: {...}|null}
      {type: "mission_complete", report: {...}}
    """
    await ws.accept()
    speed = 1.0
    try:
        speed = float(ws.query_params.get("speed", "1") or "1")
    except ValueError:
        speed = 1.0
    speed = max(0.1, min(20.0, speed))

    # By default the mission uses the narrative-coherent demo environment
    # (high humidity + recent rain + elevated risk) so the storyline always
    # holds. `?live_env=1` swaps in the real Open-Meteo reading instead — the
    # /api/environment endpoint always proves the live integration works.
    use_live_env = ws.query_params.get("live_env", "0") in ("1", "true")

    try:
        if use_live_env:
            env = await fetch_environment(DEMO_FIELD["lat"], DEMO_FIELD["lon"])
        else:
            env = dict(FALLBACK)

        await ws.send_json(
            {
                "type": "mission_start",
                "field": DEMO_FIELD,
                "environment": env,
            }
        )

        prev_t = 0
        for phase in MISSION_PHASES:
            # wait out the dwell between phases (scaled by speed)
            delay = max(0, (phase["t"] - prev_t)) / speed
            if delay:
                await asyncio.sleep(delay)
            prev_t = phase["t"]

            reasoning = None
            if phase.get("reasoning_input"):
                out = await run_reasoning(
                    _build_reasoning_input(env, phase["reasoning_input"])
                )
                reasoning = out.model_dump()
                # Hybrid: keep the real vision-grounded assessment, but let the
                # deterministic state machine own the mission action + treatment
                # status so the demo reliably reaches the treatment-zone finale.
                sd = phase.get("scripted_decision")
                if sd is not None:
                    reasoning["mission_decision"] = MissionDecision(
                        action=sd["action"],
                        target_row=sd.get("target_row"),
                        altitude_change_meters=sd.get("altitude_change_meters"),
                        inspect_adjacent_row=sd.get("inspect_adjacent_row", False),
                    ).model_dump()
                    reasoning["treatment_status"] = TreatmentStatus(
                        recommend_treatment=sd["recommend_treatment"],
                        reason=sd["treatment_reason"],
                    ).model_dump()

            await ws.send_json(
                {
                    "type": "phase",
                    "phase": {
                        "id": phase["id"],
                        "title": phase["title"],
                        "narration": phase["narration"],
                        "video_mode": phase["video_mode"],
                        "altitude_m": phase["altitude_m"],
                        "detection": phase["detection"],
                        "zones": phase["zones"],
                        "stats": phase["stats"],
                    },
                    "environment": env,
                    "reasoning": reasoning,
                }
            )

        await ws.send_json({"type": "mission_complete", "report": MISSION_REPORT})
    except WebSocketDisconnect:
        return
    except Exception:
        # Never crash the socket mid-demo.
        try:
            await ws.send_json({"type": "error", "recoverable": True})
        except Exception:
            pass
