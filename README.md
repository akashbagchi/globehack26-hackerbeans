# SAURON — AI-Native Fleet Digital Twin

GlobeHack Season 1 · TruckerPath / Marketplace & Growth track

AI dispatch assistant for trucking fleets. Live driver map, Claude-powered dispatch recommendations, cost intelligence, streaming chat, and SAURON Vision for proactive fleet camera monitoring.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 + React 19 + Tailwind v4 |
| Map | Mapbox GL JS |
| State | Zustand |
| Backend | InsForge (PostgreSQL + Edge Functions) |
| AI | Claude `anthropic/claude-sonnet-4.5` via InsForge |

---

## Quick Start

### Prerequisites
- Node.js 18+, pnpm
- InsForge CLI: `npx @insforge/cli whoami` (must be logged in and project linked)
- Mapbox account (free tier)

### Frontend

```bash
cd frontend
cp .env.example .env.local
# fill in NEXT_PUBLIC_INSFORGE_URL, NEXT_PUBLIC_INSFORGE_ANON_KEY, NEXT_PUBLIC_MAPBOX_TOKEN
pnpm install
pnpm dev        # http://localhost:3000
```

### Backend

InsForge is fully managed — no local server to run. The `backend/` directory holds edge function source files. Deploy changes with:

```bash
cd backend
npx @insforge/cli functions deploy dispatch-recommend
npx @insforge/cli functions deploy cost-insights
npx @insforge/cli functions deploy simulate-assignment
npx @insforge/cli functions deploy vision-monitor
```

Apply new SQL migrations with:

```bash
cd backend
npx @insforge/cli db query "$(cat insforge/migrations/003_vision_events.sql)"
```

## SAURON Vision Demo Setup

1. Put demo videos in `frontend/public/videos/vision/` as `1.mp4` through `7.mp4`.
2. Those files are intentionally gitignored and stay local to your demo machine.
3. Only `driving` trucks get assigned camera feeds.
4. The frontend samples those feeds in the background and sends frames to the `vision-monitor` InsForge function.

Visible operator surfaces:

- Driver detail panel live feed
- Auto-prioritized map feed
- Critical vision alert card
- Marker risk halos based on attention score

Alert behavior:

- SAURON first attempts Claude vision analysis on real sampled frames.
- If the AI response fails, the demo falls back to a deterministic scorer so the experience stays resilient.

---

## Environment Variables

| Variable | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_INSFORGE_URL` | `frontend/.env.local` | `https://hy28h59d.us-east.insforge.app` |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | `frontend/.env.local` | get from team |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `frontend/.env.local` | get from mapbox.com |

---

## Testing

See [`frontend/README.md`](frontend/README.md) for UI testing steps.  
See [`backend/README.md`](backend/README.md) for InsForge CLI testing commands.
