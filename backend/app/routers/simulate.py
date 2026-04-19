import math
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from app.models.load import SimulationRequest
from app.services.navpro import get_driver, resolve_coords, build_route_geojson, haversine_miles
from app.services.claude import get_simulation_narrator
from app.limiter import limiter

router = APIRouter(prefix="/simulate", tags=["simulate"])

AVG_SPEED_MPH = 55.0
COST_PER_MILE_OVERHEAD = 0.15


@router.post("/assignment")
@limiter.limit("10/minute")
async def simulate_assignment(request: Request, req: SimulationRequest):
    driver = await get_driver(req.driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    pickup_coords = resolve_coords(req.pickup)
    dest_coords = resolve_coords(req.destination)
    driver_coords = (driver.location.lat, driver.location.lng)

    deadhead_miles = haversine_miles(*driver_coords, *pickup_coords)
    haul_miles = haversine_miles(*pickup_coords, *dest_coords)
    total_miles = deadhead_miles + haul_miles
    total_hours = total_miles / AVG_SPEED_MPH
    cost_per_mile = driver.economics.cost_per_mile + COST_PER_MILE_OVERHEAD
    total_cost = total_miles * cost_per_mile
    hos_after = max(0.0, driver.hos.drive_remaining_hrs - total_hours)

    mid_coords = (
        (driver_coords[0] + pickup_coords[0]) / 2,
        (driver_coords[1] + pickup_coords[1]) / 2,
    )
    route_geojson = build_route_geojson(driver_coords, pickup_coords, dest_coords)

    narrator = await get_simulation_narrator(
        driver_name=driver.name,
        current_city=f"{driver.location.city}, {driver.location.state}",
        pickup=req.pickup,
        destination=req.destination,
        estimated_hours=total_hours,
        total_cost=total_cost,
        cost_per_mile=cost_per_mile,
        miles=total_miles,
        hos_remaining_after=hos_after,
    )

    return {
        "data": {
            "driver_id": driver.driver_id,
            "driver_name": driver.name,
            "route": route_geojson,
            "pickup_coords": {"lat": pickup_coords[0], "lng": pickup_coords[1]},
            "destination_coords": {"lat": dest_coords[0], "lng": dest_coords[1]},
            "estimated_miles": round(total_miles, 1),
            "estimated_hours": round(total_hours, 1),
            "total_cost": round(total_cost, 2),
            "cost_per_mile": round(cost_per_mile, 2),
            "narrator_text": narrator,
            "hos_remaining_after": round(hos_after, 1),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
