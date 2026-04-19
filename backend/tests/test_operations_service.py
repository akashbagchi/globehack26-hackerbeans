import unittest
from datetime import date
from unittest.mock import AsyncMock, patch

from app.models.domain import ConsignmentCreate, ConsignmentUpdate, ConsignmentStatus
from app.services.operations import (
    OperationsServiceConflict,
    create_assignment,
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

    async def test_create_assignment_creates_receiver_notifications(self):
        consignment = {
            "consignment_id": "CON001",
            "fleet_id": "fleet_demo",
            "receiver_name": "Mock Receiver",
            "destination": "Dallas, TX",
            "assigned_driver_id": "DRV001",
            "current_assignment_id": "ASN001",
            "receiver_contact_preferences": [
                {"channel": "sms", "recipient": "+15555550101", "priority": 1}
            ],
            "promised_delivery_at": "2026-04-19T18:00:00Z",
        }

        with patch(
            "app.services.operations._mutate_records",
            new=AsyncMock(return_value=[{"assignment_id": "ASN001", "fleet_id": "fleet_demo"}]),
        ), patch(
            "app.services.operations.get_consignment",
            new=AsyncMock(return_value=consignment),
        ), patch(
            "app.services.operations.create_receiver_notifications",
            new=AsyncMock(return_value=[]),
        ) as mock_notifications:
            await create_assignment(
                fleet_id="fleet_demo",
                consignment_id="CON001",
                dispatcher_id="DISP001",
                driver_id="DRV001",
                truck_id="TRK001",
            )

        mock_notifications.assert_awaited_once()
        self.assertEqual(
            mock_notifications.await_args.kwargs["notification_type"],
            "assignment_confirmed",
        )

    async def test_update_consignment_emits_status_and_eta_notifications(self):
        existing = {
            "consignment_id": "CON001",
            "fleet_id": "fleet_demo",
            "status": "in_transit",
            "promised_delivery_at": "2026-04-19T17:00:00Z",
            "receiver_contact_preferences": [
                {"channel": "sms", "recipient": "+15555550101", "priority": 1}
            ],
        }
        updated = {
            **existing,
            "status": "delayed",
            "promised_delivery_at": "2026-04-19T19:15:00Z",
        }

        with patch(
            "app.services.operations.get_consignment",
            new=AsyncMock(side_effect=[existing, updated]),
        ), patch(
            "app.services.operations._mutate_records",
            new=AsyncMock(return_value=[updated]),
        ), patch(
            "app.services.operations.create_receiver_notifications",
            new=AsyncMock(return_value=[]),
        ) as mock_notifications:
            await update_consignment(
                fleet_id="fleet_demo",
                consignment_id="CON001",
                payload=ConsignmentUpdate(
                    status=ConsignmentStatus.delayed,
                    promised_delivery_at="2026-04-19T19:15:00Z",
                ),
            )

        self.assertEqual(mock_notifications.await_count, 2)
        notification_types = [
            call.kwargs["notification_type"] for call in mock_notifications.await_args_list
        ]
        self.assertEqual(notification_types, ["delay_alert", "eta_updated"])


if __name__ == "__main__":
    unittest.main()
