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

    def test_get_consignment_notifications_returns_history(self):
        mocked_row = {
            "consignment_id": "CON001",
            "fleet_id": "fleet_demo",
            "status": "in_transit",
        }
        mocked_notifications = [
            {
                "receiver_notification_id": "RNT001",
                "consignment_id": "CON001",
                "notification_type": "eta_updated",
                "delivery_status": "sent",
            }
        ]

        with patch.object(
            operations_module,
            "get_consignment",
            new=AsyncMock(return_value=mocked_row),
        ), patch.object(
            operations_module,
            "list_receiver_notifications",
            new=AsyncMock(return_value=mocked_notifications),
        ):
            response = self.client.get(
                "/operations/consignments/CON001/notifications",
                params={"fleet_id": "fleet_demo"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["data"][0]["receiver_notification_id"], "RNT001")

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
