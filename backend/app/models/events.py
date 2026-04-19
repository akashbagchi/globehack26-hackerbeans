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


class AssignmentDecisionPayload(BaseModel):
    pickup: str
    destination: str
    cargo: str
    weight_lbs: int
    eligible_driver_ids: list[str] = Field(default_factory=list)
    rejected_driver_ids: list[str] = Field(default_factory=list)


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


class AssignmentDecisionEvent(FleetEventEnvelope):
    event_type: Literal["assignment.decision_made.v1"] = "assignment.decision_made.v1"
    payload: AssignmentDecisionPayload


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
    AssignmentDecisionEvent,
    ReceiverNotificationEvent,
]


def as_event_dict(event: FleetEvent) -> dict[str, Any]:
    return event.model_dump(mode="json")
