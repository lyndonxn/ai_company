# AGENTS.md

## 项目定位

**AI Company** 是一个实时语音智能体工作台:在浏览器中与不同「人设」的 AI 角色进行实时语音对话,支持字幕、打断、会话计时与多设备适配。

整体由三个服务组成:

| 目录 | 职责 | 技术栈 |
| --- | --- | --- |
| `web/` | 前端应用:人设画廊、语音房间、字幕与控制条 | React 18 + TypeScript + Vite + Redux Toolkit |
| `server/` | 网关服务:人设(场景)配置下发、语音会话生命周期管理 | Node.js 18+ / Express |
| `ai-service/` | 大脑服务:人设化对话生成、知识检索(RAG)、流式输出 | Python 3.11+ / FastAPI |

## 指令优先级

1. 用户当前指令
2. 本文件
3. `spec/` 下的规格文档
4. 其他注释与说明

## 领域约束

- 「人设(Persona)」是系统第一概念:一切对话行为(问候语、语气、快捷问题、音色偏好)都由 `server/scenes/*.json` 声明,前端与大脑服务都不得硬编码人设。
- 语音传输层(`web/src/rtc/`)与会话提供方(`server/src/providers/`)必须是可插拔接口:仓库内置 `mock` 实现保证离线可运行,真实供应商通过实现同一接口接入,禁止把任何具体供应商的实现散落在业务代码里。
- 密钥与凭据只允许出现在服务端环境变量(`server/.env`、`ai-service` 环境变量),前端不得持有任何长期凭据。
- AI 生成内容必须始终展示免责声明文案(房间页底部)。

## 安全与质量约束

- 提交前必须通过:`web` 的 `npm run build` 与 `tsc --noEmit`、`server` 的接口冒烟脚本、`ai-service` 的 `uv run python -c "import app.main"`。
- 仓库中不得出现任何真实 AK/SK、AppId、Token;示例配置一律留空。
- 禁止提交 `node_modules`、`.venv`、构建产物。

## 任务路由

- 改人设内容 → `server/scenes/*.json` + `ai-service/app/personas.py`(保持两侧一致)
- 改对话流程/字幕协议 → `spec/02-architecture.md` 先行,再动 `web/src/rtc/` 与 `web/src/store/`
- 接入新的语音/大模型供应商 → 读 `docs/provider-integration.md`,只新增 provider 文件,不改业务层

## 完成定义(Definition of Done)

- 行为有对应验收 ID(`spec/03-acceptance.md`)且通过
- `web` 构建零错误、类型检查零错误
- 三个服务各自的冒烟验证通过
- 变更同步到 `HANDOFF.md`
