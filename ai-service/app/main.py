import asyncio
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import config
from .callback import router as callback_router, stream_reply
from .personas import get_persona, list_public
from .providers.llm import get_llm_client
from .providers.retrieval import get_retriever
from .schemas import ChatRequest

REPLY_TIMEOUT = 30  # 秒,单轮回复上限

llm = get_llm_client()
retriever = get_retriever()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print(f"[ai-service] llm provider: {llm.name}")
    yield


app = FastAPI(title="AI Company Brain", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 云端智能体回调:会话编排云服务把 ASR 文本回调到这里,本服务流式返回文本
app.include_router(callback_router)


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "ai-company-brain", "llm": llm.name}


@app.get("/api/personas")
async def personas():
    return {"personas": list_public()}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    persona = get_persona(req.personaId)
    if persona is None:
        raise HTTPException(status_code=404, detail=f"未知人设: {req.personaId}")

    messages = [m.model_dump() for m in req.messages]
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    context = retriever.retrieve(last_user)

    if not req.stream:
        chunks: list[str] = []
        async for chunk in llm.chat_stream(persona, messages, context):
            chunks.append(chunk)
        return {
            "reply": "".join(chunks),
            "personaId": persona.id,
            "provider": llm.name,
            "contextUsed": bool(context),
        }

    async def sse():
        try:
            async with asyncio.timeout(REPLY_TIMEOUT):
                async for chunk in stream_reply(persona, messages):
                    frame = json.dumps({"delta": chunk}, ensure_ascii=False)
                    yield f"data: {frame}\n\n"
        except asyncio.TimeoutError:
            yield 'data: {"error": "reply timeout"}\n\n'
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
