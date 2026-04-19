import asyncio
import unittest

from app.models.events import AssignmentDecisionEvent, AssignmentDecisionPayload
from app.services.event_bus import FleetEventBus


class EventBusTests(unittest.IsolatedAsyncioTestCase):
    async def test_event_bus_processes_jobs(self):
        bus = FleetEventBus()
        seen: list[str] = []

        async def handler(event):
            seen.append(event.event_id)

        bus.register_handler("assignment.decision_made.v1", handler)
        await bus.start()

        await bus.publish(
            AssignmentDecisionEvent(
                producer="test",
                payload=AssignmentDecisionPayload(
                    pickup="Chicago, IL",
                    destination="Dallas, TX",
                    cargo="Electronics",
                    weight_lbs=20000,
                ),
            )
        )
        await asyncio.wait_for(bus._queue.join(), timeout=1)
        snapshot = bus.snapshot()
        await bus.stop()

        self.assertEqual(len(seen), 1)
        self.assertEqual(snapshot["processed_jobs"], 1)
        self.assertEqual(snapshot["dead_letter_count"], 0)

    async def test_failed_jobs_can_be_retried_from_dead_letter(self):
        bus = FleetEventBus(max_retries=1)
        calls = 0

        async def failing_handler(event):
            nonlocal calls
            calls += 1
            raise RuntimeError("boom")

        bus.register_handler("assignment.decision_made.v1", failing_handler)
        await bus.start()
        job_id = await bus.publish(
            AssignmentDecisionEvent(
                producer="test",
                payload=AssignmentDecisionPayload(
                    pickup="Chicago, IL",
                    destination="Dallas, TX",
                    cargo="Electronics",
                    weight_lbs=20000,
                ),
            )
        )
        await asyncio.wait_for(bus._queue.join(), timeout=1)
        snapshot = bus.snapshot()

        self.assertEqual(snapshot["dead_letter_count"], 1)
        self.assertEqual(calls, 1)

        bus._handlers["assignment.decision_made.v1"] = [lambda event: asyncio.sleep(0)]
        self.assertTrue(await bus.retry_dead_letter(job_id))
        await asyncio.wait_for(bus._queue.join(), timeout=1)
        retry_snapshot = bus.snapshot()
        await bus.stop()

        self.assertEqual(retry_snapshot["dead_letter_count"], 0)
        self.assertEqual(retry_snapshot["processed_jobs"], 1)


if __name__ == "__main__":
    unittest.main()
