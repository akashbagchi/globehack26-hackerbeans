from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Literal

from app.models.driver import Driver
from app.models.events import (
    AssignmentDecisionEvent,
    AssignmentDecisionPayload,
    OrchestrationCompletedEvent,
    OrchestrationCompletedPayload,
)
from app.services.eligibility import evaluate_driver_for_load
from app.services.event_bus import event_bus
from app.services.navpro import get_drivers
from app.services.operations import create_assignment, list_consignments
from app.services.scoring import score_drivers


@dataclass
class AssignmentPlan:
    consignment_id: str
    consignment_summary: str
    assigned_driver_id: str | None
    assigned_truck_id: str | None
    score: int
    reasoning: str
    decision: Literal["auto_assigned", "needs_review", "no_match"]
    skip_reasons: list[str] = field(default_factory=list)


@dataclass
class OrchestrationResult:
    fleet_id: str
    dispatch_date: str
    total_consignments: int
    auto_assigned: int
    needs_review: int
    no_match: int
    plans: list[AssignmentPlan]
    drivers_used: list[str]


def _summarize_consignment(row: dict) -> str:
    origin = row.get("origin", "?")
    destination = row.get("destination", "?")
    cargo = row.get("cargo_description", "?")
    weight = row.get("weight_lbs", 0)
    return f"{origin} -> {destination} | {cargo} | {weight:,} lbs"


async def orchestrate_daily_dispatch(
    fleet_id: str,
    dispatch_date: date,
    dispatcher_id: str,
    auto_assign_threshold: int = 70,
    review_threshold: int = 50,
    dry_run: bool = False,
) -> OrchestrationResult:
    consignments = await list_consignments(
        fleet_id=fleet_id,
        dispatch_date=dispatch_date,
        status="unassigned",
    )

    all_drivers, _ = await get_drivers()

    available_pool: list[Driver] = list(all_drivers)
    plans: list[AssignmentPlan] = []
    drivers_used: list[str] = []
    auto_count = 0
    review_count = 0
    no_match_count = 0

    for consignment in consignments:
        origin = consignment.get("origin", "")
        destination = consignment.get("destination", "")
        cargo = consignment.get("cargo_description", "")
        weight_lbs = consignment.get("weight_lbs", 0)
        consignment_id = consignment.get("consignment_id", "")
        summary = _summarize_consignment(consignment)

        evaluations = [
            evaluate_driver_for_load(driver, origin, destination, cargo, weight_lbs)
            for driver in available_pool
        ]
        eligible = [ev.driver for ev in evaluations if ev.eligible]

        await event_bus.publish(
            AssignmentDecisionEvent(
                producer="dispatch.orchestrate",
                payload=AssignmentDecisionPayload(
                    pickup=origin,
                    destination=destination,
                    cargo=cargo,
                    weight_lbs=weight_lbs,
                    eligible_driver_ids=[d.driver_id for d in eligible],
                    rejected_driver_ids=[
                        ev.driver.driver_id for ev in evaluations if not ev.eligible
                    ],
                ),
            )
        )

        if not eligible:
            all_reasons: list[str] = []
            for ev in evaluations:
                all_reasons.extend(ev.reasons)
            no_match_count += 1
            plans.append(AssignmentPlan(
                consignment_id=consignment_id,
                consignment_summary=summary,
                assigned_driver_id=None,
                assigned_truck_id=None,
                score=0,
                reasoning="No eligible drivers available.",
                decision="no_match",
                skip_reasons=sorted(set(all_reasons))[:5],
            ))
            continue

        recommendation = score_drivers(eligible, origin, destination, cargo, weight_lbs)

        if not recommendation.recommendations:
            no_match_count += 1
            plans.append(AssignmentPlan(
                consignment_id=consignment_id,
                consignment_summary=summary,
                assigned_driver_id=None,
                assigned_truck_id=None,
                score=0,
                reasoning="Scoring returned no results.",
                decision="no_match",
            ))
            continue

        top = recommendation.recommendations[0]

        if top.score >= auto_assign_threshold:
            decision: Literal["auto_assigned", "needs_review", "no_match"] = "auto_assigned"
        elif top.score >= review_threshold:
            decision = "needs_review"
        else:
            decision = "no_match"

        chosen_driver = next(
            (d for d in available_pool if d.driver_id == top.driver_id), None
        )
        truck_id = chosen_driver.vehicle.vehicle_id if chosen_driver else None

        if decision == "auto_assigned" and not dry_run and chosen_driver:
            await create_assignment(
                fleet_id=fleet_id,
                consignment_id=consignment_id,
                dispatcher_id=dispatcher_id,
                driver_id=top.driver_id,
                truck_id=truck_id or top.driver_id.replace("DRV", "VEH"),
                notes=f"Auto-dispatched (score {top.score}): {top.reasoning}",
            )

        if decision in ("auto_assigned", "needs_review") and chosen_driver:
            available_pool = [
                d for d in available_pool if d.driver_id != top.driver_id
            ]
            drivers_used.append(top.driver_id)

        if decision == "auto_assigned":
            auto_count += 1
        elif decision == "needs_review":
            review_count += 1
        else:
            no_match_count += 1

        plans.append(AssignmentPlan(
            consignment_id=consignment_id,
            consignment_summary=summary,
            assigned_driver_id=top.driver_id if decision != "no_match" else None,
            assigned_truck_id=truck_id if decision != "no_match" else None,
            score=top.score,
            reasoning=top.reasoning,
            decision=decision,
            skip_reasons=[] if decision != "no_match" else ["Score below review threshold."],
        ))

    await event_bus.publish(
        OrchestrationCompletedEvent(
            producer="dispatch.orchestrate",
            payload=OrchestrationCompletedPayload(
                dispatch_date=dispatch_date.isoformat(),
                total_consignments=len(consignments),
                auto_assigned=auto_count,
                needs_review=review_count,
                no_match=no_match_count,
                driver_ids_used=drivers_used,
            ),
        )
    )

    return OrchestrationResult(
        fleet_id=fleet_id,
        dispatch_date=dispatch_date.isoformat(),
        total_consignments=len(consignments),
        auto_assigned=auto_count,
        needs_review=review_count,
        no_match=no_match_count,
        plans=plans,
        drivers_used=drivers_used,
    )
