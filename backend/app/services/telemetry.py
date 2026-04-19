from __future__ import annotations

import asyncio
import json
import math
import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.services.routing import fetch_osrm_route
from app.services.navpro import haversine_miles
from app.config import settings

logger = logging.getLogger(__name__)

TICK_SECONDS = 10
SPEED_MULTIPLIER = 60        # 60× real-time so trucks visibly move on screen
DEVIATION_MINOR_MILES = 5.0
DEVIATION_MAJOR_MILES = 12.0

_ROUTE_CONFIG: dict[str, dict] = {
    "DRV001": {
        "start": (41.8781, -87.6298),
        "end":   (38.6270, -90.1994),
        "speed_mph": 62,
        "driver_name": "Marcus Webb",
        "load_id": "LD-8821",
        "progress_start": 0.30,
    },
    "DRV002": {
        "start": (32.7767, -96.7970),
        "end":   (29.7604, -95.3698),
        "speed_mph": 71,
        "driver_name": "Sofia Reyes",
        "load_id": "LD-9012",
        "progress_start": 0.40,
    },
    "DRV004": {
        "start": (33.7490, -84.3880),
        "end":   (25.7617, -80.1918),
        "speed_mph": 65,
        "driver_name": "Aaliyah Brooks",
        "load_id": "LD-7733",
        "progress_start": 0.18,
        "dev_start": 0.22,
        "dev_end":   0.44,
        "dev_offset_lat":  0.00,
        "dev_offset_lng":  0.24,
    },
    "DRV006": {
        "start": (33.4484, -112.0740),
        "end":   (34.0522, -118.2437),
        "speed_mph": 68,
        "driver_name": "Carmen Ibáñez",
        "load_id": "LD-6614",
        "progress_start": 0.25,
        "dev_start": 0.32,
        "dev_end":   0.50,
        "dev_offset_lat":  0.10,
        "dev_offset_lng":  0.00,
    },
    "DRV008": {
        "start": (39.9612, -82.9988),
        "end":   (40.4406, -79.9959),
        "speed_mph": 58,
        "driver_name": "Priya Nair",
        "load_id": "LD-5501",
        "progress_start": 0.50,
    },
}


@dataclass
class TruckState:
    driver_id: str
    driver_name: str
    load_id: str
    planned_coords: list
    cumulative: list[float]
    total_miles: float
    speed_mph: float
    route_progress: float = 0.0
    history: deque = field(default_factory=lambda: deque(maxlen=50))
    dev_start: float = 2.0
    dev_end: float = 2.0
    dev_offset_lat: float = 0.0
    dev_offset_lng: float = 0.0
    deviation_active: bool = False


