# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What Scout is

**Scout — Autonomous AI Copilot for Agricultural Drones.** A real-time reasoning + adaptive mission-planning layer that turns an agricultural drone from a passive flying camera into an autonomous field inspector. During flight it observes → understands → reasons → plans → inspects again → verifies → recommends, and outputs a *localized* treatment zone to reduce pesticide coverage.

One-liner: *the drone does not just see — it thinks.*

This is a **hackathon build** (~5-hour core build window). Everything is scoped to ship a working **3-minute demo**, not production. Positioning: an autonomous reasoning/mission-planning layer for ag drones — disease detection is only the first use case.

### Initial demo scenario (locked)
- **Crop:** grapevine · **Environment:** vineyard
- **Condition:** visually detectable fungal disease (leaning downy/powdery mildew)
- **Drone behavior:** detect → inspect → verify → define a localized treatment zone
- Do **not** try to support every crop/disease.

## Repo state (what's been done)

Docs-only so far — **no application code yet.**

```
scout/
├── README.md               # overview, scenario, planned stack
├── CLAUDE.md               # this file
└── docs/
    ├── PRD.md              # full product requirements (35 sections)
    └── PRD-work-split.md   # Holly × Riyan division of labor + build-day timeline
```

- Git repo initialized; pushed to GitHub (public): **https://github.com/tangxiya-star/scout**
- Collaborator invited with write access: **Riyan Jain** ([@InsertWittyCommentHere](https://github.com/InsertWittyCommentHere))

**Not yet created:** the Next.js frontend, FastAPI backend, CV pipeline, reasoning engine, and `data/disease_profile.json` (Holly is writing that file herself).

## Team & ownership

Two people. Full detail in [`docs/PRD-work-split.md`](docs/PRD-work-split.md).

- **Holly** — Product & Technical Lead: frontend (Next.js cockpit), backend (FastAPI), AI reasoning engine + mission planner, computer vision, **NASA/environmental data integration**, and the pitch.
- **Riyan Jain** — Agricultural Research Lead + Customer Discovery: disease science, indicators, treatment decision tree, scientific validation, and finding **US farmers who already fly drones** (via the hackathon sponsor track).

**Shared contract:** `data/disease_profile.json` — Holly drafts the structure (to match the reasoning engine); Riyan fills in + validates the science. If the schema changes, ping the other person first — it's the interface between the two halves.

## Planned architecture (from the PRD)

Single **centralized** AI reasoning engine (no multi-agent framework for the prototype). Pipeline:

```
Live/simulated drone video
  → Perception (detection · segmentation · tracking)
  → Environmental context (NASA + weather + crop profile)
  → Centralized AI reasoning (structured JSON)
  → Mission planner (state machine)
  → Adaptive action → re-observe → verify
  → Localized recommendation + coverage-reduction estimate
```

### Planned stack (nothing installed yet)
- **Frontend:** Next.js · React · TypeScript · Tailwind · shadcn/ui · Mapbox GL JS · Framer Motion · WebSocket client
- **Backend:** Python · FastAPI · WebSocket · PostgreSQL (Redis optional)
- **CV:** YOLO / Grounding DINO / SAM 2 / OpenCV (may be partially simulated for the demo — keep it credible)
- **Reasoning:** Claude, **structured JSON output** (not free prose)

### Environmental data layer — NASA-first
- **NASA POWER** — temp, humidity, rainfall, solar, wind (historical + agroclimate)
- **NASA SMAP / Crop-CASMA** — soil moisture (regional context, not plant-level)
- **Sentinel Hub** — NDVI / NDMI for the field map
- **Open-Meteo** — low-latency *current* conditions to complement NASA's slower data

## Conventions & guardrails when building here

- **Demo reliability first.** The live demo must never block on a slow/failable external call. Pre-fetch and **cache** the demo field's NASA/weather values and keep a **hardcoded fallback object**. Use a deterministic mission sequence.
- **Structured JSON, validated.** The reasoning engine returns `assessment` / `mission_decision` / `treatment_status` against a fixed schema (see PRD §13). Validate outputs; don't rely on free-form text.
- **Safety / honesty on treatment.** Never emit an exact chemical dose as an autonomous instruction. Scout recommends *whether* intervention may be needed, *which region*, and *whether expert review is required*. Label the pesticide metric as **"estimated reduction in treated field coverage"** (`1 - recommended_area / baseline_area`), never "88% less pesticide used."
- **Distinguish states:** observation vs. suspected vs. verified vs. treatment-consideration vs. professional-recommendation.
- **Keep scope tight:** grapevine + one disease. Anything that can't be shown or defended in 3 minutes is out of scope.

## Git / workflow

- Default branch: `main`. Repo is public.
- Commits so far use author "Holly" <tangxiya9906@gmail.com> and are co-authored by Claude.
- Push to `origin main` after doc/code changes so Riyan stays in sync.

## Key references
- Product spec: [`docs/PRD.md`](docs/PRD.md)
- Who does what + build-day timeline: [`docs/PRD-work-split.md`](docs/PRD-work-split.md)
