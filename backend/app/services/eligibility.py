from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.models.driver import Driver
from app.services.navpro import AVG_SPEED_MPH, haversine_miles, resolve_coords


@dataclass
class LoadRequirements:
    cargo: str
    weight_lbs: int
    required_certifications: list[str]
    requires_refrigeration: bool
    estimated_hours: float
    deadhead_miles: float


@dataclass
class EligibilityResult:
    driver: Driver
    eligible: bool
    reasons: list[str]
    requirements: LoadRequirements


def _contains_any(text: str, needles: Iterable[str]) -> bool:
    return any(needle in text for needle in needles)


def infer_load_requirements(
    driver: Driver,
    pickup: str,
    destination: str,
    cargo: str,
    weight_lbs: int,
) -> LoadRequirements:
    cargo_text = cargo.lower()
    required: list[str] = []

    if _contains_any(cargo_text, ("hazmat", "hazard", "flammable", "chemical")):
        required.append("hazmat")
    if _contains_any(cargo_text, ("explosive", "munitions")):
        required.extend(["hazmat", "explosives"])
    if _contains_any(cargo_text, ("military", "defense", "government")):
        required.append("military")
    if _contains_any(cargo_text, ("produce", "perishable", "refrigerated", "frozen", "pharma", "vaccine")):
        required.append("refrigerated")
    if weight_lbs >= 45000:
        required.append("heavy_haul")

    driver_coords = (driver.location.lat, driver.location.lng)
    pickup_coords = resolve_coords(pickup)
    dest_coords = resolve_coords(destination)
    deadhead_miles = haversine_miles(*driver_coords, *pickup_coords)
    haul_miles = haversine_miles(*pickup_coords, *dest_coords)

    return LoadRequirements(
        cargo=cargo,
        weight_lbs=weight_lbs,
        required_certifications=sorted(set(required)),
        requires_refrigeration="refrigerated" in required,
        estimated_hours=(deadhead_miles + haul_miles) / AVG_SPEED_MPH,
        deadhead_miles=deadhead_miles,
    )


def evaluate_driver_for_load(
    driver: Driver,
    pickup: str,
    destination: str,
    cargo: str,
    weight_lbs: int,
) -> EligibilityResult:
    requirements = infer_load_requirements(driver, pickup, destination, cargo, weight_lbs)
    reasons: list[str] = []
    certifications = set(driver.certifications) | set(driver.endorsements)
    excluded_cargo = [item.lower() for item in driver.contract_constraints.excluded_cargo_types]

    if driver.current_load:
        reasons.append("Driver already has an active load.")

    if driver.status in {"off_duty", "unavailable", "breakdown"}:
        reasons.append(f"Driver status is {driver.status.replace('_', ' ')}.")

    if driver.readiness.state not in {"ready", "limited"}:
        reasons.extend(driver.readiness.blocker_reasons or ["Driver is not dispatch ready."])

    if not driver.vehicle.maintenance_ready:
        reasons.append("Truck is not maintenance ready.")

    if weight_lbs > driver.vehicle.capacity_lbs:
        reasons.append(
            f"Truck capacity is {driver.vehicle.capacity_lbs:,} lbs, below the requested load."
        )

    if requirements.deadhead_miles > driver.contract_constraints.max_deadhead_miles:
        reasons.append(
            f"Deadhead exceeds contract limit of {driver.contract_constraints.max_deadhead_miles} miles."
        )

    if driver.hos.drive_remaining_hrs < requirements.estimated_hours:
        reasons.append(
            f"Insufficient HOS for estimated {requirements.estimated_hours:.1f}h assignment."
        )

    if requirements.requires_refrigeration and not driver.vehicle.refrigerated:
        reasons.append("Load requires refrigerated equipment.")

    if "hazmat" in requirements.required_certifications and not driver.vehicle.hazmat_permitted:
        reasons.append("Truck is not hazmat permitted.")

    for required in requirements.required_certifications:
        if required not in certifications:
            reasons.append(f"Missing required certification: {required}.")

    cargo_text = cargo.lower()
    for blocked in excluded_cargo:
        if blocked and blocked in cargo_text:
            reasons.append(f"Contract excludes {blocked} cargo.")

    return EligibilityResult(
        driver=driver,
        eligible=not reasons,
        reasons=sorted(set(reasons)),
        requirements=requirements,
    )
