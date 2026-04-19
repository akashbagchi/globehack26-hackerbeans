from __future__ import annotations

from typing import Any

from app.models.analytics import (
    FleetEconomicsSummary,
    FleetHealthSummary,
    FleetPerformanceReport,
    HistoricalMetricsFilters,
    HistoricalMetricsSummary,
    HistoricalOperationalMetricsReport,
    NextDayPlanningReport,
    PlanningAssignmentOutcomeSummary,
    PlanningLaneOutcome,
)
from app.services.operations import _fetch_records, _parse_timestamp, _within_range


def _coerce_float(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return 0.0
    return 0.0


def _detail_value(details: Any, *keys: str) -> float:
    if not isinstance(details, dict):
        return 0.0
    for key in keys:
        if key in details:
            return _coerce_float(details.get(key))
    return 0.0


def _safe_divide(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def _assignment_matches_time_window(
    assignment: dict[str, Any],
    from_ts,
    to_ts,
) -> bool:
    timestamps = [
        assignment.get("assigned_at"),
        assignment.get("dispatched_at"),
        assignment.get("completed_at"),
        assignment.get("created_at"),
    ]
    if not from_ts and not to_ts:
        return True
    return any(_within_range(timestamp, from_ts, to_ts) for timestamp in timestamps if timestamp)


def _event_in_range(timestamp: str | None, from_ts, to_ts) -> bool:
    if not timestamp:
        return not from_ts and not to_ts
    return _within_range(timestamp, from_ts, to_ts)


def _is_on_time_delivery(
    assignment: dict[str, Any],
    consignment: dict[str, Any] | None,
) -> bool | None:
    if not consignment:
        return None

    completed_at = _parse_timestamp(assignment.get("completed_at"))
    promised_at = _parse_timestamp(consignment.get("promised_delivery_at"))
    if not completed_at or not promised_at:
        return None
    return completed_at <= promised_at


def _assignment_delay_flag(
    assignment: dict[str, Any],
    consignment: dict[str, Any] | None,
    scoped_events: list[dict[str, Any]],
) -> bool:
    assignment_id = assignment.get("assignment_id")
    consignment_id = assignment.get("consignment_id")
    event_delay = any(
        (
            row.get("assignment_id") == assignment_id
            or row.get("consignment_id") == consignment_id
        )
        and "delay" in str(row.get("event_type", "")).lower()
        for row in scoped_events
    )
    if event_delay:
        return True
    return bool(consignment and consignment.get("status") == "delayed")


def _assignment_breakdown_flag(
    assignment: dict[str, Any],
    scoped_incidents: list[dict[str, Any]],
) -> bool:
    assignment_id = assignment.get("assignment_id")
    return any(
        row.get("assignment_id") == assignment_id
        and "breakdown" in str(row.get("incident_type", "")).lower()
        for row in scoped_incidents
    )


def _assignment_margin(
    assignment_id: str,
    scoped_reconciliation_events: list[dict[str, Any]],
    scoped_events: list[dict[str, Any]],
) -> float:
    revenue = sum(
        _coerce_float(row.get("revenue_delta_usd"))
        for row in scoped_reconciliation_events
        if row.get("assignment_id") == assignment_id
    )
    cost = sum(
        _coerce_float(row.get("cost_delta_usd"))
        for row in scoped_reconciliation_events
        if row.get("assignment_id") == assignment_id
    )
    fuel = sum(
        _detail_value(row.get("details"), "fuel_spend_usd")
        for row in scoped_reconciliation_events
        if row.get("assignment_id") == assignment_id
    ) + sum(
        _detail_value(row.get("details"), "fuel_spend_usd")
        for row in scoped_events
        if row.get("assignment_id") == assignment_id
    )
    return revenue - cost - fuel


def _assignment_route_hours(
    assignment_id: str,
    scoped_events: list[dict[str, Any]],
    scoped_reconciliation_events: list[dict[str, Any]],
) -> float:
    return sum(
        _detail_value(row.get("details"), "hos_used_hours", "drive_hours_used")
        for row in scoped_events
        if row.get("assignment_id") == assignment_id
    ) + sum(
        _detail_value(row.get("details"), "hos_used_hours", "drive_hours_used")
        for row in scoped_reconciliation_events
        if row.get("assignment_id") == assignment_id
    )


async def _load_operational_scope(
    *,
    fleet_id: str,
    origin: str | None = None,
    destination: str | None = None,
    driver_id: str | None = None,
    truck_id: str | None = None,
    from_ts=None,
    to_ts=None,
) -> dict[str, Any]:
    consignments = await _fetch_records(
        "consignments",
        {"fleet_id": f"eq.{fleet_id}", "order": "created_at.desc"},
    )
    consignment_by_id = {row["consignment_id"]: row for row in consignments if row.get("consignment_id")}

    assignments = await _fetch_records(
        "assignments",
        {"fleet_id": f"eq.{fleet_id}", "order": "assigned_at.desc"},
    )

    scoped_assignments: list[dict[str, Any]] = []
    for assignment in assignments:
        consignment = consignment_by_id.get(assignment.get("consignment_id"))
        if driver_id and assignment.get("driver_id") != driver_id:
            continue
        if truck_id and assignment.get("truck_id") != truck_id:
            continue
        if origin and (not consignment or consignment.get("origin") != origin):
            continue
        if destination and (not consignment or consignment.get("destination") != destination):
            continue
        if not _assignment_matches_time_window(assignment, from_ts, to_ts):
            continue
        scoped_assignments.append(assignment)

    assignment_ids = {
        assignment["assignment_id"]
        for assignment in scoped_assignments
        if assignment.get("assignment_id")
    }
    scoped_consignments = {
        assignment["consignment_id"]: consignment_by_id[assignment["consignment_id"]]
        for assignment in scoped_assignments
        if assignment.get("consignment_id") in consignment_by_id
    }

    in_transit_events = await _fetch_records(
        "in_transit_events",
        {"fleet_id": f"eq.{fleet_id}", "order": "occurred_at.desc"},
    )
    reconciliation_events = await _fetch_records(
        "reconciliation_events",
        {"fleet_id": f"eq.{fleet_id}", "order": "event_date.desc"},
    )
    roadside_incidents = await _fetch_records(
        "roadside_incidents",
        {"fleet_id": f"eq.{fleet_id}", "order": "occurred_at.desc"},
    )
    check_in_events = await _fetch_records(
        "check_in_events",
        {"fleet_id": f"eq.{fleet_id}", "order": "checked_in_at.desc"},
    )

    scoped_events = [
        row
        for row in in_transit_events
        if row.get("assignment_id") in assignment_ids
        and _event_in_range(row.get("occurred_at"), from_ts, to_ts)
    ]
    scoped_reconciliation_events = [
        row
        for row in reconciliation_events
        if row.get("assignment_id") in assignment_ids
        and _event_in_range(row.get("event_date"), from_ts, to_ts)
    ]
    scoped_incidents = [
        row
        for row in roadside_incidents
        if row.get("assignment_id") in assignment_ids
        and _event_in_range(row.get("occurred_at"), from_ts, to_ts)
    ]
    scoped_check_ins = [
        row
        for row in check_in_events
        if row.get("assignment_id") in assignment_ids
        and _event_in_range(row.get("checked_in_at"), from_ts, to_ts)
    ]

    return {
        "scoped_assignments": scoped_assignments,
        "assignment_ids": assignment_ids,
        "scoped_consignments": scoped_consignments,
        "consignment_ids": set(scoped_consignments),
        "scoped_events": scoped_events,
        "scoped_reconciliation_events": scoped_reconciliation_events,
        "scoped_incidents": scoped_incidents,
        "scoped_check_ins": scoped_check_ins,
    }


async def get_historical_operational_metrics(
    *,
    fleet_id: str,
    origin: str | None = None,
    destination: str | None = None,
    driver_id: str | None = None,
    truck_id: str | None = None,
    from_ts=None,
    to_ts=None,
) -> HistoricalOperationalMetricsReport:
    scope = await _load_operational_scope(
        fleet_id=fleet_id,
        origin=origin,
        destination=destination,
        driver_id=driver_id,
        truck_id=truck_id,
        from_ts=from_ts,
        to_ts=to_ts,
    )
    scoped_assignments = scope["scoped_assignments"]
    assignment_ids = scope["assignment_ids"]
    scoped_consignments = scope["scoped_consignments"]
    consignment_ids = scope["consignment_ids"]
    scoped_events = scope["scoped_events"]
    scoped_reconciliation_events = scope["scoped_reconciliation_events"]
    scoped_incidents = scope["scoped_incidents"]

    completed_assignments = [
        assignment for assignment in scoped_assignments if assignment.get("status") == "completed"
    ]
    active_assignments = [
        assignment for assignment in scoped_assignments if assignment.get("status") == "active"
    ]
    delivered_consignments = [
        consignment
        for consignment in scoped_consignments.values()
        if consignment.get("status") == "delivered"
    ]
    delayed_assignment_ids = {
        row.get("assignment_id")
        for row in scoped_events
        if "delay" in str(row.get("event_type", "")).lower()
    }
    delayed_consignment_ids = {
        row.get("consignment_id")
        for row in scoped_events
        if "delay" in str(row.get("event_type", "")).lower()
    }
    delayed_consignments = [
        consignment
        for consignment_id, consignment in scoped_consignments.items()
        if consignment.get("status") == "delayed"
        or consignment_id in delayed_consignment_ids
        or consignment_id
        in {
            assignment.get("consignment_id")
            for assignment in scoped_assignments
            if assignment.get("assignment_id") in delayed_assignment_ids
        }
    ]
    breakdown_count = sum(
        1
        for incident in scoped_incidents
        if "breakdown" in str(incident.get("incident_type", "")).lower()
    )

    on_time_results = [
        result
        for result in (
            _is_on_time_delivery(
                assignment,
                scoped_consignments.get(assignment.get("consignment_id")),
            )
            for assignment in completed_assignments
        )
        if result is not None
    ]

    deadhead_miles = sum(
        _coerce_float(event.get("details", {}).get("deadhead_miles")) for event in scoped_events
    ) + sum(
        _coerce_float(event.get("details", {}).get("deadhead_miles"))
        for event in scoped_reconciliation_events
    )
    hos_used_hours = sum(
        _coerce_float(event.get("details", {}).get("hos_used_hours"))
        + _coerce_float(event.get("details", {}).get("drive_hours_used"))
        for event in scoped_events
    ) + sum(
        _coerce_float(event.get("details", {}).get("hos_used_hours"))
        + _coerce_float(event.get("details", {}).get("drive_hours_used"))
        for event in scoped_reconciliation_events
    )
    fuel_spend_usd = sum(
        _coerce_float(event.get("details", {}).get("fuel_spend_usd"))
        for event in scoped_events
    ) + sum(
        _coerce_float(event.get("details", {}).get("fuel_spend_usd"))
        for event in scoped_reconciliation_events
    )
    total_cost_delta_usd = sum(
        _coerce_float(event.get("cost_delta_usd")) for event in scoped_reconciliation_events
    )
    total_revenue_delta_usd = sum(
        _coerce_float(event.get("revenue_delta_usd")) for event in scoped_reconciliation_events
    )

    summary = HistoricalMetricsSummary(
        assignment_count=len(scoped_assignments),
        completed_assignment_count=len(completed_assignments),
        active_assignment_count=len(active_assignments),
        delivered_consignment_count=len(delivered_consignments),
        delayed_consignment_count=len(delayed_consignments),
        breakdown_count=breakdown_count,
        incident_count=len(scoped_incidents),
        route_completion_rate=(
            len(completed_assignments) / len(scoped_assignments) if scoped_assignments else 0.0
        ),
        on_time_delivery_rate=(
            sum(1 for result in on_time_results if result) / len(on_time_results)
            if on_time_results
            else None
        ),
        deadhead_miles=deadhead_miles,
        hos_used_hours=hos_used_hours,
        fuel_spend_usd=fuel_spend_usd,
        total_cost_delta_usd=total_cost_delta_usd,
        total_revenue_delta_usd=total_revenue_delta_usd,
    )

    return HistoricalOperationalMetricsReport(
        filters=HistoricalMetricsFilters(
            fleet_id=fleet_id,
            origin=origin,
            destination=destination,
            driver_id=driver_id,
            truck_id=truck_id,
            from_ts=from_ts,
            to_ts=to_ts,
        ),
        summary=summary,
        matched_assignment_ids=sorted(assignment_ids),
        matched_consignment_ids=sorted(consignment_ids),
    )


async def get_fleet_performance_report(
    *,
    fleet_id: str,
    origin: str | None = None,
    destination: str | None = None,
    driver_id: str | None = None,
    truck_id: str | None = None,
    from_ts=None,
    to_ts=None,
) -> FleetPerformanceReport:
    scope = await _load_operational_scope(
        fleet_id=fleet_id,
        origin=origin,
        destination=destination,
        driver_id=driver_id,
        truck_id=truck_id,
        from_ts=from_ts,
        to_ts=to_ts,
    )
    scoped_assignments = scope["scoped_assignments"]
    assignment_ids = scope["assignment_ids"]
    scoped_consignments = scope["scoped_consignments"]
    consignment_ids = scope["consignment_ids"]
    scoped_events = scope["scoped_events"]
    scoped_reconciliation_events = scope["scoped_reconciliation_events"]
    scoped_incidents = scope["scoped_incidents"]
    scoped_check_ins = scope["scoped_check_ins"]

    assignment_count = len(scoped_assignments)
    active_driver_ids = {row.get("driver_id") for row in scoped_assignments if row.get("driver_id")}
    active_truck_ids = {row.get("truck_id") for row in scoped_assignments if row.get("truck_id")}
    completed_assignment_count = sum(
        1 for row in scoped_assignments if row.get("status") == "completed"
    )
    delayed_assignment_ids = {
        row.get("assignment_id")
        for row in scoped_events
        if "delay" in str(row.get("event_type", "")).lower()
    }
    delayed_consignment_count = sum(
        1
        for consignment_id, consignment in scoped_consignments.items()
        if consignment.get("status") == "delayed"
        or consignment_id
        in {
            assignment.get("consignment_id")
            for assignment in scoped_assignments
            if assignment.get("assignment_id") in delayed_assignment_ids
        }
    )
    breakdown_count = sum(
        1
        for incident in scoped_incidents
        if "breakdown" in str(incident.get("incident_type", "")).lower()
    )
    total_deadhead_miles = sum(
        _coerce_float(event.get("details", {}).get("deadhead_miles")) for event in scoped_events
    ) + sum(
        _coerce_float(event.get("details", {}).get("deadhead_miles"))
        for event in scoped_reconciliation_events
    )
    total_loaded_miles = sum(
        _detail_value(event.get("details"), "loaded_miles", "miles_today")
        for event in scoped_events
    ) + sum(
        _detail_value(event.get("details"), "loaded_miles", "miles_today")
        for event in scoped_reconciliation_events
    )
    total_hos_used = sum(
        _coerce_float(event.get("details", {}).get("hos_used_hours"))
        + _coerce_float(event.get("details", {}).get("drive_hours_used"))
        for event in scoped_events
    ) + sum(
        _coerce_float(event.get("details", {}).get("hos_used_hours"))
        + _coerce_float(event.get("details", {}).get("drive_hours_used"))
        for event in scoped_reconciliation_events
    )
    fuel_spend_usd = sum(
        _coerce_float(event.get("details", {}).get("fuel_spend_usd"))
        for event in scoped_events
    ) + sum(
        _coerce_float(event.get("details", {}).get("fuel_spend_usd"))
        for event in scoped_reconciliation_events
    )
    total_cost_delta_usd = sum(
        _coerce_float(event.get("cost_delta_usd")) for event in scoped_reconciliation_events
    )
    total_revenue_delta_usd = sum(
        _coerce_float(event.get("revenue_delta_usd")) for event in scoped_reconciliation_events
    )
    check_in_assignment_ids = {
        row.get("assignment_id") for row in scoped_check_ins if row.get("assignment_id")
    }

    fleet_health = FleetHealthSummary(
        active_driver_count=len(active_driver_ids),
        active_truck_count=len(active_truck_ids),
        utilization_rate=(
            len(active_driver_ids) / assignment_count if assignment_count else 0.0
        ),
        incident_rate_per_assignment=(
            len(scoped_incidents) / assignment_count if assignment_count else 0.0
        ),
        breakdown_rate_per_assignment=(
            breakdown_count / assignment_count if assignment_count else 0.0
        ),
        delay_rate=(
            delayed_consignment_count / assignment_count if assignment_count else 0.0
        ),
        avg_hos_used_hours=(total_hos_used / assignment_count if assignment_count else 0.0),
        check_in_compliance_rate=(
            len(check_in_assignment_ids) / assignment_count if assignment_count else None
        ),
    )

    fleet_economics = FleetEconomicsSummary(
        total_revenue_delta_usd=total_revenue_delta_usd,
        total_cost_delta_usd=total_cost_delta_usd,
        net_contribution_usd=total_revenue_delta_usd - total_cost_delta_usd - fuel_spend_usd,
        fuel_spend_usd=fuel_spend_usd,
        avg_fuel_spend_per_assignment_usd=(
            fuel_spend_usd / assignment_count if assignment_count else 0.0
        ),
        avg_revenue_per_assignment_usd=(
            total_revenue_delta_usd / assignment_count if assignment_count else 0.0
        ),
        avg_cost_per_assignment_usd=(
            total_cost_delta_usd / assignment_count if assignment_count else 0.0
        ),
        avg_deadhead_miles_per_assignment=(
            total_deadhead_miles / assignment_count if assignment_count else 0.0
        ),
        avg_deadhead_share=(
            total_deadhead_miles / (total_deadhead_miles + total_loaded_miles)
            if (total_deadhead_miles + total_loaded_miles) > 0
            else None
        ),
    )

    return FleetPerformanceReport(
        filters=HistoricalMetricsFilters(
            fleet_id=fleet_id,
            origin=origin,
            destination=destination,
            driver_id=driver_id,
            truck_id=truck_id,
            from_ts=from_ts,
            to_ts=to_ts,
        ),
        fleet_health=fleet_health,
        fleet_economics=fleet_economics,
        matched_assignment_ids=sorted(assignment_ids),
        matched_consignment_ids=sorted(consignment_ids),
    )


async def get_next_day_planning_report(
    *,
    fleet_id: str,
    origin: str | None = None,
    destination: str | None = None,
    driver_id: str | None = None,
    truck_id: str | None = None,
    from_ts=None,
    to_ts=None,
) -> NextDayPlanningReport:
    scope = await _load_operational_scope(
        fleet_id=fleet_id,
        origin=origin,
        destination=destination,
        driver_id=driver_id,
        truck_id=truck_id,
        from_ts=from_ts,
        to_ts=to_ts,
    )
    scoped_assignments = scope["scoped_assignments"]
    assignment_ids = scope["assignment_ids"]
    scoped_consignments = scope["scoped_consignments"]
    consignment_ids = scope["consignment_ids"]
    scoped_events = scope["scoped_events"]
    scoped_reconciliation_events = scope["scoped_reconciliation_events"]
    scoped_incidents = scope["scoped_incidents"]

    assignment_count = len(scoped_assignments)
    completed_count = sum(1 for row in scoped_assignments if row.get("status") == "completed")
    active_count = sum(1 for row in scoped_assignments if row.get("status") == "active")

    delayed_assignments = [
        assignment
        for assignment in scoped_assignments
        if _assignment_delay_flag(
            assignment,
            scoped_consignments.get(assignment.get("consignment_id")),
            scoped_events,
        )
    ]
    breakdown_assignments = [
        assignment
        for assignment in scoped_assignments
        if _assignment_breakdown_flag(assignment, scoped_incidents)
    ]

    route_hours = [
        _assignment_route_hours(
            assignment["assignment_id"],
            scoped_events,
            scoped_reconciliation_events,
        )
        for assignment in scoped_assignments
        if assignment.get("assignment_id")
    ]
    assignment_margins = [
        _assignment_margin(
            assignment["assignment_id"],
            scoped_reconciliation_events,
            scoped_events,
        )
        for assignment in scoped_assignments
        if assignment.get("assignment_id")
    ]

    lane_buckets: dict[str, dict[str, Any]] = {}
    for assignment in scoped_assignments:
        consignment = scoped_consignments.get(assignment.get("consignment_id"))
        if not consignment:
            continue
        origin_value = consignment.get("origin") or "Unknown"
        destination_value = consignment.get("destination") or "Unknown"
        lane_key = f"{origin_value} -> {destination_value}"
        bucket = lane_buckets.setdefault(
            lane_key,
            {
                "origin": origin_value,
                "destination": destination_value,
                "assignments": [],
                "margins": [],
                "deadhead_miles": [],
                "on_time_results": [],
                "delay_count": 0,
                "breakdown_count": 0,
                "completed_count": 0,
            },
        )
        bucket["assignments"].append(assignment)
        assignment_id = assignment.get("assignment_id")
        bucket["margins"].append(
            _assignment_margin(assignment_id, scoped_reconciliation_events, scoped_events)
        )
        deadhead = sum(
            _detail_value(row.get("details"), "deadhead_miles")
            for row in scoped_events
            if row.get("assignment_id") == assignment_id
        ) + sum(
            _detail_value(row.get("details"), "deadhead_miles")
            for row in scoped_reconciliation_events
            if row.get("assignment_id") == assignment_id
        )
        bucket["deadhead_miles"].append(deadhead)
        if assignment.get("status") == "completed":
            bucket["completed_count"] += 1
        if _assignment_delay_flag(assignment, consignment, scoped_events):
            bucket["delay_count"] += 1
        if _assignment_breakdown_flag(assignment, scoped_incidents):
            bucket["breakdown_count"] += 1
        on_time = _is_on_time_delivery(assignment, consignment)
        if on_time is not None:
            bucket["on_time_results"].append(on_time)

    lane_outcomes: list[PlanningLaneOutcome] = []
    for lane_key, bucket in lane_buckets.items():
        lane_assignment_count = len(bucket["assignments"])
        lane_outcomes.append(
            PlanningLaneOutcome(
                lane_key=lane_key,
                origin=bucket["origin"],
                destination=bucket["destination"],
                assignment_count=lane_assignment_count,
                completion_rate=_safe_divide(bucket["completed_count"], lane_assignment_count),
                delay_rate=_safe_divide(bucket["delay_count"], lane_assignment_count),
                breakdown_rate=_safe_divide(bucket["breakdown_count"], lane_assignment_count),
                on_time_delivery_rate=(
                    _safe_divide(
                        sum(1 for result in bucket["on_time_results"] if result),
                        len(bucket["on_time_results"]),
                    )
                    if bucket["on_time_results"]
                    else None
                ),
                avg_deadhead_miles=_safe_divide(
                    sum(bucket["deadhead_miles"]),
                    lane_assignment_count,
                ),
                avg_margin_per_assignment_usd=_safe_divide(
                    sum(bucket["margins"]),
                    lane_assignment_count,
                ),
            )
        )

    top_lanes = sorted(
        lane_outcomes,
        key=lambda lane: (
            lane.avg_margin_per_assignment_usd,
            lane.completion_rate,
            -(lane.delay_rate),
        ),
        reverse=True,
    )[:3]
    highest_risk_lanes = sorted(
        lane_outcomes,
        key=lambda lane: (
            lane.delay_rate + lane.breakdown_rate + (1 - lane.completion_rate),
            lane.breakdown_rate,
            1 - lane.completion_rate,
            lane.delay_rate,
            -(lane.avg_margin_per_assignment_usd),
        ),
        reverse=True,
    )[:3]

    return NextDayPlanningReport(
        filters=HistoricalMetricsFilters(
            fleet_id=fleet_id,
            origin=origin,
            destination=destination,
            driver_id=driver_id,
            truck_id=truck_id,
            from_ts=from_ts,
            to_ts=to_ts,
        ),
        assignment_outcomes=PlanningAssignmentOutcomeSummary(
            assignment_count=assignment_count,
            completed_assignment_count=completed_count,
            active_assignment_count=active_count,
            delayed_assignment_count=len(delayed_assignments),
            breakdown_assignment_count=len(breakdown_assignments),
            avg_route_hours=_safe_divide(sum(route_hours), len(route_hours)),
            avg_margin_per_assignment_usd=_safe_divide(
                sum(assignment_margins),
                len(assignment_margins),
            ),
        ),
        top_lanes=top_lanes,
        highest_risk_lanes=highest_risk_lanes,
        matched_assignment_ids=sorted(assignment_ids),
        matched_consignment_ids=sorted(consignment_ids),
    )
