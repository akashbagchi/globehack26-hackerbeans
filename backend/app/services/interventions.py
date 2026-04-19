from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.models.domain import (
    ConsignmentUpdate,
    ConsignmentStatus,
    ShipmentInterventionRoadsideUpdate,
    ShipmentInterventionOutreachUpdate,
    ShipmentInterventionRerouteUpdate,
)
from app.models.events import (
    BreakdownEvent,
    HOSThresholdWarningEvent,
    OperationalExceptionEvent,
    RouteDeviationEvent,
)
from app.services.operations import (
    _fetch_records,
    _mutate_records,
    get_consignment,
    update_consignment,
)

ACTIVE_INTERVENTION_STATUSES = ("open", "action_required")


def _isoformat(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _generate_intervention_id() -> str:
    return f"INT{uuid4().hex[:8].upper()}"


def _generate_in_transit_event_id() -> str:
    return f"ITE{uuid4().hex[:8].upper()}"


def _generate_roadside_incident_id() -> str:
    return f"RSI{uuid4().hex[:8].upper()}"


def _generate_intervention_action_id() -> str:
    return f"INA{uuid4().hex[:8].upper()}"


def _generate_route_plan_id() -> str:
    return f"RTE{uuid4().hex[:8].upper()}"


async def list_shipment_interventions(
    *,
    fleet_id: str,
    status: str | None = None,
    consignment_id: str | None = None,
    assignment_id: str | None = None,
) -> list[dict[str, Any]]:
    params: dict[str, str] = {
        "fleet_id": f"eq.{fleet_id}",
        "order": "latest_event_at.desc",
    }
    if status:
        params["status"] = f"eq.{status}"
    if consignment_id:
        params["consignment_id"] = f"eq.{consignment_id}"
    if assignment_id:
        params["assignment_id"] = f"eq.{assignment_id}"
    return await _fetch_records("shipment_interventions", params)


async def get_shipment_intervention(
    *,
    fleet_id: str,
    shipment_intervention_id: str,
) -> dict[str, Any] | None:
    rows = await _fetch_records(
        "shipment_interventions",
        {
            "fleet_id": f"eq.{fleet_id}",
            "shipment_intervention_id": f"eq.{shipment_intervention_id}",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


async def list_shipment_intervention_actions(
    *,
    fleet_id: str,
    shipment_intervention_id: str,
) -> list[dict[str, Any]]:
    return await _fetch_records(
        "shipment_intervention_actions",
        {
            "fleet_id": f"eq.{fleet_id}",
            "shipment_intervention_id": f"eq.{shipment_intervention_id}",
            "order": "occurred_at.desc",
        },
    )


def _eta_with_shift(base_eta: str | None, minutes: int) -> str | None:
    if not base_eta:
        return None
    parsed = datetime.fromisoformat(base_eta.replace("Z", "+00:00"))
    shifted = parsed.timestamp() + minutes * 60
    return datetime.fromtimestamp(shifted, tz=timezone.utc).isoformat().replace("+00:00", "Z")


async def _resolve_shipment_context(
    *,
    fleet_id: str,
    assignment_id: str | None,
    driver_id: str | None,
) -> dict[str, Any]:
    assignment: dict[str, Any] | None = None
    consignment: dict[str, Any] | None = None

    if assignment_id:
        assignment_rows = await _fetch_records(
            "assignments",
            {
                "fleet_id": f"eq.{fleet_id}",
                "assignment_id": f"eq.{assignment_id}",
                "limit": "1",
            },
        )
        assignment = assignment_rows[0] if assignment_rows else None

    if not assignment and driver_id:
        assignment_rows = await _fetch_records(
            "assignments",
            {
                "fleet_id": f"eq.{fleet_id}",
                "driver_id": f"eq.{driver_id}",
                "status": "in.(planned,active)",
                "order": "updated_at.desc",
                "limit": "1",
            },
        )
        assignment = assignment_rows[0] if assignment_rows else None

    consignment_id = assignment.get("consignment_id") if assignment else None
    if consignment_id:
        consignment = await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)

    if not consignment and driver_id:
        consignment_rows = await _fetch_records(
            "consignments",
            {
                "fleet_id": f"eq.{fleet_id}",
                "assigned_driver_id": f"eq.{driver_id}",
                "status": "in.(assigned,dispatched,in_transit,delayed,exception)",
                "order": "updated_at.desc",
                "limit": "1",
            },
        )
        consignment = consignment_rows[0] if consignment_rows else None

    return {
        "assignment": assignment,
        "consignment": consignment,
        "assignment_id": (assignment or {}).get("assignment_id"),
        "consignment_id": (consignment or {}).get("consignment_id"),
        "driver_id": driver_id or (assignment or {}).get("driver_id") or (consignment or {}).get("assigned_driver_id"),
        "truck_id": (assignment or {}).get("truck_id") or (consignment or {}).get("assigned_truck_id"),
    }


async def _find_open_intervention(
    *,
    fleet_id: str,
    category: str,
    assignment_id: str | None,
    consignment_id: str | None,
    driver_id: str | None,
) -> dict[str, Any] | None:
    params: dict[str, str] = {
        "fleet_id": f"eq.{fleet_id}",
        "category": f"eq.{category}",
        "status": f"in.({','.join(ACTIVE_INTERVENTION_STATUSES)})",
        "order": "updated_at.desc",
        "limit": "1",
    }
    if assignment_id:
        params["assignment_id"] = f"eq.{assignment_id}"
    elif consignment_id:
        params["consignment_id"] = f"eq.{consignment_id}"
    elif driver_id:
        params["driver_id"] = f"eq.{driver_id}"
    else:
        return None

    rows = await _fetch_records("shipment_interventions", params)
    return rows[0] if rows else None


async def _upsert_intervention(
    *,
    fleet_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    existing = await _find_open_intervention(
        fleet_id=fleet_id,
        category=payload["category"],
        assignment_id=payload.get("assignment_id"),
        consignment_id=payload.get("consignment_id"),
        driver_id=payload.get("driver_id"),
    )
    if not existing:
        created = await _mutate_records("POST", "shipment_interventions", json_body=[payload])
        if isinstance(created, list) and created:
            return created[0]
        return payload

    existing_details = existing.get("details") or {}
    updated_details = {
        **existing_details,
        **(payload.get("details") or {}),
        "trigger_count": int(existing_details.get("trigger_count", 1)) + 1,
        "last_trigger_event_type": payload.get("trigger_event_type"),
    }
    updated = await _mutate_records(
        "PATCH",
        "shipment_interventions",
        params={"shipment_intervention_id": f"eq.{existing['shipment_intervention_id']}"},
        json_body={
            "severity": payload["severity"],
            "status": payload["status"],
            "summary": payload["summary"],
            "dispatcher_cta": payload["dispatcher_cta"],
            "recommended_route_action": payload.get("recommended_route_action"),
            "roadside_incident_id": payload.get("roadside_incident_id"),
            "latest_event_at": payload["latest_event_at"],
            "details": updated_details,
            "updated_at": payload["updated_at"],
        },
    )
    if isinstance(updated, list) and updated:
        return updated[0]
    return {**existing, **payload, "details": updated_details}


async def _append_intervention_action(
    *,
    shipment_intervention_id: str,
    fleet_id: str,
    dispatcher_id: str | None,
    action_type: str,
    action_status: str,
    action_reason: str | None,
    notes: str | None,
    metadata: dict[str, Any],
    occurred_at: str,
) -> dict[str, Any]:
    payload = {
        "shipment_intervention_action_id": _generate_intervention_action_id(),
        "shipment_intervention_id": shipment_intervention_id,
        "fleet_id": fleet_id,
        "dispatcher_id": dispatcher_id,
        "action_type": action_type,
        "action_status": action_status,
        "action_reason": action_reason,
        "notes": notes,
        "metadata": metadata,
        "occurred_at": occurred_at,
        "created_at": occurred_at,
        "updated_at": occurred_at,
    }
    created = await _mutate_records(
        "POST",
        "shipment_intervention_actions",
        json_body=[payload],
    )
    if isinstance(created, list) and created:
        return created[0]
    return payload


def _route_deviation_severity(raw: str) -> str:
    return "high" if raw == "major" else "medium"


def _route_deviation_status(raw: str) -> str:
    return "action_required" if raw == "major" else "open"


async def create_route_deviation_intervention(event: RouteDeviationEvent) -> dict[str, Any] | None:
    context = await _resolve_shipment_context(
        fleet_id=event.fleet_id,
        assignment_id=event.payload.assignment_id,
        driver_id=event.payload.driver_id,
    )
    if not context["assignment_id"] and not context["consignment_id"]:
        return None

    occurred_at = _isoformat(event.published_at)
    await _mutate_records(
        "POST",
        "in_transit_events",
        json_body=[
            {
                "in_transit_event_id": _generate_in_transit_event_id(),
                "fleet_id": event.fleet_id,
                "assignment_id": context["assignment_id"],
                "consignment_id": context["consignment_id"],
                "driver_id": context["driver_id"],
                "truck_id": context["truck_id"],
                "event_type": "route_deviation_detected",
                "occurred_at": occurred_at,
                "location": {
                    "lat": event.payload.lat,
                    "lng": event.payload.lng,
                },
                "details": {
                    "corridor": event.payload.corridor,
                    "deviation_miles": event.payload.deviation_miles,
                    "severity": event.payload.severity,
                    "source_event_id": event.event_id,
                },
            }
        ],
    )

    consignment = context["consignment"] or {}
    recommended_eta = consignment.get("promised_delivery_at") or consignment.get("delivery_window_end_at")
    now = occurred_at
    return await _upsert_intervention(
        fleet_id=event.fleet_id,
        payload={
            "shipment_intervention_id": _generate_intervention_id(),
            "fleet_id": event.fleet_id,
            "consignment_id": context["consignment_id"],
            "assignment_id": context["assignment_id"],
            "driver_id": context["driver_id"],
            "truck_id": context["truck_id"],
            "category": "route_deviation",
            "trigger_event_type": event.event_type,
            "summary": f"Driver is off route in {event.payload.corridor}",
            "severity": _route_deviation_severity(event.payload.severity),
            "status": _route_deviation_status(event.payload.severity),
            "dispatcher_cta": {
                "primary_action": "contact_driver",
                "secondary_action": "review_reroute",
                "label": "Confirm deviation reason and decide whether to reroute.",
            },
            "recommended_route_action": {
                "action": "evaluate_reroute",
                "policy": "dispatcher_review_required",
                "recommended_eta": recommended_eta,
            },
            "roadside_incident_id": None,
            "latest_event_at": now,
            "details": {
                "corridor": event.payload.corridor,
                "deviation_miles": event.payload.deviation_miles,
                "severity": event.payload.severity,
                "lat": event.payload.lat,
                "lng": event.payload.lng,
                "source_event_id": event.event_id,
                "trigger_count": 1,
            },
            "created_at": now,
            "updated_at": now,
        },
    )


async def create_breakdown_intervention(event: BreakdownEvent) -> dict[str, Any] | None:
    context = await _resolve_shipment_context(
        fleet_id=event.fleet_id,
        assignment_id=None,
        driver_id=event.payload.driver_id,
    )
    occurred_at = _isoformat(event.published_at)
    roadside_incident_id = _generate_roadside_incident_id()

    await _mutate_records(
        "POST",
        "roadside_incidents",
        json_body=[
            {
                "roadside_incident_id": roadside_incident_id,
                "fleet_id": event.fleet_id,
                "assignment_id": context["assignment_id"],
                "consignment_id": context["consignment_id"],
                "driver_id": event.payload.driver_id,
                "truck_id": event.payload.truck_id or context["truck_id"],
                "severity": event.payload.severity,
                "incident_type": "breakdown",
                "occurred_at": occurred_at,
                "summary": event.payload.summary,
                "details": f"Source event {event.event_id}",
            }
        ],
    )

    now = occurred_at
    return await _upsert_intervention(
        fleet_id=event.fleet_id,
        payload={
            "shipment_intervention_id": _generate_intervention_id(),
            "fleet_id": event.fleet_id,
            "consignment_id": context["consignment_id"],
            "assignment_id": context["assignment_id"],
            "driver_id": event.payload.driver_id,
            "truck_id": event.payload.truck_id or context["truck_id"],
            "category": "breakdown",
            "trigger_event_type": event.event_type,
            "summary": event.payload.summary,
            "severity": event.payload.severity,
            "status": "action_required",
            "dispatcher_cta": {
                "primary_action": "contact_driver",
                "secondary_action": "start_roadside_assistance",
                "label": "Contact the driver and begin roadside assistance coordination.",
            },
            "recommended_route_action": None,
            "roadside_incident_id": roadside_incident_id,
            "latest_event_at": now,
            "details": {
                "severity": event.payload.severity,
                "truck_id": event.payload.truck_id,
                "source_event_id": event.event_id,
                "trigger_count": 1,
                "roadside_assistance_status": "not_started",
            },
            "created_at": now,
            "updated_at": now,
        },
    )


async def create_hos_risk_intervention(event: HOSThresholdWarningEvent) -> dict[str, Any] | None:
    context = await _resolve_shipment_context(
        fleet_id=event.fleet_id,
        assignment_id=None,
        driver_id=event.payload.driver_id,
    )
    if not context["assignment_id"] and not context["consignment_id"]:
        return None

    occurred_at = _isoformat(event.published_at)
    consignment = context["consignment"] or {}
    recommended_eta = consignment.get("promised_delivery_at") or consignment.get("delivery_window_end_at")
    auto_policy = "auto_apply_allowed" if event.payload.drive_remaining_hrs <= 1 else "dispatcher_review_required"

    return await _upsert_intervention(
        fleet_id=event.fleet_id,
        payload={
            "shipment_intervention_id": _generate_intervention_id(),
            "fleet_id": event.fleet_id,
            "consignment_id": context["consignment_id"],
            "assignment_id": context["assignment_id"],
            "driver_id": context["driver_id"],
            "truck_id": context["truck_id"],
            "category": "hos_risk",
            "trigger_event_type": event.event_type,
            "summary": f"HOS risk for driver {event.payload.driver_id}: {event.payload.drive_remaining_hrs:.1f}h remaining",
            "severity": "high" if event.payload.drive_remaining_hrs <= 1 else "medium",
            "status": "action_required",
            "dispatcher_cta": {
                "primary_action": "contact_driver",
                "secondary_action": "review_reroute",
                "label": "Confirm break timing and decide whether to rebalance ETA or reroute.",
            },
            "recommended_route_action": {
                "action": "evaluate_reroute",
                "policy": auto_policy,
                "recommended_eta": recommended_eta,
            },
            "roadside_incident_id": None,
            "latest_event_at": occurred_at,
            "details": {
                "drive_remaining_hrs": event.payload.drive_remaining_hrs,
                "threshold_hrs": event.payload.threshold_hrs,
                "severity": event.payload.severity,
                "source_event_id": event.event_id,
                "trigger_count": 1,
            },
            "created_at": occurred_at,
            "updated_at": occurred_at,
        },
    )


async def create_operational_exception_intervention(
    event: OperationalExceptionEvent,
) -> dict[str, Any] | None:
    context = await _resolve_shipment_context(
        fleet_id=event.fleet_id,
        assignment_id=event.payload.assignment_id,
        driver_id=event.payload.driver_id,
    )
    if not context["assignment_id"] and not context["consignment_id"]:
        return None

    occurred_at = _isoformat(event.published_at)
    consignment = context["consignment"] or {}
    current_eta = consignment.get("promised_delivery_at") or consignment.get("delivery_window_end_at")
    shifted_eta = _eta_with_shift(current_eta, event.payload.eta_shift_minutes)

    await _mutate_records(
        "POST",
        "in_transit_events",
        json_body=[
            {
                "in_transit_event_id": _generate_in_transit_event_id(),
                "fleet_id": event.fleet_id,
                "assignment_id": context["assignment_id"],
                "consignment_id": context["consignment_id"],
                "driver_id": context["driver_id"],
                "truck_id": context["truck_id"],
                "event_type": event.payload.category,
                "occurred_at": occurred_at,
                "location": (
                    {"lat": event.payload.lat, "lng": event.payload.lng}
                    if event.payload.lat is not None and event.payload.lng is not None
                    else None
                ),
                "details": {
                    "summary": event.payload.summary,
                    "severity": event.payload.severity,
                    "eta_shift_minutes": event.payload.eta_shift_minutes,
                    "policy": event.payload.policy,
                    "source_event_id": event.event_id,
                },
            }
        ],
    )

    intervention = await _upsert_intervention(
        fleet_id=event.fleet_id,
        payload={
            "shipment_intervention_id": _generate_intervention_id(),
            "fleet_id": event.fleet_id,
            "consignment_id": context["consignment_id"],
            "assignment_id": context["assignment_id"],
            "driver_id": context["driver_id"],
            "truck_id": context["truck_id"],
            "category": event.payload.category,
            "trigger_event_type": event.event_type,
            "summary": event.payload.summary,
            "severity": event.payload.severity,
            "status": "action_required" if event.payload.policy != "auto_apply_allowed" else "open",
            "dispatcher_cta": {
                "primary_action": "contact_driver",
                "secondary_action": "review_reroute",
                "label": "Review the route impact and confirm shipment recovery plan.",
            },
            "recommended_route_action": {
                "action": "auto_apply_reroute" if event.payload.policy == "auto_apply_allowed" else "evaluate_reroute",
                "policy": event.payload.policy,
                "recommended_eta": shifted_eta or current_eta,
            },
            "roadside_incident_id": None,
            "latest_event_at": occurred_at,
            "details": {
                "eta_shift_minutes": event.payload.eta_shift_minutes,
                "policy": event.payload.policy,
                "source_event_id": event.event_id,
                "trigger_count": 1,
            },
            "created_at": occurred_at,
            "updated_at": occurred_at,
        },
    )

    if event.payload.policy == "auto_apply_allowed" and intervention:
        return await apply_intervention_reroute(
            fleet_id=event.fleet_id,
            shipment_intervention_id=intervention["shipment_intervention_id"],
            payload=ShipmentInterventionRerouteUpdate(
                dispatcher_id="system",
                reason=event.payload.summary,
                updated_eta_at=datetime.fromisoformat((shifted_eta or current_eta).replace("Z", "+00:00")) if (shifted_eta or current_eta) else None,
                status=ConsignmentStatus.delayed if event.payload.eta_shift_minutes > 0 else ConsignmentStatus.in_transit,
                mark_intervention_resolved=True,
            ),
        )

    return intervention


async def record_intervention_outreach(
    *,
    fleet_id: str,
    shipment_intervention_id: str,
    payload: ShipmentInterventionOutreachUpdate,
) -> dict[str, Any] | None:
    intervention = await get_shipment_intervention(
        fleet_id=fleet_id,
        shipment_intervention_id=shipment_intervention_id,
    )
    if not intervention:
        return None

    occurred_at = _isoformat(datetime.now(timezone.utc))
    action = await _append_intervention_action(
        shipment_intervention_id=shipment_intervention_id,
        fleet_id=fleet_id,
        dispatcher_id=payload.dispatcher_id,
        action_type="dispatcher_outreach",
        action_status=payload.contact_status,
        action_reason=payload.reason,
        notes=payload.notes,
        metadata={"contact_channel": payload.contact_channel.value},
        occurred_at=occurred_at,
    )
    next_status = payload.intervention_status.value if payload.intervention_status else intervention.get("status", "open")
    updated_intervention = await _mutate_records(
        "PATCH",
        "shipment_interventions",
        params={"shipment_intervention_id": f"eq.{shipment_intervention_id}"},
        json_body={
            "status": next_status,
            "details": {
                **(intervention.get("details") or {}),
                "last_outreach_at": occurred_at,
                "last_outreach_status": payload.contact_status,
                "last_outreach_reason": payload.reason,
                "last_outreach_notes": payload.notes,
                "last_contact_channel": payload.contact_channel.value,
            },
            "updated_at": occurred_at,
        },
    )
    return {
        "intervention": updated_intervention[0] if isinstance(updated_intervention, list) and updated_intervention else intervention,
        "action": action,
    }


async def apply_intervention_reroute(
    *,
    fleet_id: str,
    shipment_intervention_id: str,
    payload: ShipmentInterventionRerouteUpdate,
) -> dict[str, Any] | None:
    intervention = await get_shipment_intervention(
        fleet_id=fleet_id,
        shipment_intervention_id=shipment_intervention_id,
    )
    if not intervention:
        return None

    assignment_id = intervention.get("assignment_id")
    consignment_id = intervention.get("consignment_id")
    if not assignment_id or not consignment_id:
        return None

    occurred_at = _isoformat(datetime.now(timezone.utc))
    route_plan_rows = await _fetch_records(
        "route_plans",
        {
            "fleet_id": f"eq.{fleet_id}",
            "assignment_id": f"eq.{assignment_id}",
            "order": "updated_at.desc",
            "limit": "1",
        },
    )
    route_plan = route_plan_rows[0] if route_plan_rows else None

    route_plan_payload = {
        "status": payload.route_plan_status.value,
        "planned_arrival_at": payload.updated_eta_at.isoformat().replace("+00:00", "Z")
        if payload.updated_eta_at
        else None,
        "estimated_distance_miles": payload.estimated_distance_miles,
        "estimated_drive_hours": payload.estimated_drive_hours,
        "updated_at": occurred_at,
    }
    route_plan_payload = {key: value for key, value in route_plan_payload.items() if value is not None}

    if route_plan:
        updated_route_plan = await _mutate_records(
            "PATCH",
            "route_plans",
            params={"route_plan_id": f"eq.{route_plan['route_plan_id']}"},
            json_body=route_plan_payload,
        )
        route_plan_row = updated_route_plan[0] if isinstance(updated_route_plan, list) and updated_route_plan else route_plan
    else:
        created_route_plan = {
            "route_plan_id": _generate_route_plan_id(),
            "fleet_id": fleet_id,
            "assignment_id": assignment_id,
            "status": payload.route_plan_status.value,
            "planned_arrival_at": payload.updated_eta_at.isoformat().replace("+00:00", "Z")
            if payload.updated_eta_at
            else occurred_at,
            "estimated_distance_miles": payload.estimated_distance_miles,
            "estimated_drive_hours": payload.estimated_drive_hours,
            "created_at": occurred_at,
            "updated_at": occurred_at,
        }
        created = await _mutate_records("POST", "route_plans", json_body=[created_route_plan])
        route_plan_row = created[0] if isinstance(created, list) and created else created_route_plan

    current_consignment = await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)
    current_eta = current_consignment.get("promised_delivery_at") if current_consignment else None
    next_status = payload.status
    if not next_status:
        next_status = (
            ConsignmentStatus.delayed
            if payload.updated_eta_at and current_eta and payload.updated_eta_at.isoformat().replace("+00:00", "Z") != current_eta
            else ConsignmentStatus.in_transit
        )

    consignment_update = await update_consignment(
        fleet_id=fleet_id,
        consignment_id=consignment_id,
        payload=ConsignmentUpdate(
            status=next_status,
            promised_delivery_at=payload.updated_eta_at,
        ),
    )

    await _mutate_records(
        "POST",
        "in_transit_events",
        json_body=[
            {
                "in_transit_event_id": _generate_in_transit_event_id(),
                "fleet_id": fleet_id,
                "assignment_id": assignment_id,
                "consignment_id": consignment_id,
                "driver_id": intervention.get("driver_id"),
                "truck_id": intervention.get("truck_id"),
                "event_type": "route_rerouted",
                "occurred_at": occurred_at,
                "details": {
                    "reason": payload.reason,
                    "dispatcher_id": payload.dispatcher_id,
                    "updated_eta_at": payload.updated_eta_at.isoformat().replace("+00:00", "Z")
                    if payload.updated_eta_at
                    else None,
                    "route_plan_id": route_plan_row.get("route_plan_id"),
                },
            }
        ],
    )

    action = await _append_intervention_action(
        shipment_intervention_id=shipment_intervention_id,
        fleet_id=fleet_id,
        dispatcher_id=payload.dispatcher_id,
        action_type="reroute_applied",
        action_status="completed",
        action_reason=payload.reason,
        notes=None,
        metadata={
            "route_plan_id": route_plan_row.get("route_plan_id"),
            "updated_eta_at": payload.updated_eta_at.isoformat().replace("+00:00", "Z")
            if payload.updated_eta_at
            else None,
            "estimated_distance_miles": payload.estimated_distance_miles,
            "estimated_drive_hours": payload.estimated_drive_hours,
            "consignment_status": next_status.value,
        },
        occurred_at=occurred_at,
    )

    updated_intervention = await _mutate_records(
        "PATCH",
        "shipment_interventions",
        params={"shipment_intervention_id": f"eq.{shipment_intervention_id}"},
        json_body={
            "status": "resolved" if payload.mark_intervention_resolved else intervention.get("status", "open"),
            "recommended_route_action": {
                **(intervention.get("recommended_route_action") or {}),
                "applied_at": occurred_at,
                "applied_by": payload.dispatcher_id,
                "resolution": "reroute_applied",
            },
            "details": {
                **(intervention.get("details") or {}),
                "resolution_reason": payload.reason,
                "resolution_action": "reroute_applied",
                "resolved_at": occurred_at if payload.mark_intervention_resolved else None,
            },
            "updated_at": occurred_at,
        },
    )

    return {
        "intervention": updated_intervention[0] if isinstance(updated_intervention, list) and updated_intervention else intervention,
        "action": action,
        "route_plan": route_plan_row,
        "consignment": consignment_update,
    }


async def update_roadside_assistance(
    *,
    fleet_id: str,
    shipment_intervention_id: str,
    payload: ShipmentInterventionRoadsideUpdate,
) -> dict[str, Any] | None:
    intervention = await get_shipment_intervention(
        fleet_id=fleet_id,
        shipment_intervention_id=shipment_intervention_id,
    )
    if not intervention:
        return None

    roadside_incident_id = intervention.get("roadside_incident_id")
    occurred_at = _isoformat(datetime.now(timezone.utc))

    action = await _append_intervention_action(
        shipment_intervention_id=shipment_intervention_id,
        fleet_id=fleet_id,
        dispatcher_id=payload.dispatcher_id,
        action_type="roadside_assistance",
        action_status=payload.assistance_status,
        action_reason=payload.provider_name,
        notes=payload.notes,
        metadata={
            "provider_name": payload.provider_name,
            "external_reference": payload.external_reference,
        },
        occurred_at=occurred_at,
    )

    incident = None
    if roadside_incident_id:
        incident_rows = await _mutate_records(
            "PATCH",
            "roadside_incidents",
            params={"roadside_incident_id": f"eq.{roadside_incident_id}"},
            json_body={
                "details": (
                    f"provider={payload.provider_name or 'unknown'};"
                    f" status={payload.assistance_status};"
                    f" ref={payload.external_reference or 'n/a'};"
                    f" notes={payload.notes or ''}"
                ),
                "resolved_at": occurred_at if payload.mark_incident_resolved else None,
                "updated_at": occurred_at,
            },
        )
        if isinstance(incident_rows, list) and incident_rows:
            incident = incident_rows[0]

    updated_intervention = await _mutate_records(
        "PATCH",
        "shipment_interventions",
        params={"shipment_intervention_id": f"eq.{shipment_intervention_id}"},
        json_body={
            "status": "resolved" if payload.mark_intervention_resolved else intervention.get("status", "open"),
            "details": {
                **(intervention.get("details") or {}),
                "roadside_assistance_status": payload.assistance_status,
                "roadside_provider_name": payload.provider_name,
                "roadside_reference": payload.external_reference,
                "roadside_updated_at": occurred_at,
                "resolved_at": occurred_at if payload.mark_intervention_resolved else intervention.get("details", {}).get("resolved_at"),
            },
            "updated_at": occurred_at,
        },
    )

    return {
        "intervention": updated_intervention[0] if isinstance(updated_intervention, list) and updated_intervention else intervention,
        "action": action,
        "roadside_incident": incident,
    }
