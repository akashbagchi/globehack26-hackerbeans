# SAURON — AI-Native Fleet Digital Twin

> One ring to rule all your trucks.

GlobeHack Season 1 · Marketplace & Growth Track

---

## What is Sauron?

Sauron is an AI-native fleet digital twin that gives trucking dispatchers a live 3D map of their entire fleet and uses Claude AI to simulate dispatch decisions before committing to them — showing cost savings, HOS impact, and ETA in real time.

---

## Prerequisites

- Python 3.10+ (tested on 3.14)
- Node.js 18+
- [Mapbox account](https://mapbox.com) — free tier works
- [Anthropic API key](https://console.anthropic.com)
- NavPro/Trucker Path API key (optional — mock data works without it)

---

## Setup

### 1. Clone & enter the repo

```bash
git clone https://github.com/akashbagchi/globehack26-hackerbeans
cd globehack26-hackerbeans
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...      # Required
NAVPRO_API_KEY=                   # Optional — leave blank to use mock data
USE_MOCK_DATA=true                # Set false only if NavPro key is provided
PORT=8000
CORS_ORIGINS=http://localhost:5173
```

Start the server:

```bash
python -m uvicorn main:app --reload --port 8000
```

API runs at `http://localhost:8000`. Verify with `http://localhost:8000/health`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=pk.eyJ1...      # Required — get from mapbox.com account
```

Install and run:

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## Usage

### Driver List
The left panel shows all 8 fleet drivers with status (Driving / Idle / Off Duty), location, and HOS remaining. Use the search bar and status filter to narrow the list.

### Driver Detail
Click any driver to open their detail view:
- **Details tab** — location, HOS breakdown, vehicle info, active load, today's performance
- **Dispatch AI tab** — enter a pickup, destination, cargo, and weight to get Claude's top 3 driver recommendations with cost delta reasoning

### Simulate Assignment
After selecting a recommended driver, click **Simulate Assignment** to:
- Render a ghost route on the map
- Get a one-sentence AI narrative with cost, ETA, and HOS impact

### Cost Intelligence (Reports tab)
Bar chart of cost-per-mile across all drivers, color-coded green to red, with 3 AI-generated insight cards surfacing actionable inefficiencies.

### Dispatcher Chat (Chat tab)
Natural language chat powered by Claude with full live fleet context. Try:
- *"Who has the most HOS left?"*
- *"Which driver is closest to Denver?"*
- *"Who is cheapest per mile today?"*

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/fleet/drivers` | All drivers (NavPro or mock) |
| GET | `/fleet/drivers/{id}` | Single driver |
| POST | `/dispatch/recommend` | Claude dispatch recommendations |
| GET | `/dispatch/cost-insights` | Cost chart data + AI insights |
| POST | `/chat/message` | Streaming Claude chat (SSE) |
| POST | `/simulate/assignment` | Route simulation + narrator |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript + Tailwind CSS v4 |
| Map | Mapbox GL JS (3D terrain + buildings + fog) |
| Charts | Recharts |
| State | Zustand |
| Backend | FastAPI (Python) |
| AI | Claude API (`claude-sonnet-4-6`) with prompt caching |
| Data | NavPro API (Trucker Path) + mock fallback |

---

## Demo Mode

Set `USE_MOCK_DATA=true` in `backend/.env` to run fully offline with 8 pre-seeded drivers across the US (Chicago, Dallas, Denver, Atlanta, Seattle, Phoenix, Nashville, Columbus). All AI features work in demo mode — only the Mapbox token and Anthropic key are required.
