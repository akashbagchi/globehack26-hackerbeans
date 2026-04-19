from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from app.limiter import limiter
from app.services.event_bus import event_bus

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/jobs")
@limiter.limit("30/minute")
async def event_job_status(request: Request):
    return {
        "data": event_bus.snapshot(),
        "source": "in_memory",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/jobs/{job_id}/retry")
@limiter.limit("10/minute")
async def retry_event_job(request: Request, job_id: str):
    retried = await event_bus.retry_dead_letter(job_id)
    if not retried:
        raise HTTPException(status_code=404, detail="Event job not found")
    return {
        "data": {"job_id": job_id, "status": "queued"},
        "source": "in_memory",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
