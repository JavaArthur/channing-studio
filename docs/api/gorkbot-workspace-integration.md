# gorkbot 通用工作台接入：笔记、收集箱、项目

支持远程 MCP 的客户端可以使用 [MCP 接入指南](gorkbot-mcp-integration.md)，一次完成收集箱转笔记与关联项目。MCP 使用独立凭据，现有 HTTP API 和 Hermes Token 保持兼容。

更新：2026-10-18。适用于支持 HTTP API 工具的 gorkbot。

这套接口直接操作私人工作台的 `notes`、`inbox_items`、`projects`，不需要把普通内容伪装成 Flomo。原 Hermes / Flomo 同步接口保持不变。

## 连接配置

| 项目 | 值 |
|---|---|
| Server URL | `https://note.aichanning.cn` |
| 认证 | HTTP Bearer，沿用你已有的 Hermes 同步 Token |
| 请求头 | `Authorization: Bearer <凭据管理注入>` |
| JSON 请求 | `Content-Type: application/json` |
| 导入文件 | [gorkbot-workspace.openapi.json](gorkbot-workspace.openapi.json) |
| 在线导入地址 | `https://note.aichanning.cn/api/agent/v1/openapi`（公开接口定义，不含凭据） |
| 初次验证 | `GET /api/agent/v1/brain/notes?limit=1` |

Bearer 输入框只填写 Token 本身。Token 放在 gorkbot 的凭据管理中，不填入 URL、工具参数、提示词或日志。既有 `qm_` Token 和后台 Cookie 不能用于这套接口。

**权限变化：已有 Hermes Token 现在也能读取和修改这三类私人数据。** 这是同一个个人站点的共享 Agent 凭据，没有按 Bot 或数据条目分权；只交给你信任的执行环境。不会调用外部 AI 服务，也不开放后台密码、AI 配置、全库导出、文章发布或项目公开发布操作。原 Flomo 流程仍只回传脱敏投影，不要通过通用笔记接口搬运 Flomo 原文。

HTTP 工具从服务端调用，不需要浏览器 Cookie；只向本站传递认证头。OpenAPI 文件包含 **8 个通用操作 + 4 个原 Hermes 操作**，若已导入旧文件，避免重复添加同名工具。

## 可用操作

`{kind}` 只能是 `notes`、`inbox`、`projects`。所有请求成功或失败均禁止缓存。

| operationId | 方法与路径 | 功能 |
|---|---|---|
| `listWorkspaceItems` | GET `/api/agent/v1/brain/{kind}` | 分页、正文/标题搜索、归档筛选 |
| `createWorkspaceItem` | POST `/api/agent/v1/brain/{kind}` | 创建私人条目，必须提供 Idempotency-Key |
| `getWorkspaceItem` | GET `/api/agent/v1/brain/{kind}/{id}` | 读取正文和当前 revision / ETag |
| `updateWorkspaceItem` | PATCH `/api/agent/v1/brain/{kind}/{id}` | 仅修改给定字段；必须 If-Match |
| `convertInboxToNote` | POST `/api/agent/v1/brain/inbox/{id}/convert` | 收集箱整理为笔记；必须 If-Match |
| `listProjectNotes` | GET `/api/agent/v1/brain/projects/{id}/notes` | 查询项目已关联的笔记 |
| `linkProjectNote` | PUT `/api/agent/v1/brain/projects/{id}/notes/{noteId}` | 关联现有未归档笔记；必须项目 If-Match |
| `unlinkProjectNote` | DELETE `/api/agent/v1/brain/projects/{id}/notes/{noteId}` | 仅移除关联，不删除笔记；必须项目 If-Match |

不提供笔记、收集箱或项目的永久删除接口。清理使用归档；项目暂只开放笔记关联，不能借此访问文章、工具或提示词管理。

## 一次完整的使用流程

下面示例值用于说明。写入请使用真实需要保存的内容；不要把文档里的示例 ID 当成服务器返回值。

### 1. 检查连接并搜索已有内容

```http
GET /api/agent/v1/brain/notes?q=接入&limit=10&page=1&archived=exclude
Authorization: Bearer <由凭据管理注入>
```

