from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.models.ai import ChatRequest
from app.services.navpro import get_drivers
from app.services.claude import stream_chat

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message")
async def chat_message(req: ChatRequest):
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
