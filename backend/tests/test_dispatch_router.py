import unittest
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


if __name__ == "__main__":
    unittest.main()
