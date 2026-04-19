from __future__ import annotations

import logging

from app.models.events import (
    AssignmentDecisionEvent,
    BreakdownEvent,
    FleetEvent,
    HOSThresholdWarningEvent,
    OperationalExceptionEvent,
    ReceiverNotificationEvent,
    RouteDeviationEvent,
    TelemetryUpdateEvent,
)
from app.services.event_bus import FleetEventBus
from app.services.interventions import (
    create_breakdown_intervention,
    create_hos_risk_intervention,
    create_operational_exception_intervention,
    create_route_deviation_intervention,
)
from app.services.operations import (
    call_proactive_notify,
    create_route_event_notification,
    _resolve_consignment_for_driver,
)

logger = logging.getLogger(__name__)

# Dedup guard: fire proactive SMS only once per driver per server run
_proactive_notified_drivers: set[str] = set()


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
    await create_hos_risk_intervention(event)


async def _watch_route_deviations(event: FleetEvent) -> None:
    if not isinstance(event, RouteDeviationEvent):
        return
    logger.warning(
        "route deviation [%s] driver=%s %.1f mi off-route in %s",
        event.payload.severity,
        event.payload.driver_id,
        event.payload.deviation_miles,
        event.payload.corridor,
    )
    await create_route_deviation_intervention(event)
    await create_route_event_notification(
        fleet_id=event.fleet_id,
        assignment_id=event.payload.assignment_id,
        driver_id=event.payload.driver_id,
        notification_type="route_impact_alert",
        reason=f"{event.payload.severity} route deviation in {event.payload.corridor}",
        eta_shift_minutes=45 if event.payload.severity == "major" else 20,
        extra_context={
            "deviation_miles": event.payload.deviation_miles,
            "corridor": event.payload.corridor,
            "severity": event.payload.severity,
            "lat": event.payload.lat,
            "lng": event.payload.lng,
        },
    )

    if event.payload.severity == "major" and event.payload.driver_id not in _proactive_notified_drivers:
        _proactive_notified_drivers.add(event.payload.driver_id)
        try:
            consignment = await _resolve_consignment_for_driver(
                fleet_id=event.fleet_id,
                assignment_id=event.payload.assignment_id,
                driver_id=event.payload.driver_id,
            )
            if consignment:
                sms_prefs = [
                    p for p in (consignment.get("receiver_contact_preferences") or [])
                    if p.get("channel") == "sms" and p.get("recipient")
                ]
                if sms_prefs:
                    await call_proactive_notify(
                        driver_id=event.payload.driver_id,
                        driver_name=None,
                        reason=f"Major route deviation detected — {event.payload.deviation_miles:.1f} mi off planned corridor in {event.payload.corridor}",
                        eta_delta=45,
                        load_id=event.payload.assignment_id or consignment.get("consignment_id", "unknown"),
                        consignment_id=consignment.get("consignment_id"),
                        receiver_phone=sms_prefs[0]["recipient"],
                        receiver_name=consignment.get("receiver_name"),
                    )
                else:
                    logger.info(
                        "proactive-notify skipped for %s: no SMS contact preference on consignment",
                        event.payload.driver_id,
                    )
        except Exception as exc:
            logger.warning("proactive-notify trigger failed for %s: %s", event.payload.driver_id, exc)


async def _watch_breakdown_notifications(event: FleetEvent) -> None:
    if not isinstance(event, BreakdownEvent):
        return
    await create_breakdown_intervention(event)
    await create_route_event_notification(
        fleet_id=event.fleet_id,
        assignment_id=None,
        driver_id=event.payload.driver_id,
        notification_type="exception_alert",
        reason=event.payload.summary,
        eta_shift_minutes=90 if event.payload.severity in {"high", "critical"} else 45,
        extra_context={
            "severity": event.payload.severity,
            "truck_id": event.payload.truck_id,
        },
    )


async def _watch_receiver_notifications(event: FleetEvent) -> None:
    if not isinstance(event, ReceiverNotificationEvent):
        return
    logger.info(
        "receiver notification %s -> %s [%s]",
        event.payload.consignment_id,
        event.payload.recipient,
        event.payload.status,
    )


async def _watch_operational_exceptions(event: FleetEvent) -> None:
    if not isinstance(event, OperationalExceptionEvent):
        return
    logger.warning(
        "operational exception [%s] driver=%s %s",
        event.payload.category,
        event.payload.driver_id,
        event.payload.summary,
    )
    await create_operational_exception_intervention(event)


def register_core_consumers(bus: FleetEventBus) -> None:
    bus.register_handler("telemetry.update.v1", _log_event)
    bus.register_handler("telemetry.update.v1", _watch_telemetry)
    bus.register_handler("assignment.decision_made.v1", _log_event)
    bus.register_handler("assignment.decision_made.v1", _watch_assignment_decisions)
    bus.register_handler("hos.threshold_warning.v1", _log_event)
    bus.register_handler("hos.threshold_warning.v1", _watch_hos_alerts)
    bus.register_handler("operational.exception_detected.v1", _log_event)
    bus.register_handler("operational.exception_detected.v1", _watch_operational_exceptions)
    bus.register_handler("breakdown.reported.v1", _log_event)
    bus.register_handler("breakdown.reported.v1", _watch_breakdowns)
    bus.register_handler("breakdown.reported.v1", _watch_breakdown_notifications)
    bus.register_handler("route.deviation_detected.v1", _log_event)
    bus.register_handler("route.deviation_detected.v1", _watch_route_deviations)
    bus.register_handler("receiver.notification_sent.v1", _log_event)
    bus.register_handler("receiver.notification_sent.v1", _watch_receiver_notifications)
