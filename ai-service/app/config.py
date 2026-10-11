import os
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> int:
    """极简 .env 加载:已存在的环境变量优先,不覆盖。"""
    if not path.exists():
        return 0
    loaded = 0
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value
            loaded += 1
    return loaded


# 支持服务目录下 .env 文件(与课程工作流一致:启动前创建 .env)
_load_dotenv(SERVICE_ROOT / ".env")

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "").strip()
LLM_API_KEY = os.environ.get("LLM_API_KEY", "").strip()
LLM_MODEL = os.environ.get("LLM_MODEL", "").strip()

# 生成参数:对话场景建议 0.3(严谨且有对话感);0 为极度严谨
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0.3") or 0.3)
LLM_MAX_TOKENS = int(os.environ["LLM_MAX_TOKENS"]) if os.environ.get("LLM_MAX_TOKENS", "").strip() else None

# 托管知识库(远程知识服务)缝口:配置 KB_BASE_URL 后启用,优先于本地关键词检索
KB_BASE_URL = os.environ.get("KB_BASE_URL", "").strip()
KB_API_KEY = os.environ.get("KB_API_KEY", "").strip()
KB_TOP_K = int(os.environ.get("KB_TOP_K", "3") or 3)

KNOWLEDGE_DIR = SERVICE_ROOT / os.environ.get("KNOWLEDGE_DIR", "data/knowledge")
