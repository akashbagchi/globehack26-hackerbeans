import unittest
from datetime import date
from unittest.mock import AsyncMock, patch

from app.models.domain import ConsignmentCreate, ConsignmentUpdate, ConsignmentStatus
from app.services.operations import (
    OperationsServiceConflict,
    create_consignment,
    list_consignments,
    update_consignment,
)


class OperationsServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_list_consignments_filters_by_dispatch_date_using_pickup_window(self):
        mocked_rows = [
            {
                "consignment_id": "CON001",
                "fleet_id": "fleet_demo",
                "status": "unassigned",
                "pickup_window_start_at": "2026-04-18T08:00:00Z",
                "requested_pickup_at": "2026-04-17T18:00:00Z",
                "created_at": "2026-04-17T12:00:00Z",
            },
            {
                "consignment_id": "CON002",
                "fleet_id": "fleet_demo",
                "status": "unassigned",
                "pickup_window_start_at": "2026-04-19T08:00:00Z",
                "requested_pickup_at": "2026-04-19T08:00:00Z",
                "created_at": "2026-04-18T12:00:00Z",
            },
        ]

        with patch(
            "app.services.operations._fetch_records",
            new=AsyncMock(return_value=mocked_rows),
        ):
            consignments = await list_consignments(
                fleet_id="fleet_demo",
                status="unassigned",
                dispatch_date=date(2026, 4, 18),
            )

        self.assertEqual(len(consignments), 1)
        self.assertEqual(consignments[0]["consignment_id"], "CON001")

    async def test_create_consignment_flattens_dispatch_requirement_fields(self):
        payload = ConsignmentCreate(
            fleet_id="fleet_demo",
            shipper_name="Mock Shipper",
            receiver_name="Mock Receiver",
            origin="Phoenix, AZ",
            destination="Las Vegas, NV",
            cargo_description="Medical Supplies",
            weight_lbs=12000,
            pickup_window={"start_at": "2026-04-18T08:00:00Z", "end_at": "2026-04-18T10:00:00Z"},
            delivery_window={"start_at": "2026-04-18T16:00:00Z", "end_at": "2026-04-18T18:00:00Z"},
            status=ConsignmentStatus.unassigned,
        )

        with patch(
            "app.services.operations._mutate_records",
            new=AsyncMock(return_value=[{"consignment_id": "CONNEW1", "fleet_id": "fleet_demo"}]),
        ) as mock_mutate:
            consignment = await create_consignment(payload)

        self.assertEqual(consignment["consignment_id"], "CONNEW1")
        sent_payload = mock_mutate.await_args.kwargs["json_body"][0]
        self.assertEqual(sent_payload["pickup_window_start_at"], "2026-04-18T08:00:00Z")
        self.assertEqual(sent_payload["delivery_window_end_at"], "2026-04-18T18:00:00Z")

    async def test_update_consignment_rejects_invalid_status_transition(self):
        with patch(
            "app.services.operations.get_consignment",
            new=AsyncMock(
                return_value={
                    "consignment_id": "CON001",
                    "fleet_id": "fleet_demo",
                    "status": "in_transit",
                }
            ),
        ):
            with self.assertRaises(OperationsServiceConflict):
                await update_consignment(
                    fleet_id="fleet_demo",
                    consignment_id="CON001",
                    payload=ConsignmentUpdate(status=ConsignmentStatus.unassigned),
                )


if __name__ == "__main__":
    unittest.main()
