import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models.driver import Driver
from app.services.dispatch_scoring import build_dispatch_scoring_signals


class DispatchScoringTests(unittest.IsolatedAsyncioTestCase):
    async def test_build_dispatch_scoring_signals_returns_lane_and_driver_history(self):
        eligible_drivers = [
            Driver(
                driver_id="DRV001",
                name="Marcus Webb",
                truck_number="T-1",
                status="available",
                location={"lat": 33.44, "lng": -112.07, "city": "Phoenix", "state": "AZ", "heading": 0, "speed_mph": 0},
                hos={"drive_remaining_hrs": 8, "shift_remaining_hrs": 10, "cycle_remaining_hrs": 40, "last_rest_end": "2026-04-18T00:00:00Z"},
                vehicle={"vehicle_id": "VEH001", "make": "Freightliner", "model": "Cascadia", "year": 2022, "fuel_level_pct": 80, "odometer_miles": 100000, "mpg_avg": 7.1, "capacity_lbs": 40000, "cab_type": "sleeper", "trailer_type": "dry_van", "trailer_length_ft": 53, "refrigerated": False, "maintenance_ready": True, "hazmat_permitted": True},
                economics={"cost_per_mile": 1.8, "miles_today": 200, "revenue_today": 500, "idle_cost_today": 10},
                certifications=["cdl_class_a"],
                endorsements=[],
                contract_constraints={"max_deadhead_miles": 300, "preferred_regions": [], "excluded_cargo_types": []},
                availability_window={"available_from": "2026-04-19T06:00:00Z", "available_until": "2026-04-19T18:00:00Z"},
                readiness={"state": "ready", "score": 90, "blocker_reasons": []},
            ),
            Driver(
                driver_id="DRV002",
                name="Sofia Reyes",
                truck_number="T-2",
                status="available",
                location={"lat": 33.44, "lng": -112.07, "city": "Phoenix", "state": "AZ", "heading": 0, "speed_mph": 0},
                hos={"drive_remaining_hrs": 8, "shift_remaining_hrs": 10, "cycle_remaining_hrs": 40, "last_rest_end": "2026-04-18T00:00:00Z"},
                vehicle={"vehicle_id": "VEH002", "make": "Kenworth", "model": "T680", "year": 2023, "fuel_level_pct": 75, "odometer_miles": 90000, "mpg_avg": 7.5, "capacity_lbs": 40000, "cab_type": "sleeper", "trailer_type": "dry_van", "trailer_length_ft": 53, "refrigerated": False, "maintenance_ready": True, "hazmat_permitted": True},
                economics={"cost_per_mile": 1.75, "miles_today": 180, "revenue_today": 450, "idle_cost_today": 8},
                certifications=["cdl_class_a"],
                endorsements=[],
                contract_constraints={"max_deadhead_miles": 300, "preferred_regions": [], "excluded_cargo_types": []},
                availability_window={"available_from": "2026-04-19T06:00:00Z", "available_until": "2026-04-19T18:00:00Z"},
                readiness={"state": "ready", "score": 92, "blocker_reasons": []},
            ),
        ]
        scope = {
            "scoped_assignments": [
                {"assignment_id": "ASN001", "consignment_id": "CON001", "driver_id": "DRV001", "status": "completed"},
                {"assignment_id": "ASN002", "consignment_id": "CON002", "driver_id": "DRV002", "status": "completed"},
                {"assignment_id": "ASN003", "consignment_id": "CON003", "driver_id": "DRV002", "status": "completed"},
            ],
            "assignment_ids": {"ASN001", "ASN002", "ASN003"},
            "scoped_consignments": {
                "CON001": {"consignment_id": "CON001", "status": "delivered"},
                "CON002": {"consignment_id": "CON002", "status": "delayed"},
                "CON003": {"consignment_id": "CON003", "status": "delivered"},
            },
            "consignment_ids": {"CON001", "CON002", "CON003"},
            "scoped_events": [
                {"assignment_id": "ASN001", "consignment_id": "CON001", "event_type": "position_report", "details": {"deadhead_miles": 20, "fuel_spend_usd": 50}},
                {"assignment_id": "ASN002", "consignment_id": "CON002", "event_type": "delay_reported", "details": {"deadhead_miles": 40, "fuel_spend_usd": 80}},
                {"assignment_id": "ASN003", "consignment_id": "CON003", "event_type": "position_report", "details": {"deadhead_miles": 10, "fuel_spend_usd": 40}},
            ],
            "scoped_reconciliation_events": [
                {"assignment_id": "ASN001", "revenue_delta_usd": 1000, "cost_delta_usd": 120, "details": {}},
                {"assignment_id": "ASN002", "revenue_delta_usd": 900, "cost_delta_usd": 200, "details": {}},
                {"assignment_id": "ASN003", "revenue_delta_usd": 950, "cost_delta_usd": 100, "details": {}},
            ],
            "scoped_incidents": [{"assignment_id": "ASN002", "incident_type": "breakdown"}],
            "scoped_check_ins": [],
        }

        with patch("app.services.dispatch_scoring._load_operational_scope", new=AsyncMock(return_value=scope)):
            report = await build_dispatch_scoring_signals(
                fleet_id="fleet_demo",
                pickup="Phoenix, AZ",
                destination="Los Angeles, CA",
                eligible_drivers=eligible_drivers,
                from_ts=datetime(2026, 4, 1, tzinfo=timezone.utc),
                to_ts=datetime(2026, 4, 19, tzinfo=timezone.utc),
            )

        self.assertEqual(report.lane_assignment_count, 3)
        self.assertEqual(report.lane_completion_rate, 1.0)
        self.assertEqual(report.lane_delay_rate, 1 / 3)
        self.assertEqual(report.driver_signals[0].driver_id, "DRV001")
        self.assertEqual(report.driver_signals[1].driver_id, "DRV002")
        self.assertEqual(report.driver_signals[1].breakdown_rate, 0.5)


if __name__ == "__main__":
    unittest.main()
