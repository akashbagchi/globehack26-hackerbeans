from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class HistoricalMetricsFilters(BaseModel):
    fleet_id: str
    origin: str | None = None
    destination: str | None = None
    driver_id: str | None = None
    truck_id: str | None = None
    from_ts: datetime | None = None
    to_ts: datetime | None = None


class HistoricalMetricsSummary(BaseModel):
    assignment_count: int
    completed_assignment_count: int
    active_assignment_count: int
    delivered_consignment_count: int
    delayed_consignment_count: int
    breakdown_count: int
    incident_count: int
    route_completion_rate: float
    on_time_delivery_rate: float | None = None
    deadhead_miles: float
    hos_used_hours: float
    fuel_spend_usd: float
    total_cost_delta_usd: float
    total_revenue_delta_usd: float


class HistoricalOperationalMetricsReport(BaseModel):
    filters: HistoricalMetricsFilters
    summary: HistoricalMetricsSummary
    matched_assignment_ids: list[str]
    matched_consignment_ids: list[str]


class FleetHealthSummary(BaseModel):
    active_driver_count: int
    active_truck_count: int
    utilization_rate: float
    incident_rate_per_assignment: float
    breakdown_rate_per_assignment: float
    delay_rate: float
    avg_hos_used_hours: float
    check_in_compliance_rate: float | None = None


class FleetEconomicsSummary(BaseModel):
    total_revenue_delta_usd: float
    total_cost_delta_usd: float
    net_contribution_usd: float
    fuel_spend_usd: float
    avg_fuel_spend_per_assignment_usd: float
    avg_revenue_per_assignment_usd: float
    avg_cost_per_assignment_usd: float
    avg_deadhead_miles_per_assignment: float
    avg_deadhead_share: float | None = None


class FleetPerformanceReport(BaseModel):
    filters: HistoricalMetricsFilters
    fleet_health: FleetHealthSummary
    fleet_economics: FleetEconomicsSummary
    matched_assignment_ids: list[str]
    matched_consignment_ids: list[str]


class PlanningLaneOutcome(BaseModel):
    lane_key: str
    origin: str
    destination: str
    assignment_count: int
    completion_rate: float
    delay_rate: float
    breakdown_rate: float
    on_time_delivery_rate: float | None = None
    avg_deadhead_miles: float
    avg_margin_per_assignment_usd: float


class PlanningAssignmentOutcomeSummary(BaseModel):
    assignment_count: int
    completed_assignment_count: int
    active_assignment_count: int
    delayed_assignment_count: int
    breakdown_assignment_count: int
    avg_route_hours: float
    avg_margin_per_assignment_usd: float


class NextDayPlanningReport(BaseModel):
    filters: HistoricalMetricsFilters
    assignment_outcomes: PlanningAssignmentOutcomeSummary
    top_lanes: list[PlanningLaneOutcome]
    highest_risk_lanes: list[PlanningLaneOutcome]
    matched_assignment_ids: list[str]
    matched_consignment_ids: list[str]


class DispatchHistoricalSignal(BaseModel):
    driver_id: str
    driver_name: str
    assignment_count: int
    completion_rate: float
    delay_rate: float
    breakdown_rate: float
    avg_margin_per_assignment_usd: float
    avg_deadhead_miles: float
    historical_score: float


class DispatchScoringSignalsReport(BaseModel):
    filters: HistoricalMetricsFilters
    lane_assignment_count: int
    lane_completion_rate: float
    lane_delay_rate: float
    lane_avg_margin_per_assignment_usd: float
    driver_signals: list[DispatchHistoricalSignal]
