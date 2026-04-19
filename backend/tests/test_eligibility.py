import unittest

from app.data.mock_seed import MOCK_DRIVERS
from app.models.driver import Driver
from app.services.eligibility import evaluate_driver_for_load


class EligibilityTests(unittest.TestCase):
    def setUp(self):
        self.drivers = {row["driver_id"]: Driver(**row) for row in MOCK_DRIVERS}

    def test_refrigerated_load_rejects_non_reefer_truck(self):
        result = evaluate_driver_for_load(
            self.drivers["DRV003"],
            pickup="Denver, CO",
            destination="Kansas City, MO",
            cargo="Refrigerated produce",
            weight_lbs=22000,
        )

        self.assertFalse(result.eligible)
        self.assertIn("Load requires refrigerated equipment.", result.reasons)

    def test_hazmat_load_accepts_qualified_ready_driver(self):
        result = evaluate_driver_for_load(
            self.drivers["DRV003"],
            pickup="Denver, CO",
            destination="Albuquerque, NM",
            cargo="Hazmat cleaning supplies",
            weight_lbs=18000,
        )

        self.assertTrue(result.eligible)
        self.assertEqual(result.reasons, [])

    def test_heavy_load_rejects_under_capacity_driver(self):
        result = evaluate_driver_for_load(
            self.drivers["DRV005"],
            pickup="Seattle, WA",
            destination="Portland, OR",
            cargo="Steel coils",
            weight_lbs=50000,
        )

        self.assertFalse(result.eligible)
        self.assertTrue(
            any("Truck capacity" in reason for reason in result.reasons),
            result.reasons,
        )


if __name__ == "__main__":
    unittest.main()
