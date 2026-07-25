# Scout Backend (FastAPI)

Centralized reasoning + mission stream for the Scout demo. Designed so the
live demo **never blocks on an external call**: environment and reasoning both
fall back to hardcoded, narrative-coherent values.

## Run

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # optional: add ANTHROPIC_API_KEY for live reasoning
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Health check: <http://localhost:8000/api/health>

## Endpoints

| Method | Path               | Purpose                                                        |
| ------ | ------------------ | -------------------------------------------------------------- |
| GET    | `/api/health`      | Liveness + whether live reasoning is configured                |
| GET    | `/api/environment` | Live env (Open-Meteo + NASA POWER), cached 10 min, fallback    |
| POST   | `/api/reason`      | Run the reasoning engine on one frame (PRD §13 in → §13 out)   |
| WS     | `/ws/mission`      | Stream the deterministic mission timeline (§26), phase by phase |

### `/ws/mission` query params

- `speed` — scales dwell time (e.g. `?speed=20` compresses the 165s timeline to ~8s)
- `live_env=1` — use the real Open-Meteo reading instead of the demo-coherent
  environment. Off by default so the storyline (high humidity + rain + elevated
  risk) always holds; `/api/environment` proves the live integration regardless.

Messages (server → client): `mission_start` → `phase` (×7) → `mission_complete`.

## Design notes

- **Reasoning** (`app/reasoning.py`): forces Claude through a tool schema →
  parsed into `ReasoningOutput`. Missing key or any error → deterministic
  scripted fallback. Never emits chemical products/doses.
- **Environment** (`app/environment.py`): try live → cache → hardcoded `FALLBACK`.
- **Mission** (`app/mission_script.py`): canonical `MISSION_PHASES` timeline; the
  Python source of truth mirrored by the frontend's local script.
- **Contract**: reads `../data/disease_profile.json` (shared with Riyan).
