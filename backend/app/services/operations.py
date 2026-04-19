from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any
from uuid import uuid4

import httpx

from app.config import settings
from app.models.domain import (
    ConsignmentCreate,
    ConsignmentStatus,
    ConsignmentUpdate,
    can_transition_consignment_status,
)
from app.models.events import ReceiverNotificationEvent, ReceiverNotificationPayload
from app.services.event_bus import event_bus


class OperationsServiceError(Exception):
    pass


class OperationsServiceNotConfigured(OperationsServiceError):
    pass


class OperationsServiceConflict(OperationsServiceError):
    pass


def _base_headers() -> dict[str, str]:
    if not settings.insforge_base_url or not settings.insforge_anon_key:
        raise OperationsServiceNotConfigured(
            "INSFORGE_BASE_URL and INSFORGE_ANON_KEY must be configured in backend/.env"
        )
    return {
        "Authorization": f"Bearer {settings.insforge_anon_key}",
        "Content-Type": "application/json",
    }


def _records_url(table_name: str) -> str:
    base_url = settings.insforge_base_url.rstrip("/")
    return f"{base_url}/api/database/records/{table_name}"


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat().replace("+00:00", "Z") if value else None


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _within_range(
    value: str | None,
    from_ts: datetime | None,
    to_ts: datetime | None,
) -> bool:
    parsed = _parse_timestamp(value)
    if not parsed:
        return False
    if from_ts and parsed < from_ts:
        return False
    if to_ts and parsed > to_ts:
        return False
    return True


def _consignment_dispatch_timestamp(row: dict[str, Any]) -> str | None:
    return (
        row.get("pickup_window_start_at")
        or row.get("requested_pickup_at")
        or row.get("created_at")
    )


async def _fetch_records(table_name: str, params: dict[str, str]) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            _records_url(table_name),
            headers=_base_headers(),
            params=params,
        )

    if response.status_code >= 400:
        raise OperationsServiceError(
            f"InsForge query failed for {table_name}: {response.status_code} {response.text}"
        )

    payload = response.json()
    if not isinstance(payload, list):
        raise OperationsServiceError(
            f"Unexpected InsForge response for {table_name}: expected list payload"
        )
    return payload


