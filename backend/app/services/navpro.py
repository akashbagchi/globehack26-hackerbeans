import math
import httpx
from typing import List, Optional
from app.config import settings
from app.models.driver import Driver
from app.data.mock_seed import MOCK_DRIVERS


def _parse_mock_drivers() -> List[Driver]:
    return [Driver(**d) for d in MOCK_DRIVERS]


async def get_drivers() -> tuple[List[Driver], str]:
    if settings.use_mock_data or not settings.navpro_api_key:
        return _parse_mock_drivers(), "mock"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.navpro_base_url}/api/driver/query",
            headers={"Authorization": f"Bearer {settings.navpro_api_key}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        drivers = [Driver(**d) for d in data.get("drivers", [])]
        return drivers, "navpro"


async def get_driver(driver_id: str) -> Optional[Driver]:
    drivers, _ = await get_drivers()
    return next((d for d in drivers if d.driver_id == driver_id), None)


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


CITY_COORDS: dict[str, tuple[float, float]] = {
    "chicago": (41.8781, -87.6298),
    "dallas": (32.7767, -96.7970),
    "denver": (39.7392, -104.9903),
    "atlanta": (33.7490, -84.3880),
    "seattle": (47.6062, -122.3321),
    "phoenix": (33.4484, -112.0740),
    "nashville": (36.1627, -86.7816),
    "columbus": (39.9612, -82.9988),
    "new york": (40.7128, -74.0060),
    "los angeles": (34.0522, -118.2437),
    "houston": (29.7604, -95.3698),
    "miami": (25.7617, -80.1918),
    "st. louis": (38.6270, -90.1994),
    "kansas city": (39.0997, -94.5786),
    "minneapolis": (44.9778, -93.2650),
    "cleveland": (41.4993, -81.6944),
    "pittsburgh": (40.4406, -79.9959),
    "charlotte": (35.2271, -80.8431),
    "memphis": (35.1495, -90.0490),
    "detroit": (42.3314, -83.0458),
    "indianapolis": (39.7684, -86.1581),
    "louisville": (38.2527, -85.7585),
    "oklahoma city": (35.4676, -97.5164),
    "salt lake city": (40.7608, -111.8910),
    "portland": (45.5051, -122.6750),
    "san francisco": (37.7749, -122.4194),
    "albuquerque": (35.0844, -106.6504),
    "tucson": (32.2226, -110.9747),
    "fort worth": (32.7555, -97.3308),
    "san antonio": (29.4241, -98.4936),
    "gary": (41.5934, -87.3467),
}


def resolve_coords(city_str: str) -> tuple[float, float]:
    key = city_str.lower().split(",")[0].strip()
    return CITY_COORDS.get(key, (39.8283, -98.5795))


def build_route_geojson(
    start: tuple[float, float],
    waypoint: tuple[float, float],
    end: tuple[float, float],
) -> dict:
    import random
    mid_lat = (start[0] + end[0]) / 2 + random.uniform(-1.5, 1.5)
    mid_lng = (start[1] + end[1]) / 2 + random.uniform(-1.5, 1.5)

    coords = [
        [start[1], start[0]],
        [waypoint[1] + random.uniform(-0.5, 0.5), waypoint[0] + random.uniform(-0.5, 0.5)],
        [mid_lng, mid_lat],
        [end[1], end[0]],
    ]
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coords},
        "properties": {},
    }
