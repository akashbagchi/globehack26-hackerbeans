from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DriverStatus(str, Enum):
    available = "available"
    driving = "driving"
    off_duty = "off_duty"
    unavailable = "unavailable"
    breakdown = "breakdown"


class ConsignmentStatus(str, Enum):
    unassigned = "unassigned"
    assigned = "assigned"
    dispatched = "dispatched"
    in_transit = "in_transit"
    delayed = "delayed"
    delivered = "delivered"
    exception = "exception"


class AssignmentStatus(str, Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class RoutePlanStatus(str, Enum):
    draft = "draft"
    approved = "approved"
    active = "active"
    completed = "completed"
    superseded = "superseded"


class IncidentSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class NotificationChannel(str, Enum):
    email = "email"
    sms = "sms"
    phone = "phone"
    portal = "portal"


class ReconciliationStatus(str, Enum):
    pending = "pending"
    matched = "matched"
    disputed = "disputed"
    resolved = "resolved"


DRIVER_STATUS_TRANSITIONS: dict[DriverStatus, set[DriverStatus]] = {
    DriverStatus.available: {
        DriverStatus.driving,
        DriverStatus.off_duty,
        DriverStatus.unavailable,
        DriverStatus.breakdown,
    },
    DriverStatus.driving: {
        DriverStatus.available,
        DriverStatus.off_duty,
        DriverStatus.unavailable,
        DriverStatus.breakdown,
    },
    DriverStatus.off_duty: {
        DriverStatus.available,
        DriverStatus.unavailable,
    },
    DriverStatus.unavailable: {
        DriverStatus.available,
        DriverStatus.off_duty,
        DriverStatus.breakdown,
    },
    DriverStatus.breakdown: {
        DriverStatus.unavailable,
        DriverStatus.available,
    },
}


CONSIGNMENT_STATUS_TRANSITIONS: dict[ConsignmentStatus, set[ConsignmentStatus]] = {
    ConsignmentStatus.unassigned: {ConsignmentStatus.assigned, ConsignmentStatus.exception},
    ConsignmentStatus.assigned: {
        ConsignmentStatus.unassigned,
        ConsignmentStatus.dispatched,
        ConsignmentStatus.exception,
    },
    ConsignmentStatus.dispatched: {
        ConsignmentStatus.in_transit,
        ConsignmentStatus.delayed,
        ConsignmentStatus.exception,
    },
    ConsignmentStatus.in_transit: {
        ConsignmentStatus.delayed,
        ConsignmentStatus.delivered,
        ConsignmentStatus.exception,
    },
    ConsignmentStatus.delayed: {
        ConsignmentStatus.in_transit,
        ConsignmentStatus.delivered,
        ConsignmentStatus.exception,
    },
    ConsignmentStatus.delivered: set(),
    ConsignmentStatus.exception: {
        ConsignmentStatus.unassigned,
        ConsignmentStatus.assigned,
        ConsignmentStatus.delayed,
    },
}


def can_transition_driver_status(current: DriverStatus, nxt: DriverStatus) -> bool:
    return nxt in DRIVER_STATUS_TRANSITIONS[current]


def can_transition_consignment_status(
    current: ConsignmentStatus, nxt: ConsignmentStatus
) -> bool:
    return nxt in CONSIGNMENT_STATUS_TRANSITIONS[current]


class AuditFields(BaseModel):
    fleet_id: str = Field(..., description="Tenant or fleet this record belongs to.")
    created_at: datetime
    updated_at: datetime


class GeoPoint(BaseModel):
    lat: float
    lng: float
    city: Optional[str] = None
    state: Optional[str] = None


class DispatcherProfile(AuditFields):
    dispatcher_id: str
    name: str
    email: str
    phone: Optional[str] = None
    shift_start_at: Optional[datetime] = None
    shift_end_at: Optional[datetime] = None
    active: bool = True


class DriverCertification(AuditFields):
    certification_id: str
    driver_id: str
    certification_type: str
    issued_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    issuer: Optional[str] = None
    notes: Optional[str] = None


class DriverProfile(AuditFields):
    driver_id: str
    dispatcher_id: Optional[str] = None
    first_name: str
    last_name: str
    phone: Optional[str] = None
    license_number: str
    home_terminal: Optional[str] = None
    status: DriverStatus
    last_known_location: Optional[GeoPoint] = None
    last_check_in_at: Optional[datetime] = None
    current_assignment_id: Optional[str] = None


class TruckProfile(AuditFields):
    truck_id: str
    truck_number: str
    vin: Optional[str] = None
    make: str
    model: str
    year: int
    capacity_lbs: Optional[int] = None
    current_driver_id: Optional[str] = None
    current_assignment_id: Optional[str] = None
    last_known_location: Optional[GeoPoint] = None
    active: bool = True


class Consignment(BaseModel):
    consignment_id: str
    fleet_id: str
    customer_reference: Optional[str] = None
    shipper_name: str
    receiver_name: str
    origin: str
    destination: str
    cargo_description: str
    weight_lbs: int
    status: ConsignmentStatus
    requested_pickup_at: Optional[datetime] = None
    promised_delivery_at: Optional[datetime] = None
    assigned_driver_id: Optional[str] = None
    assigned_truck_id: Optional[str] = None
    current_assignment_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class Assignment(AuditFields):
    assignment_id: str
    consignment_id: str
    dispatcher_id: str
    driver_id: str
    truck_id: str
    status: AssignmentStatus
    assigned_at: datetime
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None


class RoutePlanStop(BaseModel):
    sequence: int
    stop_type: str
    location_name: str
    location: Optional[GeoPoint] = None
    planned_arrival_at: Optional[datetime] = None
    planned_departure_at: Optional[datetime] = None


class RoutePlan(AuditFields):
    route_plan_id: str
    assignment_id: str
    status: RoutePlanStatus
    estimated_distance_miles: Optional[float] = None
    estimated_drive_hours: Optional[float] = None
    planned_departure_at: Optional[datetime] = None
    planned_arrival_at: Optional[datetime] = None
    stops: list[RoutePlanStop] = Field(default_factory=list)


class InTransitEvent(AuditFields):
    in_transit_event_id: str
    assignment_id: str
    consignment_id: str
    driver_id: Optional[str] = None
    truck_id: Optional[str] = None
    event_type: str
    occurred_at: datetime
    location: Optional[GeoPoint] = None
    details: dict = Field(default_factory=dict)


class CheckInEvent(AuditFields):
    check_in_event_id: str
    assignment_id: Optional[str] = None
    driver_id: str
    truck_id: Optional[str] = None
    checked_in_at: datetime
    source: str
    location: Optional[GeoPoint] = None
    notes: Optional[str] = None


class RoadsideIncident(AuditFields):
    roadside_incident_id: str
    assignment_id: Optional[str] = None
    consignment_id: Optional[str] = None
    driver_id: Optional[str] = None
    truck_id: Optional[str] = None
    severity: IncidentSeverity
    incident_type: str
    occurred_at: datetime
    resolved_at: Optional[datetime] = None
    location: Optional[GeoPoint] = None
    summary: str
    details: Optional[str] = None


class ReceiverNotification(AuditFields):
    receiver_notification_id: str
    consignment_id: str
    assignment_id: Optional[str] = None
    channel: NotificationChannel
    recipient: str
    sent_at: datetime
    delivery_status: str
    message_template: Optional[str] = None
    external_reference: Optional[str] = None


class ReconciliationEvent(AuditFields):
    reconciliation_event_id: str
    consignment_id: str
    assignment_id: Optional[str] = None
    event_date: datetime
    status: ReconciliationStatus
    cost_delta_usd: Optional[float] = None
    revenue_delta_usd: Optional[float] = None
    details: dict = Field(default_factory=dict)
