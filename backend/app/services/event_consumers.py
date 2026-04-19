from __future__ import annotations

import logging

from app.models.events import (
    AssignmentDecisionEvent,
    BreakdownEvent,
    FleetEvent,
    HOSThresholdWarningEvent,
    TelemetryUpdateEvent,
)
from app.services.event_bus import FleetEventBus

logger = logging.getLogger(__name__)


async def _log_event(event: FleetEvent) -> None:
    logger.info("fleet-event %s %s", event.event_type, event.event_id)


async def _watch_telemetry(event: FleetEvent) -> None:
    if not isinstance(event, TelemetryUpdateEvent):
        return
    if event.payload.drive_remaining_hrs <= 2:
        logger.warning(
            "driver %s crossed HOS threshold at %.1fh",
            event.payload.driver_id,
            event.payload.drive_remaining_hrs,
        )


async def _watch_assignment_decisions(event: FleetEvent) -> None:
    if not isinstance(event, AssignmentDecisionEvent):
        return
    logger.info(
        "assignment decision evaluated %s eligible / %s rejected",
        len(event.payload.eligible_driver_ids),
        len(event.payload.rejected_driver_ids),
    )


async def _watch_breakdowns(event: FleetEvent) -> None:
    if not isinstance(event, BreakdownEvent):
        return
    logger.error("breakdown reported for %s: %s", event.payload.driver_id, event.payload.summary)


async def _watch_hos_alerts(event: FleetEvent) -> None:
    if not isinstance(event, HOSThresholdWarningEvent):
        return
    logger.warning(
        "hos warning for %s: %.1fh remaining",
        event.payload.driver_id,
        event.payload.drive_remaining_hrs,
    )


def register_core_consumers(bus: FleetEventBus) -> None:
    bus.register_handler("telemetry.update.v1", _log_event)
    bus.register_handler("telemetry.update.v1", _watch_telemetry)
    bus.register_handler("assignment.decision_made.v1", _log_event)
    bus.register_handler("assignment.decision_made.v1", _watch_assignment_decisions)
    bus.register_handler("hos.threshold_warning.v1", _log_event)
    bus.register_handler("hos.threshold_warning.v1", _watch_hos_alerts)
    bus.register_handler("breakdown.reported.v1", _log_event)
    bus.register_handler("breakdown.reported.v1", _watch_breakdowns)