成功 200：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 10,
  "has_more": false
}
```

- `q` 可省略，最长 200 字符；按标题和正文搜索，项目还搜索下一步行动；`%`、`_` 按普通字符处理。
- `page` 从 1 开始，最大 10000；`limit` 默认 30，范围 1–50。
- `archived` 为 `exclude`（默认）、`only` 或 `all`。
- 列表按 `updated_at` 降序、`id` 排序，返回 `preview` 前 200 字符而非全文。需要全文时 GET 单条。
- 列表返回 `id`、`title`、`revision`、`created_at`、`updated_at`、`preview` 和状态；笔记状态是数字 `archived: 0/1`，收集箱/项目是字符串 `status`。
- `total` 是符合筛选条件的全部数量。持续写入时分页位置可能移动，客户端可按 ID 去重。
- 参数重复、未知参数、无效 kind 会被拒绝。日期时间字段为 Unix 秒。

### 2. 新建一条收集内容

调用 `createWorkspaceItem`，`kind=inbox`。为这次逻辑创建生成一次 UUID 并保存到任务上下文，用作 `Idempotency-Key`。不要每次重试换一个值。

```http
POST /api/agent/v1/brain/inbox
Authorization: Bearer <由凭据管理注入>
Content-Type: application/json
Idempotency-Key: 2a52f0ec-aeae-4b9f-b5dc-49a62e456eb4
```

```json
{
  "title": "整理下一轮工作台优化想法",
  "content": "先收集需求，再归纳成项目下一步行动。",
  "source_url": null
}
```

首次成功 **201**，响应头例如 `ETag: "1"`：

```json
{
  "item": {
    "id": "agent_REPLACE_WITH_RETURNED_ID",
    "title": "整理下一轮工作台优化想法",
    "content": "先收集需求，再归纳成项目下一步行动。",
    "source_url": null,
    "status": "inbox",
    "target_type": null,
    "target_id": null,
    "revision": 1,
    "created_at": 1792249200,
    "updated_at": 1792249200
  },
  "replayed": false
}
```

ID 必须使用实际响应值。相同 kind、相同 Key、相同规范化创建内容重放返回 **200 / replayed=true**，不重复创建；同一 Key 换了内容返回 **409**。重放返回条目的**当前版本**，不会覆盖之后的人工作业。Key 范围按 kind 隔离，回执持久保存，没有自动过期时间；新条目始终使用新 Key。

### 3. 整理成笔记

调用 `convertInboxToNote`，Path id 使用收集条目 ID；Header `If-Match` 使用该条目的 ETag（包括双引号）：

```http
POST /api/agent/v1/brain/inbox/{id}/convert
Content-Type: application/json
If-Match: "1"
```

```json
{ "target": "note" }
```

成功 200 返回 `{ "item": <更新后的收集条目>, "note": <笔记全文>, "created": true }`。收集条目变为 `organized`，`target_type=note`，`target_id` 指向笔记；两者在同一事务完成。

已归档条目必须先恢复。若已经整理为笔记，读取最新版本后再次转换只返回原笔记（`created=false`），不会覆盖笔记后续修改。如果以前已在后台转为文章，返回 409，不能强制改目标。此接口不支持转成或发布文章。

### 4. 创建项目并关联笔记

调用 `createWorkspaceItem`，`kind=projects`，使用新的 Idempotency-Key：

```json
{
  "title": "个人工作台迭代",
  "description": "把分散需求整理成可以推进的工作。",
  "next_action": "整理需求并确定第一项改进",
  "status": "active"
}
```

然后调用 `linkProjectNote`：

```http
PUT /api/agent/v1/brain/projects/{项目id}/notes/{笔记id}
If-Match: "1"
```

PUT/DELETE 关联不需要 Body。`If-Match` 是**项目版本**，不是笔记版本；响应为 `{ "item": <项目当前数据> }` 并附新的 ETag。关联增加或移除都会更新项目 revision，后台界面操作也会更新。重复添加已有笔记或移除不存在的关联，在提供当前项目版本时返回 200，不重复创建关联。

项目已关联笔记列表支持同样的 `q/page/limit/archived` 参数，额外返回 `project_revision`；需要修改项目时，先 GET 项目单条来取得当前版本和正文。

### 5. 修改、归档与恢复

先 `getWorkspaceItem` 读取当前条目，保存 `item.revision` 或响应 ETag。再 `updateWorkspaceItem`，传入有双引号的 If-Match，例如 revision 为 3 时传 `"3"`。

只写要改变的字段，其他字段保留：

```json
{ "next_action": "完成接入后整理第一批真实需求" }
```

笔记或收集箱归档：

```json
{ "archived": true }
```

恢复传 `{"archived":false}`。恢复已经整理过的收集条目会回到 `organized`，保留原目标，不会重复转成笔记。

项目归档传 `{"status":"archived"}`，恢复时指定 `active`、`paused` 或 `done`。**这里改变的是私人项目状态，不会撤回已经审核发布的公开快照。** 公开项目的发布和撤回继续在后台操作。

## 字段与长度

| 资源 | 新建 | 可 PATCH 字段 |
|---|---|---|
| notes | title 必填；content、source_url 可省略 | title、content、source_url、archived（布尔） |
| inbox | title 必填；content、source_url 可省略 | title、content、source_url、archived（布尔） |
| projects | title 必填；description、next_action、status 可省略 | title、description、next_action、status |

- `title` 非空，最长 200 字符；`content`、`description` 最长 50000；`next_action` 最长 2000。
- `source_url` 可为 null 或空字符串（保存为 null），否则必须是无用户名密码的 http/https 地址，最长 2000；清空正文传空字符串，不传 null。
- 项目 status：`active` / `paused` / `done` / `archived`；新建默认 active。
- `id`、`revision`、时间、收集箱 status/target、`published_payload`、`public_url` 都不可从 Body 写入。未知字段、空 PATCH、`source`、`metadata` 等自动附加字段会被拒绝。
- 单个 JSON Body 最大 **256 KiB（UTF-8 字节）**，并同时受各字段字符上限约束。
- Idempotency-Key：16–128 个 ASCII 字母、数字或 `_ . : -`；建议 UUID。不要使用凭据作为 Key。
- PUT/DELETE 只改变笔记关联，其他后台既有关联类型保留。

## 重试和冲突处理

| 状态 | 处理方式 |
|---|---|
| 200 / 201 | 读取响应 item 和 ETag；201 表示首次创建，200 可能是去重重放 |
| 400 | 检查字段、长度、URL、参数或 Key，不盲目重试 |
| 401 | 检查 Hermes Token 和 Bearer 前缀；Cookie / qm_ Token 不适用 |
| 404 | kind、ID 或条目不存在 |
| 409 | Key 与原 Body 不一致，或条目状态不允许转换/关联 |
| 412 | 版本已变；重新 GET，比较用户修改，再决定是否提交新的 PATCH |
| 413 / 415 | Body 超过256 KiB / 请求不是 application/json |
| 428 | 缺少 If-Match；必须先读条目 |
| 500 / 503 | 服务或数据库错误，记录操作名、Key、ID、状态，勿记录正文和 Token |

- GET 可以有限退避重试。
- 创建超时后，使用**相同 kind、Key、Body**重试；服务端永久回执避免重复条目。
- PATCH/转换/关联超时后，先 GET 核对目标状态。成功的首次操作已经提升 revision，原 If-Match 再次提交通常会得到 412；不要自动换成新版本后覆盖。
- If-Match 只接受单个强 ETag，如 `"12"`。不接受 `*`、弱 ETag 或逗号分隔列表。
- 后台人工修改也会提升版本，即使发生在同一秒。Bot 不得把冲突当成可以强制覆盖的普通重试。
- 客户端只收到 partial update 的当前结果，不是完整历史记录；没有历史版本恢复接口。

## 可交给 gorkbot 的工具说明

```text
你可以通过 Channing Studio 的通用工作台 HTTP API 管理我的私人笔记、收集箱和项目。
Server 为 https://note.aichanning.cn，使用凭据管理中的现有 Hermes Token，通过 Bearer 注入。
先 GET /api/agent/v1/brain/notes?limit=1 验证连接，不创建假测试数据。

