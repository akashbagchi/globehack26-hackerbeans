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
| SAURON Vision | Click any driving driver → live feed should open from about 1:00 into the clip |
| Vision Alerts | Wait for background monitoring → map should surface risk halos, live priority feed, and alert cards |

## Demo Videos

Put local demo videos here:

```text
public/videos/vision/1.mp4
public/videos/vision/2.mp4
...
public/videos/vision/7.mp4
```

Notes:

- These video files are gitignored and should not be committed.
- Only `driving` drivers get assigned feeds.
- Visible players start around 60 seconds into each clip.
- Background monitoring samples frames from the local files and sends them to InsForge.

## Architecture

```
src/
  api/client.ts          # InsForge SDK — all data fetching + streaming chat
  store/fleetStore.ts    # Zustand — drivers, dispatch, simulation state
  store/uiStore.ts       # Zustand — active tab, panel state
  hooks/
    useFleetPolling.ts   # polls InsForge DB every 30s
    useTelemetryPolling.ts # simulates truck motion from route snapshots
    useMapbox.ts         # Mapbox GL JS lifecycle
    useStreamingChat.ts  # SSE streaming chat with fleet context
  components/
    layout/AppShell      # top-level layout
    sidebar/             # driver list + detail panel
    map/                 # Mapbox + ghost route layer
    vision/              # proactive alert surfaces + video player
    dispatch/            # load form + recommendation cards
    costs/               # cost bar chart + insight cards
    chat/                # dispatcher chat UI
    narrator/            # post-simulation AI narrative
  lib/
    visionFeeds.ts       # assigns local demo videos to driving trucks
    videoPlayback.ts     # shared demo playback offset helpers
  app/
    layout.tsx           # Next.js root layout
    page.tsx             # mounts AppShell
```

Mapbox and all hooks using browser APIs are `'use client'` components — cannot be server-rendered.
