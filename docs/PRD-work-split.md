# Scout — Work-Split PRD (Holly × Riyan)

A standalone division-of-labor spec for the hackathon build. Companion to [`PRD.md`](PRD.md).

- **Holly** — Product & Technical Lead (build + product + pitch)
- **Riyan Jain** ([@InsertWittyCommentHere](https://github.com/InsertWittyCommentHere)) — Agricultural Research Lead + Customer Discovery / GTM

Constraint: short hackathon build window (~5 hours of core build time). Everything below is scoped to ship a working 3-minute demo, not a production system.

---

## 1. At a glance

| Area | Owner |
|---|---|
| Product scope, demo narrative, pitch | **Holly** |
| Frontend (Next.js cockpit, video, map, reasoning panel) | **Holly** |
| Backend (FastAPI, WebSocket, mission state) | **Holly** |
| Computer vision (detection/overlays, second-inspection) | **Holly** |
| AI reasoning engine + mission planner | **Holly** (uses Riyan's knowledge base) |
| `disease_profile.json` structure | **Holly** (drafts); **Riyan** fills in + validates science |
| Disease indicators, treatment logic | **Riyan** |
| Scientific validation of AI output | **Riyan** |
| Customer discovery — find real farmers | **Riyan** |
| Sponsor-track outreach / "sell during hackathon" | **Riyan** (Holly supports) |
| Final pitch delivery | **Holly** (Riyan does the science + traction section) |

The single shared contract between the two halves is the **disease-profile JSON** (see §4). Riyan produces it; Holly's reasoning engine consumes it.

---

## 2. Holly — Product & Technical Lead

### 2.1 Product & demo
- Lock scope to the grapevine / vineyard fungal-anomaly scenario.
- Own the demo narrative and the 3-minute flow (per PRD §26).
- Decide what is real vs. simulated for the demo and keep the story technically credible.

### 2.2 Frontend
- Next.js + Tailwind + shadcn/ui cockpit.
- Full-screen drone video player + LIVE indicator + telemetry (battery/altitude/wind).
- Detection overlay (bounding box + confidence).
- Scout reasoning panel (condition, confidence, evidence, uncertainty, next action).
- Mini field map (Mapbox or SVG): flight path, healthy / needs-inspection / treatment zones.
- Mission-state transitions (anomaly → adaptive action → verification → localized zone).
- Mission-complete report screen (acres, verified anomalies, treatment %, coverage reduction).

### 2.3 Backend & AI
- FastAPI + WebSocket to stream mission events to the frontend.
- Frame sampling / preprocessing pipeline.
- Environmental context: real API where cheap (Open-Meteo) + cached fallback object.
- **AI reasoning engine**: structured JSON output (assessment / mission_decision / treatment_status), fed by Riyan's disease profile.
- Mission-planner state machine: `CONTINUE_ROUTE → FLY_CLOSER → INSPECT_ADJACENT_ROW → COMPLETE_MISSION` (deterministic for demo).
- Confidence-update / verification loop (64% → 92%).

### 2.4 Computer vision
- Select drone footage; pick or stage the anomaly moment.
- Implement or mock detection + overlay generation.
- Prepare the second close-inspection frame/sequence.

### 2.5 Pitch
- Write and deliver the 3-minute pitch, architecture explanation, and business-value story.
- Hand the science + traction slots to Riyan.

### Holly — Definition of done
- [ ] Cockpit renders live-style video with a detection overlay
- [ ] Reasoning panel shows condition + confidence + evidence + next action
- [ ] One adaptive action + one verification loop that raises confidence
- [ ] Field map shows a localized treatment zone
- [ ] Mission-complete screen shows coverage-reduction number
- [ ] Demo runs end-to-end in < 3 min without a live-API dependency that can fail

---

## 3. Riyan — Ag Research Lead + Customer Discovery

Two hats: (A) make Scout's recommendations scientifically credible, and (B) find and talk to real farmer customers during the event.

### 3.1 Agricultural research
- Select the exact grapevine disease (recommend **downy mildew** or **powdery mildew** — visually detectable, humidity/rain-driven, strong demo story).
- Top **5 visual indicators** and top **5 environmental indicators**, each tagged: essential / supporting / weak / exclusionary.
- Common **lookalikes** (nutrient deficiency, water stress, dust/residue) and how to tell them apart.
- Rules for: when closer imagery is required, when monitoring is enough, when treatment may be justified.
- Low-pesticide / biological alternatives + when spraying should be avoided.
- 2–3 credible sources cited (extension bulletins, university ag guides).

### 3.2 Knowledge base — the deliverable that plugs into the code
- **Holly** drafts the `disease_profile.json` structure (schema in §4) so it matches what the reasoning engine expects.
- **Riyan** fills in the scientific content (indicator names, importance rankings, lookalikes, sources) and validates it is correct.
- Draft the treatment decision tree (monitor / inspect / non-chemical / localized zone / agronomist review).

### 3.3 Scientific validation
- Review Scout's AI output for plausibility; flag any unsupported or unsafe claim.
- Confirm the demo scenario is scientifically defensible.
- Prepare a ~30-second scientific explanation for the pitch.

### 3.4 Customer discovery — US farmers who already fly drones — via the sponsor track
The event rewards teams that find real users and even sell during the hackathon (Channel 3 and Hexclave both called this out). Riyan drives this.

**Target profile (ICP):** US-based growers and operators who **already use agricultural drones** — Scout is an add-on brain for a drone they own, so a farmer already flying is a warm, credible buyer.
- US vineyards / wineries running crop-monitoring or spray drones
- Row-crop / specialty-crop farms using **DJI Agras** (T-series) or similar spray/scout drones
- **Ag-drone service providers / spray-as-a-service** operators (they run many drones and fly for many farms — highest-leverage customer)
- Precision-ag teams and crop-health consultants who fly drones for clients

**How to find them:**
- Use the **sponsor track** first — sponsors with ag / logistics / hardware reach, plus any "find customers / sell" prizes, for warm intros.
- Tap event mentors and attendees for anyone ag-adjacent or with farm connections in the US.
- If time allows, reach US ag-drone operator communities directly (DJI Agras user groups, drone-spraying operator forums / local ag-drone service companies) for a fast discovery call.

**What to get out of it:**
- Run 2–3 discovery conversations with people who **fly drones today**: does "reason during flight + reduce pesticide coverage" resonate? What do they pay for imaging/spraying now, and what would they pay Scout?
- Capture a demand signal — a verbal "I'd try this", a contact, or a pre-order — for the pitch's traction slide.
- If a sponsor prize rewards selling, attempt the smallest real commitment we can (a paid pilot intent counts).

### Riyan — Definition of done
- [ ] Disease + top 5 visual + top 5 environmental indicators chosen and ranked
- [ ] Scientific content filled into Holly's `disease_profile.json` draft and validated (matches §4 schema)
- [ ] Treatment decision tree written
- [ ] AI output reviewed and signed off as plausible
- [ ] ≥ 2 discovery conversations with US growers/operators who **already fly drones**, with at least one usable quote or demand signal
- [ ] 30-second science + traction section ready for the pitch

---

## 4. The shared contract — `disease_profile.json`

**Holly** drafts the structure (so it matches the reasoning engine); **Riyan** fills in and validates the scientific content. Keep it committed at `data/disease_profile.json`.

```json
{
  "crop": "grapevine",
  "condition": "downy_mildew",
  "visual_indicators": [
    { "name": "oil-spot lesions on upper leaf surface", "importance": "essential" },
    { "name": "white downy growth on underside", "importance": "essential" },
    { "name": "localized discoloration", "importance": "supporting" },
    { "name": "multiple nearby plants affected", "importance": "essential" }
  ],
  "environmental_indicators": [
    { "name": "relative_humidity", "importance": "essential" },
    { "name": "recent_rainfall", "importance": "essential" },
    { "name": "temperature_range", "importance": "supporting" },
    { "name": "leaf_wetness", "importance": "supporting" },
    { "name": "soil_moisture", "importance": "weak" }
  ],
  "lookalikes": ["nutrient deficiency", "water stress", "dust or residue"],
  "additional_evidence": ["closer leaf image", "adjacent plant inspection"],
  "treatment_states": ["monitor", "inspect_further", "non_chemical", "localized_treatment", "agronomist_review"],
  "sources": ["<extension bulletin>", "<university ag guide>"]
}
```

Rule: if the schema changes, whoever changes it pings the other before committing — this file is the interface, so a silent change breaks the demo.

---

## 5. Timeline (build day)

| Block | Holly | Riyan |
|---|---|---|
| Hour 0–1 | Scaffold Next.js + FastAPI, lock scope | Pick disease, draft indicators |
| Hour 1–2 | Video player + detection overlay; draft `disease_profile.json` structure | Fill in science into the profile draft |
| Hour 2–3 | Reasoning engine + mission planner (consuming profile) | Start farmer/customer discovery via sponsor track |
| Hour 3–4 | Verification loop + field map + treatment zone | Validate AI output; capture demand signal |
| Hour 4–5 | Mission-complete screen + demo polish | Prep science + traction pitch section |
| Wrap | Rehearse 3-min demo (Holly leads, Riyan on science/traction) | |

---

## 6. Interfaces & handoffs

```
Holly: drafts disease_profile.json structure
   │
   ▼
Riyan: fills in science + treatment decision tree, validates
   │  (committed to data/)
   ▼
Holly: reasoning engine + mission planner  →  cockpit UI  →  demo
   ▲
   │  (validation feedback: "this claim isn't supported")
Riyan: scientific sign-off
```

```
Riyan: customer discovery (sponsor track → farmers)
   │  quotes / demand signal / pre-order
   ▼
Holly: pitch traction slide
```

---

## 7. Explicitly out of scope (both)
- Real drone control, real pesticide application, exact chemical dosing.
- Universal disease diagnosis or multi-crop support.
- Anything that can't be shown or defended in the 3-minute demo.
