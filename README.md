# SAURON — AI-Native Fleet Digital Twin

GlobeHack Season 1 · TruckerPath / Marketplace & Growth track

AI dispatch assistant for trucking fleets. Live driver map, Claude-powered dispatch recommendations, cost intelligence, and streaming chat.

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
```

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
