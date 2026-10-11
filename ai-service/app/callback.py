"""云端智能体回调端点。

会话编排云服务在通话中把 ASR 识别出的文本回调到本服务(本服务需公网可达,
开发态用 ngrok 等内网穿透暴露),本端点完成「检索 → Prompt 组装 → 流式生成」,
并把回复以 SSE 文本流交还云端,由云端完成 TTS 播流。

线格式(与课程工作流一致):
  请求:POST JSON,兼容两种形态 ——
    {"messages": [{"role": "user", "content": "..."}], "personaId": "..."}
    {"text": "...", "roomId": "...", "roundId": 1, "sequence": 0}
  响应:SSE;帧为 `data: {"content": "..."}`(两个换行结尾),终止帧 `data: [DONE]`。

注意:不同云服务回调的字段命名可能存在差异;所有请求字段解析收敛在
`extract_request`,响应帧格式收敛在 `sse_frame` —— 接入具体云服务联调时,
只需对齐这两处,不动业务管线。
"""
from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from .personas import PERSONAS, PersonaProfile, get_persona
from .providers.llm import get_llm_client
from .providers.retrieval import get_retriever

REPLY_TIMEOUT = 30  # 秒,单轮回复上限

router = APIRouter()

llm = get_llm_client()
retriever = get_retriever()

_META_KEYS = ("roomId", "sessionId", "roundId", "sequence", "userId")


def _default_persona_id() -> str:
    return next(iter(PERSONAS))


def extract_request(payload: dict) -> tuple[PersonaProfile, list[dict], dict]:
    """从回调请求体解析(人设, 消息列表, 透传元数据)。字段差异在此对齐。"""
    persona_id = (
        payload.get("personaId")
        or payload.get("persona_id")
        or payload.get("sceneId")
        or _default_persona_id()
    )
    persona = get_persona(persona_id)
    if persona is None:
        raise HTTPException(status_code=404, detail=f"未知人设: {persona_id}")

    raw_messages = payload.get("messages")
    if isinstance(raw_messages, list) and raw_messages:
        messages = [
            {
                "role": m.get("role", "user") if isinstance(m, dict) else "user",
                "content": m.get("content", "") if isinstance(m, dict) else str(m),
            }
            for m in raw_messages
        ]
    else:
        text = payload.get("text") or payload.get("utterance") or payload.get("query") or ""
        if not text:
            raise HTTPException(status_code=400, detail="回调请求缺少对话文本(messages 或 text)")
        messages = [{"role": "user", "content": str(text)}]

    meta = {k: payload[k] for k in _META_KEYS if payload.get(k) is not None}
    return persona, messages, meta


def sse_frame(chunk: str) -> str:
    """响应帧格式在此收敛:云端按 content 字段拼接流式文本。"""
    return f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"


async def stream_reply(persona: PersonaProfile, messages: list[dict]) -> AsyncIterator[str]:
    """共用的生成管线:检索 → 流式回复。"""
    import asyncio

    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    context = retriever.retrieve(last_user)
    try:
        async with asyncio.timeout(REPLY_TIMEOUT):
            async for chunk in llm.chat_stream(persona, messages, context):
                yield chunk
    except asyncio.TimeoutError:
        yield "抱歉,这一轮回复超时了,请再说一次。"


@router.post("/api/callback")
async def callback(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="回调请求体必须是 JSON")
    persona, messages, meta = extract_request(payload)

    async def sse():
        try:
            async for chunk in stream_reply(persona, messages):
                yield sse_frame(chunk)
        except Exception as exc:  # 云端要求流内报错也要以正常 SSE 帧结束
            yield sse_frame(f"抱歉,我这边出了点状况({exc})。")
        yield "data: [DONE]\n\n"

    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    if meta:
        headers["X-Callback-Meta"] = json.dumps(meta, ensure_ascii=False)
    return StreamingResponse(sse(), media_type="text/event-stream", headers=headers)
