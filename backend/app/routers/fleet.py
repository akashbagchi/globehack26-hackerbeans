from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from app.services.navpro import get_drivers, get_driver
from app.models.events import BreakdownEvent, TelemetryUpdateEvent, BreakdownPayload, TelemetryUpdatePayload
from app.services.event_bus import event_bus
from app.limiter import limiter

router = APIRouter(prefix="/fleet", tags=["fleet"])


@router.get("/drivers")
@limiter.limit("60/minute")
async def list_drivers(request: Request):
    drivers, source = await get_drivers()
    for driver in drivers:
        await event_bus.publish(
            TelemetryUpdateEvent(
                producer="fleet.list_drivers",
                payload=TelemetryUpdatePayload(
                    driver_id=driver.driver_id,
                    status=driver.status,
                    city=driver.location.city,
                    state=driver.location.state,
                    speed_mph=driver.location.speed_mph,
                    drive_remaining_hrs=driver.hos.drive_remaining_hrs,
                    heading=driver.location.heading,
                ),
            )
        )
        if driver.status == "breakdown":
            await event_bus.publish(
                BreakdownEvent(
                    producer="fleet.list_drivers",
                    payload=BreakdownPayload(
                        driver_id=driver.driver_id,
                        truck_id=driver.vehicle.vehicle_id,
                        severity="high",
                        summary="Driver snapshot reported a breakdown state.",
                    ),
                )
            )
    return {
        "data": [d.model_dump() for d in drivers],
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "count": len(drivers),
    }


@router.get("/drivers/{driver_id}")
@limiter.limit("60/minute")
async def get_driver_by_id(request: Request, driver_id: str):
    driver = await get_driver(driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    drivers, source = await get_drivers()
    return {
        "data": driver.model_dump(),
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
