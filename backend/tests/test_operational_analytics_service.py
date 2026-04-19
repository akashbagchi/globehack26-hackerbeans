import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.services.operational_analytics import (
    get_fleet_performance_report,
    get_historical_operational_metrics,
    get_next_day_planning_report,
)


class OperationalAnalyticsServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_historical_metrics_filter_and_aggregate_expected_signals(self):
        assignments = [
            {
                "assignment_id": "ASN001",
                "fleet_id": "fleet_demo",
                "consignment_id": "CON001",
                "driver_id": "DRV001",
                "truck_id": "TRK001",
                "status": "completed",
                "assigned_at": "2026-04-18T06:00:00Z",
                "completed_at": "2026-04-18T17:30:00Z",
            },
            {
                "assignment_id": "ASN002",
                "fleet_id": "fleet_demo",
                "consignment_id": "CON002",
                "driver_id": "DRV002",
                "truck_id": "TRK002",
                "status": "active",
                "assigned_at": "2026-04-18T08:00:00Z",
            },
        ]
        consignments = [
            {
                "consignment_id": "CON001",
                "fleet_id": "fleet_demo",
                "origin": "Phoenix, AZ",
                "destination": "Los Angeles, CA",
                "status": "delivered",
                "promised_delivery_at": "2026-04-18T18:00:00Z",
            },
            {
                "consignment_id": "CON002",
                "fleet_id": "fleet_demo",
                "origin": "Phoenix, AZ",
                "destination": "Las Vegas, NV",
                "status": "delayed",
                "promised_delivery_at": "2026-04-18T16:00:00Z",
            },
        ]
        in_transit_events = [
            {
                "assignment_id": "ASN001",
                "consignment_id": "CON001",
                "occurred_at": "2026-04-18T10:00:00Z",
                "event_type": "position_report",
                "details": {
                    "deadhead_miles": 42,
                    "hos_used_hours": 5.5,
                    "fuel_spend_usd": 120,
                },
            },
            {
                "assignment_id": "ASN002",
                "consignment_id": "CON002",
                "occurred_at": "2026-04-18T11:00:00Z",
                "event_type": "delay_reported",
                "details": {
                    "deadhead_miles": 18,
                    "drive_hours_used": 2.0,
                },
            },
        ]
        reconciliation_events = [
            {
                "assignment_id": "ASN001",
                "consignment_id": "CON001",
                "event_date": "2026-04-18T18:00:00Z",
                "cost_delta_usd": 85.5,
                "revenue_delta_usd": 1200,
                "details": {"fuel_spend_usd": 45},
            }
        ]
        roadside_incidents = [
            {
                "assignment_id": "ASN001",
                "consignment_id": "CON001",
                "occurred_at": "2026-04-18T12:30:00Z",
                "incident_type": "breakdown",
            }
        ]

        with patch(
            "app.services.operational_analytics._fetch_records",
            new=AsyncMock(
                side_effect=[
                    consignments,
                    assignments,
                    in_transit_events,
                    reconciliation_events,
                    roadside_incidents,
                    [],
                ]
            ),
        ):
            report = await get_historical_operational_metrics(
                fleet_id="fleet_demo",
                origin="Phoenix, AZ",
                destination="Los Angeles, CA",
                driver_id="DRV001",
                truck_id="TRK001",
                from_ts=datetime(2026, 4, 18, 0, 0, tzinfo=timezone.utc),
                to_ts=datetime(2026, 4, 18, 23, 59, tzinfo=timezone.utc),
            )

        self.assertEqual(report.summary.assignment_count, 1)
        self.assertEqual(report.summary.completed_assignment_count, 1)
        self.assertEqual(report.summary.delivered_consignment_count, 1)
        self.assertEqual(report.summary.delayed_consignment_count, 0)
        self.assertEqual(report.summary.breakdown_count, 1)
        self.assertEqual(report.summary.deadhead_miles, 42.0)
        self.assertEqual(report.summary.hos_used_hours, 5.5)
        self.assertEqual(report.summary.fuel_spend_usd, 165.0)
        self.assertEqual(report.summary.total_cost_delta_usd, 85.5)
        self.assertEqual(report.summary.total_revenue_delta_usd, 1200.0)
        self.assertEqual(report.summary.route_completion_rate, 1.0)
        self.assertEqual(report.summary.on_time_delivery_rate, 1.0)
        self.assertEqual(report.matched_assignment_ids, ["ASN001"])
        self.assertEqual(report.matched_consignment_ids, ["CON001"])

    async def test_fleet_performance_report_builds_health_and_economics_metrics(self):
        assignments = [
            {
                "assignment_id": "ASN001",
                "fleet_id": "fleet_demo",
                "consignment_id": "CON001",
                "driver_id": "DRV001",
                "truck_id": "TRK001",
                "status": "completed",
                "assigned_at": "2026-04-18T06:00:00Z",
                "completed_at": "2026-04-18T17:30:00Z",
            },
            {
                "assignment_id": "ASN002",
                "fleet_id": "fleet_demo",
                "consignment_id": "CON002",
                "driver_id": "DRV002",
                "truck_id": "TRK002",
                "status": "active",
                "assigned_at": "2026-04-18T08:00:00Z",
            },
        ]
        consignments = [
            {
                "consignment_id": "CON001",
                "fleet_id": "fleet_demo",
                "origin": "Phoenix, AZ",
                "destination": "Los Angeles, CA",
                "status": "delivered",
            },
            {
                "consignment_id": "CON002",
                "fleet_id": "fleet_demo",
                "origin": "Phoenix, AZ",
                "destination": "Las Vegas, NV",
                "status": "delayed",
            },
        ]
        in_transit_events = [
            {
                "assignment_id": "ASN001",
                "occurred_at": "2026-04-18T10:00:00Z",
                "event_type": "position_report",
                "details": {
                    "deadhead_miles": 40,
                    "loaded_miles": 220,
                    "hos_used_hours": 6,
                    "fuel_spend_usd": 100,
                },
            },
            {
                "assignment_id": "ASN002",
                "occurred_at": "2026-04-18T11:00:00Z",
                "event_type": "delay_reported",
                "details": {
                    "deadhead_miles": 20,
                    "loaded_miles": 140,
                    "drive_hours_used": 3,
                    "fuel_spend_usd": 70,
                },
            },
        ]
        reconciliation_events = [
            {
                "assignment_id": "ASN001",
                "event_date": "2026-04-18T18:00:00Z",
                "cost_delta_usd": 140,
                "revenue_delta_usd": 1100,
                "details": {"fuel_spend_usd": 30, "miles_today": 260},
            },
            {
                "assignment_id": "ASN002",
                "event_date": "2026-04-18T19:00:00Z",
                "cost_delta_usd": 90,
                "revenue_delta_usd": 700,
                "details": {"miles_today": 180},
            },
        ]
        roadside_incidents = [
            {
                "assignment_id": "ASN002",
                "occurred_at": "2026-04-18T12:30:00Z",
                "incident_type": "breakdown",
            }
        ]
        check_in_events = [
            {
                "assignment_id": "ASN001",
                "checked_in_at": "2026-04-18T12:00:00Z",
            }
        ]

        with patch(
            "app.services.operational_analytics._fetch_records",
            new=AsyncMock(
                side_effect=[
                    consignments,
                    assignments,
                    in_transit_events,
                    reconciliation_events,
                    roadside_incidents,
                    check_in_events,
                ]
            ),
        ):
            report = await get_fleet_performance_report(
                fleet_id="fleet_demo",
                from_ts=datetime(2026, 4, 18, 0, 0, tzinfo=timezone.utc),
                to_ts=datetime(2026, 4, 18, 23, 59, tzinfo=timezone.utc),
            )

        self.assertEqual(report.fleet_health.active_driver_count, 2)
        self.assertEqual(report.fleet_health.active_truck_count, 2)
        self.assertEqual(report.fleet_health.utilization_rate, 1.0)
        self.assertEqual(report.fleet_health.incident_rate_per_assignment, 0.5)
        self.assertEqual(report.fleet_health.breakdown_rate_per_assignment, 0.5)
        self.assertEqual(report.fleet_health.delay_rate, 0.5)
        self.assertEqual(report.fleet_health.avg_hos_used_hours, 4.5)
        self.assertEqual(report.fleet_health.check_in_compliance_rate, 0.5)
        self.assertEqual(report.fleet_economics.total_revenue_delta_usd, 1800.0)
        self.assertEqual(report.fleet_economics.total_cost_delta_usd, 230.0)
        self.assertEqual(report.fleet_economics.fuel_spend_usd, 200.0)
        self.assertEqual(report.fleet_economics.avg_fuel_spend_per_assignment_usd, 100.0)
        self.assertEqual(report.fleet_economics.avg_revenue_per_assignment_usd, 900.0)
        self.assertEqual(report.fleet_economics.avg_cost_per_assignment_usd, 115.0)
        self.assertEqual(report.fleet_economics.avg_deadhead_miles_per_assignment, 30.0)
        self.assertAlmostEqual(report.fleet_economics.avg_deadhead_share or 0, 60 / 860)
        self.assertEqual(report.fleet_economics.net_contribution_usd, 1370.0)

    async def test_next_day_planning_report_summarizes_lane_and_assignment_outcomes(self):
        assignments = [
            {
                "assignment_id": "ASN001",
                "fleet_id": "fleet_demo",
                "consignment_id": "CON001",
                "driver_id": "DRV001",
                "truck_id": "TRK001",
                "status": "completed",
                "assigned_at": "2026-04-18T06:00:00Z",
                "completed_at": "2026-04-18T16:00:00Z",
            },
            {
                "assignment_id": "ASN002",
                "fleet_id": "fleet_demo",
                "consignment_id": "CON002",
                "driver_id": "DRV002",
                "truck_id": "TRK002",
                "status": "completed",
                "assigned_at": "2026-04-18T07:00:00Z",
                "completed_at": "2026-04-18T18:30:00Z",
            },
            {
                "assignment_id": "ASN003",
                "fleet_id": "fleet_demo",
                "consignment_id": "CON003",
                "driver_id": "DRV003",
                "truck_id": "TRK003",
                "status": "active",
                "assigned_at": "2026-04-18T09:00:00Z",
            },
        ]
        consignments = [
            {
                "consignment_id": "CON001",
                "fleet_id": "fleet_demo",
                "origin": "Phoenix, AZ",
                "destination": "Los Angeles, CA",
                "status": "delivered",
                "promised_delivery_at": "2026-04-18T17:00:00Z",
            },
            {
                "consignment_id": "CON002",
                "fleet_id": "fleet_demo",
                "origin": "Phoenix, AZ",
                "destination": "Los Angeles, CA",
                "status": "delayed",
                "promised_delivery_at": "2026-04-18T17:30:00Z",
            },
            {
                "consignment_id": "CON003",
                "fleet_id": "fleet_demo",
                "origin": "Dallas, TX",
                "destination": "Houston, TX",
                "status": "in_transit",
                "promised_delivery_at": "2026-04-18T15:00:00Z",
            },
        ]
        in_transit_events = [
            {
                "assignment_id": "ASN001",
                "consignment_id": "CON001",
                "occurred_at": "2026-04-18T10:00:00Z",
                "event_type": "position_report",
                "details": {
                    "deadhead_miles": 30,
                    "hos_used_hours": 5,
                    "fuel_spend_usd": 90,
                },
            },
            {
                "assignment_id": "ASN002",
                "consignment_id": "CON002",
                "occurred_at": "2026-04-18T12:00:00Z",
                "event_type": "delay_reported",
                "details": {
                    "deadhead_miles": 42,
                    "drive_hours_used": 6,
                    "fuel_spend_usd": 110,
                },
            },
            {
                "assignment_id": "ASN003",
                "consignment_id": "CON003",
                "occurred_at": "2026-04-18T13:00:00Z",
                "event_type": "position_report",
                "details": {
                    "deadhead_miles": 12,
                    "drive_hours_used": 3,
                    "fuel_spend_usd": 55,
                },
            },
        ]
        reconciliation_events = [
            {
                "assignment_id": "ASN001",
                "event_date": "2026-04-18T17:00:00Z",
                "cost_delta_usd": 100,
                "revenue_delta_usd": 1200,
                "details": {},
            },
            {
                "assignment_id": "ASN002",
                "event_date": "2026-04-18T19:00:00Z",
                "cost_delta_usd": 180,
                "revenue_delta_usd": 950,
                "details": {},
            },
            {
                "assignment_id": "ASN003",
                "event_date": "2026-04-18T14:00:00Z",
                "cost_delta_usd": 70,
                "revenue_delta_usd": 500,
                "details": {},
            },
        ]
        roadside_incidents = [
            {
                "assignment_id": "ASN003",
                "occurred_at": "2026-04-18T14:30:00Z",
                "incident_type": "breakdown",
            }
        ]
        check_in_events = []

        with patch(
            "app.services.operational_analytics._fetch_records",
            new=AsyncMock(
                side_effect=[
                    consignments,
                    assignments,
                    in_transit_events,
                    reconciliation_events,
                    roadside_incidents,
                    check_in_events,
                ]
            ),
        ):
            report = await get_next_day_planning_report(
                fleet_id="fleet_demo",
                from_ts=datetime(2026, 4, 18, 0, 0, tzinfo=timezone.utc),
                to_ts=datetime(2026, 4, 18, 23, 59, tzinfo=timezone.utc),
            )

        self.assertEqual(report.assignment_outcomes.assignment_count, 3)
        self.assertEqual(report.assignment_outcomes.completed_assignment_count, 2)
        self.assertEqual(report.assignment_outcomes.active_assignment_count, 1)
        self.assertEqual(report.assignment_outcomes.delayed_assignment_count, 1)
        self.assertEqual(report.assignment_outcomes.breakdown_assignment_count, 1)
        self.assertEqual(report.assignment_outcomes.avg_route_hours, 14 / 3)
        self.assertAlmostEqual(report.assignment_outcomes.avg_margin_per_assignment_usd, 2045 / 3)
        self.assertEqual(report.top_lanes[0].lane_key, "Phoenix, AZ -> Los Angeles, CA")
        self.assertEqual(report.top_lanes[0].assignment_count, 2)
        self.assertEqual(report.top_lanes[0].completion_rate, 1.0)
        self.assertEqual(report.top_lanes[0].delay_rate, 0.5)
        self.assertEqual(report.top_lanes[0].breakdown_rate, 0.0)
        self.assertEqual(report.top_lanes[0].avg_deadhead_miles, 36.0)
        self.assertEqual(report.top_lanes[0].avg_margin_per_assignment_usd, 835.0)
        self.assertEqual(report.highest_risk_lanes[0].lane_key, "Dallas, TX -> Houston, TX")
        self.assertEqual(report.highest_risk_lanes[0].completion_rate, 0.0)
        self.assertEqual(report.highest_risk_lanes[0].breakdown_rate, 1.0)


if __name__ == "__main__":
    unittest.main()