async def _mutate_records(
    method: str,
    table_name: str,
    *,
    params: dict[str, str] | None = None,
    json_body: Any = None,
) -> Any:
    headers = {
        **_base_headers(),
        "Prefer": "return=representation",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.request(
            method,
            _records_url(table_name),
            headers=headers,
            params=params,
            json=json_body,
        )

    if response.status_code >= 400:
        raise OperationsServiceError(
            f"InsForge {method} failed for {table_name}: {response.status_code} {response.text}"
        )

    if response.status_code == 204 or not response.text.strip():
        return None

    return response.json()


def _generate_consignment_id() -> str:
    return f"CON{uuid4().hex[:8].upper()}"


def _generate_receiver_notification_id() -> str:
    return f"RNT{uuid4().hex[:8].upper()}"


def _flatten_consignment_payload(payload: ConsignmentCreate | ConsignmentUpdate) -> dict[str, Any]:
    values = payload.model_dump(exclude_none=True, mode="json")
    pickup_window = values.pop("pickup_window", None)
    delivery_window = values.pop("delivery_window", None)

    if pickup_window:
        values["pickup_window_start_at"] = pickup_window["start_at"]
        values["pickup_window_end_at"] = pickup_window["end_at"]
    if delivery_window:
        values["delivery_window_start_at"] = delivery_window["start_at"]
        values["delivery_window_end_at"] = delivery_window["end_at"]

    return values


def _coalesce_eta(row: dict[str, Any]) -> str | None:
    return (
        row.get("promised_delivery_at")
        or row.get("delivery_window_end_at")
        or row.get("delivery_window_start_at")
    )


def _to_display_timestamp(value: str | None) -> str:
    if not value:
        return "TBD"
    parsed = _parse_timestamp(value)
    if not parsed:
        return "TBD"
    return parsed.astimezone(timezone.utc).strftime("%b %d %I:%M %p UTC")


def _build_message_text(
    *,
    consignment: dict[str, Any],
    notification_type: str,
    eta_at: str | None,
    context: dict[str, Any],
) -> str:
    consignment_id = consignment.get("consignment_id", "shipment")
    destination = consignment.get("destination", "destination")
    receiver_name = consignment.get("receiver_name", "receiver")
    driver_id = consignment.get("assigned_driver_id")
    event_timestamp = _to_display_timestamp(context.get("event_timestamp"))
    eta_display = _to_display_timestamp(eta_at)

    if notification_type == "assignment_confirmed":
        driver_note = f" Driver {driver_id} has been assigned." if driver_id else ""
        return (
            f"Shipment {consignment_id} for {receiver_name} is now assigned and scheduled to "
            f"{destination}.{driver_note} Current ETA: {eta_display}."
        )
    if notification_type == "dispatched":
        return (
            f"Shipment {consignment_id} has departed origin and is en route to {destination}. "
            f"Dispatch timestamp: {event_timestamp}. ETA: {eta_display}."
        )
    if notification_type == "in_transit_update":
        return (
            f"Shipment {consignment_id} remains in transit to {destination}. "
            f"Latest ETA as of {event_timestamp}: {eta_display}."
        )
    if notification_type == "eta_updated":
        previous_eta = _to_display_timestamp(context.get("previous_eta_at"))
        return (
            f"Shipment {consignment_id} ETA changed from {previous_eta} to {eta_display}. "
            f"Update recorded at {event_timestamp}."
        )
    if notification_type == "delay_alert":
        return (
            f"Shipment {consignment_id} is delayed en route to {destination}. "
            f"Updated ETA: {eta_display}. Context: {context.get('reason', 'operational delay')}."
        )
    if notification_type == "exception_alert":
        return (
            f"Shipment {consignment_id} hit an in-transit exception affecting delivery to {destination}. "
            f"Updated ETA: {eta_display}. Context: {context.get('reason', 'dispatcher review in progress')}."
        )
    if notification_type == "route_impact_alert":
        return (
            f"Shipment {consignment_id} encountered a route-impacting event while moving to {destination}. "
            f"Updated ETA: {eta_display}. Context: {context.get('reason', 'route deviation detected')}."
        )
    if notification_type == "delivered":
        return (
            f"Shipment {consignment_id} has been delivered to {destination}. "
            f"Completion timestamp: {event_timestamp}."
        )

    return (
        f"Shipment {consignment_id} has a new receiver update for {destination}. "
        f"Current ETA: {eta_display}."
    )


async def _publish_receiver_notification_events(
    *,
    consignment_id: str,
    notifications: list[dict[str, Any]],
) -> None:
    for notification in notifications:
        await event_bus.publish(
            ReceiverNotificationEvent(
                producer="operations.receiver_notifications",
                payload=ReceiverNotificationPayload(
                    consignment_id=consignment_id,
                    channel=notification.get("channel", "portal"),
                    recipient=notification.get("recipient", ""),
                    status=notification.get("delivery_status", "sent"),
                ),
            )
        )


async def create_receiver_notifications(
    *,
    fleet_id: str,
    consignment: dict[str, Any],
    notification_type: str,
    event_timestamp: str | None = None,
    eta_at: str | None = None,
    context: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    preferences = consignment.get("receiver_contact_preferences") or []
    if not preferences:
        return []

    sent_at = event_timestamp or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    eta_at = eta_at or _coalesce_eta(consignment)
    context = {
        **(context or {}),
        "event_timestamp": event_timestamp or sent_at,
        "notification_type": notification_type,
    }

    rows: list[dict[str, Any]] = []
    for preference in preferences:
        rows.append(
            {
                "receiver_notification_id": _generate_receiver_notification_id(),
                "fleet_id": fleet_id,
                "consignment_id": consignment["consignment_id"],
                "assignment_id": consignment.get("current_assignment_id"),
                "notification_type": notification_type,
                "channel": preference.get("channel", "portal"),
                "recipient": preference.get("recipient", ""),
                "sent_at": sent_at,
                "delivery_status": "sent",
                "eta_at": eta_at,
                "message_template": notification_type,
                "message_text": _build_message_text(
                    consignment=consignment,
                    notification_type=notification_type,
                    eta_at=eta_at,
                    context=context,
                ),
                "context": context,
                "external_reference": f"{notification_type}:{uuid4().hex[:10]}",
            }
        )

    created = await _mutate_records("POST", "receiver_notifications", json_body=rows)
    if isinstance(created, list):
        await _publish_receiver_notification_events(
            consignment_id=consignment["consignment_id"],
            notifications=created,
        )
        return created

    await _publish_receiver_notification_events(
        consignment_id=consignment["consignment_id"],
        notifications=rows,
    )
    return rows


async def list_receiver_notifications(
    fleet_id: str,
    consignment_id: str,
) -> list[dict[str, Any]]:
    return await _fetch_records(
        "receiver_notifications",
        {
            "fleet_id": f"eq.{fleet_id}",
            "consignment_id": f"eq.{consignment_id}",
            "order": "sent_at.desc",
        },
    )


def _estimate_eta_shift(
    *,
    base_eta: str | None,
    minutes: int,
) -> str | None:
    parsed = _parse_timestamp(base_eta)
    if not parsed:
        return None
    shifted = parsed.timestamp() + (minutes * 60)
    return datetime.fromtimestamp(shifted, tz=timezone.utc).isoformat().replace("+00:00", "Z")


async def _emit_consignment_notifications_for_update(
    *,
    fleet_id: str,
    previous: dict[str, Any],
    current: dict[str, Any],
    updated_fields: dict[str, Any],
) -> None:
    current_status = current.get("status")
    previous_status = previous.get("status")
    previous_eta = _coalesce_eta(previous)
    current_eta = _coalesce_eta(current)
    event_timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    if previous_status != current_status:
        status_to_notification = {
            "dispatched": "dispatched",
            "in_transit": "in_transit_update",
            "delayed": "delay_alert",
            "exception": "exception_alert",
            "delivered": "delivered",
        }
        notification_type = status_to_notification.get(current_status)
        if notification_type:
            await create_receiver_notifications(
                fleet_id=fleet_id,
                consignment=current,
                notification_type=notification_type,
                event_timestamp=event_timestamp,
                eta_at=current_eta,
                context={
                    "previous_status": previous_status,
                    "current_status": current_status,
                    "reason": updated_fields.get("status"),
                },
            )

    if previous_eta != current_eta and current_eta:
        await create_receiver_notifications(
            fleet_id=fleet_id,
            consignment=current,
            notification_type="eta_updated",
            event_timestamp=event_timestamp,
            eta_at=current_eta,
            context={
                "previous_eta_at": previous_eta,
                "current_eta_at": current_eta,
            },
        )


async def create_route_event_notification(
    *,
    fleet_id: str,
    assignment_id: str | None,
    driver_id: str | None,
    notification_type: str,
    reason: str,
    eta_shift_minutes: int = 0,
    extra_context: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
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
        if assignment_rows:
            consignment_id = assignment_rows[0].get("consignment_id")
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

    if not consignment:
        return []

    eta_at = _estimate_eta_shift(base_eta=_coalesce_eta(consignment), minutes=eta_shift_minutes)
    return await create_receiver_notifications(
        fleet_id=fleet_id,
        consignment=consignment,
        notification_type=notification_type,
        eta_at=eta_at or _coalesce_eta(consignment),
        context={
            "reason": reason,
            **(extra_context or {}),
        },
    )


async def list_consignments(
    fleet_id: str,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    dispatch_date: date | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    if dispatch_date:
        from_ts = from_ts or datetime.combine(dispatch_date, time.min, tzinfo=timezone.utc)
        to_ts = to_ts or datetime.combine(dispatch_date, time.max, tzinfo=timezone.utc)

    params: dict[str, str] = {
        "fleet_id": f"eq.{fleet_id}",
        "order": "pickup_window_start_at.asc",
    }
    if status:
        params["status"] = f"eq.{status}"
    rows = await _fetch_records("consignments", params)
    if from_ts or to_ts:
        rows = [
            row
            for row in rows
            if _within_range(_consignment_dispatch_timestamp(row), from_ts, to_ts)
        ]
    return rows


async def get_consignment(
    fleet_id: str,
    consignment_id: str,
) -> dict[str, Any] | None:
    rows = await _fetch_records(
        "consignments",
        {
            "fleet_id": f"eq.{fleet_id}",
            "consignment_id": f"eq.{consignment_id}",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


async def create_consignment(payload: ConsignmentCreate) -> dict[str, Any]:
    values = _flatten_consignment_payload(payload)
    values["consignment_id"] = payload.consignment_id or _generate_consignment_id()
    values["status"] = payload.status.value
    created = await _mutate_records("POST", "consignments", json_body=[values])
    if isinstance(created, list) and created:
        return created[0]
    created_row = await get_consignment(payload.fleet_id, values["consignment_id"])
    if not created_row:
        raise OperationsServiceError("Consignment was created but could not be reloaded")
    return created_row


async def update_consignment(
    fleet_id: str,
    consignment_id: str,
    payload: ConsignmentUpdate,
) -> dict[str, Any] | None:
    existing = await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)
    if not existing:
        return None

    values = _flatten_consignment_payload(payload)
    next_status = values.get("status")
    current_status = existing.get("status")
    if next_status and current_status and next_status != current_status:
        if not can_transition_consignment_status(
            ConsignmentStatus(current_status),
            ConsignmentStatus(next_status),
        ):
            raise OperationsServiceConflict(
                f"Cannot transition consignment from {current_status} to {next_status}"
            )

    if not values:
        return existing

    updated = await _mutate_records(
        "PATCH",
        "consignments",
        params={
            "fleet_id": f"eq.{fleet_id}",
            "consignment_id": f"eq.{consignment_id}",
        },
        json_body=values,
    )
    if isinstance(updated, list) and updated:
        updated_row = updated[0]
    else:
        updated_row = await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)

    if updated_row:
        await _emit_consignment_notifications_for_update(
            fleet_id=fleet_id,
            previous=existing,
            current=updated_row,
            updated_fields=values,
        )

    return updated_row


async def delete_consignment(
    fleet_id: str,
    consignment_id: str,
) -> bool:
    existing = await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)
    if not existing:
        return False

    if existing.get("current_assignment_id"):
        raise OperationsServiceConflict(
            "Cannot delete a consignment that has a current assignment"
        )

    await _mutate_records(
        "DELETE",
        "consignments",
        params={
            "fleet_id": f"eq.{fleet_id}",
            "consignment_id": f"eq.{consignment_id}",
        },
    )
    return True


def _generate_assignment_id() -> str:
    return f"ASN{uuid4().hex[:8].upper()}"


async def create_assignment(
    fleet_id: str,
    consignment_id: str,
    dispatcher_id: str,
    driver_id: str,
    truck_id: str,
    notes: str | None = None,
) -> dict[str, Any]:
    assignment_id = _generate_assignment_id()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    values = {
        "assignment_id": assignment_id,
        "fleet_id": fleet_id,
        "consignment_id": consignment_id,
        "dispatcher_id": dispatcher_id,
        "driver_id": driver_id,
        "truck_id": truck_id,
        "status": "planned",
        "assigned_at": now,
        "notes": notes,
        "created_at": now,
        "updated_at": now,
    }
    created = await _mutate_records("POST", "assignments", json_body=[values])

    # Update the consignment to reflect the assignment
    await _mutate_records(
        "PATCH",
        "consignments",
        params={
            "fleet_id": f"eq.{fleet_id}",
            "consignment_id": f"eq.{consignment_id}",
        },
        json_body={
            "assigned_driver_id": driver_id,
            "assigned_truck_id": truck_id,
            "current_assignment_id": assignment_id,
            "status": "assigned",
            "updated_at": now,
        },
    )

    assigned_consignment = await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)
    if assigned_consignment:
        await create_receiver_notifications(
            fleet_id=fleet_id,
            consignment=assigned_consignment,
            notification_type="assignment_confirmed",
            event_timestamp=now,
            context={
                "dispatcher_id": dispatcher_id,
                "driver_id": driver_id,
                "truck_id": truck_id,
            },
        )

    if isinstance(created, list) and created:
        return created[0]
    rows = await _fetch_records("assignments", {
        "assignment_id": f"eq.{assignment_id}",
        "limit": "1",
    })
    return rows[0] if rows else values


async def list_assignments(
    fleet_id: str,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
) -> list[dict[str, Any]]:
    params: dict[str, str] = {
        "fleet_id": f"eq.{fleet_id}",
        "order": "assigned_at.desc",
    }
    rows = await _fetch_records("assignments", params)
    if from_ts or to_ts:
        rows = [
            row
            for row in rows
            if _within_range(row.get("assigned_at"), from_ts, to_ts)
        ]
    return rows


async def get_consignment_timeline(
    fleet_id: str, consignment_id: str
) -> dict[str, Any] | None:
    consignment_rows = await _fetch_records(
        "consignments",
        {
            "fleet_id": f"eq.{fleet_id}",
            "consignment_id": f"eq.{consignment_id}",
            "limit": "1",
        },
    )
    if not consignment_rows:
        return None

    consignment = consignment_rows[0]
    event_sources = [
        ("in_transit_events", "occurred_at", "in_transit"),
        ("roadside_incidents", "occurred_at", "incident"),
        ("receiver_notifications", "sent_at", "notification"),
        ("reconciliation_events", "event_date", "reconciliation"),
    ]

    timeline: list[dict[str, Any]] = []
    for table_name, timestamp_field, category in event_sources:
        rows = await _fetch_records(
            table_name,
            {
                "fleet_id": f"eq.{fleet_id}",
                "consignment_id": f"eq.{consignment_id}",
                "order": f"{timestamp_field}.asc",
            },
        )
        for row in rows:
            timeline.append(
                {
                    "category": category,
                    "timestamp": row.get(timestamp_field),
                    "record": row,
                }
            )

    assignment_id = consignment.get("current_assignment_id")
    if assignment_id:
        check_ins = await _fetch_records(
            "check_in_events",
            {
                "fleet_id": f"eq.{fleet_id}",
                "assignment_id": f"eq.{assignment_id}",
                "order": "checked_in_at.asc",
            },
        )
        for row in check_ins:
            timeline.append(
                {
                    "category": "check_in",
                    "timestamp": row.get("checked_in_at"),
                    "record": row,
                }
            )

    timeline.sort(key=lambda item: item.get("timestamp") or "")
    return {
        "consignment": consignment,
        "events": timeline,
    }
