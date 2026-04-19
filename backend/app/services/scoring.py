from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from app.models.ai import DispatchRecommendation, DriverRecommendation
from app.models.analytics import DispatchScoringSignalsReport
from app.models.driver import Driver
from app.services.navpro import AVG_SPEED_MPH, haversine_miles, resolve_coords


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


@dataclass
class ScoringWeights:
    proximity: float = 0.30
    hos_margin: float = 0.25
    cost_efficiency: float = 0.20
    readiness: float = 0.10
    capacity_utilization: float = 0.10
    fuel_adequacy: float = 0.05
    historical_fit: float = 0.15


@dataclass
class ScoringConfig:
    weights: ScoringWeights = field(default_factory=ScoringWeights)
    hos_surplus_ref_hrs: float = 4.0
    max_results: int = 5


@dataclass
class _DriverFactors:
    driver: Driver
    deadhead_miles: float
    haul_miles: float
    estimated_hours: float
    hos_surplus_hrs: float
    factors: dict[str, float] = field(default_factory=dict)
    score: int = 0
    historical_signal = None


def score_drivers(
    drivers: List[Driver],
    pickup: str,
    destination: str,
    cargo: str,
    weight_lbs: int,
    config: ScoringConfig | None = None,
    historical_signals: DispatchScoringSignalsReport | None = None,
) -> DispatchRecommendation:
    if config is None:
        config = ScoringConfig()

    if not drivers:
        return DispatchRecommendation(
            recommendations=[],
            dispatch_note="No eligible drivers to score.",
        )

    pickup_coords = resolve_coords(pickup)
    dest_coords = resolve_coords(destination)
    haul_miles = haversine_miles(*pickup_coords, *dest_coords)

    entries: list[_DriverFactors] = []
    for driver in drivers:
        driver_coords = (driver.location.lat, driver.location.lng)
        deadhead = haversine_miles(*driver_coords, *pickup_coords)
        total_miles = deadhead + haul_miles
        estimated_hours = total_miles / AVG_SPEED_MPH
        hos_surplus = driver.hos.drive_remaining_hrs - estimated_hours

        entries.append(
            _DriverFactors(
                driver=driver,
                deadhead_miles=deadhead,
                haul_miles=haul_miles,
                estimated_hours=estimated_hours,
                hos_surplus_hrs=hos_surplus,
            )
        )

    # Fleet-level stats for relative cost normalization
    cpms = [e.driver.economics.cost_per_mile for e in entries]
    min_cpm, max_cpm = min(cpms), max(cpms)
    cpm_range = max_cpm - min_cpm

    avg_cpm = sum(cpms) / len(cpms)
    historical_signal_map = {
        signal.driver_id: signal for signal in historical_signals.driver_signals
    } if historical_signals else {}

    w = config.weights

    for entry in entries:
        d = entry.driver
        max_dh = d.contract_constraints.max_deadhead_miles or 500.0

        proximity = 1.0 - _clamp(entry.deadhead_miles / max_dh)
        hos_margin = _clamp(entry.hos_surplus_hrs / config.hos_surplus_ref_hrs)
        cost_eff = 1.0 - _clamp((d.economics.cost_per_mile - min_cpm) / cpm_range) if cpm_range > 0 else 1.0
        readiness = _clamp(d.readiness.score / 100.0)
        cap_util = _clamp(weight_lbs / d.vehicle.capacity_lbs) if d.vehicle.capacity_lbs > 0 else 0.0
        fuel = _clamp(d.vehicle.fuel_level_pct / 100.0)
        historical_signal = historical_signal_map.get(d.driver_id)
        historical_fit = (
            _clamp((historical_signal.historical_score + 25) / 125.0)
            if historical_signal
            else 0.5
        )

        entry.factors = {
            "proximity": proximity,
            "hos_margin": hos_margin,
            "cost_efficiency": cost_eff,
            "readiness": readiness,
            "capacity_utilization": cap_util,
            "fuel_adequacy": fuel,
            "historical_fit": historical_fit,
        }
        entry.historical_signal = historical_signal

        raw = (
            w.proximity * proximity
            + w.hos_margin * hos_margin
            + w.cost_efficiency * cost_eff
            + w.readiness * readiness
            + w.capacity_utilization * cap_util
            + w.fuel_adequacy * fuel
            + w.historical_fit * historical_fit
        )
        entry.score = round(raw * 100)

    # Sort: score desc, cost asc, driver_id asc for deterministic tie-breaking
    entries.sort(key=lambda e: (-e.score, e.driver.economics.cost_per_mile, e.driver.driver_id))

    results = entries[: config.max_results]

    recommendations: list[DriverRecommendation] = []
    for rank, entry in enumerate(results, start=1):
        d = entry.driver
        cost_delta = d.economics.cost_per_mile - avg_cpm
        reasoning = _build_reasoning(entry, avg_cpm)

        recommendations.append(
            DriverRecommendation(
                rank=rank,
                driver_id=d.driver_id,
                driver_name=d.name,
                score=entry.score,
                distance_to_pickup_miles=round(entry.deadhead_miles, 1),
                hos_remaining_hrs=round(d.hos.drive_remaining_hrs, 1),
                cost_per_mile=d.economics.cost_per_mile,
                cost_delta_vs_avg=round(cost_delta, 2),
                reasoning=reasoning,
            )
        )

    top = results[0] if results else None
    if top and len(results) > 1:
        spread = f"{results[0].score}-{results[-1].score}"
        note = (
            f"Scored {len(entries)} eligible drivers. "
            f"Top pick: {top.driver.name} (score {top.score}). Spread: {spread}."
        )
    elif top:
        note = f"Single eligible driver: {top.driver.name} (score {top.score})."
    else:
        note = "No eligible drivers to score."

    return DispatchRecommendation(recommendations=recommendations, dispatch_note=note)


def _build_reasoning(entry: _DriverFactors, avg_cpm: float) -> str:
    d = entry.driver
    factor_labels = {
        "proximity": f"{entry.deadhead_miles:.0f}mi deadhead",
        "hos_margin": f"{entry.hos_surplus_hrs:.1f}h HOS surplus",
        "cost_efficiency": f"${d.economics.cost_per_mile:.2f}/mi",
        "readiness": f"readiness {d.readiness.score}/100",
        "capacity_utilization": f"{entry.factors['capacity_utilization'] * 100:.0f}% capacity used",
        "fuel_adequacy": f"fuel at {d.vehicle.fuel_level_pct:.0f}%",
        "historical_fit": (
            f"historical score {entry.historical_signal.historical_score:.0f}"
            if entry.historical_signal
            else "no lane history"
        ),
    }

    # Sort factors by weighted contribution descending
    weights = ScoringWeights()
    weighted = sorted(
        entry.factors.items(),
        key=lambda kv: kv[1] * getattr(weights, kv[0]),
        reverse=True,
    )

    top_name = weighted[0][0]
    parts = [f"Top factor: {top_name.replace('_', ' ')} ({factor_labels[top_name]})"]

    if len(weighted) > 1:
        second_name = weighted[1][0]
        parts.append(factor_labels[second_name])

    total_miles = entry.deadhead_miles + entry.haul_miles
    parts.append(f"est. {total_miles:.0f} total miles")
    if entry.historical_signal:
        parts.append(
            f"lane completion {entry.historical_signal.completion_rate:.0%}, "
            f"delay {entry.historical_signal.delay_rate:.0%}"
        )

    return ". ".join(parts) + "."
