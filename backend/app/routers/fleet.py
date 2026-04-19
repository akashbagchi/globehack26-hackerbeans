from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from app.services.navpro import get_drivers, get_driver

router = APIRouter(prefix="/fleet", tags=["fleet"])


@router.get("/drivers")
async def list_drivers():
    drivers, source = await get_drivers()
    return {
        "data": [d.model_dump() for d in drivers],
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "count": len(drivers),
    }


@router.get("/drivers/{driver_id}")
async def get_driver_by_id(driver_id: str):
    driver = await get_driver(driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    drivers, source = await get_drivers()
    return {
        "data": driver.model_dump(),
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
