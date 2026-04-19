import unittest
from dataclasses import dataclass
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

dispatch_path = Path(__file__).resolve().parents[1] / "app" / "routers" / "dispatch.py"
dispatch_spec = spec_from_file_location("dispatch_router_module", dispatch_path)
dispatch_module = module_from_spec(dispatch_spec)
assert dispatch_spec is not None and dispatch_spec.loader is not None
dispatch_spec.loader.exec_module(dispatch_module)
dispatch_router = dispatch_module.router


class DispatchRouterTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.state.limiter = dispatch_module.limiter
        app.include_router(dispatch_router)
        self.client = TestClient(app)

    def test_recommend_dispatch_can_include_historical_signals(self):
        driver = type(
            "DriverStub",
            (),
            {
                "driver_id": "DRV001",
                "name": "Marcus Webb",
            },
        )()
        evaluation = type("EligibilityStub", (), {"eligible": True, "driver": driver})()
        historical_report = type(
            "HistoryStub",
            (),
            {"model_dump": lambda self, mode="json": {"lane_assignment_count": 4, "driver_signals": []}},
        )()
        scoring_result = type(
            "ScoringResultStub",
            (),
            {"model_dump": lambda self: {"recommendations": [], "dispatch_note": "ok"}},
        )()

        with patch.object(dispatch_module, "get_drivers", new=AsyncMock(return_value=([driver], "mock"))), patch.object(
            dispatch_module,
            "evaluate_driver_for_load",
            return_value=evaluation,
        ), patch.object(
            dispatch_module,
            "build_dispatch_scoring_signals",
            new=AsyncMock(return_value=historical_report),
        ) as mock_signals, patch.object(
            dispatch_module,
            "score_drivers",
            return_value=scoring_result,
        ) as mock_score:
            response = self.client.post(
                "/dispatch/recommend",
                params={"fleet_id": "fleet_demo", "include_historical_signals": "true"},
                json={
                    "pickup": "Phoenix, AZ",
                    "destination": "Los Angeles, CA",
                    "cargo": "Auto Parts",
                    "weight_lbs": 12000,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["historical_signals"]["lane_assignment_count"], 4)
        mock_signals.assert_awaited_once()
        self.assertIs(mock_score.call_args.kwargs["historical_signals"], historical_report)

    def test_orchestrate_dispatch_returns_orchestration_summary(self):
        @dataclass
        class OrchestrationResultStub:
            fleet_id: str
            dispatch_date: str
            total_consignments: int
            auto_assigned: int
            needs_review: int
            no_match: int
            plans: list[dict]
            drivers_used: list[str]

        orchestration_result = OrchestrationResultStub(
            fleet_id="fleet_demo",
            dispatch_date="2026-04-19",
            total_consignments=3,
            auto_assigned=2,
            needs_review=1,
            no_match=0,
            plans=[],
            drivers_used=["DRV001", "DRV002"],
        )

        with patch.object(
            dispatch_module,
            "orchestrate_daily_dispatch",
            new=AsyncMock(return_value=orchestration_result),
        ) as mock_orchestrate:
            response = self.client.post(
                "/dispatch/orchestrate",
                json={
                    "fleet_id": "fleet_demo",
                    "dispatch_date": "2026-04-19",
                    "dispatcher_id": "DSP001",
                    "auto_assign_threshold": 75,
                    "review_threshold": 55,
                    "dry_run": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["data"]["fleet_id"], "fleet_demo")
        self.assertEqual(body["data"]["auto_assigned"], 2)
        self.assertEqual(body["data"]["drivers_used"], ["DRV001", "DRV002"])
        mock_orchestrate.assert_awaited_once()
        kwargs = mock_orchestrate.await_args.kwargs
        self.assertEqual(kwargs["fleet_id"], "fleet_demo")
        self.assertEqual(kwargs["dispatcher_id"], "DSP001")
        self.assertEqual(kwargs["auto_assign_threshold"], 75)
        self.assertEqual(kwargs["review_threshold"], 55)
        self.assertTrue(kwargs["dry_run"])


if __name__ == "__main__":
    unittest.main()
