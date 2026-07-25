# VOYGR / Callwright call runner

Standalone — not part of the Scout app. Places real outbound AI-voice calls
through Callwright to the vineyard drone contractors in
[`../docs/scout-voygr-call-list.md`](../docs/scout-voygr-call-list.md).

## Run it

```
cd voygr-calls
.venv/bin/python callwright_runner.py
```

That's it — `calls.csv` is the default input, and `.env` (gitignored) already
has `CALLWRIGHT_API_KEY` set. `requests` is installed in the local `.venv/`
so this doesn't touch your system Python.

Results land in `results.json` and `results.csv` next to the script.

## What's in `calls.csv`

Only the **6 targets from the call list that had a real, published phone
number**: Plantivo, Der Drohnenservice, Schmidt Solutions (Germany), and
SAS Agri, Precision Drone Services, Crop Angel (UK). The Canada, US, and
Armenia sections of the call list, plus a few Germany/UK rows, had no
verified number — they're marked "enrichment target" in the source doc and
were deliberately left out rather than guessed at.

Der Drohnenservice has an alt landline (`+49 7042 8145191`) not in the CSV —
the call list says to try the mobile first; add a second row by hand if you
want the script's built-in retry to fall back to it (it currently only
retries the *same* number).

## Notes from verifying this against the live API

- Auth is `X-API-Key` only — the separate "Key ID" you have is just the
  server's label for that same key, not a second header to send.
- **Credit cost is 200/call**, not the 10 originally assumed in the quota
  pre-check — confirmed empirically against the live API. 6 calls (+ up to
  6 retries) = up to 2400 credits against your 2000-credit quota, so a
  retry-heavy run could hit `402 insufficient credits` partway through;
  that's handled (the run stops dispatching new calls, existing results
  still get written).
- The response field is `outcome_summary`, not `summary` — fixed in the
  script.
- One validation probe was run against the live API while checking this
  (garbage phone number, instantly failed, no one was called) — it cost
  200 credits. Quota was at 1800/2000 remaining as of 2026-07-24.
