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
        return updated[0]
    return await get_consignment(fleet_id=fleet_id, consignment_id=consignment_id)


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
