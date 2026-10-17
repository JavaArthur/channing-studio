# gorkbot 通用工作台 API 上线记录

上线日期：2026-10-17（Asia/Shanghai）。

正式站点：<https://note.aichanning.cn>。在线定义：<https://note.aichanning.cn/api/agent/v1/openapi>。

[接入指南](api/gorkbot-workspace-integration.md) · [OpenAPI 文件](api/gorkbot-workspace.openapi.json)

## 交付内容

新增 `/api/agent/v1/brain/*` 的 8 个通用操作，支持笔记、收集箱和项目的分页搜索、单条读取、去重创建、条件更新、归档恢复，以及收集箱转笔记、项目笔记关联查询/添加/移除。公开 OpenAPI 同时包含原有 4 个 Hermes 操作。

沿用专用 `HERMES_SYNC_TOKEN`，权限扩展到这三类私人数据的读取与修改。新接口不接受 `qm_` Token 或管理员 Cookie。原后台会话鉴权、Flomo 同步接口和公开发布流程保留；新接口不创建公开文章、不改写项目公开快照。

创建使用持久化 Idempotency-Key 回执；更新使用 If-Match 版本条件。鉴权失败返回 401，缺失版本返回 428，版本冲突返回 412。响应禁止共享缓存。

## 迁移与部署

已先导出生产 D1，并在隔离 SQLite 与 Wrangler 本地 D1 恢复、演练迁移，核对既有字段值、完整性及外键。

`db/migrations/2026-10-17-agent-brain-api.sql` 已在本站生产执行成功，**不能重复执行**。新增三类条目的 `revision`、5 个版本触发器以及 `agent_brain_creates` 创建回执表；回执不存储凭据或正文。新库的完整 schema 已同步维护。

生产 Worker 已部署并承接全部流量，原 secrets 保留。既有数据数量核对一致，R2 媒体未变更。完整备份、部署版本与操作日志存放在仓库外的私有运维记录中。

## 验证

- `npm run verify:quick` 通过：Lint、39 个测试文件 / 172 项测试、Next.js 构建；OpenNext 构建通过。
- SQLite 路由测试覆盖鉴权、去重、并发冲突、搜索分页、归档恢复、转换原子回滚、项目关联、公开快照隔离及迁移保留数据。
- 隔离 Worker 完成 25 次 HTTP 校验，包含后台修改后 Agent 版本冲突和完整转换/关联流程；原有 4 条 Playwright 回归通过。
- 本地及线上 OpenAPI 返回 200，12 个 operationId 唯一，引用和示例通过校验。
- 生产 18 项检查通过，覆盖公开定义、无效 Token 拒绝、旧 Hermes 匿名拒绝、公开页面与资源 API。
- 未代替用户进行生产认证写入；完整有效 Token 流程已在隔离 Worker 验证。真实凭据与备份均不纳入 Git。

## 使用边界与回退

先在 gorkbot 配置已有专用凭据，调用 `GET /api/agent/v1/brain/notes?limit=1` 验证连接。通用 API 使用版本检查；原后台表单保留既有保存语义，版本触发器让 Agent 感知后台变化。创建回执持久保存，无自动清理任务。

项目归档只改变私人状态，不自动撤回公开快照。不提供永久删除、公开发布、私人附件、任务截止日期、细粒度多 Bot 授权或私人笔记历史版本；Flomo 原文仍不能写入本站。

回退前停止 Bot 写入，依据私有运维记录恢复前一 Worker 版本，保留新增结构。数据恢复应先导入新 D1 并核对，再决定切换绑定，避免覆盖上线后的内容。
