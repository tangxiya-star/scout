# Scout

**Autonomous AI Copilot for Agricultural Drones**

Scout transforms agricultural drones from passive flying cameras into intelligent field inspectors that reason in real time — deciding where to inspect, what to verify, and how to minimize pesticide usage during flight.

> The drone does not just see. **It thinks.**

---

## What's here

- [`docs/PRD.md`](docs/PRD.md) — the full product requirements document (vision, problem, solution, architecture, demo flow, roadmap).

## Initial hackathon scenario

- **Crop:** Grapevine
- **Environment:** Vineyard
- **Condition:** Visually detectable fungal disease / crop-health anomaly
- **Drone behavior:** Detect → inspect → verify → define a localized treatment zone

## Core loop

```
Observe → Understand → Reason → Plan → Inspect Again → Verify → Recommend
```

## Planned stack

- **Frontend:** Next.js, React, TypeScript, Tailwind, shadcn/ui, Mapbox GL JS, WebSocket
- **Backend:** Python, FastAPI, WebSocket, PostgreSQL
- **CV:** YOLO / Grounding DINO / SAM 2 / OpenCV
- **Reasoning:** Claude (structured JSON output)

See the [PRD](docs/PRD.md) for details.