class TelemetryService:
    def __init__(self) -> None:
        self._trucks: dict[str, TruckState] = {}
        self._task: Optional[asyncio.Task] = None
        self._bus = None
        self._insforge_url = (settings.insforge_base_url or "").rstrip("/")
        self._insforge_key = settings.insforge_anon_key

    def set_event_bus(self, bus) -> None:
        self._bus = bus

    async def initialize(self) -> None:
        for drv_id, cfg in _ROUTE_CONFIG.items():
            coords = await fetch_osrm_route(cfg["start"], cfg["end"])
            cumulative, total = _build_cumulative(coords)
            state = TruckState(
                driver_id=drv_id,
                driver_name=cfg["driver_name"],
                load_id=cfg["load_id"],
                planned_coords=coords,
                cumulative=cumulative,
                total_miles=total,
                speed_mph=cfg["speed_mph"],
                route_progress=cfg.get("progress_start", 0.0),
                dev_start=cfg.get("dev_start", 2.0),
                dev_end=cfg.get("dev_end", 2.0),
                dev_offset_lat=cfg.get("dev_offset_lat", 0.0),
                dev_offset_lng=cfg.get("dev_offset_lng", 0.0),
            )
            self._trucks[drv_id] = state
            logger.info("Telemetry: %s route ready — %d pts, %.0f mi", drv_id, len(coords), total)

        await self._push_routes()

    async def start(self) -> None:
        await self.initialize()
        self._task = asyncio.create_task(self._run(), name="telemetry-simulator")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        while True:
            await asyncio.sleep(TICK_SECONDS)
            try:
                await self._tick()
            except Exception:
                logger.exception("Telemetry tick error")

    async def _tick(self) -> None:
        from app.models.events import RouteDeviationEvent, RouteDeviationPayload

        positions: list[dict] = []
        deviations_upsert: list[dict] = []
        deviations_resolve: list[str] = []

        for drv_id, state in self._trucks.items():
            if state.total_miles <= 0:
                continue

            miles_per_tick = SPEED_MULTIPLIER * TICK_SECONDS * state.speed_mph / 3600
            state.route_progress = min(1.0, state.route_progress + miles_per_tick / state.total_miles)

            lat, lng, heading = _interpolate(
                state.planned_coords, state.cumulative, state.total_miles, state.route_progress
            )

            in_dev = state.dev_start <= state.route_progress <= state.dev_end
            if in_dev:
                lat += state.dev_offset_lat
                lng += state.dev_offset_lng

            positions.append({
                "driver_id": drv_id,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "speed_mph": state.speed_mph,
                "heading": heading,
                "route_progress_pct": round(state.route_progress * 100, 1),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

            if in_dev:
                dist = _dist_to_route_miles(lat, lng, state.planned_coords)
                severity = (
                    "major" if dist >= DEVIATION_MAJOR_MILES
                    else "minor" if dist >= DEVIATION_MINOR_MILES
                    else None
                )
                if severity and not state.deviation_active:
                    state.deviation_active = True
                    corridor = _corridor_label(state.planned_coords)
                    deviations_upsert.append({
                        "driver_id": drv_id,
                        "driver_name": state.driver_name,
                        "load_id": state.load_id,
                        "detected_at": datetime.now(timezone.utc).isoformat(),
                        "severity": severity,
                        "deviation_miles": round(dist, 1),
                        "lat": round(lat, 6),
                        "lng": round(lng, 6),
                        "corridor": corridor,
                        "resolved": False,
                    })
                    logger.warning("Deviation %s: %s %.1f mi off-route", severity, drv_id, dist)
                    if self._bus:
                        await self._bus.publish(RouteDeviationEvent(
                            producer="telemetry.simulator",
                            payload=RouteDeviationPayload(
                                assignment_id=state.load_id,
                                driver_id=drv_id,
                                deviation_miles=round(dist, 1),
                                corridor=_corridor_label(state.planned_coords),
                                severity=severity,
                                lat=round(lat, 6),
                                lng=round(lng, 6),
                            ),
                        ))
            else:
                if state.deviation_active:
                    state.deviation_active = False
                    deviations_resolve.append(drv_id)
                    logger.info("Deviation resolved for %s", drv_id)

            if state.route_progress >= 1.0:
                state.route_progress = 0.0
                state.deviation_active = False
                deviations_resolve.append(drv_id)

        await self._push_positions(positions)
        if deviations_upsert:
            await self._upsert_deviations(deviations_upsert)
        for drv_id in deviations_resolve:
            await self._resolve_deviation(drv_id)

    # ── InsForge writes ────────────────────────────────────────────────────────

    def _headers(self) -> dict:
        return {
            "apikey": self._insforge_key,
            "Authorization": f"Bearer {self._insforge_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        }

    async def _push_routes(self) -> None:
        if not self._insforge_url:
            return
        rows = [
            {
                "driver_id": drv_id,
                "geojson": {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": state.planned_coords},
                    "properties": {},
                },
                "total_miles": round(state.total_miles, 1),
            }
            for drv_id, state in self._trucks.items()
        ]
        await self._upsert("driver_routes", rows)

    async def _push_positions(self, rows: list[dict]) -> None:
        if not self._insforge_url or not rows:
            return
        await self._upsert("telemetry_positions", rows)

    async def _upsert_deviations(self, rows: list[dict]) -> None:
        if not self._insforge_url:
            return
        await self._upsert("route_deviations", rows)

    async def _resolve_deviation(self, driver_id: str) -> None:
        if not self._insforge_url:
            return
        url = f"{self._insforge_url}/rest/v1/route_deviations"
        params = {"driver_id": f"eq.{driver_id}"}
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.patch(
                    url,
                    params=params,
                    headers=self._headers(),
                    json={"resolved": True},
                )
        except Exception as exc:
            logger.warning("InsForge resolve deviation failed: %s", exc)

    async def _upsert(self, table: str, rows: list[dict]) -> None:
        url = f"{self._insforge_url}/rest/v1/{table}"
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(url, headers=self._headers(), json=rows)
        except Exception as exc:
            logger.warning("InsForge upsert %s failed: %s", table, exc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_cumulative(coords: list) -> tuple[list[float], float]:
    cumulative: list[float] = [0.0]
    total = 0.0
    for i in range(len(coords) - 1):
        d = haversine_miles(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
        total += d
        cumulative.append(total)
    return cumulative, total


def _interpolate(coords: list, cumulative: list[float], total_miles: float, progress: float) -> tuple[float, float, int]:
    if len(coords) < 2:
        c = coords[0] if coords else [0, 0]
        return c[1], c[0], 0

    target = max(0.0, min(total_miles, progress * total_miles))
    lo, hi = 0, len(cumulative) - 2
    while lo < hi:
        mid = (lo + hi) // 2
        if cumulative[mid + 1] < target:
            lo = mid + 1
        else:
            hi = mid

    i = lo
    seg_len = cumulative[i + 1] - cumulative[i]
    t = ((target - cumulative[i]) / seg_len) if seg_len > 0 else 0.0
    t = max(0.0, min(1.0, t))

    a_lng, a_lat = coords[i]
    b_lng, b_lat = coords[min(i + 1, len(coords) - 1)]
    lat = a_lat + t * (b_lat - a_lat)
    lng = a_lng + t * (b_lng - a_lng)
    heading = int(math.degrees(math.atan2(b_lng - a_lng, b_lat - a_lat))) % 360
    return lat, lng, heading


def _dist_to_route_miles(lat: float, lng: float, coords: list) -> float:
    min_dist = float("inf")
    for i in range(len(coords) - 1):
        a_lng, a_lat = coords[i]
        b_lng, b_lat = coords[i + 1]
        dx, dy = b_lng - a_lng, b_lat - a_lat
        denom = dx * dx + dy * dy
        if denom == 0:
            d_deg = math.hypot(lng - a_lng, lat - a_lat)
        else:
            t = max(0.0, min(1.0, ((lng - a_lng) * dx + (lat - a_lat) * dy) / denom))
            d_deg = math.hypot(lng - (a_lng + t * dx), lat - (a_lat + t * dy))
        min_dist = min(min_dist, d_deg * 69.0)
    return min_dist


def _corridor_label(coords: list) -> str:
    if len(coords) < 2:
        return "Unknown"
    s, e = coords[0], coords[-1]
    return f"({s[1]:.1f},{s[0]:.1f})→({e[1]:.1f},{e[0]:.1f})"


telemetry_service = TelemetryService()
