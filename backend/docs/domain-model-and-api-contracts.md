# Domain Model And API Contracts

This document is the blueprint for moving Sauron from mock snapshot reads to persistent fleet operations data in InsForge/Postgres.

## Why InsForge matters here

InsForge is the managed backend layer for this project:

- PostgreSQL stores persistent operational records.
- Edge Functions run backend workflows and AI-assisted operations.
- The frontend and automations can query the same durable data model instead of local mock snapshots.

For this issue, InsForge is where the persistent storage layer should live. The FastAPI app can still be used for local development, but the source of truth for historical dispatch and in-transit operations should be Postgres.

## Domain entities

The canonical Python domain models live in [backend/app/models/domain.py](../app/models/domain.py).

Primary entities:

- `DispatcherProfile`
- `DriverProfile`
- `DriverCertification`
- `TruckProfile`
- `Consignment`
- `Assignment`
- `RoutePlan`
- `InTransitEvent`
- `CheckInEvent`
- `RoadsideIncident`
- `ReceiverNotification`
- `ReconciliationEvent`

## Storage model

Recommended Postgres tables:

| Table | Purpose | Key relationships |
|---|---|---|
| `dispatchers` | Dispatcher user/operator profile | `fleet_id` |
| `drivers` | Persistent driver profile and current status | `dispatcher_id`, `fleet_id` |
| `driver_certifications` | CDL, hazmat, tanker, TWIC, etc. | `driver_id`, `fleet_id` |
| `trucks` | Persistent truck/unit profile | `current_driver_id`, `fleet_id` |
| `consignments` | Load/shipment record and business lifecycle | `assigned_driver_id`, `assigned_truck_id`, `current_assignment_id`, `fleet_id` |
| `assignments` | Dispatcher decision linking driver, truck, and consignment | `dispatcher_id`, `driver_id`, `truck_id`, `consignment_id`, `fleet_id` |
| `route_plans` | Planned route metadata for an assignment | `assignment_id`, `fleet_id` |
| `route_plan_stops` | Ordered stops for a route plan | `route_plan_id` |
| `in_transit_events` | Operational timeline events while moving a load | `assignment_id`, `consignment_id`, `driver_id`, `truck_id`, `fleet_id` |
| `check_in_events` | Driver or truck check-ins | `driver_id`, `truck_id`, `assignment_id`, `fleet_id` |
| `roadside_incidents` | Breakdowns, delays, compliance issues, accidents | `assignment_id`, `consignment_id`, `driver_id`, `truck_id`, `fleet_id` |
| `receiver_notifications` | Notification audit log to receiver | `consignment_id`, `assignment_id`, `fleet_id` |
| `reconciliation_events` | Post-run financial or operational reconciliation | `consignment_id`, `assignment_id`, `fleet_id` |

## Relationship rules

- One dispatcher manages many drivers and assignments.
- One driver can have many certifications.
- One driver can have many assignments over time, but at most one active assignment at once.
- One truck can have many assignments over time, but at most one active assignment at once.
- One consignment can have many events over time and typically one current assignment.
- One assignment belongs to exactly one dispatcher, driver, truck, and consignment.
- One assignment can have many in-transit events, check-ins, incidents, notifications, and reconciliation events.
- One route plan belongs to one assignment and can have many ordered stops.

## Common table fields

Every persistent table should include:

- `id` or domain-specific public id
- `fleet_id`
- `created_at`
- `updated_at`

Operational timeline tables should also include:

- a domain event timestamp such as `occurred_at`, `checked_in_at`, `sent_at`, or `event_date`

Dispatch-facing consignment fields should also include:

- `pickup_window_start_at`
- `pickup_window_end_at`
- `delivery_window_start_at`
- `delivery_window_end_at`
- `cargo_class`
- `weight_lbs`
- `special_handling`
- `receiver_contact_preferences`

## State machines

Driver states:

- `available`
- `driving`
- `off_duty`
- `unavailable`
- `breakdown`

Consignment states:

- `unassigned`
- `assigned`
- `dispatched`
- `in_transit`
- `delayed`
- `delivered`
- `exception`

Transition helpers are already defined in [backend/app/models/domain.py](../app/models/domain.py).

## Query requirements

To satisfy the issue acceptance criteria, storage must support:

- query by `fleet_id`
- query by date range
- query a single dispatch day for board workflows
- query active vs historical assignments
- query event history for a consignment, driver, or truck
- query `status = unassigned` consignments for auto-dispatch

Recommended indexes:

