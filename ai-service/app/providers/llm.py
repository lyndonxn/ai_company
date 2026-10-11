"""LLM 缝口:统一的人设化对话生成接口。

- 未配置 LLM_BASE_URL 时使用 MockPersonaLLM(离线可运行)
- 配置后使用 OpenAICompatLLM(任何 OpenAI 兼容接口均可)
"""
from __future__ import annotations

import asyncio
import json
import random
import re
from typing import AsyncIterator, Protocol

import httpx

from ..personas import PersonaProfile
from .. import config

_PUNCT = re.compile(r"[\s,。!.?:;、,!?~～\"'“”‘’()()【】\[\]]+")

_STOPWORDS = {
    "我", "你", "他", "她", "的", "了", "吗", "呢", "吧", "啊", "是", "在",
    "有", "和", "跟", "就", "都", "也", "很", "想", "要", "能", "会", "怎么",
    "什么", "这个", "那个", "一下", "可以", "请", "帮我", "帮我看看",
}

# 对话模式:讲故事 / 放松练习 由 mock 大脑特判
_STORY_HINTS = ("故事", "讲一个", "睡前")
_RELAX_HINTS = ("放松", "练习", "睡不着", "焦虑")

_STORY_IMAGERY = [
    ("巷口的灯", "橘色的光落在青石板上"),
    ("晚归的猫", "踩着月光一步一步走"),
    ("一封没有寄出的信", "压在抽屉最里层"),
    ("海边的木屋", "风铃在檐下轻轻晃"),
]

_RELAX_SCRIPT = (
    "把注意力放回到呼吸上。吸气,数四拍——一,二,三,四;"
    "停一下;再用六拍缓缓呼出去。肩膀松下来,手指松下来。"
    "再来一轮,吸气四拍,呼气六拍。嗯,就是这样。"
)


def _clean_topic(text: str) -> str:
    """从用户输入中提取一个可回指的话题短语。"""
    tokens = [t for t in _PUNCT.split(text or "") if t]
    kept = [t for t in tokens if t not in _STOPWORDS and len(t) >= 2]
    topic = kept[0] if kept else (tokens[-1] if tokens else "这件事")
    return topic[:16]


def _pick(seq: tuple[str, ...]) -> str:
    return random.choice(seq) if seq else ""


class LLMClient(Protocol):
    """实现此协议即可替换大脑(见 docs/provider-integration.md)。"""

    name: str

    async def chat_stream(
        self,
        persona: PersonaProfile,
        messages: list[dict],
        context: str,
    ) -> AsyncIterator[str]: ...


class MockPersonaLLM:
    """按人设语体合成的离线大脑:检索命中优先作答,否则走风格模板。"""

    name = "mock"

    def __init__(self, chunk_delay: float = 0.045) -> None:
        self._chunk_delay = chunk_delay

    async def chat_stream(
        self,
        persona: PersonaProfile,
        messages: list[dict],
        context: str,
    ) -> AsyncIterator[str]:
        user_text = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        reply = self._compose(persona, user_text, context)
        # 按小块流出,模拟真实打字机效果
        for i in range(0, len(reply), 3):
            yield reply[i : i + 3]
            await asyncio.sleep(self._chunk_delay)

    def _compose(self, persona: PersonaProfile, user_text: str, context: str) -> str:
        # 1) 特判:故事 / 放松属于陪伴类意图,优先于知识检索
        if any(h in user_text for h in _STORY_HINTS):
            title, image = random.choice(_STORY_IMAGERY)
            return (
                f"{_pick(persona.openers)}那讲一个短的。"
                f"你见过{title}吗?{image}。看灯的人已经回家了,它还亮着,像是替谁守着一句晚安。"
                f"好啦,{_pick(persona.closers)}"
            )
        if any(h in user_text for h in _RELAX_HINTS):
            return f"{_pick(persona.openers)}我们一起做一个一分钟的小练习。{_RELAX_SCRIPT}{_pick(persona.closers)}"

        # 2) 检索命中:基于知识片段作答
        if context:
            first_line = context.strip().splitlines()[0]
            snippet = first_line.split(") ", 1)[-1].strip()[:80]
            return f"{_pick(persona.openers)}我在资料里翻到一段,念给你听:「{snippet}」——结合你说的情况,这段应该用得上。"

        # 3) 默认:人设风格模板 + 回指用户话题
        topic = _clean_topic(user_text)
        prefix = persona.topic_prefix.format(topic=topic)
        return (
            f"{_pick(persona.openers)}{prefix},"
            f"{_pick(persona.frames)}{_pick(persona.closers)}"
        )


class OpenAICompatLLM:
    """OpenAI 兼容接口适配:LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 可配。"""

    name = "openai-compat"

    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model

    async def chat_stream(
        self,
        persona: PersonaProfile,
        messages: list[dict],
        context: str,
    ) -> AsyncIterator[str]:
        system = persona.system_prompt
        if context:
            system += f"\n\n参考资料(回答时优先使用):\n{context}"
        payload = {
            "model": self._model,
            "stream": True,
            "messages": [{"role": "system", "content": system}, *messages],
        }
        headers = {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST", f"{self._base_url}/chat/completions", json=payload, headers=headers
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        delta = json.loads(data)["choices"][0]["delta"].get("content")
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
                    if delta:
                        yield delta


def get_llm_client() -> LLMClient:
    if config.LLM_BASE_URL:
        return OpenAICompatLLM(config.LLM_BASE_URL, config.LLM_API_KEY, config.LLM_MODEL or "default")
    return MockPersonaLLM()
