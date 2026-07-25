# Scout

**Autonomous AI Copilot for Agricultural Drones**

Scout turns an agricultural drone from a passive flying camera into an autonomous field inspector. During flight it **observes → understands → reasons → plans → inspects again → verifies → recommends**, and outputs a *localized* treatment zone so a farmer sprays a small affected block instead of the whole field.

> The drone does not just see. **It thinks.**

Hackathon build. Scoped to ship a working 3-minute demo. First use case: fungal disease on grapevine in a vineyard — but the real product is the reasoning + adaptive mission-planning layer underneath.

**Repo:** https://github.com/tangxiya-star/scout

---

## What actually runs

Scout is a real, running two-part app — not slides.

### Frontend — the drone cockpit (`frontend/`)
Next.js 16 + React 19 + TypeScript + Tailwind + Framer Motion + MapLibre GL. A single-screen mission cockpit with three entry paths:

- **🌍 Globe** — spin-up entry screen; zoom from orbit down to the demo vineyard.
- **▶ Auto mission** — a deterministic 7-phase timeline (`Scanning → Anomaly Detected → Environmental Reasoning → Adaptive Mission Decision → Verification → Localized Treatment Zone → Mission Complete`) that always plays cleanly for a pitch.
- **🎮 Pilot mode** — fly the drone yourself with **WASD**, descend on the diseased canopy, and discover the anomaly at close range (FPV reveal with real diseased-leaf imagery).

The cockpit shows a live drone feed, a streaming **reasoning panel** (the model's assessment, evidence, uncertainties, and next action), a field map with the detection grid + spread forecast, and a one-click treatment-zone report at the end.

A **LIVE BACKEND** toggle switches the whole cockpit from the local scripted timeline to the FastAPI backend over WebSocket — and auto-falls-back to local if the backend ever errors mid-demo.

### Backend — reasoning + mission stream (`backend/`)
Python + FastAPI + WebSocket.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness + whether live reasoning is configured |
| `GET` | `/api/environment` | Live env (Open-Meteo + NASA POWER), cached, with fallback |
| `POST` | `/api/reason` | Run the reasoning engine on one frame → structured JSON |
| `WS` | `/ws/mission` | Stream the mission timeline phase-by-phase, enriched with live env + real reasoning |

**Centralized AI reasoning engine.** One Claude call in, one **validated structured object** out — no free prose is trusted. The model is forced through a tool schema and parsed into `assessment` / `mission_decision` / `treatment_status`. When close-range leaf photos are attached, the engine does **multi-image vision reasoning**: it cross-references frames of the same site (upper-surface oil-spots in one view, white underside sporulation in another) to distinguish look-alike diseases, and treats the onboard numeric detector as a signal to verify — not ground truth.

**Environmental data layer (NASA-first).** Open-Meteo for low-latency current conditions (temp, humidity, wind, rain) + NASA POWER for agroclimate context. Feeds the disease-risk reasoning (e.g. high humidity + recent rain → elevated fungal risk).

## Demo reliability — built in
The live demo never blocks on a slow or failing external call:
- Environment: **live → cache → hardcoded fallback**.
- Reasoning: real Claude call → **deterministic scripted fallback** on any error or missing key.
- The mission WebSocket always produces a complete, coherent mission even fully offline.
- The frontend's LIVE mode auto-reverts to the local timeline on backend error.

## Honesty & safety guardrails
- Scout **never emits a chemical product or dose**. Its treatment output is only *whether* intervention may be needed and *whether expert review is required*.
- The pesticide metric is labeled **"estimated reduction in treated field coverage"** (`1 − recommended_area / baseline_area`) — never "88% less pesticide."
- The pipeline distinguishes states: observation vs. suspected vs. verified vs. treatment-consideration vs. professional-recommendation.

## Sponsor track

Scout is built on the hackathon **sponsor track**:

- **Hexclave** — used for real. Auth (`@hexclave/next`, sign-up enabled) and one-click deploy to Vercel are wired through `frontend/hexclave.config.ts`, taking the prototype from hackathon build toward a hostable, production-ready product — and pointing at Hexclave's "make money during the hackathon" prize via a deployable path to paying farmers.
- **NASA open data** — the environmental reasoning layer runs on **NASA POWER** (agroclimate: temperature, humidity, rainfall) alongside Open-Meteo, so disease-risk reasoning is grounded in real space/earth-observation data.
- **Customer discovery** — sponsor-track intros are the channel for reaching US farmers who already fly drones (Riyan's discovery work).

---

## Run it

### Backend
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # optional: add ANTHROPIC_API_KEY for live reasoning
.venv/bin/uvicorn app.main:app --reload --port 8000
```
Health check: http://localhost:8000/api/health

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000. Without the backend running, the cockpit runs the fully self-contained local demo. Click **LIVE BACKEND** to drive it from FastAPI.

Deployment is wired through Hexclave → Vercel (`frontend/hexclave.config.ts`).

---

## Architecture

```
Live / simulated drone video
  → Perception (detection · segmentation · anomaly signal)
  → Environmental context (Open-Meteo + NASA POWER + crop profile)
  → Centralized AI reasoning (Claude, structured JSON, multi-image vision)
  → Mission planner (deterministic state machine, 7 phases)
  → Adaptive action → re-observe → verify
  → Localized treatment zone + coverage-reduction estimate
```

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind, Framer Motion, MapLibre GL, WebSocket client
- **Backend:** Python, FastAPI, WebSocket
- **Reasoning:** Claude (Sonnet), structured JSON via tool schema, multi-image vision
- **Data:** Open-Meteo (current conditions) + NASA POWER (agroclimate)
- **Deploy:** Hexclave → Vercel

## Repo layout

```
scout/
├── frontend/            # Next.js drone cockpit (globe · auto demo · pilot mode)
│   └── src/
│       ├── app/page.tsx         # cockpit shell + mode switching
│       ├── components/          # DroneVideo, ReasoningPanel, FieldMap, PilotMode, …
│       └── lib/                 # local mission script + live-mission WS client
├── backend/             # FastAPI reasoning engine + mission stream
│   └── app/
│       ├── main.py              # endpoints + /ws/mission
│       ├── reasoning.py         # centralized Claude reasoning (tool schema + vision)
│       ├── environment.py       # Open-Meteo + NASA POWER, cached, with fallback
│       └── mission_script.py    # canonical 7-phase timeline
├── data/
│   └── disease_profile.json     # shared science contract (grapevine downy mildew)
└── docs/
    ├── PRD.md                   # full product requirements
    └── PRD-work-split.md        # division of labor + build-day timeline
```

## Team

- **Holly** — Product & Technical Lead: frontend cockpit, backend, reasoning engine + mission planner, NASA/environmental integration, pitch.
- **Riyan Jain** — Agricultural Research Lead: disease science, indicators, treatment decision tree, scientific validation (`data/disease_profile.json`), and farmer customer discovery.

See [`docs/PRD.md`](docs/PRD.md) for the full spec and [`docs/PRD-work-split.md`](docs/PRD-work-split.md) for who does what.
