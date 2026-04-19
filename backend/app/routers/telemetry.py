from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.get("/routes")
async def get_telemetry_routes():
    from app.services.telemetry import telemetry_service
    routes = telemetry_service.snapshot_routes()
    return {
        "data": routes,
        "count": len(routes),
        "source": "telemetry_simulator",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/deviations")
async def get_telemetry_deviations():
    from app.services.telemetry import telemetry_service
    deviations = telemetry_service.snapshot_deviations()
    return {
        "data": deviations,
        "count": len(deviations),
        "source": "telemetry_simulator",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
