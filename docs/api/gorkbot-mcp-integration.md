# gorkbot MCP 接入：收集 → 笔记 → 项目

更新：2026-10-18。现有 HTTP API 与 Hermes 同步接口继续保留。

## 连接设置

| 设置 | 值 |
|---|---|
| 名称 | Channing Studio |
| 地址 | `https://note.aichanning.cn/mcp` |
| 传输 | Streamable HTTP，无状态，JSON 响应 |
| 协议 | 官方 TypeScript SDK 1.32.1，协商版本 `2025-11-25`；也支持 SDK 的 `2025-06-18` / `2025-03-26` HTTP 兼容版本 |
| 鉴权 | `Authorization: Bearer <MCP 专用凭据>`，由客户端凭据管理注入 |
| 连通检查 | 连接成功后调用 `workspace_status` |

客户端必须支持**远程 MCP Streamable HTTP 与自定义 Bearer 请求头**。只有 HTTP API 工具、旧 SSE URL 或仅 OAuth 登录入口的客户端不能直接使用这份配置；继续使用 [HTTP 接入](gorkbot-workspace-integration.md)。尚未在用户的 gorkbot 实例中验证其 MCP 支持，不能将本站客户端测试视为 gorkbot 已连接。

首次连接由 MCP 客户端完成 initialize、版本协商及 tools/list，不要把 `/mcp` 当作普通 REST JSON 接口。服务端不提供旧式 `/sse`、独立 GET 事件流或会话恢复，不要求 MCP session ID。不宣称支持仅接受 `2026-07-28` 的客户端；需允许协商到上述版本。

凭据与权限：

- `MCP_READ_TOKEN`：6 个只读工具，可读工作空间与 X 短帖草稿。
- `MCP_WRITE_TOKEN`：14 个工具，可读写工作空间与 X 短帖草稿，并执行整理流程。
- 现有 Hermes Token、`qm_` Token、后台 Cookie 均不能登录 `/mcp`。更换 MCP secret 不影响这些旧接口。
- 当前是两个独立静态凭据，按读写分权，没有每个 Bot 独立账号、自动过期或 OAuth 授权流程。不要将其描述为完整 OAuth 授权服务。
- Token 不进入工具参数、提示词、URL、Git 或日志。仅在可信服务端客户端配置；来自其他站点的浏览器 Origin 会被拒绝，不开放跨站 CORS。

不同客户端的配置字段不同。以下只是支持 `mcpServers`、`type`、`url` 和 `headers` 的客户端示意；占位符需由其凭据机制替换，不能假定所有客户端支持环境变量插值：

```json
{
  "mcpServers": {
    "channing-studio": {
      "type": "http",
      "url": "https://note.aichanning.cn/mcp",
      "headers": { "Authorization": "Bearer <由凭据管理注入 MCP_WRITE_TOKEN>" }
    }
  }
}
```

## 工具

| 工具 | 行为 |
|---|---|
| `workspace_status` | 验证鉴权、数据库和迁移，返回读写权限，不返回私人内容 |
| `search_workspace` | 按 kind（inbox/notes/projects）搜索、分页，返回摘要与 revision |
| `get_item` | 读取条目完整字段和 revision |
| `get_project_context` | 获取私人项目说明、下一步和关联笔记摘要，支持分页 |
| `capture_inbox` | 新建收集项，request_key 去重 |
| `create_note` | 新建私人笔记，request_key 去重 |
| `create_project` | 新建私人项目，request_key 去重 |
| `update_item` | 用 expected_revision 部分更新或归档；笔记/收集箱用 archived，项目用 status |
| `organize_inbox` | **一次事务将收集项转换为笔记并关联到项目** |
| `link_note_to_project` | 将已有未归档笔记关联项目，要求 project_revision |

只读凭据只能发现和调用读取工具，不能调用任何写入工具，权限由服务端执行。工具注解帮助客户端展示行为，不替代鉴权。

现有公开发布仍由后台完成。MCP 不提供永久删除、项目公开发布、文章管理、私人附件或原始 Flomo 数据导入。

X 短帖草稿工具（只保存草稿和人工发布状态，不代发到 X）：

| 工具 | 权限与行为 |
|---|---|
| `list_x_drafts` | 只读；status/source_type/q/since/until/page/limit 筛选，默认待发 |
| `get_x_draft` | 只读；按 id 读取正文、revision、char_count 和 over_limit |
| `create_x_draft` | 写入；request_key 幂等创建，正文必填，来源链接与类型可选 |
| `update_x_draft` | 写入；expected_revision 乐观锁，支持正文、来源、状态和 posted_url |

超出 280 加权字符仅提示，不阻止保存。来源类型支持自定义小写标识。链接仅限 HTTP(S)；版本冲突返回 412，同一请求键换正文返回 409。部署前先备份 D1，再应用可重复运行的 `db/migrations/2026-10-18-x-drafts.sql`。

