import os
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent.parent

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "").strip()
LLM_API_KEY = os.environ.get("LLM_API_KEY", "").strip()
LLM_MODEL = os.environ.get("LLM_MODEL", "").strip()
KNOWLEDGE_DIR = SERVICE_ROOT / os.environ.get("KNOWLEDGE_DIR", "data/knowledge")
