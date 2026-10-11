# HANDOFF

> 供任何接手者(人或智能体)续作使用。保持最新;敏感信息不得写入。

## 当前状态

- 日期:2026-10-12
- 阶段:已对齐课程文档《AI语音对话-智能客服项目》的架构要求(回调端点/.env/托管知识库缝口/生成参数);全部验证通过并推送
- 分支:`main` → `origin/main`(github.com/lyndonxn/ai_company,公开)

## 本轮变更(2026-10-12 第二轮)

- `POST /api/callback` 云端回调端点:SSE `content` 帧 + `[DONE]`,请求兼容 messages/text 两种形态;字段解析与帧格式收敛在 `ai-service/app/callback.py`(联调时只对齐该文件)
- 两个服务启动时自动加载各自目录 `.env`(已存在环境变量优先):`server/src/env.js`、`ai-service/app/config.py`
- LLM 生成参数可配:`LLM_TEMPERATURE`(默认 0.3)、`LLM_MAX_TOKENS`
- 托管知识库适配位:`RemoteKnowledgeRetriever`(HTTP 契约 `POST {query, top_k} → {chunks:[{content}]}`,`KB_BASE_URL` 启用,失败降级);本机地址自动绕过系统代理(`app/net.py`,解决 Clash 类代理拦截 localhost 的 502)
- 文档:provider-integration 增加「两种会话形态 + 回调 + ngrok + 重启前挂断房间」;spec/02、spec/03(ACC-011~013)、AGENTS 同步
- 实测:callback 双形态 SSE ✓、400/404 语义 ✓、KB 注入与降级 ✓、.env 端口生效 ✓、server 冒烟 ✓、web 构建 ✓
- 待用户接入:真实供应商凭证(.env 填值)、托管知识库 API 适配(按 3.2 契约包一层)、回调字段与云服务联调对齐(`app/callback.py`)


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

- **火山引擎 API 尚未开通(用户确认,2026-10-12)**:回调接入、真实 RTC/ASR/TTS、托管知识库均暂缓;当前仓库不依赖任何供应商凭证,mock 模式离线可完整运行。开通后按 `docs/provider-integration.md` 三步接入(填 `.env` → 适配托管知识库 → 联调回调字段,后者只需改 `ai-service/app/callback.py`)
- 仓库可见性:**public**(2026-10-12 由用户确认公开);后续提交仍需遵守 AGENTS.md 的安全约束,任何真实凭据不得入库

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
