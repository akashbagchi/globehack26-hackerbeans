# Step 3: InsForge Schema And Seed Slice

This step creates the first persistent storage slice for operational dispatch data.

## What was added

- SQL schema migration: `backend/insforge/migrations/001_operational_domain_schema.sql`
- Seed SQL generator: `backend/scripts/generate_operational_seed_sql.py`

## What this step covers

- Creates persistent tables for all domain entities introduced in step 1.
- Adds indexes for fleet/date/history queries.
- Adds a repeatable script that transforms the current mock fleet snapshot into normalized SQL inserts.
- Keeps the existing legacy `drivers` table untouched so current demo functions keep working during the migration.

## What this step does not do yet

- It does not switch the existing API endpoints over to the new tables.
- It does not deploy or run the migration automatically.
- It does not backfill receiver notifications or roadside incidents, because the current mock snapshot does not contain those records.

## How to generate the seed SQL

From `backend/` run:

```powershell
@'
from scripts.generate_operational_seed_sql import build_seed_sql
print(build_seed_sql()[:1200])
'@ | .\venv\Scripts\python.exe -
```

That prints the beginning of the SQL so you can verify it looks right.

## How to apply this in InsForge

Run these from `backend/` after your project is linked:

```text
npx @insforge/cli db query "<paste contents of insforge/migrations/001_operational_domain_schema.sql>"
```

Then generate seed SQL into a file:

```powershell
.\venv\Scripts\python.exe .\scripts\generate_operational_seed_sql.py > .\insforge\migrations\001_operational_seed.sql
```

Then apply that generated file with the InsForge CLI the same way.

## Recommended verification queries

After applying the schema and seed:

```sql
select fleet_id, count(*) from drivers group by fleet_id;
select count(*) from trucks;
select count(*) from consignments;
select count(*) from assignments;
select count(*) from in_transit_events;
```

Expected seed outcome from the current mock snapshot:

- `driver_profiles`: 8
- `truck_profiles`: 8
- `assignments`: 5
- `consignments`: 5
- `in_transit_events`: 5
- `check_in_events`: 8

## Why this is useful

This gives Sauron a real operational storage foundation:

- driver/truck/load relationships become queryable
- active and historical records can coexist
- future APIs can filter by fleet and date instead of reading one big mock snapshot
