import httpx
import logging

logger = logging.getLogger(__name__)
OSRM_BASE = "https://router.project-osrm.org/route/v1/driving"


async def fetch_osrm_route(
    start: tuple[float, float],
    end: tuple[float, float],
) -> list[list[float]]:
    """Fetch real road route from OSRM. Returns coords as [[lng, lat], ...]."""
    try:
        url = f"{OSRM_BASE}/{start[1]:.6f},{start[0]:.6f};{end[1]:.6f},{end[0]:.6f}"
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(url, params={"overview": "full", "geometries": "geojson"})
            resp.raise_for_status()
            data = resp.json()
        if data.get("code") == "Ok" and data.get("routes"):
            coords = data["routes"][0]["geometry"]["coordinates"]
            logger.info("OSRM: %d coords for route", len(coords))
            return coords
    except Exception as exc:
        logger.warning("OSRM route fetch failed (%s), using straight line", exc)
    return [[start[1], start[0]], [end[1], end[0]]]
