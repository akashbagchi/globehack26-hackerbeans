from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.models.ai import ChatRequest
from app.services.navpro import get_drivers
from app.services.claude import stream_chat
from app.limiter import limiter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message")
@limiter.limit("10/minute")
async def chat_message(request: Request, req: ChatRequest):
    drivers, _ = await get_drivers()

    async def event_stream():
        async for token in stream_chat(req.messages, drivers):
            yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
