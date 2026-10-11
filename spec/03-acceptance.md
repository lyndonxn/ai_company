# 03 验收

约定:所有 ID 稳定不变;新增行为追加新 ID。`mock` 即仓库内置的离线实现(引擎/大脑)。

## 功能验收(ACC)

### ACC-001 场景列表
Given server 已启动,When `GET /api/scenes`,Then 返回 200,`scenes` 数量 ≥ 3,每项含 `id/name/role/avatar/tagline/greeting/questions/capabilities`,且不含 `systemPrompt` 字段。

### ACC-002 会话创建与结束
Given `GET /api/scenes` 有 `sceneId=xiaochuan`,When `POST /api/sessions {"sceneId":"xiaochuan"}`,Then 返回 `sessionId/roomId/userId/agentId/token/expiresAt`;When `DELETE /api/sessions/:id`,Then 再查 `GET /api/sessions/:id` 状态为 `ended`。

### ACC-003 人设大脑
Given ai-service 已启动,When `POST /api/chat {"personaId":"yuqi","messages":[{"role":"user","content":"讲个睡前小故事"}],"stream":false}`,Then 返回 `reply` 非空且语体与 `yuqi` 人设一致(含温柔开场特征词);`personaId` 非法时返回 404。

### ACC-004 流式输出
When 以 `stream:true` 调 `/api/chat`,Then 响应为 SSE,含 ≥ 2 个 `data:` 分片,最后一帧为 `[DONE]`。

### ACC-005 检索注入
Given `ai-service/data/knowledge/` 存在含「请假」的文档,When 问「公司请假流程是什么」,Then mock 大脑回复包含该文档中的关键句(证明 Retriever 生效)。

### ACC-011 云端回调端点
Given ai-service 已启动,When `POST /api/callback`(两种请求形态任一),Then 响应为 SSE,帧为 `data: {"content": "..."}`,最后一帧 `[DONE]`;请求体缺文本时返回 400;`personaId` 非法返回 404。

### ACC-012 .env 加载
Given `server/.env` 写入 `PORT=8899`,When `npm start`,Then 网关监听 8899;ai-service 同理(以 `LLM_TEMPERATURE` 写入 .env 后 `/api/health` 正常、回复管线可用为证)。

### ACC-013 托管知识库适配
Given 一个返回 `{"chunks":[{"content":"..."}]}` 的 HTTP stub 作为 `KB_BASE_URL`,When ai-service 以该配置启动并问「公司请假流程」,Then 回复包含 stub 返回的片段(证明 RemoteKnowledgeRetriever 生效);stub 不可用时回复不报错(降级为无注入)。

### ACC-006 首页画廊
Given 三个服务已启动,When 打开 `/`,Then 渲染 ≥ 3 张人设卡(头像、名字、定位、快捷问题 chips),来源为 `GET /api/scenes`。

### ACC-007 房间问候
When 从首页发起 `xiaochuan` 会话并进入 `/room/:sessionId`,Then 3 秒内出现 AI 问候字幕,阶段徽标经历 `连接中 → 说话 → 聆听`。

### ACC-008 一轮完整对话
Given 房间处于聆听态,When 在演示输入框输入文本并回车,Then 用户字幕逐字上屏 → 阶段切到「思考」→ AI 回复流式上屏 → 回到「聆听」。

### ACC-009 打断
Given AI 正在说话,When 点击麦克风按钮(关麦再开麦,视为一次用户插话),Then 当前 AI 字幕停止增长并标记「已打断」,阶段回到「聆听」。

### ACC-010 挂断清理
When 点击挂断,Then `DELETE /api/sessions/:id` 被调用、路由回到 `/`,再次进入同一人设可重新建会话。

## 交互验收(INT-ACC)

### INT-ACC-001 人设卡点击
When 点击人设卡,Then 打开详情抽屉(问候语、快捷问题、开始通话按钮);Esc / 遮罩点击可关闭。

### INT-ACC-002 快捷问题填充
When 在抽屉点击某个快捷问题,Then 开始通话后该问题自动作为第一轮用户输入。

### INT-ACC-003 麦克风反馈
When 点击麦克风按钮,Then 图标与配色随开关状态切换,并带悬停提示文案。

### INT-ACC-004 字幕开关
When 点击字幕按钮,Then 字幕区隐藏/显示,按钮状态同步。

### INT-ACC-005 演示输入回车
When 演示输入框聚焦且按 Enter,Then 发送一轮对话;Shift+Enter 换行不发送;空文本不发送。

### INT-ACC-006 会话计时
When 会话进行中,Then 工具条显示计时 mm:ss 且每秒递增;挂断后停止。

## 视觉验收(V-ACC)

基线:桌面 1440×900 与移动 390×844 两档。

### V-ACC-001 暗色体系
首页与房间均为深色渐变底(近黑蓝),卡片为半透明玻璃质感,主色为蓝紫渐变;无默认白底组件漏出。

### V-ACC-002 房间焦点
房间页视觉焦点为中央 AI 头像光球:说话时光球外圈出现呼吸/波纹动画,聆听时静态微光;波形条仅说话时起伏。

### V-ACC-003 响应式
390×844 下无横向滚动:画廊单列,房间字幕区与工具条完整可见,工具条按钮 ≥ 44px 触控区。

### V-ACC-004 免责声明
房间页底部常驻「AI 生成内容,请注意甄别」文案。
