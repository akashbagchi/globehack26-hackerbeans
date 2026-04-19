from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.config import settings
from app.limiter import limiter
from app.routers import fleet, dispatch, chat, operations, simulate, auth, events
from app.services.event_bus import event_bus
from app.services.event_consumers import register_core_consumers

app = FastAPI(title="Sauron Fleet API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth.router)
app.include_router(fleet.router)
app.include_router(dispatch.router)
app.include_router(chat.router)
app.include_router(operations.router)
app.include_router(simulate.router)
app.include_router(events.router)


@app.on_event("startup")
async def startup():
    register_core_consumers(event_bus)
    await event_bus.start()


@app.on_event("shutdown")
async def shutdown():
    await event_bus.stop()


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
