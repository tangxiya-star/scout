"""Environmental data layer — NASA-first with a low-latency complement.

Guardrail (CLAUDE.md): the live demo must never block on a slow/failable
external call. So every fetch is: try live → cache → hardcoded fallback.
The demo field's values are pre-baked in FALLBACK and always return instantly
if anything upstream is slow or down.

Sources:
  - Open-Meteo   : low-latency *current* conditions (temp, humidity, wind, rain)
  - NASA POWER   : historical / agroclimate context (daily T2M, RH2M, precip)
"""

from __future__ import annotations

import time
from typing import Any

import httpx

# Locked demo field — a vineyard (Napa-ish coords, only used for context).
DEMO_FIELD = {"name": "Vineyard Block C", "lat": 38.29, "lon": -122.46}

# Hardcoded fallback = the numbers the PRD demo narrative is built around.
# If every network path fails, the demo still shows a coherent, defensible field.
FALLBACK: dict[str, Any] = {
    "temperature_celsius": 29.0,
    "relative_humidity": 91.0,
    "recent_rainfall": True,
    "wind_speed_mph": 4.0,
    "soil_moisture": "elevated",
    "source": "fallback",
    "disease_risk": "elevated",
}

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 600  # 10 min — plenty for a demo, avoids hammering APIs


def _cache_get(key: str) -> dict[str, Any] | None:
    hit = _CACHE.get(key)
    if hit and (time.time() - hit[0]) < _TTL_SECONDS:
        return hit[1]
    return None


def _cache_set(key: str, value: dict[str, Any]) -> None:
    _CACHE[key] = (time.time(), value)


def _classify_risk(temp_c: float, humidity: float, rain: bool) -> str:
    """Coarse downy-mildew risk heuristic (Riyan validates the real thresholds).

    High humidity + warm + recent rain = classic infection window.
    """
    score = 0
    if humidity >= 85:
        score += 2
    elif humidity >= 70:
        score += 1
    if 18 <= temp_c <= 30:
        score += 1
    if rain:
        score += 1
    return "elevated" if score >= 3 else "moderate" if score >= 2 else "low"


async def fetch_environment(lat: float, lon: float) -> dict[str, Any]:
    """Return current environmental context. Never raises — always usable."""
    key = f"{lat:.3f},{lon:.3f}"
    cached = _cache_get(key)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient(timeout=3.5) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,"
                    "wind_speed_10m,precipitation,rain",
                    "hourly": "precipitation",
                    "past_hours": 24,
                    "wind_speed_unit": "mph",
                    "forecast_days": 1,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            cur = data.get("current", {})
            hourly_precip = data.get("hourly", {}).get("precipitation", []) or [0]
            recent_rain = sum(p or 0 for p in hourly_precip[-24:]) > 1.0

            temp_c = float(cur.get("temperature_2m", FALLBACK["temperature_celsius"]))
            humidity = float(
                cur.get("relative_humidity_2m", FALLBACK["relative_humidity"])
            )

            result = {
                "temperature_celsius": round(temp_c, 1),
                "relative_humidity": round(humidity, 1),
                "recent_rainfall": recent_rain
                or float(cur.get("rain", 0) or 0) > 0,
                "wind_speed_mph": round(float(cur.get("wind_speed_10m", 4.0)), 1),
                # satellite soil moisture is regional context; keep the demo
                # value unless we wire SMAP/Crop-CASMA (their latency is high).
                "soil_moisture": FALLBACK["soil_moisture"],
                "source": "open-meteo",
            }
            result["disease_risk"] = _classify_risk(
                result["temperature_celsius"],
                result["relative_humidity"],
                result["recent_rainfall"],
            )
            _cache_set(key, result)
            return result
    except Exception:
        # Any failure → the pre-baked demo field. Demo never blocks.
        return dict(FALLBACK)


async def fetch_nasa_power_context(lat: float, lon: float) -> dict[str, Any]:
    """NASA POWER agroclimate context (last ~7 days). Best-effort, non-blocking.

    Returned as *regional context*, separate from the live current conditions.
    """
    key = f"nasa:{lat:.3f},{lon:.3f}"
    cached = _cache_get(key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                "https://power.larc.nasa.gov/api/temporal/daily/point",
                params={
                    "parameters": "T2M,RH2M,PRECTOTCORR",
                    "community": "AG",
                    "latitude": lat,
                    "longitude": lon,
                    "format": "JSON",
                    "start": "20260701",
                    "end": "20260707",
                },
            )
            resp.raise_for_status()
            p = resp.json()["properties"]["parameter"]

            def _avg(d: dict[str, Any]) -> float | None:
                vals = [v for v in d.values() if v is not None and v > -900]
                return round(sum(vals) / len(vals), 1) if vals else None

            result = {
                "avg_temp_celsius": _avg(p.get("T2M", {})),
                "avg_humidity": _avg(p.get("RH2M", {})),
                "avg_precip_mm": _avg(p.get("PRECTOTCORR", {})),
                "source": "nasa-power",
            }
            _cache_set(key, result)
            return result
    except Exception:
        return {
            "avg_temp_celsius": 27.5,
            "avg_humidity": 84.0,
            "avg_precip_mm": 6.2,
            "source": "fallback",
        }