- `(fleet_id, created_at)` on major profile tables
- `(fleet_id, status)` on `drivers`, `consignments`, `assignments`
- `(fleet_id, occurred_at)` on `in_transit_events`
- `(fleet_id, checked_in_at)` on `check_in_events`
- `(fleet_id, event_date)` on `reconciliation_events`
- `(assignment_id)` and `(consignment_id)` on event tables

## Mock seed migration mapping

Current mock source: [backend/app/data/mock_seed.py](../app/data/mock_seed.py)

Mapping from current mock driver snapshot to persistent entities:

| Mock field | New table | Notes |
|---|---|---|
| `driver_id`, `name`, `status` | `drivers` | Split `name` into `first_name` / `last_name` if possible |
| `truck_number` | `trucks` | Create one truck row per mock driver vehicle |
| `location` | `drivers.last_known_location` and optionally `trucks.last_known_location` | Keep latest state on profile, history in events/check-ins |
| `hos` | `drivers` or a future `driver_hours_snapshots` table | For now, keep latest HOS on profile if needed |
| `vehicle.*` | `trucks` | `vehicle_id` becomes truck public id or external reference |
| `economics.*` | `reconciliation_events` or future KPI snapshot table | Better as time-based history than profile columns |
| `current_load.*` | `consignments` + `assignments` | Create assigned or in-transit records based on driver status |

Seed migration rules:

- Drivers with `current_load = null` and status `idle` should become `drivers.status = available`.
- Drivers with `current_load != null` and status `driving` should produce:
  - a `consignments` row
  - an `assignments` row
  - a `route_plans` row placeholder
  - at least one `in_transit_events` row representing the current movement snapshot
- Drivers with `off_duty` remain historical assets without active assignment.

## API contract guidance

The current FastAPI endpoints are snapshot-oriented:

- [backend/app/routers/fleet.py](../app/routers/fleet.py)
- [backend/app/routers/dispatch.py](../app/routers/dispatch.py)
- [backend/app/routers/simulate.py](../app/routers/simulate.py)

For downstream frontend and automation work, keep the response envelope consistent:

```json
{
  "data": {},
  "timestamp": "2026-04-18T12:00:00Z",
  "source": "insforge"
}
```

Collection responses may also include:

```json
{
  "count": 0,
  "fleet_id": "fleet_demo"
}
```

## Proposed persistent read endpoints

These are documentation targets for the next steps, not implemented yet.

### Fleet driver history

`GET /fleet/drivers?fleet_id={fleet_id}&as_of={timestamp}`

Response:

```json
{
  "data": [
    {
      "driver_id": "DRV001",
      "status": "driving",
      "current_assignment_id": "ASN001",
      "truck_id": "TRK001",
      "last_check_in_at": "2026-04-18T11:45:00Z"
    }
  ],
  "count": 1,
  "fleet_id": "fleet_demo",
  "source": "insforge",
  "timestamp": "2026-04-18T12:00:00Z"
}
```

### Consignment list by status and date

`GET /operations/consignments?fleet_id={fleet_id}&status={status}&from={timestamp}&to={timestamp}`

For day-based dispatch workflows, the API should also accept:

`GET /operations/consignments?fleet_id={fleet_id}&dispatch_date=2026-04-18`

### Consignment CRUD

- `GET /operations/consignments/{consignment_id}?fleet_id={fleet_id}`
- `POST /operations/consignments`
- `PATCH /operations/consignments/{consignment_id}?fleet_id={fleet_id}`
- `DELETE /operations/consignments/{consignment_id}?fleet_id={fleet_id}`

Create and update payloads should support:

- pickup and delivery windows
- cargo class
- weight
- special handling
- receiver contact preferences

### Assignment history

`GET /operations/assignments?fleet_id={fleet_id}&from={timestamp}&to={timestamp}`

### Event timeline for a consignment

`GET /operations/consignments/{consignment_id}/events?fleet_id={fleet_id}`

Response:

```json
{
  "data": {
    "consignment_id": "CON001",
    "status": "in_transit",
    "events": [
      {
        "event_type": "departed_pickup",
        "occurred_at": "2026-04-18T09:00:00Z"
      },
      {
        "event_type": "delay_reported",
        "occurred_at": "2026-04-18T10:35:00Z"
      }
    ]
  },
  "fleet_id": "fleet_demo",
  "source": "insforge",
  "timestamp": "2026-04-18T12:00:00Z"
}
```

## Non-goals for this step

- No database tables created yet
- No FastAPI endpoint behavior changed yet
- No Edge Functions changed yet

This step is documentation only so the next implementation step can create the InsForge schema with less rework.
