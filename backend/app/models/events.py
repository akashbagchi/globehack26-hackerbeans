from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Union
from uuid import uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FleetEventEnvelope(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt_{uuid4().hex[:12]}")
    schema_version: str = "2026-04-18"
    fleet_id: str = "fleet_demo"
    published_at: datetime = Field(default_factory=_utcnow)
    producer: str


class TelemetryUpdatePayload(BaseModel):
    driver_id: str
    status: str
    city: str
    state: str
    speed_mph: float
    drive_remaining_hrs: float
    heading: int


class HOSThresholdWarningPayload(BaseModel):
    driver_id: str
    drive_remaining_hrs: float
    threshold_hrs: float
    severity: str


class RouteDeviationPayload(BaseModel):
    assignment_id: str | None = None
    driver_id: str
    deviation_miles: float
    corridor: str
    severity: str = "minor"
    lat: float = 0.0
    lng: float = 0.0


class CardTransactionPayload(BaseModel):
    driver_id: str
    truck_id: str
    merchant: str
    amount_usd: float
    category: str


class DriverCheckInPayload(BaseModel):
    driver_id: str
    truck_id: str
    source: str
    note: str | None = None


class BreakdownPayload(BaseModel):
    driver_id: str
    truck_id: str
    severity: str
    summary: str


class OperationalExceptionPayload(BaseModel):
    assignment_id: str | None = None
    driver_id: str
    category: Literal["traffic_delay", "weather", "incident", "construction"]
    severity: str = "medium"
    summary: str
    eta_shift_minutes: int = 0
    lat: float | None = None
    lng: float | None = None
    policy: Literal["dispatcher_review_required", "auto_apply_allowed"] = "dispatcher_review_required"


class AssignmentDecisionPayload(BaseModel):
    pickup: str
    destination: str
    cargo: str
    weight_lbs: int
    eligible_driver_ids: list[str] = Field(default_factory=list)
    rejected_driver_ids: list[str] = Field(default_factory=list)


class OrchestrationCompletedPayload(BaseModel):
    dispatch_date: str
    total_consignments: int
    auto_assigned: int
    needs_review: int
    no_match: int
    driver_ids_used: list[str] = Field(default_factory=list)


class ReceiverNotificationPayload(BaseModel):
    consignment_id: str
    channel: str
    recipient: str
    status: str


class TelemetryUpdateEvent(FleetEventEnvelope):
    event_type: Literal["telemetry.update.v1"] = "telemetry.update.v1"
    payload: TelemetryUpdatePayload


class HOSThresholdWarningEvent(FleetEventEnvelope):
    event_type: Literal["hos.threshold_warning.v1"] = "hos.threshold_warning.v1"
    payload: HOSThresholdWarningPayload


class RouteDeviationEvent(FleetEventEnvelope):
    event_type: Literal["route.deviation_detected.v1"] = "route.deviation_detected.v1"
    payload: RouteDeviationPayload


class CardTransactionEvent(FleetEventEnvelope):
    event_type: Literal["card.transaction_recorded.v1"] = "card.transaction_recorded.v1"
    payload: CardTransactionPayload


class DriverCheckInEvent(FleetEventEnvelope):
    event_type: Literal["driver.check_in_received.v1"] = "driver.check_in_received.v1"
    payload: DriverCheckInPayload


class BreakdownEvent(FleetEventEnvelope):
    event_type: Literal["breakdown.reported.v1"] = "breakdown.reported.v1"
    payload: BreakdownPayload


class OperationalExceptionEvent(FleetEventEnvelope):
    event_type: Literal["operational.exception_detected.v1"] = "operational.exception_detected.v1"
    payload: OperationalExceptionPayload


class AssignmentDecisionEvent(FleetEventEnvelope):
    event_type: Literal["assignment.decision_made.v1"] = "assignment.decision_made.v1"
    payload: AssignmentDecisionPayload


class OrchestrationCompletedEvent(FleetEventEnvelope):
    event_type: Literal["dispatch.orchestration_completed.v1"] = "dispatch.orchestration_completed.v1"
    payload: OrchestrationCompletedPayload


class ReceiverNotificationEvent(FleetEventEnvelope):
    event_type: Literal["receiver.notification_sent.v1"] = "receiver.notification_sent.v1"
    payload: ReceiverNotificationPayload


FleetEvent = Union[
    TelemetryUpdateEvent,
    HOSThresholdWarningEvent,
    RouteDeviationEvent,
    CardTransactionEvent,
    DriverCheckInEvent,
    BreakdownEvent,
    OperationalExceptionEvent,
    AssignmentDecisionEvent,
    OrchestrationCompletedEvent,
    ReceiverNotificationEvent,
]


def as_event_dict(event: FleetEvent) -> dict[str, Any]:
    return event.model_dump(mode="json")
