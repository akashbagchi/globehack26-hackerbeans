from fastapi import APIRouter, Query, Request
from datetime import datetime, timezone
from app.models.load import LoadRequest
from app.services.navpro import get_drivers
from app.services.claude import get_cost_insights, enrich_recommendations_with_ai
from app.services.dispatch_scoring import build_dispatch_scoring_signals
from app.services.eligibility import evaluate_driver_for_load
from app.services.scoring import score_drivers
from app.models.events import AssignmentDecisionEvent, AssignmentDecisionPayload
from app.services.event_bus import event_bus
from app.limiter import limiter

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.post("/recommend")
@limiter.limit("10/minute")
async def recommend_dispatch(
    request: Request,
    req: LoadRequest,
    enrich_with_ai: bool = Query(default=False),
    fleet_id: str | None = Query(default=None),
    include_historical_signals: bool = Query(default=False),
    history_from: datetime | None = Query(default=None, alias="history_from"),
    history_to: datetime | None = Query(default=None, alias="history_to"),
):
    drivers, source = await get_drivers()
    evaluations = [
        evaluate_driver_for_load(driver, req.pickup, req.destination, req.cargo, req.weight_lbs)
        for driver in drivers
    ]
    eligible_drivers = [evaluation.driver for evaluation in evaluations if evaluation.eligible]
    await event_bus.publish(
        AssignmentDecisionEvent(
            producer="dispatch.recommend",
            payload=AssignmentDecisionPayload(
                pickup=req.pickup,
                destination=req.destination,
                cargo=req.cargo,
                weight_lbs=req.weight_lbs,
                eligible_driver_ids=[driver.driver_id for driver in eligible_drivers],
                rejected_driver_ids=[
                    evaluation.driver.driver_id
                    for evaluation in evaluations
                    if not evaluation.eligible
                ],
            ),
        )
    )

    if not eligible_drivers:
        return {
            "data": {
                "recommendations": [],
                "dispatch_note": "No eligible driver-truck pairs met the readiness, HOS, certification, and capacity checks.",
            },
            "source": source,
            "scoring": "deterministic",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    historical_signals = None
    if include_historical_signals and fleet_id:
        historical_signals = await build_dispatch_scoring_signals(
            fleet_id=fleet_id,
            pickup=req.pickup,
            destination=req.destination,
            eligible_drivers=eligible_drivers,
            from_ts=history_from,
            to_ts=history_to,
        )

    result = score_drivers(
        eligible_drivers,
        req.pickup,
        req.destination,
        req.cargo,
        req.weight_lbs,
        historical_signals=historical_signals,
    )

    if enrich_with_ai:
        result = await enrich_recommendations_with_ai(result)

    response = {
        "data": result.model_dump(),
        "source": source,
        "scoring": "deterministic",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if historical_signals:
        response["historical_signals"] = historical_signals.model_dump(mode="json")
    return response


@router.get("/cost-insights")
@limiter.limit("20/minute")
async def cost_insights(request: Request):
    drivers, source = await get_drivers()
    result = await get_cost_insights(drivers)
    return {
        "data": result,
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
