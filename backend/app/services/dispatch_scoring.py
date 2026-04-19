from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.analytics import (
    DispatchHistoricalSignal,
    DispatchScoringSignalsReport,
    HistoricalMetricsFilters,
)
from app.models.driver import Driver
from app.services.operational_analytics import (
    _assignment_breakdown_flag,
    _assignment_delay_flag,
    _assignment_margin,
    _detail_value,
    _load_operational_scope,
    _safe_divide,
)


def _default_history_window() -> tuple[datetime, datetime]:
    to_ts = datetime.now(timezone.utc)
    return to_ts - timedelta(days=30), to_ts


async def build_dispatch_scoring_signals(
    *,
    fleet_id: str,
    pickup: str,
    destination: str,
    eligible_drivers: list[Driver],
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
) -> DispatchScoringSignalsReport:
    if from_ts is None or to_ts is None:
        default_from, default_to = _default_history_window()
        from_ts = from_ts or default_from
        to_ts = to_ts or default_to

    scope = await _load_operational_scope(
        fleet_id=fleet_id,
        origin=pickup,
        destination=destination,
        from_ts=from_ts,
        to_ts=to_ts,
    )
    scoped_assignments = scope["scoped_assignments"]
    scoped_consignments = scope["scoped_consignments"]
    scoped_events = scope["scoped_events"]
    scoped_reconciliation_events = scope["scoped_reconciliation_events"]
    scoped_incidents = scope["scoped_incidents"]

    lane_assignment_count = len(scoped_assignments)
    lane_completed_count = sum(
        1 for assignment in scoped_assignments if assignment.get("status") == "completed"
    )
    lane_delayed_count = sum(
        1
        for assignment in scoped_assignments
        if _assignment_delay_flag(
            assignment,
            scoped_consignments.get(assignment.get("consignment_id")),
            scoped_events,
        )
    )
    lane_margins = [
        _assignment_margin(
            assignment["assignment_id"],
            scoped_reconciliation_events,
            scoped_events,
        )
        for assignment in scoped_assignments
        if assignment.get("assignment_id")
    ]

    driver_signals: list[DispatchHistoricalSignal] = []
    for driver in eligible_drivers:
        driver_assignments = [
            assignment
            for assignment in scoped_assignments
            if assignment.get("driver_id") == driver.driver_id
        ]
        assignment_count = len(driver_assignments)
        completed_count = sum(
            1 for assignment in driver_assignments if assignment.get("status") == "completed"
        )
        delayed_count = sum(
            1
            for assignment in driver_assignments
            if _assignment_delay_flag(
                assignment,
                scoped_consignments.get(assignment.get("consignment_id")),
                scoped_events,
            )
        )
        breakdown_count = sum(
            1
            for assignment in driver_assignments
            if _assignment_breakdown_flag(assignment, scoped_incidents)
        )
        margins = [
            _assignment_margin(
                assignment["assignment_id"],
                scoped_reconciliation_events,
                scoped_events,
            )
            for assignment in driver_assignments
            if assignment.get("assignment_id")
        ]
        deadhead_miles = [
            sum(
                _detail_value(row.get("details"), "deadhead_miles")
                for row in scoped_events
                if row.get("assignment_id") == assignment.get("assignment_id")
            )
            + sum(
                _detail_value(row.get("details"), "deadhead_miles")
                for row in scoped_reconciliation_events
                if row.get("assignment_id") == assignment.get("assignment_id")
            )
            for assignment in driver_assignments
        ]

        completion_rate = _safe_divide(completed_count, assignment_count)
        delay_rate = _safe_divide(delayed_count, assignment_count)
        breakdown_rate = _safe_divide(breakdown_count, assignment_count)
        avg_margin = _safe_divide(sum(margins), len(margins))
        avg_deadhead = _safe_divide(sum(deadhead_miles), len(deadhead_miles))
        historical_score = round(
            (completion_rate * 100)
            - (delay_rate * 25)
            - (breakdown_rate * 35)
            + min(avg_margin / 50, 20)
            - min(avg_deadhead / 10, 10),
            2,
        )

        driver_signals.append(
            DispatchHistoricalSignal(
                driver_id=driver.driver_id,
                driver_name=driver.name,
                assignment_count=assignment_count,
                completion_rate=completion_rate,
                delay_rate=delay_rate,
                breakdown_rate=breakdown_rate,
                avg_margin_per_assignment_usd=avg_margin,
                avg_deadhead_miles=avg_deadhead,
                historical_score=historical_score,
            )
        )

    driver_signals.sort(key=lambda signal: signal.historical_score, reverse=True)
    return DispatchScoringSignalsReport(
        filters=HistoricalMetricsFilters(
            fleet_id=fleet_id,
            origin=pickup,
            destination=destination,
            from_ts=from_ts,
            to_ts=to_ts,
        ),
        lane_assignment_count=lane_assignment_count,
        lane_completion_rate=_safe_divide(lane_completed_count, lane_assignment_count),
        lane_delay_rate=_safe_divide(lane_delayed_count, lane_assignment_count),
        lane_avg_margin_per_assignment_usd=_safe_divide(sum(lane_margins), len(lane_margins)),
        driver_signals=driver_signals,
    )
