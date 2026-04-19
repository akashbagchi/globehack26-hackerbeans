from datetime import datetime, timezone
import unittest
from unittest.mock import AsyncMock, patch

from app.models.domain import (
    ShipmentInterventionOutreachUpdate,
    ShipmentInterventionRoadsideUpdate,
    ShipmentInterventionRerouteUpdate,
    ShipmentInterventionStatus,
)
from app.models.events import (
    BreakdownEvent,
    BreakdownPayload,
    HOSThresholdWarningEvent,
    HOSThresholdWarningPayload,
    OperationalExceptionEvent,
    OperationalExceptionPayload,
    RouteDeviationEvent,
    RouteDeviationPayload,
)
from app.services.interventions import (
    apply_intervention_reroute,
    create_hos_risk_intervention,
    create_operational_exception_intervention,
    create_breakdown_intervention,
    create_route_deviation_intervention,
    record_intervention_outreach,
    update_roadside_assistance,
)


class InterventionServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_route_deviation_creates_in_transit_event_and_intervention(self):
        assignment = {
            "assignment_id": "ASN001",
            "consignment_id": "CON001",
            "driver_id": "DRV001",
            "truck_id": "TRK001",
        }
        consignment = {
            "consignment_id": "CON001",
            "fleet_id": "fleet_demo",
            "promised_delivery_at": "2026-04-19T19:00:00Z",
        }
        created_intervention = {
            "shipment_intervention_id": "INT001",
            "category": "route_deviation",
            "status": "action_required",
        }

        with patch(
            "app.services.interventions._fetch_records",
            new=AsyncMock(side_effect=[[assignment], []]),
        ) as mock_fetch, patch(
            "app.services.interventions.get_consignment",
            new=AsyncMock(return_value=consignment),
        ), patch(
            "app.services.interventions._mutate_records",
            new=AsyncMock(side_effect=[None, [created_intervention]]),
        ) as mock_mutate:
            intervention = await create_route_deviation_intervention(
                RouteDeviationEvent(
                    fleet_id="fleet_demo",
                    producer="test",
                    payload=RouteDeviationPayload(
                        assignment_id="ASN001",
                        driver_id="DRV001",
                        deviation_miles=18.2,
                        corridor="I-10 W",
                        severity="major",
                        lat=33.4,
                        lng=-112.0,
                    ),
                )
            )

        self.assertEqual(intervention["shipment_intervention_id"], "INT001")
        self.assertEqual(mock_fetch.await_count, 2)
        self.assertEqual(mock_mutate.await_count, 2)
        in_transit_call = mock_mutate.await_args_list[0]
        self.assertEqual(in_transit_call.args[1], "in_transit_events")
        intervention_call = mock_mutate.await_args_list[1]
        payload = intervention_call.kwargs["json_body"][0]
        self.assertEqual(payload["category"], "route_deviation")
        self.assertEqual(payload["status"], "action_required")
        self.assertEqual(payload["dispatcher_cta"]["primary_action"], "contact_driver")

    async def test_breakdown_creates_roadside_incident_and_intervention(self):
        assignment = {
            "assignment_id": "ASN009",
            "consignment_id": "CON009",
            "driver_id": "DRV009",
            "truck_id": "TRK009",
        }
        consignment = {
            "consignment_id": "CON009",
            "fleet_id": "fleet_demo",
            "assigned_truck_id": "TRK009",
        }
        created_intervention = {
            "shipment_intervention_id": "INT009",
            "category": "breakdown",
            "status": "action_required",
        }

        with patch(
            "app.services.interventions._fetch_records",
            new=AsyncMock(side_effect=[[assignment], []]),
        ), patch(
            "app.services.interventions.get_consignment",
            new=AsyncMock(return_value=consignment),
        ), patch(
            "app.services.interventions._mutate_records",
            new=AsyncMock(side_effect=[None, [created_intervention]]),
        ) as mock_mutate:
            intervention = await create_breakdown_intervention(
                BreakdownEvent(
                    fleet_id="fleet_demo",
                    producer="test",
                    payload=BreakdownPayload(
                        driver_id="DRV009",
                        truck_id="TRK009",
                        severity="critical",
                        summary="Engine failure outside Amarillo",
                    ),
                )
            )

        self.assertEqual(intervention["shipment_intervention_id"], "INT009")
        self.assertEqual(mock_mutate.await_count, 2)
        incident_call = mock_mutate.await_args_list[0]
        self.assertEqual(incident_call.args[1], "roadside_incidents")
        intervention_call = mock_mutate.await_args_list[1]
        payload = intervention_call.kwargs["json_body"][0]
        self.assertEqual(payload["category"], "breakdown")
        self.assertEqual(payload["severity"], "critical")
        self.assertEqual(
            payload["dispatcher_cta"]["secondary_action"],
            "start_roadside_assistance",
        )

    async def test_record_intervention_outreach_creates_action_and_updates_intervention(self):
        intervention = {
            "shipment_intervention_id": "INT001",
            "fleet_id": "fleet_demo",
            "status": "action_required",
            "details": {},
        }
        updated_intervention = {
            **intervention,
            "status": "open",
        }

        with patch(
            "app.services.interventions.get_shipment_intervention",
            new=AsyncMock(return_value=intervention),
        ), patch(
            "app.services.interventions._mutate_records",
            new=AsyncMock(side_effect=[[{"shipment_intervention_action_id": "INA001"}], [updated_intervention]]),
        ) as mock_mutate:
            result = await record_intervention_outreach(
                fleet_id="fleet_demo",
                shipment_intervention_id="INT001",
                payload=ShipmentInterventionOutreachUpdate(
                    dispatcher_id="DSP001",
                    contact_status="reached_driver",
                    reason="Driver confirmed a construction detour",
                    notes="Holding for ETA recalculation",
                    intervention_status=ShipmentInterventionStatus.open,
                ),
            )

        self.assertEqual(result["action"]["shipment_intervention_action_id"], "INA001")
        self.assertEqual(mock_mutate.await_count, 2)
        action_payload = mock_mutate.await_args_list[0].kwargs["json_body"][0]
        self.assertEqual(action_payload["action_type"], "dispatcher_outreach")
        self.assertEqual(action_payload["action_status"], "reached_driver")

    async def test_apply_intervention_reroute_updates_route_plan_consignment_and_history(self):
        intervention = {
            "shipment_intervention_id": "INT001",
            "fleet_id": "fleet_demo",
            "assignment_id": "ASN001",
            "consignment_id": "CON001",
            "driver_id": "DRV001",
            "truck_id": "TRK001",
            "status": "action_required",
            "recommended_route_action": {"action": "evaluate_reroute"},
            "details": {},
        }
        route_plan = {"route_plan_id": "RTE001", "assignment_id": "ASN001"}
        consignment = {
            "consignment_id": "CON001",
            "promised_delivery_at": "2026-04-19T18:00:00Z",
        }
        updated_consignment = {
            **consignment,
            "status": "delayed",
            "promised_delivery_at": "2026-04-19T19:30:00Z",
        }
        updated_intervention = {
            **intervention,
            "status": "resolved",
        }

        with patch(
            "app.services.interventions.get_shipment_intervention",
            new=AsyncMock(return_value=intervention),
        ), patch(
            "app.services.interventions._fetch_records",
            new=AsyncMock(return_value=[route_plan]),
        ) as mock_fetch, patch(
            "app.services.interventions.get_consignment",
            new=AsyncMock(return_value=consignment),
        ), patch(
            "app.services.interventions.update_consignment",
            new=AsyncMock(return_value=updated_consignment),
        ), patch(
            "app.services.interventions._mutate_records",
            new=AsyncMock(
                side_effect=[
                    [route_plan],
                    None,
                    [{"shipment_intervention_action_id": "INA002"}],
                    [updated_intervention],
                ]
            ),
        ) as mock_mutate:
            result = await apply_intervention_reroute(
                fleet_id="fleet_demo",
                shipment_intervention_id="INT001",
                payload=ShipmentInterventionRerouteUpdate(
                    dispatcher_id="DSP001",
                    reason="Construction closure requires alternate lane",
                    updated_eta_at=datetime(2026, 4, 19, 19, 30, tzinfo=timezone.utc),
                ),
            )

        self.assertEqual(result["action"]["shipment_intervention_action_id"], "INA002")
        self.assertEqual(result["consignment"]["status"], "delayed")
        self.assertEqual(mock_fetch.await_args.args[1]["assignment_id"], "eq.ASN001")
        self.assertEqual(mock_mutate.await_count, 4)
        reroute_action_payload = mock_mutate.await_args_list[2].kwargs["json_body"][0]
        self.assertEqual(reroute_action_payload["action_type"], "reroute_applied")

    async def test_hos_risk_creates_intervention(self):
        assignment = {
            "assignment_id": "ASN010",
            "consignment_id": "CON010",
            "driver_id": "DRV010",
            "truck_id": "TRK010",
        }
        consignment = {"consignment_id": "CON010", "promised_delivery_at": "2026-04-19T18:00:00Z"}
        created_intervention = {"shipment_intervention_id": "INT010", "category": "hos_risk"}

        with patch(
            "app.services.interventions._fetch_records",
            new=AsyncMock(side_effect=[[assignment], []]),
        ), patch(
            "app.services.interventions.get_consignment",
            new=AsyncMock(return_value=consignment),
        ), patch(
            "app.services.interventions._mutate_records",
            new=AsyncMock(return_value=[created_intervention]),
        ):
            result = await create_hos_risk_intervention(
                HOSThresholdWarningEvent(
                    fleet_id="fleet_demo",
                    producer="test",
                    payload=HOSThresholdWarningPayload(
                        driver_id="DRV010",
                        drive_remaining_hrs=0.8,
                        threshold_hrs=2.0,
                        severity="critical",
                    ),
                )
            )

        self.assertEqual(result["category"], "hos_risk")

    async def test_operational_exception_auto_apply_returns_reroute_result(self):
        assignment = {
            "assignment_id": "ASN011",
            "consignment_id": "CON011",
            "driver_id": "DRV011",
            "truck_id": "TRK011",
        }
        consignment = {"consignment_id": "CON011", "promised_delivery_at": "2026-04-19T18:00:00Z"}
        intervention = {"shipment_intervention_id": "INT011"}

        with patch(
            "app.services.interventions._fetch_records",
            new=AsyncMock(side_effect=[[assignment], []]),
        ), patch(
            "app.services.interventions.get_consignment",
            new=AsyncMock(return_value=consignment),
        ), patch(
            "app.services.interventions._mutate_records",
            new=AsyncMock(side_effect=[None, [intervention]]),
        ), patch(
            "app.services.interventions.apply_intervention_reroute",
            new=AsyncMock(return_value={"intervention": intervention, "action": {"shipment_intervention_action_id": "INA011"}}),
        ) as mock_apply:
            result = await create_operational_exception_intervention(
                OperationalExceptionEvent(
                    fleet_id="fleet_demo",
                    producer="test",
                    payload=OperationalExceptionPayload(
                        assignment_id="ASN011",
                        driver_id="DRV011",
                        category="weather",
                        severity="high",
                        summary="Snow cell on current corridor",
                        eta_shift_minutes=35,
                        policy="auto_apply_allowed",
                    ),
                )
            )

        self.assertEqual(result["action"]["shipment_intervention_action_id"], "INA011")
        mock_apply.assert_awaited_once()

    async def test_update_roadside_assistance_records_action_and_updates_incident(self):
        intervention = {
            "shipment_intervention_id": "INT012",
            "fleet_id": "fleet_demo",
            "roadside_incident_id": "RSI012",
            "status": "action_required",
            "details": {},
        }
        updated_intervention = {**intervention, "status": "resolved"}

        with patch(
            "app.services.interventions.get_shipment_intervention",
            new=AsyncMock(return_value=intervention),
        ), patch(
            "app.services.interventions._mutate_records",
            new=AsyncMock(side_effect=[[{"shipment_intervention_action_id": "INA012"}], [{"roadside_incident_id": "RSI012"}], [updated_intervention]]),
        ) as mock_mutate:
            result = await update_roadside_assistance(
                fleet_id="fleet_demo",
                shipment_intervention_id="INT012",
                payload=ShipmentInterventionRoadsideUpdate(
                    dispatcher_id="DSP001",
                    assistance_status="completed",
                    provider_name="Acme Roadside",
                    external_reference="CASE-12",
                    mark_intervention_resolved=True,
                    mark_incident_resolved=True,
                ),
            )

        self.assertEqual(result["action"]["shipment_intervention_action_id"], "INA012")
        self.assertEqual(mock_mutate.await_count, 3)


if __name__ == "__main__":
    unittest.main()
