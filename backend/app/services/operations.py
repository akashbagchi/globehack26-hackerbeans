from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from app.config import settings


class OperationsServiceError(Exception):
    pass


class OperationsServiceNotConfigured(OperationsServiceError):
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


async def list_consignments(
    fleet_id: str,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    params: dict[str, str] = {
        "fleet_id": f"eq.{fleet_id}",
        "order": "requested_pickup_at.desc",
    }
    if status:
        params["status"] = f"eq.{status}"
    rows = await _fetch_records("consignments", params)
    if from_ts or to_ts:
        rows = [
            row
            for row in rows
            if _within_range(row.get("requested_pickup_at"), from_ts, to_ts)
        ]
    return rows


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