## 整理完整流程

1. `workspace_status` 确认 connected=true、access=write。
2. 用 `search_workspace` 找项目与收集项。项目重名时确认真实目标，不能猜测 ID。
3. `get_item` 读取 inbox 和 project 的当前 revision。若确需新建项目，使用 `create_project`。
4. 生成一次 UUID request_key，调用 `organize_inbox`：

```json
{
  "request_key": "9b7f851e-4ccb-4d72-a767-a0b167dc76eb",
  "inbox_id": "REPLACE_WITH_REAL_INBOX_ID",
  "project_id": "REPLACE_WITH_REAL_PROJECT_ID",
  "inbox_revision": 1,
  "project_revision": 1
}
```

5. 结果包含 inbox、note、project 的当前数据，以及 replayed、created_note、added_link、currently_linked。用 `get_project_context` 核对关联。

`organize_inbox` 原样复制收集项标题、正文和来源地址。它不调用模型改写正文。若需要摘要或整理文字，应先完成转换，再明确用 `update_item` 更新笔记。

数据库内的请求回执、笔记、收集项更新和关联写入位于**同一 D1 batch 事务**。任一步失败全部回滚。已转成笔记的收集项复用原笔记；已转成文章、归档收集项/项目或归档目标笔记会被拒绝，不自动恢复或覆盖。

网络超时后，**使用原 request_key 和完全相同的参数重试，包括原 revision**。回执命中后不会再执行写入，不会因旧 revision 重复创建；同一个 Key 换参数返回 409。回执保存在数据库中，不依赖 Worker 内存，无自动过期。

回执返回的是当前条目；created_note / added_link 表示首次请求是否创建/添加，currently_linked 表示现在是否仍有关联。之后人工解除关联或编辑内容，再重试旧请求不会撤销这些人工操作。要重新关联，应读取当前状态并发起新操作。

首次执行发生版本冲突返回工具错误 `isError: true`，`structuredContent.error.status=412`。重新读取两边内容，核对变化后用新的 request_key 和版本发起新操作；不能只取最新版本盲目覆盖。

## 可以发给 gorkbot 的指令

```text
使用已配置的 Channing Studio MCP，不要读取或显示凭据。
先发现工具并调用 workspace_status，确认 connected=true、access=write；失败就停止并报告。

然后执行一次独立验收，所有新建条目标题带“MCP 接入验收 + 当前时间 + 唯一标记”：
1. capture_inbox 创建一条合成收集内容，create_project 创建独立测试项目。
2. 使用实际返回的 ID 和 revision 调用 organize_inbox，一次完成转笔记和关联项目。
3. 网络失败时保留同一 request_key 和全部原参数重试；遇到版本冲突先读取核对，不能盲目覆盖。
4. get_project_context 验证笔记已关联，get_item 验证正文与来源保留。
5. 完成后仅归档本次创建的收集项、笔记和项目；保留关联，用 archived=all 再验证。
6. 报告连接状态、实际记录 ID、转换/关联/归档结果。失败时报告已创建的 ID 和失败步骤，不显示其他私人内容。
不要修改已有真实记录，不要发布内容，不要永久删除。
```

## 部署与回归

本站生产已完成此迁移，不能重复执行；验收结果见 [上线记录](../2026-10-18-mcp-release.md)。

新增 `db/migrations/2026-10-18-mcp-workflows.sql` 创建仅含哈希、ID 与结果标志的回执表。新库 schema 已同步。已有库先备份，隔离恢复并演练后只应用一次增量，不能重放历史 migrations。

在目标 Worker 交互式配置两个独立高强度 secret（勿复用旧 Token）：

```bash
npx wrangler secret put MCP_READ_TOKEN -c wrangler.production.local.toml
npx wrangler secret put MCP_WRITE_TOKEN -c wrangler.production.local.toml
```

每次设置都会修改生产配置，已配置的环境无需重复执行。凭据分别撤销或轮换；客户端随后更新对应值。

官方 SDK 的验收脚本会完成协议握手、工具发现和连接检查：

```bash
# MCP_TOKEN 由环境或凭据管理提供；不要写进命令参数。
STUDIO_MCP_URL=https://note.aichanning.cn/mcp npm run test:mcp
# 显式启用合成写入验收：创建三个测试条目并在结束后归档。
# 生产执行前先完成 D1 备份。
STUDIO_MCP_URL=https://note.aichanning.cn/mcp npm run test:mcp -- --write
```

脚本仅清理自己创建的记录，报告实际 ID，不打印 Token 或正文。失败时可能留下待核对的测试记录，按报告检查。只读凭据不能运行 --write。

参考：[官方 MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server)、[Streamable HTTP 2025-11-25 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)。