按 gorkbot-workspace.openapi.json 使用 list/create/get/updateWorkspaceItem、convertInboxToNote、list/link/unlinkProjectNote。
普通笔记和项目使用通用接口，不附加 source=flomo。只有真实 Flomo 同步才使用原来的 runs/state 工具。
每次逻辑创建保存一个 Idempotency-Key；网络重试沿用原 Key 和原 Body。
修改、转换或关联前先 GET 当前资源；If-Match 使用项目或条目自己的 ETag，包括双引号。
412 时重新读取并比较差异，不强制覆盖人工修改。只 PATCH 用户要求改变的字段。
清理内容使用归档；取消项目笔记关联不会删除笔记。
不要尝试公开发布项目、文章、上传私人附件、读取后台凭据或转存 Flomo 原文。
不要在聊天、提示词和日志输出 Token 或无关的私人全文。
每次操作报告条目 ID、结果和必要的下一步；不要把失败响应说成已保存。
```

## 验收位置

- 笔记：[后台笔记](https://note.aichanning.cn/admin/notes)。
- 收集内容：[后台收集箱](https://note.aichanning.cn/admin/inbox)。
- 项目与笔记关联：[后台项目](https://note.aichanning.cn/admin/projects)。
- 原 Flomo 同步仍查看 [后台连接](https://note.aichanning.cn/admin/connections)，协议见 [Hermes 指南](gorkbot-hermes-integration.md)。

部署与测试记录见 [通用 Agent API 上线记录](../2026-10-17-agent-brain-release.md)。工具调用成功才代表你的 gorkbot 已实际接通；部署接口本身不表示已经用你的真实 Token 完成联调。
