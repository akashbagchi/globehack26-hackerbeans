import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app


class OperationsRouterTests(unittest.TestCase):
    def setUp(self):
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

        with patch(
            "app.routers.operations.list_assignments",
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

        with patch(
            "app.routers.operations.list_consignments",
            new=AsyncMock(return_value=mocked_rows),
        ) as mock_list_consignments:
            response = self.client.get(
                "/operations/consignments",
                params={
                    "fleet_id": "fleet_demo",
                    "status": "in_transit",
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

    def test_consignment_timeline_returns_404_when_not_found(self):
        with patch(
            "app.routers.operations.get_consignment_timeline",
            new=AsyncMock(return_value=None),
        ):
            response = self.client.get(
                "/operations/consignments/CON404/events",
                params={"fleet_id": "fleet_demo"},
            )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Consignment not found")


if __name__ == "__main__":
    unittest.main()
