# HANDOFF

> 供任何接手者(人或智能体)续作使用。保持最新;敏感信息不得写入。

## 当前状态

- 日期:2026-10-12
- 阶段:首版功能完成并通过自主验证;待独立验收后创建远端仓库并推送
- 分支:`main`(本地),尚未关联远端

## 已完成(附证据)

- 三缝口架构:`web/src/rtc`(VoiceEngine + mock)、`server/src/providers`(AgentProvider + mock)、`ai-service/app/providers`(LLM/Retriever + mock)
- server:`GET /api/scenes`、`POST /api/sessions`、`GET|DELETE /api/sessions/:id`、`GET /api/health`;HMAC 开发态凭据;3 个人设场景 JSON
- ai-service:`/api/chat`(JSON + SSE)、`/api/personas`、人设语体 mock 大脑、LCS 关键词检索、404 语义
- web:首页画廊 + 详情抽屉、语音房间(阶段徽标/字幕/波形/打断/计时/挂断)、演示输入、移动端适配
- 文档:README、spec/01~03、docs/provider-integration.md、两份 provider README
- CI:`.github/workflows/ci.yml`(server 冒烟 / web 构建 / ai-service 导入检查)

### 自主验证记录(2026-10-12)

- `server`:npm run smoke 全部断言通过
- `ai-service`:检索命中、故事意图、SSE 分帧、非法 personaId 404 全部通过
- `web`:`npm run build`(tsc + vite)零错误
- 浏览器全流程(1440×900 与 390×844):画廊 → 抽屉 → 快捷问题 → 进房问候 → 思考 → 检索命中回复 → 开麦打断(「已打断」标记)→ 挂断(服务端 status=ended);移动端无横向滚动

## 未完成 / 待用户决策

- 真实语音供应商与大模型供应商接入(用户自行测试补充):按 `docs/provider-integration.md` 三步走,需填 `server/.env`、`web/.env.local`、ai-service 的 `LLM_BASE_URL` 等环境变量
- 仓库可见性:计划以 **private** 创建;如需公开执行 `gh repo edit lyndonxn/ai_company --visibility public --accept-visibility-change-consequences`

## 环境清单(一次性盘点,勿重复执行)

- macOS arm64;Node v24.19.0;git 2.50.1;Python 3.14.7 + uv;gh 已登录 `lyndonxn`(repo scope)
- 本机 8787 端口被无关 Python 服务占用(项目网关默认改用 8790)
- Node fetch 对 `localhost` 优先解析 IPv6,本地请求一律用 `127.0.0.1`
- git 身份:仓库本地 `lyndonxn <lyndonxn@users.noreply.github.com>`(全局未配置)

## 验证命令

```bash
cd server && npm ci && npm start          # 冒烟: curl 127.0.0.1:8790/api/scenes && npm run smoke
cd ai-service && uv sync && uv run uvicorn app.main:app --port 8900
cd web && npm ci && npm run build && npm run dev
```

## 下一步(精确动作)

1. 独立验收子代理核对 `spec/03-acceptance.md` 全部 ID
2. 修复验收问题(如有)
3. `gh repo create lyndonxn/ai_company --private --source . --push`
4. 确认远端提交历史与仓库内容,更新本文件推送状态
