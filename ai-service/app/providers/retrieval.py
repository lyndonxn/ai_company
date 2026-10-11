"""检索缝口:最长公共子串打分的本地实现,可替换为向量库等(见 docs/provider-integration.md)。"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Protocol

from .. import config

_MIN_MATCH_CHARS = 4  # 查询与正文至少连续重合的字数才视为相关


class Retriever(Protocol):
    """输入用户问题,返回注入 prompt 的参考片段(空串表示无命中)。"""

    def retrieve(self, query: str, limit: int = 2) -> str: ...


def _longest_common_len(a: str, b: str) -> int:
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    best = 0
    for ch in a:
        cur = [0] * (len(b) + 1)
        for j, bc in enumerate(b, 1):
            if ch == bc:
                cur[j] = prev[j - 1] + 1
                best = max(best, cur[j])
        prev = cur
    return best


class KeywordRetriever:
    """对本地 markdown 知识库做连续片段匹配,返回最相关正文段落。"""

    def __init__(self, knowledge_dir: Path | None = None) -> None:
        self._dir = knowledge_dir or config.KNOWLEDGE_DIR
        self._docs: list[tuple[str, list[str]]] = []  # (source, 正文段落)
        self._reload()

    def _reload(self) -> None:
        self._docs = []
        if not self._dir.exists():
            return
        for path in sorted(self._dir.glob("*.md")):
            paras = [
                p.strip()
                for p in path.read_text(encoding="utf-8").split("\n\n")
                if p.strip() and not p.strip().startswith("#")
            ]
            self._docs.append((path.name, paras))

    def retrieve(self, query: str, limit: int = 2) -> str:
        query = query.strip()
        if not self._docs or not query:
            return ""
        scored: list[tuple[int, str, str]] = []
        for source, paras in self._docs:
            for para in paras:
                match = _longest_common_len(query, para)
                if match >= _MIN_MATCH_CHARS:
                    scored.append((match, source, para))
        scored.sort(key=lambda item: item[0], reverse=True)

        parts = [f"({source}) {para[:400]}" for _, source, para in scored[:limit]]
        return "\n\n".join(parts)


def get_retriever() -> Retriever:
    return KeywordRetriever()
