#!/usr/bin/env python3
"""
Callwright (VOYGR) autonomous call runner
==========================================

Places a batch of phone calls through the Callwright API, respecting the
2-max-concurrent-calls limit on hackathon keys, polls each call until it
completes, retries no-answer/voicemail outcomes once, and writes the
aggregated structured results + transcripts to disk.

SETUP
-----
    export CALLWRIGHT_API_KEY=<your team key>
    pip install requests

    (or drop a .env file next to this script with CALLWRIGHT_API_KEY=...
    — it's loaded automatically and gitignored.)

INPUT
-----
A CSV file (default: calls.csv) with at minimum these columns:

    name,phone,brief

    - name   : label for this call, just for your own reporting (not sent to the API)
    - phone  : E.164 format, e.g. +14155551234
    - brief  : the FULL plain-English task. This is the only thing the bot
               reads, so put everything in it: who you're calling for,
               exactly what to ask/confirm, any names/dates/callback
               numbers, and how to wrap up the call.

Example row:
    Luigi's Pizza,+14155551234,"Ask if they are showing the USA match tonight and whether a table for 4 at 7pm needs a reservation. If yes, get the reservation confirmed under the name Alex and ask for a callback number to text if plans change. Thank them and end the call once you have an answer."

USAGE
-----
    python3 callwright_runner.py calls.csv
    python3 callwright_runner.py calls.csv --out results.json --workers 2

OUTPUT
------
Writes results.json (default) and results.csv next to the input, each row/entry
containing: name, phone, call_id, status, outcome_type, summary,
transcript_full, attempts.
"""

import argparse
import csv
import json
import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

BASE_URL = "https://api.voygr.tech"
CALLS_ENDPOINT = f"{BASE_URL}/calls"
USAGE_ENDPOINT = f"{BASE_URL}/v1/usage"

# Outcomes worth one automatic retry (transient / didn't reach a human).
# Matches the real outcome_type enum from /openapi.json — the previous values
# here ("no_answer", "voicemail", ...) never matched anything the API returns.
RETRYABLE_OUTCOMES = {"failed_no_answer", "failed_voicemail", "failed_busy",
                       "failed_short_hangup", "failed_technical"}

TERMINAL_STATUSES = {"completed", "failed", "cancelled"}

# Per /openapi.json: POST /calls reserves 200 credits up front per call (held,
# not charged), released at completion. Actual settle is 10 for a success_*
# outcome, 0 for a failed_* one. 200 is the right number for this pre-flight
# check because it's what blocks a NEW call from being accepted (402) if
# unavailable — it is not the final cost of the batch.
CREDITS_PER_CALL = 200


def load_env_file(path: str) -> None:
    """Minimal .env loader so `CALLWRIGHT_API_KEY=...` in a local .env just works,
    without adding a python-dotenv dependency. Does not override already-set env vars."""
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def get_api_key() -> str:
    key = os.environ.get("CALLWRIGHT_API_KEY")
    if not key:
        sys.exit("ERROR: set CALLWRIGHT_API_KEY in your environment (or a local .env file) first.")
    return key


def check_quota(session: requests.Session, num_calls: int) -> None:
    """Pre-flight check: warn (don't hard-fail) if quota looks tight."""
    try:
        resp = session.get(USAGE_ENDPOINT, timeout=15)
        resp.raise_for_status()
        usage = resp.json()
        remaining = usage.get("remaining")
        if remaining is not None:
            needed = num_calls * CREDITS_PER_CALL
            print(f"[quota] remaining={remaining}, estimated need={needed} "
                  f"({num_calls} calls x {CREDITS_PER_CALL} credits, before retries)")
            if remaining < needed:
                print("[quota] WARNING: remaining credits may not cover this whole batch "
                      "once retries are included. Continuing anyway.")
    except requests.RequestException as e:
        print(f"[quota] could not check usage endpoint ({e}); continuing without it.")


def place_call(session: requests.Session, phone: str, brief: str, language: str = "en") -> str:
    payload = {"target_phone": phone, "brief": brief, "language": language}
    resp = session.post(CALLS_ENDPOINT, json=payload, timeout=30)
    if resp.status_code == 402:
        raise RuntimeError("insufficient credits (402) — stop dispatching new calls")
    resp.raise_for_status()
    body = resp.json()
    # Two possible envelopes per /openapi.json: the 202 QueuedCallResponse has
    # call_id at the top level; the 201 CallResponse nests it under "call".
    return body.get("call_id") or body["call"]["call_id"]


