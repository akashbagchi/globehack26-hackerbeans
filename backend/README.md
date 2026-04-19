# Backend — InsForge

No local server. The backend is InsForge (managed PostgreSQL + Edge Functions).

**Project:** GlobeHack 26  
**OSS host:** `https://hy28h59d.us-east.insforge.app`  
**Functions host:** `https://hy28h59d.functions.insforge.app`

## Setup

```bash
# Authenticate (one-time)
npx @insforge/cli login

# Verify you're linked to the right project
npx @insforge/cli current
```

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

## Debugging

```bash
npx @insforge/cli logs function.logs --limit 30   # function errors
npx @insforge/cli logs postgres.logs              # DB errors
npx @insforge/cli diagnose                        # full health report
```

## Database

One table: `drivers` — 8 rows, JSONB columns for `location`, `hos`, `vehicle`, `economics`, `current_load`.  
Public read via RLS. No writes from the frontend.

## AI

Routed through InsForge → OpenRouter → `anthropic/claude-sonnet-4.5`.  
No Anthropic API key needed — configured in the InsForge dashboard.
