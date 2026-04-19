# Fleet Event Schemas

This document captures the versioned event contracts introduced for issue `#3`.

## Schema version

- Current version: `2026-04-18`
- Envelope fields on every event:
  - `event_id`
  - `schema_version`
  - `fleet_id`
  - `published_at`
  - `producer`
  - `event_type`
  - `payload`

## Event types

### `telemetry.update.v1`

- Purpose: driver/truck movement, speed, HOS, and status snapshots.
- Payload:
  - `driver_id`
  - `status`
  - `city`
  - `state`
  - `speed_mph`
  - `drive_remaining_hrs`
  - `heading`

### `hos.threshold_warning.v1`

- Purpose: alert when a driver nears a dispatch threshold.
- Payload:
  - `driver_id`
  - `drive_remaining_hrs`
  - `threshold_hrs`
  - `severity`

### `route.deviation_detected.v1`

- Purpose: route corridor drift or off-plan movement.
- Payload:
  - `assignment_id`
  - `driver_id`
  - `deviation_miles`
  - `corridor`

### `card.transaction_recorded.v1`

- Purpose: fuel, toll, lodging, or roadside spend ingestion.
- Payload:
  - `driver_id`
  - `truck_id`
  - `merchant`
  - `amount_usd`
  - `category`

### `driver.check_in_received.v1`

- Purpose: check-ins from mobile, telematics, or dispatcher workflows.
- Payload:
  - `driver_id`
  - `truck_id`
  - `source`
  - `note`

### `breakdown.reported.v1`

- Purpose: operational incident or maintenance stop.
- Payload:
  - `driver_id`
  - `truck_id`
  - `severity`
  - `summary`

### `assignment.decision_made.v1`

- Purpose: dispatch evaluation output for a new load.
- Payload:
  - `pickup`
  - `destination`
  - `cargo`
  - `weight_lbs`
  - `eligible_driver_ids`
  - `rejected_driver_ids`

### `receiver.notification_sent.v1`

- Purpose: downstream receiver communication tracking.
- Payload:
  - `consignment_id`
  - `channel`
  - `recipient`
  - `status`

## Job processing model

- Publisher boundary: `backend/app/services/event_bus.py`
- Consumer registration: `backend/app/services/event_consumers.py`
- Observability route: `GET /events/jobs`
- Manual retry route: `POST /events/jobs/{job_id}/retry`

## Failure handling

- Jobs are processed asynchronously by an in-process worker.
- Failures retry up to 3 times with backoff.
- Exhausted jobs move to a dead-letter list.
- Dead-letter jobs remain visible through `/events/jobs` and can be retried manually.