def poll_call(session: requests.Session, call_id: str,
              poll_interval: int = 15, timeout: int = 600) -> dict:
    """Poll GET /calls/<call_id> until it's in a terminal state or we time out."""
    deadline = time.time() + timeout
    last = {}
    while time.time() < deadline:
        resp = session.get(f"{CALLS_ENDPOINT}/{call_id}", timeout=30)
        resp.raise_for_status()
        last = resp.json()
        status = last.get("status", "")
        if status in TERMINAL_STATUSES:
            return last
        time.sleep(poll_interval)
    last["status"] = last.get("status", "timeout")
    return last


def run_one_target(session: requests.Session, target: dict, max_retries: int = 1) -> dict:
    """Place a call, poll to completion, retry once on a retryable outcome."""
    name, phone, brief = target["name"], target["phone"], target["brief"]
    attempts = 0
    result = {}

    while attempts <= max_retries:
        attempts += 1
        print(f"[dispatch] {name} ({phone}) — attempt {attempts}")
        call_id = place_call(session, phone, brief)

        # give the call time to actually happen + the ~30s the API needs to populate
        time.sleep(30)
        result = poll_call(session, call_id)
        outcome = result.get("outcome_type", "")

        if outcome not in RETRYABLE_OUTCOMES or attempts > max_retries:
            break
        print(f"[retry] {name}: outcome='{outcome}', retrying")

    return {
        "name": name,
        "phone": phone,
        "call_id": result.get("call_id"),
        "status": result.get("status"),
        "outcome_type": result.get("outcome_type"),
        "summary": result.get("outcome_summary"),
        "transcript_full": result.get("transcript_full"),
        "has_recording": result.get("has_recording"),
        "recording_url": result.get("recording_url"),
        "attempts": attempts,
    }


def load_targets(csv_path: str) -> list:
    targets = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get("phone") or not row.get("brief"):
                continue
            targets.append({
                "name": row.get("name", "").strip() or row["phone"],
                "phone": row["phone"].strip(),
                "brief": row["brief"].strip(),
            })
    return targets


def main():
    parser = argparse.ArgumentParser(description="Run a batch of Callwright calls.")
    parser.add_argument("csv_path", nargs="?", default="calls.csv",
                         help="CSV with columns: name,phone,brief (default: calls.csv)")
    parser.add_argument("--out", default="results", help="output file stem (writes .json and .csv)")
    parser.add_argument("--workers", type=int, default=2,
                         help="max concurrent calls (hackathon keys are capped at 2)")
    parser.add_argument("--retries", type=int, default=1,
                         help="max automatic retries per target on a retryable outcome")
    args = parser.parse_args()

    load_env_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    api_key = get_api_key()
    session = requests.Session()
    session.headers.update({
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    })

    targets = load_targets(args.csv_path)
    if not targets:
        sys.exit(f"No valid rows found in {args.csv_path}")
    print(f"Loaded {len(targets)} call targets from {args.csv_path}")

    check_quota(session, len(targets))

    results = []
    lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(run_one_target, session, t, args.retries): t
            for t in targets
        }
        for future in as_completed(futures):
            target = futures[future]
            try:
                res = future.result()
            except Exception as e:
                res = {
                    "name": target["name"],
                    "phone": target["phone"],
                    "call_id": None,
                    "status": "error",
                    "outcome_type": "exception",
                    "summary": str(e),
                    "transcript_full": None,
                    "has_recording": None,
                    "recording_url": None,
                    "attempts": 1,
                }
            with lock:
                results.append(res)
                print(f"[done] {res['name']}: status={res['status']} outcome={res['outcome_type']}")

    # Write JSON
    json_path = f"{args.out}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Write CSV
    csv_path = f"{args.out}.csv"
    fieldnames = ["name", "phone", "call_id", "status", "outcome_type", "summary",
                  "transcript_full", "has_recording", "recording_url", "attempts"]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"\nWrote {len(results)} results to {json_path} and {csv_path}")


if __name__ == "__main__":
    main()
