from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Awaitable, Callable
from uuid import uuid4

from app.models.events import FleetEvent, as_event_dict

logger = logging.getLogger(__name__)

EventHandler = Callable[[FleetEvent], Awaitable[None]]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class JobRecord:
    job_id: str
    event: FleetEvent
    attempts: int = 0
    status: str = "queued"
    created_at: datetime = field(default_factory=_utcnow)
    processed_at: datetime | None = None
    last_error: str | None = None

    def as_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "attempts": self.attempts,
            "created_at": self.created_at.isoformat(),
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "last_error": self.last_error,
            "event": as_event_dict(self.event),
        }


class FleetEventBus:
    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries
        self._queue: asyncio.Queue[JobRecord] = asyncio.Queue()
        self._handlers: dict[str, list[EventHandler]] = {}
        self._dead_letters: dict[str, JobRecord] = {}
        self._workers: list[asyncio.Task] = []
        self._started = False
        self._processed_jobs = 0
        self._failed_jobs = 0
        self._retried_jobs = 0

    async def start(self, worker_count: int = 1) -> None:
        if self._started:
            return
        self._started = True
        self._workers = [
            asyncio.create_task(self._worker(), name=f"fleet-event-worker-{index}")
            for index in range(worker_count)
        ]

    async def stop(self) -> None:
        if not self._started:
            return
        self._started = False
        for worker in self._workers:
            worker.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

    def register_handler(self, event_type: str, handler: EventHandler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    async def publish(self, event: FleetEvent) -> str:
        job = JobRecord(job_id=f"job_{uuid4().hex[:12]}", event=event)
        await self._queue.put(job)
        return job.job_id

    async def retry_dead_letter(self, job_id: str) -> bool:
        job = self._dead_letters.pop(job_id, None)
        if not job:
            return False
        job.status = "queued"
        job.last_error = None
        await self._queue.put(job)
        return True

    def snapshot(self) -> dict:
        return {
            "queue_size": self._queue.qsize(),
            "processed_jobs": self._processed_jobs,
            "failed_jobs": self._failed_jobs,
            "retried_jobs": self._retried_jobs,
            "dead_letter_count": len(self._dead_letters),
            "dead_letters": [job.as_dict() for job in self._dead_letters.values()],
            "registered_event_types": sorted(self._handlers.keys()),
        }

    async def _worker(self) -> None:
        while True:
            job = await self._queue.get()
            try:
                await self._process(job)
            finally:
                self._queue.task_done()

    async def _process(self, job: JobRecord) -> None:
        handlers = self._handlers.get(job.event.event_type, [])
        job.attempts += 1
        job.status = "processing"

        try:
            for handler in handlers:
                await handler(job.event)
            job.status = "processed"
            job.processed_at = _utcnow()
            self._processed_jobs += 1
        except Exception as exc:  # pragma: no cover - guarded in tests
            job.last_error = str(exc)
            self._failed_jobs += 1
            logger.exception("Fleet event job %s failed", job.job_id)
            if job.attempts < self.max_retries:
                self._retried_jobs += 1
                job.status = "retrying"
                asyncio.create_task(self._requeue(job))
            else:
                job.status = "dead_letter"
                job.processed_at = _utcnow()
                self._dead_letters[job.job_id] = job

    async def _requeue(self, job: JobRecord) -> None:
        await asyncio.sleep(min(job.attempts, 3) * 0.05)
        job.status = "queued"
        await self._queue.put(job)


event_bus = FleetEventBus()
