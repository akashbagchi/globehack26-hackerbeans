from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.services.operations import (
    OperationsServiceError,
    OperationsServiceNotConfigured,
    get_consignment_timeline,
    list_assignments,
    list_consignments,
)

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/consignments")
async def get_consignments(
    fleet_id: str = Query(...),
    status: str | None = Query(default=None),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        consignments = await list_consignments(
            fleet_id=fleet_id,
            from_ts=from_ts,
            to_ts=to_ts,
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
