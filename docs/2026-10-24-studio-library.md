# Studio：Agent 收录、私人取用、精选公开

代码实现日期：2026-10-24。本文不表示已部署到生产。

## 使用流程

1. 将文章或工具交给任意 Agent，说「保存到 Studio」。
2. Agent 提炼内容，通过 `capture_library_item` 保存为私人资料，返回单条直达链接。
3. 在 `/admin` 搜索、查看最近收录、打开主题资料集；`/admin/library` 支持类型、主题、资料集、收藏和归档筛选。
4. 勾选最多 20 条资料，填写要求，复制正文、来源与条目标识给助手继续加工。
5. 工具与提示词可编辑并确认独立公开版本；笔记/文章摘录可转为文章草稿，再在编辑器确认发布。

2026-10-25 更新：X 短帖统一进入[运营工作台](2026-10-25-x-operations.md)，退出资料库列表与搜索。旧灵感链接跳转运营；历史内容、元数据与关联记录保留。运营状态由人工标记，复制和跳转不会改变状态。资料库仍只有明确的 `decision_question` 才进入「待我决定」。

主题资料集复用旧 projects 和 project_links；新增关联表补足收集箱、灵感与同步成果。旧项目公开快照继续在公开管理的历史项目入口维护。公开首页作品由 `/admin/studio` 管理。

## 新 MCP 契约

服务版本 0.3.0：写凭据可发现 21 个工具，只读凭据可发现 9 个工具。原有 14 个工具及 HTTP 接口保留。

| 工具 | 用法 |
|---|---|
| `capture_library_item` | type 为 tool/article/note/prompt/inspiration；统一记录 Agent 提交，原始来源另存 |
| `search_library` | 跨类型检索正文、标题和主题，支持资料集、收藏、归档及分页 |
| `get_library_item` | 读取完整内容、来源、元数据、当前 revision 和 href |
| `list_collections` | 查找已有资料集及 revision |
| `create_collection` | 创建主题资料集，request_key 防重复，无强制下一步 |
| `link_library_collection` | 将现有条目关联到资料集，需 collection_revision |
| `update_library_item` | 修改私人资料，必须提供 expected_revision |

示例（来源与正文仅为格式示意，须由 Agent 实际读取整理）：

```json
{
  "request_key": "unique-request-uuid",
  "type": "article",
  "title": "原文标题",
  "summary": "简短摘要",
  "content": "## 关键观点\n\n- 经核实的观点一\n- 经核实的观点二",
  "saved_reason": "以后在哪个场景会用到它",
  "source_url": "https://example.com/article",
  "source_status": "available",
  "topics": ["知识管理"],
  "collection_ids": [],
  "decision_question": ""
}
```

读取失败时使用 `source_status: unavailable`，保留已知信息和链接，不生成摘要。工具正文描述用途及适用场景。文章摘录保存整理后的要点而非复制完整原文。禁止导入 Flomo 原文。

同一 request_key 只能重试完全相同的输入。工具和文章按规范化来源去重（去除片段和常见追踪参数），返回 `reused_source` 提示；已有内容不会被新提交覆盖。`href` 为站内绝对路径，客户端用本站 origin 拼接即可。412 需读取并核对冲突，不能只刷新 revision 后盲目覆盖。

元数据 revision 同时跟踪旧接口对底层记录的更新。公开快照只由管理员 API 写入；Agent 工具不提供公开发布。私人编辑不会触及公开快照。

## 部署顺序

1. 导出目标生产 D1 到不受版本控制的安全位置。
2. 将备份恢复到隔离的本地 D1，先演练本次增量并核对数量、旧来源、公开快照与外键。
3. 只执行一次 `db/migrations/2026-10-24-studio-library.sql`，不要重放 schema 或历史 migrations。
4. 部署新代码，重新连接 MCP/刷新工具发现。新服务的 workspace_status 会检查 library 迁移。
5. 验证旧接口、只读权限、私人查询和公开页面。不得将备份或任何凭据提交仓库。

迁移新增元数据、请求回执、扩展关联及查询视图，不复制原始正文。历史内容的提交者保留 unknown，不凭空标记为 Agent，不产生待办。D1 单个 compound SELECT 限制为五项，视图分组且用 LIMIT 阻止合并，已在本地 Wrangler D1 演练。

## 隔离验证

可用 `CF_CONFIG_PATH` 指定本地 Wrangler 配置，`CF_LOCAL_PERSIST_PATH` 指向独立的 `state/v3`。Wrangler CLI 对应 `--persist-to state`。仅本地开发启用这些覆盖，不改变部署配置。

```bash
npx vitest run tests/lib/library.test.ts tests/app/api/mcp.route.test.ts
npm run verify:quick
# 先启动本地开发服务；E2E_ADMIN_PASSWORD 通过本地环境注入
npm run test:e2e
```

端到端测试仅允许 loopback，包含合成内容写入和公开快照验证，务必使用独立的本地数据库。不要对生产执行。

## 本次验收记录

- `verify:quick` 通过：lint、45 个测试文件 / 230 项测试、Next.js 生产构建。
- Playwright 7 条流程通过：收录/关联/多选交接、公开快照隔离、桌面与手机/深色模式、长文复制、权限、旧编辑器冲突与草稿、X 复制不改变历史状态。
- Ego 浏览器实测登录、收录直达、Markdown 阅读与交接复制；截图接口超时后由 Playwright 完成视觉截图。
- Wrangler 本地 D1 执行完整 schema 成功；单元测试覆盖旧库增量迁移、事务回滚和并发版本检查。
- 使用隔离本地库和临时凭据；生产数据库、Worker 与 Bot 配置未更改。

界面预览：[公开首页](screenshots/studio-home.png)、[私人资料阅读](screenshots/studio-library.png)。后台截图使用合成样例，不含真实私人资料。
