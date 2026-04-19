# Frontend — Next.js

## Setup

```bash
cp .env.example .env.local   # fill in the three vars
pnpm install
pnpm dev                      # http://localhost:3000
```

## Env vars (`.env.local`)

```env
NEXT_PUBLIC_INSFORGE_URL=https://hy28h59d.us-east.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<get from team>
NEXT_PUBLIC_MAPBOX_TOKEN=<your mapbox token>
```

## Scripts

```bash
pnpm dev      # dev server with hot reload
pnpm build    # production build
pnpm start    # serve production build
pnpm lint     # eslint
```

## Testing the UI

Once `pnpm dev` is running, verify each feature:

| Feature | How to test |
|---|---|
| Driver list | Sidebar should populate with 8 drivers on load |
| Driver detail | Click a driver card |
| Dispatch AI | Open a driver → Dispatch AI tab → enter pickup/destination → Submit |
| Simulate | Pick a recommended driver → click Simulate Assignment |
| Reports | Click Reports tab → chart + 3 insight cards |
| Chat | Click Chat tab → ask "Who has the most HOS left?" |

## Architecture

```
src/
  api/client.ts          # InsForge SDK — all data fetching + streaming chat
  store/fleetStore.ts    # Zustand — drivers, dispatch, simulation state
  store/uiStore.ts       # Zustand — active tab, panel state
  hooks/
    useFleetPolling.ts   # polls InsForge DB every 30s
    useMapbox.ts         # Mapbox GL JS lifecycle
    useStreamingChat.ts  # SSE streaming chat with fleet context
  components/
    layout/AppShell      # top-level layout
    sidebar/             # driver list + detail panel
    map/                 # Mapbox + ghost route layer
    dispatch/            # load form + recommendation cards
    costs/               # cost bar chart + insight cards
    chat/                # dispatcher chat UI
    narrator/            # post-simulation AI narrative
  app/
    layout.tsx           # Next.js root layout
    page.tsx             # mounts AppShell
```

Mapbox and all hooks using browser APIs are `'use client'` components — cannot be server-rendered.
