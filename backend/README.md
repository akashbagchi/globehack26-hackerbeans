# Backend — InsForge + Local API

Sauron now uses a hybrid backend setup:

- InsForge stores persistent operational records and runs Edge Functions.
- The local FastAPI server is still used for localhost development and can read persistent data from InsForge.

**Project:** GlobeHack 26  
**OSS host:** `https://hy28h59d.us-east.insforge.app`  
**Functions host:** `https://hy28h59d.functions.insforge.app`

## Setup

```bash
# Authenticate (one-time)
npx @insforge/cli login

# Verify you're linked to the right project
npx @insforge/cli current

## Edge Functions

Source lives in `insforge/functions/<slug>/index.ts`. Deploy with:

```bash
npx @insforge/cli functions deploy dispatch-recommend
npx @insforge/cli functions deploy cost-insights
npx @insforge/cli functions deploy simulate-assignment
```

## Testing

```bash
# Check drivers are seeded
npx @insforge/cli db query "SELECT driver_id, name, status FROM drivers"

# Dispatch recommendations
npx @insforge/cli functions invoke dispatch-recommend \
  --data '{"pickup":"Chicago, IL","destination":"Dallas, TX","cargo":"Electronics","weight_lbs":20000}'

# Cost insights
npx @insforge/cli functions invoke cost-insights

# Simulate assignment
npx @insforge/cli functions invoke simulate-assignment \
  --data '{"driver_id":"DRV003","pickup":"Denver, CO","destination":"Kansas City, MO"}'
```

## Localhost Historical Queries

Start the local API:

```bash
python -m uvicorn main:app --reload --port 8000
```

Then query the persistent InsForge-backed endpoints:

```bash
curl.exe "http://localhost:8000/operations/assignments?fleet_id=fleet_demo"
curl.exe "http://localhost:8000/operations/consignments?fleet_id=fleet_demo"
curl.exe "http://localhost:8000/operations/consignments/CON001/events?fleet_id=fleet_demo"
```

Consignment management is also available locally:

```bash
curl.exe -X POST "http://localhost:8000/operations/consignments" ^
  -H "Content-Type: application/json" ^
  -d "{\"fleet_id\":\"fleet_demo\",\"shipper_name\":\"Test Shipper\",\"receiver_name\":\"Test Receiver\",\"origin\":\"Phoenix, AZ\",\"destination\":\"Las Vegas, NV\",\"cargo_description\":\"Medical Supplies\",\"weight_lbs\":12000}"
```

On Windows PowerShell, prefer `curl.exe` or `Invoke-RestMethod` instead of plain `curl` to avoid the `Invoke-WebRequest` wrapper output.

## Automated Tests

Run the lightweight router tests with:

```bash
python -m unittest tests.test_operations_router
```

## Debugging

```bash
npx @insforge/cli logs function.logs --limit 30   # function errors
npx @insforge/cli logs postgres.logs              # DB errors
npx @insforge/cli diagnose                        # full health report
```

## Database

One table: `drivers` — 8 rows, JSONB columns for `location`, `hos`, `vehicle`, `economics`, `current_load`.  
Public read via RLS. No writes from the frontend.

## Domain model planning

The staged migration plan for persistent fleet operations is documented here:

- [backend/docs/domain-model-and-api-contracts.md](./docs/domain-model-and-api-contracts.md)

That document defines:

- the new operational entities
- storage/table targets for InsForge/Postgres
- lifecycle states and relationships
- mock-to-persistent migration rules
- proposed API contracts for downstream frontend and automation work

The step 3 storage implementation notes live here:

- [backend/docs/insforge-schema-step-3.md](./docs/insforge-schema-step-3.md)

The localhost historical-query step lives here:

- `GET /operations/consignments?fleet_id=...&from=...&to=...`
- `GET /operations/assignments?fleet_id=...&from=...&to=...`
- `GET /operations/consignments/{consignment_id}/events?fleet_id=...`

Issue acceptance status:

- domain entities: implemented in backend models
- storage layer: implemented in InsForge schema and seed flow
- mock seed migration: implemented and validated
- API contracts: documented
- historical fleet/date reads: implemented on localhost against InsForge

## AI

Routed through InsForge → OpenRouter → `anthropic/claude-sonnet-4.5`.  
No Anthropic API key needed — configured in the InsForge dashboard.
