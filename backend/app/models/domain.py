from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


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


class ShipmentInterventionStatus(str, Enum):
    open = "open"
    action_required = "action_required"
    resolved = "resolved"


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


class CargoClass(str, Enum):
    general = "general"
    hazmat = "hazmat"
    refrigerated = "refrigerated"
    oversized = "oversized"
    high_value = "high_value"


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


class TimeWindow(BaseModel):
    start_at: datetime
    end_at: datetime


class ReceiverContactPreference(BaseModel):
    channel: NotificationChannel
    recipient: str
    priority: int = Field(default=1, ge=1, le=5)
    notes: Optional[str] = None


class ConsignmentRequirementFields(BaseModel):
    customer_reference: Optional[str] = None
    shipper_name: str
    receiver_name: str
    origin: str
    destination: str
    cargo_description: str
    cargo_class: CargoClass = CargoClass.general
    weight_lbs: int = Field(..., gt=0)
    pickup_window: Optional[TimeWindow] = None
    delivery_window: Optional[TimeWindow] = None
    special_handling: list[str] = Field(default_factory=list)
    receiver_contact_preferences: list[ReceiverContactPreference] = Field(default_factory=list)
    requested_pickup_at: Optional[datetime] = None
    promised_delivery_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_time_windows(self) -> "ConsignmentRequirementFields":
        if self.pickup_window and self.pickup_window.end_at < self.pickup_window.start_at:
            raise ValueError("pickup_window.end_at must be on or after pickup_window.start_at")
        if self.delivery_window and self.delivery_window.end_at < self.delivery_window.start_at:
            raise ValueError("delivery_window.end_at must be on or after delivery_window.start_at")
        return self


class ConsignmentCreate(ConsignmentRequirementFields):
    fleet_id: str
    consignment_id: Optional[str] = None
    status: ConsignmentStatus = ConsignmentStatus.unassigned
    assigned_driver_id: Optional[str] = None
    assigned_truck_id: Optional[str] = None
    current_assignment_id: Optional[str] = None


class ConsignmentUpdate(BaseModel):
    customer_reference: Optional[str] = None
    shipper_name: Optional[str] = None
    receiver_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    cargo_description: Optional[str] = None
    cargo_class: Optional[CargoClass] = None
    weight_lbs: Optional[int] = Field(default=None, gt=0)
    pickup_window: Optional[TimeWindow] = None
    delivery_window: Optional[TimeWindow] = None
    special_handling: Optional[list[str]] = None
    receiver_contact_preferences: Optional[list[ReceiverContactPreference]] = None
    requested_pickup_at: Optional[datetime] = None
    promised_delivery_at: Optional[datetime] = None
    status: Optional[ConsignmentStatus] = None
    assigned_driver_id: Optional[str] = None
    assigned_truck_id: Optional[str] = None
    current_assignment_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_time_windows(self) -> "ConsignmentUpdate":
        if self.pickup_window and self.pickup_window.end_at < self.pickup_window.start_at:
            raise ValueError("pickup_window.end_at must be on or after pickup_window.start_at")
        if self.delivery_window and self.delivery_window.end_at < self.delivery_window.start_at:
            raise ValueError("delivery_window.end_at must be on or after delivery_window.start_at")
        return self


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
    cargo_class: CargoClass = CargoClass.general
    weight_lbs: int
    pickup_window: Optional[TimeWindow] = None
    delivery_window: Optional[TimeWindow] = None
    special_handling: list[str] = Field(default_factory=list)
    receiver_contact_preferences: list[ReceiverContactPreference] = Field(default_factory=list)
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
    notification_type: str = "manual"
    channel: NotificationChannel
    recipient: str
    sent_at: datetime
    delivery_status: str
    eta_at: Optional[datetime] = None
    message_template: Optional[str] = None
    message_text: Optional[str] = None
    context: dict = Field(default_factory=dict)
    external_reference: Optional[str] = None


class ShipmentInterventionOutreachUpdate(BaseModel):
    dispatcher_id: str
    contact_channel: NotificationChannel = NotificationChannel.phone
    contact_status: str
    reason: str
    notes: Optional[str] = None
    intervention_status: Optional[ShipmentInterventionStatus] = None


class ShipmentInterventionRerouteUpdate(BaseModel):
    dispatcher_id: str
    reason: str
    updated_eta_at: Optional[datetime] = None
    estimated_distance_miles: Optional[float] = Field(default=None, gt=0)
    estimated_drive_hours: Optional[float] = Field(default=None, gt=0)
    status: Optional[ConsignmentStatus] = None
    route_plan_status: RoutePlanStatus = RoutePlanStatus.active
    mark_intervention_resolved: bool = True


class ShipmentInterventionRoadsideUpdate(BaseModel):
    dispatcher_id: str
    assistance_status: str
    provider_name: Optional[str] = None
    external_reference: Optional[str] = None
    notes: Optional[str] = None
    mark_intervention_resolved: bool = False
    mark_incident_resolved: bool = False


class ReconciliationEvent(AuditFields):
    reconciliation_event_id: str
    consignment_id: str
    assignment_id: Optional[str] = None
    event_date: datetime
    status: ReconciliationStatus
    cost_delta_usd: Optional[float] = None
    revenue_delta_usd: Optional[float] = None
    details: dict = Field(default_factory=dict)
