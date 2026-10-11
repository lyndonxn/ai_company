from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    personaId: str
    messages: list[ChatMessage] = Field(min_length=1)
    stream: bool = False
