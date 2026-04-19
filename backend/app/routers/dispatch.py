from fastapi import APIRouter
from datetime import datetime, timezone
from app.models.load import LoadRequest
from app.services.navpro import get_drivers
from app.services.claude import get_dispatch_recommendations, get_cost_insights

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.post("/recommend")
async def recommend_dispatch(req: LoadRequest):
    drivers, source = await get_drivers()
    result = await get_dispatch_recommendations(
        drivers, req.pickup, req.destination, req.cargo, req.weight_lbs
    )
    return {
        "data": result,
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/cost-insights")
async def cost_insights():
    drivers, source = await get_drivers()
    result = await get_cost_insights(drivers)
    return {
        "data": result,
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
