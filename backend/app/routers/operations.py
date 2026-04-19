from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.models.domain import ConsignmentCreate, ConsignmentUpdate, TestNotifyPayload
from app.services.dispatch_scoring import build_dispatch_scoring_signals
from app.services.navpro import get_drivers
from app.services.operational_analytics import (
    get_fleet_performance_report,
    get_historical_operational_metrics,
    get_next_day_planning_report,
)
from app.services.operations import (
    call_proactive_notify,
    OperationsServiceConflict,
    OperationsServiceError,
    OperationsServiceNotConfigured,
    create_consignment,
    delete_consignment,
    get_consignment,
    get_consignment_timeline,
    list_receiver_notifications,
    list_assignments,
    list_consignments,
    update_consignment,
)

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/analytics/history")
async def get_operational_history(
    fleet_id: str = Query(...),
    origin: str | None = Query(default=None),
    destination: str | None = Query(default=None),
    driver_id: str | None = Query(default=None),
    truck_id: str | None = Query(default=None),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        report = await get_historical_operational_metrics(
            fleet_id=fleet_id,
            origin=origin,
            destination=destination,
            driver_id=driver_id,
            truck_id=truck_id,
            from_ts=from_ts,
            to_ts=to_ts,
        )
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "data": report.model_dump(mode="json"),
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/analytics/dispatch-signals")
async def get_dispatch_signals(
    fleet_id: str = Query(...),
    pickup: str = Query(...),
    destination: str = Query(...),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        drivers, _ = await get_drivers()
        report = await build_dispatch_scoring_signals(
            fleet_id=fleet_id,
            pickup=pickup,
            destination=destination,
            eligible_drivers=drivers,
            from_ts=from_ts,
            to_ts=to_ts,
        )
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "data": report.model_dump(mode="json"),
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/analytics/fleet-report")
async def get_fleet_report(
    fleet_id: str = Query(...),
    origin: str | None = Query(default=None),
    destination: str | None = Query(default=None),
    driver_id: str | None = Query(default=None),
    truck_id: str | None = Query(default=None),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        report = await get_fleet_performance_report(
            fleet_id=fleet_id,
            origin=origin,
            destination=destination,
            driver_id=driver_id,
            truck_id=truck_id,
            from_ts=from_ts,
            to_ts=to_ts,
        )
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "data": report.model_dump(mode="json"),
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/analytics/next-day-plan")
async def get_next_day_plan(
    fleet_id: str = Query(...),
    origin: str | None = Query(default=None),
    destination: str | None = Query(default=None),
    driver_id: str | None = Query(default=None),
    truck_id: str | None = Query(default=None),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        report = await get_next_day_planning_report(
            fleet_id=fleet_id,
            origin=origin,
            destination=destination,
            driver_id=driver_id,
            truck_id=truck_id,
            from_ts=from_ts,
            to_ts=to_ts,
        )
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "data": report.model_dump(mode="json"),
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/consignments")
async def get_consignments(
    fleet_id: str = Query(...),
    status: str | None = Query(default=None),
    dispatch_date: date | None = Query(default=None),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        consignments = await list_consignments(
            fleet_id=fleet_id,
            from_ts=from_ts,
            to_ts=to_ts,
            dispatch_date=dispatch_date,
            status=status,
        )
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "data": consignments,
        "count": len(consignments),
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/consignments/{consignment_id}")
async def get_consignment_by_id(
    consignment_id: str,
    fleet_id: str = Query(...),
):
    try:
        consignment = await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not consignment:
        raise HTTPException(status_code=404, detail="Consignment not found")

    return {
        "data": consignment,
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/consignments", status_code=status.HTTP_201_CREATED)
async def post_consignment(payload: ConsignmentCreate):
    try:
        consignment = await create_consignment(payload)
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "data": consignment,
        "fleet_id": payload.fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.patch("/consignments/{consignment_id}")
async def patch_consignment(
    consignment_id: str,
    payload: ConsignmentUpdate,
    fleet_id: str = Query(...),
):
    try:
        consignment = await update_consignment(
            fleet_id=fleet_id,
            consignment_id=consignment_id,
            payload=payload,
        )
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not consignment:
        raise HTTPException(status_code=404, detail="Consignment not found")

    return {
        "data": consignment,
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.delete("/consignments/{consignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_consignment(
    consignment_id: str,
    fleet_id: str = Query(...),
):
    try:
        deleted = await delete_consignment(fleet_id=fleet_id, consignment_id=consignment_id)
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Consignment not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/assignments")
async def get_assignments(
    fleet_id: str = Query(...),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        assignments = await list_assignments(
            fleet_id=fleet_id,
            from_ts=from_ts,
            to_ts=to_ts,
        )
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "data": assignments,
        "count": len(assignments),
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/consignments/{consignment_id}/events")
async def get_consignment_events(
    consignment_id: str,
    fleet_id: str = Query(...),
):
    try:
        timeline = await get_consignment_timeline(fleet_id=fleet_id, consignment_id=consignment_id)
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not timeline:
        raise HTTPException(status_code=404, detail="Consignment not found")

    return {
        "data": timeline,
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/consignments/{consignment_id}/notifications")
async def get_consignment_notifications(
    consignment_id: str,
    fleet_id: str = Query(...),
):
    try:
        consignment = await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)
        if not consignment:
            raise HTTPException(status_code=404, detail="Consignment not found")
        notifications = await list_receiver_notifications(
            fleet_id=fleet_id,
            consignment_id=consignment_id,
        )
    except OperationsServiceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OperationsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "data": notifications,
        "count": len(notifications),
        "fleet_id": fleet_id,
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/notify/test")
async def trigger_test_notification(payload: TestNotifyPayload):
    await call_proactive_notify(
        driver_id=payload.driver_id,
        driver_name=payload.driver_name,
        reason=payload.reason,
        eta_delta=payload.eta_delta,
        load_id=payload.load_id,
        consignment_id=payload.consignment_id,
        receiver_phone=payload.receiver_phone,
        receiver_name=payload.receiver_name,
    )
    return {
        "data": {"queued": True},
        "source": "insforge",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
