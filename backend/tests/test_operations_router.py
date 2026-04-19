import unittest
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

operations_path = Path(__file__).resolve().parents[1] / "app" / "routers" / "operations.py"
operations_spec = spec_from_file_location("operations_router_module", operations_path)
operations_module = module_from_spec(operations_spec)
assert operations_spec is not None and operations_spec.loader is not None
operations_spec.loader.exec_module(operations_module)
operations_router = operations_module.router


class OperationsRouterTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(operations_router)
        self.client = TestClient(app)

    def test_assignments_endpoint_returns_expected_envelope(self):
        mocked_rows = [
            {
                "assignment_id": "ASN001",
                "fleet_id": "fleet_demo",
                "consignment_id": "CON001",
                "driver_id": "DRV001",
                "truck_id": "VEH001",
                "status": "active",
            }
        ]

        with patch.object(
            operations_module,
            "list_assignments",
            new=AsyncMock(return_value=mocked_rows),
        ):
            response = self.client.get(
                "/operations/assignments",
                params={"fleet_id": "fleet_demo"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["fleet_id"], "fleet_demo")
        self.assertEqual(body["source"], "insforge")
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["data"][0]["assignment_id"], "ASN001")

    def test_operational_history_endpoint_returns_expected_envelope(self):
        mocked_report = {
            "filters": {"fleet_id": "fleet_demo", "origin": "Phoenix, AZ"},
            "summary": {
                "assignment_count": 2,
                "completed_assignment_count": 1,
                "active_assignment_count": 1,
                "delivered_consignment_count": 1,
                "delayed_consignment_count": 1,
                "breakdown_count": 0,
                "incident_count": 1,
                "route_completion_rate": 0.5,
                "on_time_delivery_rate": 1.0,
                "deadhead_miles": 68.0,
                "hos_used_hours": 7.5,
                "fuel_spend_usd": 110.0,
                "total_cost_delta_usd": 44.0,
                "total_revenue_delta_usd": 890.0,
            },
            "matched_assignment_ids": ["ASN001", "ASN002"],
            "matched_consignment_ids": ["CON001", "CON002"],
        }

        with patch.object(
            operations_module,
            "get_historical_operational_metrics",
            new=AsyncMock(
                return_value=type(
                    "ReportStub",
                    (),
                    {"model_dump": lambda self, mode="json": mocked_report},
                )()
            ),
        ) as mock_history:
            response = self.client.get(
                "/operations/analytics/history",
                params={
                    "fleet_id": "fleet_demo",
                    "origin": "Phoenix, AZ",
                    "driver_id": "DRV001",
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["fleet_id"], "fleet_demo")
        self.assertEqual(body["data"]["summary"]["assignment_count"], 2)
        mock_history.assert_awaited_once()
        kwargs = mock_history.await_args.kwargs
        self.assertEqual(kwargs["fleet_id"], "fleet_demo")
        self.assertEqual(kwargs["origin"], "Phoenix, AZ")
        self.assertEqual(kwargs["driver_id"], "DRV001")

    def test_fleet_report_endpoint_returns_expected_envelope(self):
        mocked_report = {
            "filters": {"fleet_id": "fleet_demo"},
            "fleet_health": {
                "active_driver_count": 4,
                "active_truck_count": 4,
                "utilization_rate": 0.8,
                "incident_rate_per_assignment": 0.2,
                "breakdown_rate_per_assignment": 0.1,
                "delay_rate": 0.25,
                "avg_hos_used_hours": 6.2,
                "check_in_compliance_rate": 0.75,
            },
            "fleet_economics": {
                "total_revenue_delta_usd": 4200.0,
                "total_cost_delta_usd": 1300.0,
                "net_contribution_usd": 2500.0,
                "fuel_spend_usd": 400.0,
                "avg_fuel_spend_per_assignment_usd": 80.0,
                "avg_revenue_per_assignment_usd": 840.0,
                "avg_cost_per_assignment_usd": 260.0,
                "avg_deadhead_miles_per_assignment": 22.0,
                "avg_deadhead_share": 0.14,
            },
            "matched_assignment_ids": ["ASN001"],
            "matched_consignment_ids": ["CON001"],
        }

        with patch.object(
            operations_module,
            "get_fleet_performance_report",
            new=AsyncMock(
                return_value=type(
                    "FleetReportStub",
                    (),
                    {"model_dump": lambda self, mode="json": mocked_report},
                )()
            ),
        ) as mock_report:
            response = self.client.get(
                "/operations/analytics/fleet-report",
                params={"fleet_id": "fleet_demo", "truck_id": "TRK001"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["fleet_id"], "fleet_demo")
        self.assertEqual(body["data"]["fleet_health"]["active_driver_count"], 4)
        self.assertEqual(body["data"]["fleet_economics"]["net_contribution_usd"], 2500.0)
        mock_report.assert_awaited_once()
        kwargs = mock_report.await_args.kwargs
        self.assertEqual(kwargs["fleet_id"], "fleet_demo")
        self.assertEqual(kwargs["truck_id"], "TRK001")

    def test_next_day_plan_endpoint_returns_expected_envelope(self):
        mocked_report = {
            "filters": {"fleet_id": "fleet_demo"},
            "assignment_outcomes": {
                "assignment_count": 5,
                "completed_assignment_count": 3,
                "active_assignment_count": 2,
                "delayed_assignment_count": 1,
                "breakdown_assignment_count": 1,
                "avg_route_hours": 6.8,
                "avg_margin_per_assignment_usd": 540.0,
            },
            "top_lanes": [
                {
                    "lane_key": "Phoenix, AZ -> Los Angeles, CA",
                    "origin": "Phoenix, AZ",
                    "destination": "Los Angeles, CA",
                    "assignment_count": 2,
                    "completion_rate": 1.0,
                    "delay_rate": 0.0,
                    "breakdown_rate": 0.0,
                    "on_time_delivery_rate": 1.0,
                    "avg_deadhead_miles": 18.0,
                    "avg_margin_per_assignment_usd": 700.0,
                }
            ],
            "highest_risk_lanes": [
                {
                    "lane_key": "Dallas, TX -> Houston, TX",
                    "origin": "Dallas, TX",
                    "destination": "Houston, TX",
                    "assignment_count": 1,
                    "completion_rate": 0.0,
                    "delay_rate": 1.0,
                    "breakdown_rate": 1.0,
                    "on_time_delivery_rate": None,
                    "avg_deadhead_miles": 26.0,
                    "avg_margin_per_assignment_usd": 120.0,
                }
            ],
            "matched_assignment_ids": ["ASN001"],
            "matched_consignment_ids": ["CON001"],
        }

        with patch.object(
            operations_module,
            "get_next_day_planning_report",
            new=AsyncMock(
                return_value=type(
                    "PlanningReportStub",
                    (),
                    {"model_dump": lambda self, mode="json": mocked_report},
                )()
            ),
        ) as mock_report:
            response = self.client.get(
                "/operations/analytics/next-day-plan",
                params={"fleet_id": "fleet_demo", "origin": "Phoenix, AZ"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["fleet_id"], "fleet_demo")
        self.assertEqual(body["data"]["assignment_outcomes"]["assignment_count"], 5)
        self.assertEqual(body["data"]["top_lanes"][0]["lane_key"], "Phoenix, AZ -> Los Angeles, CA")
        mock_report.assert_awaited_once()
        kwargs = mock_report.await_args.kwargs
        self.assertEqual(kwargs["fleet_id"], "fleet_demo")
        self.assertEqual(kwargs["origin"], "Phoenix, AZ")

    def test_dispatch_signals_endpoint_returns_expected_envelope(self):
        mocked_report = {
            "filters": {
                "fleet_id": "fleet_demo",
                "origin": "Phoenix, AZ",
                "destination": "Los Angeles, CA",
            },
            "lane_assignment_count": 4,
            "lane_completion_rate": 0.75,
            "lane_delay_rate": 0.25,
            "lane_avg_margin_per_assignment_usd": 640.0,
            "driver_signals": [
                {
                    "driver_id": "DRV001",
                    "driver_name": "Marcus Webb",
                    "assignment_count": 2,
                    "completion_rate": 1.0,
                    "delay_rate": 0.0,
                    "breakdown_rate": 0.0,
                    "avg_margin_per_assignment_usd": 800.0,
                    "avg_deadhead_miles": 18.0,
                    "historical_score": 100.0,
                }
            ],
        }
        driver_stub = object()

        with patch.object(operations_module, "get_drivers", new=AsyncMock(return_value=([driver_stub], "mock"))), patch.object(
            operations_module,
            "build_dispatch_scoring_signals",
            new=AsyncMock(
                return_value=type(
                    "DispatchSignalsStub",
                    (),
                    {"model_dump": lambda self, mode="json": mocked_report},
                )()
            ),
        ) as mock_report:
            response = self.client.get(
                "/operations/analytics/dispatch-signals",
                params={
                    "fleet_id": "fleet_demo",
                    "pickup": "Phoenix, AZ",
                    "destination": "Los Angeles, CA",
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["data"]["lane_assignment_count"], 4)
        self.assertEqual(body["data"]["driver_signals"][0]["driver_id"], "DRV001")
        mock_report.assert_awaited_once()

    def test_consignments_endpoint_passes_filters_through(self):
        mocked_rows = [
            {
                "consignment_id": "CON001",
                "fleet_id": "fleet_demo",
                "status": "in_transit",
            }
        ]

        with patch.object(
            operations_module,
            "list_consignments",
            new=AsyncMock(return_value=mocked_rows),
        ) as mock_list_consignments:
            response = self.client.get(
                "/operations/consignments",
                params={
                    "fleet_id": "fleet_demo",
                    "status": "in_transit",
                    "dispatch_date": "2026-04-18",
                    "from": "2026-04-18T00:00:00Z",
                    "to": "2026-04-19T00:00:00Z",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)
        mock_list_consignments.assert_awaited_once()
        kwargs = mock_list_consignments.await_args.kwargs
        self.assertEqual(kwargs["fleet_id"], "fleet_demo")
        self.assertEqual(kwargs["status"], "in_transit")
        self.assertEqual(kwargs["dispatch_date"].isoformat(), "2026-04-18")

    def test_consignment_timeline_returns_404_when_not_found(self):
        with patch.object(
            operations_module,
            "get_consignment_timeline",
            new=AsyncMock(return_value=None),
        ):
            response = self.client.get(
                "/operations/consignments/CON404/events",
                params={"fleet_id": "fleet_demo"},
            )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Consignment not found")

    def test_get_consignment_by_id_returns_consignment(self):
        mocked_row = {
            "consignment_id": "CON001",
            "fleet_id": "fleet_demo",
            "status": "unassigned",
        }

        with patch.object(
            operations_module,
            "get_consignment",
            new=AsyncMock(return_value=mocked_row),
        ):
            response = self.client.get(
                "/operations/consignments/CON001",
                params={"fleet_id": "fleet_demo"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["consignment_id"], "CON001")

    def test_create_consignment_returns_created_envelope(self):
        mocked_row = {
            "consignment_id": "CONNEW1",
            "fleet_id": "fleet_demo",
            "status": "unassigned",
            "cargo_class": "general",
        }

        with patch.object(
            operations_module,
            "create_consignment",
            new=AsyncMock(return_value=mocked_row),
        ):
            response = self.client.post(
                "/operations/consignments",
                json={
                    "fleet_id": "fleet_demo",
                    "shipper_name": "Mock Shipper",
                    "receiver_name": "Mock Receiver",
                    "origin": "Phoenix, AZ",
                    "destination": "Las Vegas, NV",
                    "cargo_description": "Medical Supplies",
                    "weight_lbs": 12000,
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["data"]["consignment_id"], "CONNEW1")

    def test_patch_consignment_returns_conflict_on_invalid_transition(self):
        with patch.object(
            operations_module,
            "update_consignment",
            new=AsyncMock(side_effect=operations_module.OperationsServiceConflict("bad status")),
        ):
            response = self.client.patch(
                "/operations/consignments/CON001",
                params={"fleet_id": "fleet_demo"},
                json={"status": "unassigned"},
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "bad status")

    def test_delete_consignment_returns_no_content(self):
        with patch.object(
            operations_module,
            "delete_consignment",
            new=AsyncMock(return_value=True),
        ):
            response = self.client.delete(
                "/operations/consignments/CON001",
                params={"fleet_id": "fleet_demo"},
            )

        self.assertEqual(response.status_code, 204)


if __name__ == "__main__":
    unittest.main()
