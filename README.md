# SAURON — AI-Native Fleet Digital Twin

> One ring to rule all your trucks.

GlobeHack Season 1 · Marketplace & Growth Track

---

## Setup

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, NAVPRO_API_KEY (optional), USE_MOCK_DATA=true
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Fill in: VITE_MAPBOX_TOKEN=pk.eyJ1...
npm install
npm run dev
```

App runs at http://localhost:5173

---

## Features

- **3D Digital Twin Map** — Dark Mapbox map with terrain, 3D buildings, animated amber truck icons
- **Smart Dispatch AI** — Claude ranks top 3 drivers for any load with cost delta reasoning
- **Simulate Assignment** — Ghost route overlay + one-sentence AI outcome narrator
- **Cost Intelligence** — Driver cost-per-mile bar chart + 3 AI insight cards
- **NL Dispatcher Chat** — Streaming Claude chat with full fleet context

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Map | Mapbox GL JS (3D terrain + buildings) |
| Charts | Recharts |
| State | Zustand |
| Backend | FastAPI (Python) |
| AI | Claude API (claude-sonnet-4-6) |
| Data | NavPro API + mock fallback |
