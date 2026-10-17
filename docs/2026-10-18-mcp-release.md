# MCP 接入上线记录

日期：2026-10-18（Asia/Shanghai）。

入口：<https://note.aichanning.cn/mcp>。这是 MCP 协议入口，不能通过浏览器 GET 判断连通性。

[接入指南与 gorkbot 验收指令](api/gorkbot-mcp-integration.md) · [保留的 HTTP API](api/gorkbot-workspace-integration.md)

## 已交付

- 基于官方 TypeScript SDK 1.32.1 的无状态 Streamable HTTP，协商协议 `2025-11-25`，JSON 响应，不使用进程内会话。
- 10 个工具覆盖收集、笔记、项目查询/创建/更新/归档，以及完整整理流程。
- `organize_inbox` 将请求回执、笔记创建、来源状态更新与项目关联放入同一 D1 事务。已转换的笔记复用；重复请求返回当前状态，不覆盖人工修改。
- 两个独立 MCP secret 分别授予只读与读写能力。只读凭据不能发现或执行写工具；原 Hermes/HTTP Token 和后台鉴权不变。
- 所有 MCP 响应禁止缓存；校验 Origin、请求大小、参数类型与版本；不暴露原始数据库错误或真实凭据。
- 同一套业务仓储继续服务原 HTTP API。没有新增永久删除、公开发布或 Flomo 原文导入能力。

## 数据与部署

生产 D1 已先完整导出，分别恢复到隔离 SQLite 和 Wrangler 本地 D1。应用新增迁移后逐表比对原有数据，值保持一致，完整性和外键检查通过。

`db/migrations/2026-10-18-mcp-workflows.sql` **已在本站生产执行成功，不可重复运行**。本次仅新增流程回执表 `agent_brain_workflows`；新库完整 schema 同步维护。回执只包含哈希、记录 ID 和首次执行标志，不保存正文或 Token。

生产部署成功，Cloudflare 确认新版本承接 100% 流量。原四项 secrets 全部保留，仅新增 `MCP_READ_TOKEN` 和 `MCP_WRITE_TOKEN`。凭据、生产配置、备份指纹、部署版本及完整日志保存在仓库外的私有运维目录，不纳入 Git。

## 验证结果

- Focused：新 MCP 与原 Agent HTTP API 共 18 项测试通过。
- `npm run verify:quick`：Lint、40 个测试文件 / 181 项测试、Next.js 构建通过。
- OpenNext 构建和生产配置 dry-run 通过；生产构建不包含本机开发凭据。
- 使用官方 MCP 客户端完成协议握手、工具发现、读写权限验证，覆盖事务回滚、重复请求、版本冲突及并发修改；真实本地 Worker 完整验收通过。
- 生产只读连接验证通过；生产完整写入流程 14 项检查通过，包括转换、关联、重复调用、过期版本拒绝和归档。
- 仅创建本次专用的三条合成测试记录（收集项、笔记、项目），全部归档，保留项目关联及流程回执。生产数量与备份基线加这三条记录吻合，外键无异常。
- 另有 11 项生产公开页面、原 OpenAPI、旧接口匿名拒绝、MCP 只读写入拒绝和 Origin 检查通过。

首次生产读写验收因网络连接失败而结束，尚未写入数据；重试后完整通过。未登录用户的 gorkbot 实例，因此不能声称已替其完成客户端配置；需按接入指南配置支持自定义 Bearer 的远程 MCP 客户端。

## 边界与回退

当前使用两个静态凭据，不提供完整 OAuth、每 Bot 独立账号或自动过期。没有承诺与仅接受 `2026-07-28` 协议的客户端兼容。用户现有 Hermes Token 仍用于 HTTP API，不可用于 MCP。

回退前停止 MCP 写入，根据私有部署记录恢复前一 Worker 版本；保留新增回执表、笔记与项目数据，不执行破坏性逆向 SQL。需要撤销 MCP 访问时分别移除或轮换两个 MCP secret，原 API 保持独立。恢复备份应先导入新库并核对，避免覆盖上线后的真实内容。
