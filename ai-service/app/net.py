"""HTTP 出站辅助:本机地址绕过系统代理,远程地址保留系统代理。

背景:macOS/Clash 类系统代理会被 httpx(trust_env)读到,导致指向
127.0.0.1/localhost 的本地服务(知识库 stub、本地 LLM 网关)被代理拦截。
"""
from __future__ import annotations

from urllib.parse import urlparse

import httpx

_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0", "[::1]"}


def is_loopback(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in _LOOPBACK_HOSTS or host.endswith(".local")


def post_json(url: str, *, json: dict | None = None, headers: dict | None = None, timeout: float = 8.0) -> httpx.Response:
    return httpx.post(url, json=json, headers=headers, timeout=timeout, trust_env=not is_loopback(url))
