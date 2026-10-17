# gorkbot 接入 Channing Studio（Hermes 同步接口）

更新：2026-10-17。依据当前生产版本对应的路由、校验器和仓储实现编写。

你已有 **Hermes 专用同步 Token**，gorkbot 支持 **HTTP API 工具**。本文只描述原 Flomo 同步的 4 个端点。管理普通笔记、收集箱和项目现已提供 [通用工作台接口](gorkbot-workspace-integration.md)，沿用同一 Token；可导入 [完整 OpenAPI](gorkbot-workspace.openapi.json)。本文不包含真实 Token。

## 1. 先明确接入后能做什么

当前链路是：

```text
gorkbot 通过已有的 Flomo 接入读取来源
  → 在自己的执行环境中整理、脱敏
  → 使用 Hermes Token 回传运行状态、来源标识和成果摘要
  → 网站 /admin/connections 展示同步结果
  → /admin/search 可以搜索脱敏知识成果
```

**这个 Token 是网站 Agent API 的凭据，不是 Flomo 的读取凭据。** gorkbot 仍需自己具备读取 Flomo 的能力；网站不会替它读取 Flomo，也不会把 Flomo Token 转发给它。

当前协议只接受 `source: "flomo"`。`gorkbot` 是执行者，不是来源名称。不要把普通聊天、网页或任意笔记假装成 Flomo 数据。若你的目标是“把 gorkbot 的所有聊天写进私人笔记、收集箱或项目”，请使用已补齐的通用工作台 API；本页这 4 个 Flomo 同步端点不承担该功能。

| 需求 | 本页的 Flomo 同步端点 |
|---|---|
| 查询同步去重状态 | 支持 |
| 记录一次 Flomo 整理任务开始、完成或失败 | 支持 |
| 回传脱敏成果、来源 ID、版本时间和哈希 | 支持 |
| 读取 Flomo 原文 | 不支持，使用 gorkbot 自己的来源连接 |
| 读取网站私人笔记全文、项目、全部成果列表 | 不支持 |
| 管理普通笔记、收集箱和项目 | 使用独立的 `/api/agent/v1/brain/*` 通用接口；原后台路由仍使用管理员会话 |
| 新建或发布网站文章 | 不支持；`type: "draft"` / `"published"` 只登记成果状态，不创建或发布文章 |
| 收到网站主动推送 | 不支持；由 gorkbot 主动发起 HTTP 请求 |

## 2. 在 gorkbot 配置连接

以下是通用 HTTP 工具字段映射，不假定 gorkbot 的配置文件格式或菜单名称。

| 配置项 | 填写内容 |
|---|---|
| 连接名称 | `channing_studio_hermes` |
| 站点地址 / Server URL | `https://note.aichanning.cn` |
| 认证方式 | HTTP Bearer |
| Token / API Key | 你的 Hermes 专用 Token，仅放在 gorkbot 凭据管理中 |
| 最终请求头 | `Authorization: Bearer <凭据管理注入的Token>` |
| POST 请求类型 | `Content-Type: application/json` |
| 响应类型 | JSON |
| 超时建议 | 30 秒；根据执行环境网络调整 |
| 自动重试 | 默认关闭写入重试，按第 7 节区分接口处理 |
| 请求目标限制 | 仅 `https://note.aichanning.cn/api/agent/v1/` 下本文列出的接口 |

如果认证面板已经选了 **Bearer**，Token 输入框只填 Token 本身，不要再次加 `Bearer `。如果手动配置 Header，则完整写入一次 `Bearer ` 前缀。

不要使用 `qm_` 博客 API Token、Cloudflare Token、后台密码或 Flomo Token 替代。不要把 Token 写到提示词、URL 查询参数、工具参数、OpenAPI 文件或执行日志里。HTTP 工具不要自动向其他域名跟随重定向并携带凭据。

### 直接导入 OpenAPI

同目录提供 [gorkbot-hermes.openapi.json](gorkbot-hermes.openapi.json)，格式为 OpenAPI 3.0.3，只描述现有 4 个端点。若 gorkbot 支持 OpenAPI 导入，上传该文件，再单独配置 Bearer 凭据；不支持导入时按下表手动创建工具。

| 工具名 / operationId | 方法 | 路径 | 参数放置 |
|---|---|---|---|
| `getHermesSyncState` | GET | `/api/agent/v1/state` | Query：`start_date`、`end_date` |
| `startHermesSyncRun` | POST | `/api/agent/v1/runs` | JSON Body |
| `completeHermesSyncRun` | POST | `/api/agent/v1/runs/{id}/complete` | Path：`id`；JSON Body |
| `failHermesSyncRun` | POST | `/api/agent/v1/runs/{id}/fail` | Path：`id`；JSON Body |

注意 Server URL 已是域名；工具路径已包含 `/api/agent/v1`，不要重复拼接前缀。

## 3. 第一次只测试读取

在 gorkbot 手动执行 `getHermesSyncState`：

```json
{
  "start_date": "2026-10-17",
  "end_date": "2026-10-17"
}
```

HTTP 请求应为：

```http
GET /api/agent/v1/state?start_date=2026-10-17&end_date=2026-10-17
Host: note.aichanning.cn
Authorization: Bearer <由凭据管理注入>
```

用实际要处理的日期替换示例日期。日期格式是 `YYYY-MM-DD`，开始日期不能晚于结束日期。服务端按 `sourceUpdatedAt` 的 UTC 日期做**包含首尾两天**的查询；北京时间跨日窗口要考虑 UTC 日期变化。

空状态响应示例（200）：

```json
{
  "lastSuccessfulAt": null,
  "items": [],
  "pendingSourceIds": [],
  "blocked": null
}
```

有数据时 `items` 中的元素包含 `sourceId`、`sourceUpdatedAt`、`contentHash`，不包含原文或成果摘要。`pendingSourceIds` 是该日期窗口内仍为 `candidate` / `blocked` 的来源 ID；它们即使哈希没变，也不能简单跳过。

`lastSuccessfulAt` 是 Unix **秒**，不是毫秒。`lastSuccessfulAt` 与 `blocked` 查询的是全局最近记录，并不受请求日期窗口限制；`blocked` 可能是历史失败，不能仅凭它非空就判定当前同步失败。此接口没有分页参数，首次用小日期窗口。

### 可选：终端独立检查

下面在 **Bash** 中执行。交互输入不会写入命令历史，调用只读取同步状态：

```bash
read -r -s -p 'Hermes Token: ' HERMES_SYNC_TOKEN
printf '\n'
curl --silent --show-error --fail-with-body --max-time 30 \
  'https://note.aichanning.cn/api/agent/v1/state?start_date=2026-10-17&end_date=2026-10-17' \
  -H "Authorization: Bearer ${HERMES_SYNC_TOKEN}"
unset HERMES_SYNC_TOKEN
```

不要用 `curl -v`、Shell `set -x` 或完整请求头日志调试认证。优先使用 gorkbot 的凭据管理执行，终端方式只是可选诊断。

## 4. 开始一次真实任务

先读取状态，再让 gorkbot 从自己的来源连接获取真实 Flomo 条目。确认来源可用后调用 `startHermesSyncRun`。

请求 Body 示例：

```json
{
  "source": "flomo",
  "mode": "reconcile",
  "windowStart": "2026-10-17",
  "windowEnd": "2026-10-17"
}
```

成功响应是 **201**：

```json
{
  "runId": "run_EXAMPLE_REPLACE_ME"
}
```

将真实返回的 `runId` 持久化到 gorkbot 本次任务上下文，后续作为 Path 参数 `id`。不要自己生成或硬编码该 ID。没有名为 `success` 的响应字段，判断应检查 201 和 `runId`。

- `source`：固定 `flomo`。
- `mode`：`hourly`、`nightly`、`reconcile` 三选一；手动补录可使用 `reconcile`。
- `windowStart`、`windowEnd`：日期，不是带时分秒的时间戳。
- 这些模式只是记录标签，不会让网站自动定时运行或主动拉取数据。
- 请求只允许这 4 个字段。不要附加 `botName`、`agentId`、`token`、`metadata` 等字段。

首次写入请选少量真实条目。本文示例值不能作为真实生产来源直接提交，否则会污染同步统计。只想检查认证时停在第 3 节，不创建任务。

## 5. 完成任务并回传脱敏成果

调用 `completeHermesSyncRun`，路径中的 `id` 使用上一步返回值。以下是结构示例，来源 ID、时间、哈希和成果必须换成真实处理结果。

```json
{
  "discoveredCount": 1,
  "sourceItems": [
    {
      "sourceId": "flomo-example-replace-with-real-id",
      "sourceUpdatedAt": "2026-10-17T08:30:00Z",
      "contentHash": "example-replace-with-source-content-sha256",
      "decision": "processed",
      "domain": "knowledge",
      "decisionReason": "已整理为可复用的知识摘要"
    }
  ],
  "artifacts": [
    {
      "artifactKey": "gorkbot:knowledge:example-replace-with-stable-key",
      "type": "knowledge",
      "domain": "knowledge",
      "stage": "已整理",
      "title": "如何把零散记录整理成可复用知识",
      "summary": "先识别问题和结论，再补充适用条件与后续行动，形成可复用的简短摘要。",
      "sourceIds": ["flomo-example-replace-with-real-id"],
      "targetPath": null,
      "publicUrl": null,
      "status": "active"
    }
  ],
  "snapshot": {
    "periodLabel": "本次整理",
    "narrative": "完成一条来源的整理，形成一项知识成果。",
    "domains": {
      "knowledge": {
        "label": "知识整理",
        "detail": "已完成摘要整理",
        "status": "done"
      }
    }
  }
}
```

成功响应是 **200**：

```json
{
  "success": true,
  "idempotent": false
}
```

同一成功任务再次提交有效请求会返回 `idempotent: true`，不会重新更新成果。不能通过修改 Body 再次提交同一 runId 来改稿；有新结果时需要新任务。

如果实际检查后没有任何条目，也可以完成真实的空任务：`discoveredCount: 0`、`sourceItems: []`、`artifacts: []`、`snapshot: null`。不要为了连通性测试每天制造虚假的空任务。

### 字段与约束

| 位置 | 必须遵守 |
|---|---|
| 顶层 | `discoveredCount` 是非负安全整数，且 ≥ `sourceItems.length`；`sourceItems`、`artifacts` 必须为数组；`snapshot` 可省略或为 null |
| 批量 | 校验器允许两类数组各最多 50 条；初次接入建议每批 1–5 条，生产最大批量未做压测。超过单批量时分任务提交，不能对同一 runId 连续追加批次 |
| 来源 ID | `sourceId` 必填，最长 128 字符；使用真实稳定 ID，并与已有 Hermes 来源 ID 约定一致，不要因更换执行器而改 ID |
| 来源版本 | `sourceUpdatedAt` 是来源真实更新时间，UTC ISO8601，以 `Z` 结尾，可带 1–3 位毫秒；同一来源保持统一精度格式，不用本次同步时间冒充更新时间 |
| 内容哈希 | `contentHash` 必填，最长 128 字符；建议在来源侧按一致规则计算 SHA-256，沿用已有 Hermes 规则；服务端不接收原文重算哈希，也不强制哈希算法 |
| 来源判断 | `decision` 为 `ignored` / `candidate` / `processed` / `blocked`；`decisionReason` 必填，≤300 字符 |
| 领域 | 来源和成果的 `domain` 为 `work` / `investing` / `knowledge` / `content` |
| 成果 ID | `artifactKey` 必填，≤180 字符；稳定且不与其他写入者误撞；同一逻辑成果更新沿用同一个 key |
| 成果类型 | `type` 为 `knowledge` / `topic` / `draft` / `published`；只是成果分类，绝不触发文章发布 |
| 成果内容 | `stage` 必填 ≤80；`title` 必填 ≤200；`summary` 必填 ≤500 字符 |
| 来源关联 | 每项成果 `sourceIds` 必须为 1–20 个 ID，且每一个都必须出现在本次 `sourceItems` 中；历史来源即便已经同步，本次引用也要带上 |
| 成果可选项 | `status` 默认 `active`，可选 `active` / `archived` / `blocked`；`targetPath` 最长500；`publicUrl` 最长1000；均可为 null |
| 任务快照 | `periodLabel` ≤80；`narrative` ≤500；`domains` 为上述领域的子集，每项含 `label` ≤40、`detail` ≤200、`status` 为 `active` / `done` / `blocked` / `quiet` |
| 重复和额外字段 | 同批不能重复 `sourceId` 或 `artifactKey`；所有请求对象均拒绝未声明字段 |

每条非空文本都会去掉首尾空白。`selectedCount`、`artifactCount` 等统计由服务端计算，不要自行放进请求体。`selectedCount` 包含非 `ignored` 的来源，不等于“已完成数量”。

### 公私边界

- 不发送 Flomo 原文、整段聊天、完整 Markdown、凭据、私人附件地址或带签名的下载地址；只发送来源标识、版本、哈希、脱敏决策与短摘要。
- `summary`、`decisionReason`、快照 `narrative` / `detail`、失败 `message` / `nextAction` 不能含 URL 或凭据特征；需要链接时使用 `publicUrl`。
- `publicUrl` 只用无需登录的 HTTP(S) 公开地址，不能有用户名/密码或 `token`、`access_token`、`sig`、`signature`、`expires` 等签名参数。服务端校验并不替你证明链接实际公开，客户端仍需确认。
- `targetPath` 只放脱敏后的仓库相对路径，不放本机绝对路径、URL 或凭据；没有就传 null。
- `title`、`stage`、ID 等字段也要脱敏，不能把敏感内容塞到未检查 URL 的字段绕过限制。
- `status: "active"` 不等于对外公开。成果存入 `knowledge_artifacts`，主要在后台“连接”和私有搜索中显示；不会自动出现在首页、文章列表或手动笔记列表。

## 6. 失败时结束任务

如果已经取得 runId，但处理失败，调用 `failHermesSyncRun`。示例：

```json
{
  "code": "FLOMO_MCP_UNAVAILABLE",
  "message": "来源连接暂时不可用，本次任务未完成",
  "retryable": true,
  "nextAction": "恢复来源连接后重新创建任务处理相同窗口"
}
```

成功响应：`200 {"success":true}`。`message` 必填 ≤500，`nextAction` 必填 ≤300，均为脱敏描述；`retryable` 必须是布尔值。不要把异常堆栈、请求头或完整 URL 直接复制进错误消息。

当前只允许以下错误码，**没有** `UNKNOWN_ERROR` 或 `GORKBOT_ERROR`：

| code | 任务终态 |
|---|---|
| `FLOMO_AUTH_FAILED` | failed |
| `FLOMO_MCP_UNAVAILABLE` | failed |
| `FLOMO_WINDOW_SATURATED` | blocked |
| `CHEN_NOTES_DIRTY` | blocked |
| `CHEN_NOTES_PULL_FAILED` | blocked |
| `CHEN_NOTES_PUSH_FAILED` | blocked |
| `DASHBOARD_API_REJECTED` | failed |

错误码按真实原因选择，不能为了通过校验伪造失败原因。若遇到协议未覆盖的通用 Bot 错误，保存在 gorkbot 本地运行日志并提示人工处理，后续扩展协议。`retryable` 只是记录，不会触发服务器自动重试。

## 7. 去重、并发和重试

1. 每批先查 state，并与来源 ID、更新时间、哈希比较；`pendingSourceIds` 单独处理。不要将已处理来源每轮都计入新增发现数量，避免重复统计。
2. 保存 start 的 runId 和即将提交的 complete Body，再发送结果。同一组来源优先串行处理，避免 gorkbot 与已有 Hermes 同时写入产生版本冲突。
3. **GET state**：网络超时或临时 5xx 可指数退避，建议 1、2、4 秒，最多 3 次重试。
4. **POST runs**：不支持幂等键，每调用一次都会新建任务。超时后结果未知，先在 `/admin/connections` 核对，不能盲目重新创建；state 不提供完整运行列表或按 runId 查询接口。
5. **POST complete**：超时或临时 5xx，可用相同 runId 和完全相同 Body 有限重试；成功后的幂等响应不表示新 Body 被采纳。`409` 表示任务已结束或来源/成果版本已变化，先重新读取状态并核对，禁止强制覆盖。
6. **POST fail**：只接受 running 任务；已失败、已阻塞或已成功的任务再次 fail 返回 409。不要把 complete 成功后的网络重试变成 fail 请求。
7. 每个任务最终只走 complete 或 fail。需要改成果、重试已失败任务或提交下一批时，创建新的运行记录，并保留稳定来源/成果 ID。

| 现象 | 排查 |
|---|---|
| 401 Unauthorized | 是否用 Hermes 专用 Token，是否已失效，是否多写了一次 Bearer，是否丢失请求头 |
| 400 时间窗口不合法 | 日期格式、必填 query、开始结束顺序；日期字段与 UTC 时间戳字段不能混用 |
| 400 source 只支持 flomo | 不要填 gorkbot；非 Flomo 业务需要新接口 |
| 400 包含不允许的字段 | 移除 Bot 自动附加的 metadata、token、success、统计值等 |
| 400 来源关联或文本限制 | 检查同批 sourceItems、字符上限、URL、凭据、枚举 |
| 404 运行记录不存在 | Path id 必须来自真实 start 响应；不要混用本地与生产 runId |
| 409 | 终态重复操作或版本冲突，按上面的重试规则处理 |
| 500 / 503 | 保存 runId、操作名、时间、HTTP 状态和脱敏错误信息；不要反复创建任务。大批次失败可排查数据库参数限制 |
| 403 或返回 HTML | 可能是 Cloudflare/WAF/网络层响应，不代表 JSON 协议成功；核对地址和执行环境网络 |
| 创建成果后首页没有变化 | 正常，此接口写后台投影，不发布文章 |

## 8. 可直接交给 gorkbot 的接入指令

以下文本不包含 Token，可作为工具使用说明；凭据应独立绑定到 HTTP 工具：

```text
接入我的 Channing Studio，服务地址 https://note.aichanning.cn。
使用凭据管理中已有的 Hermes 同步 Token，通过 HTTP Bearer 注入认证。
工具只有 getHermesSyncState、startHermesSyncRun、completeHermesSyncRun、failHermesSyncRun，定义以所附 OpenAPI 为准。

先只执行 getHermesSyncState 检查连通性。成功后，实际 Flomo 整理任务按以下流程运行：
1. 查询目标 UTC 日期范围内的同步状态，处理 pendingSourceIds。
2. 通过我已配置的来源连接获取真实 Flomo 条目；这个网站 Token 不提供 Flomo 读取权限。
3. 创建 source=flomo 的运行记录，保存响应 runId。
4. 在来源侧整理和脱敏，提交少量 sourceItems 与 artifacts，所有成果 sourceIds 必须属于同批来源。
5. 正常结束调用 complete；遇到协议已支持的真实失败原因调用 fail。
6. 报告 runId、处理数量、HTTP 结果和后台查看入口，不输出 Token、原文或完整请求头。

不把普通聊天伪装成 Flomo 来源，不发送 Flomo 原文，不把 type=published 当成文章发布接口。
不自动重试 start，不复用已结束的 runId 来改稿，complete 重试必须使用相同 runId 与相同 Body。
若我要求通用笔记、收集箱或项目管理，使用另附的通用工作台工具；文章发布仍不在 Agent 接口范围内，不尝试后台 Cookie 接口。
```

## 9. 如何验收

1. state 返回 200 JSON，证明 HTTP 连接和 Token 匹配。
2. 一次真实小批任务 start 返回 201 和 runId。
3. complete 返回 200 / success，后台 [连接](https://note.aichanning.cn/admin/connections) 出现该次结果。
4. 用成果标题在 [后台搜索](https://note.aichanning.cn/admin/search) 找到脱敏成果；不期待它出现在手动“笔记”列表。
5. 同一个 complete 有效请求重放返回 idempotent=true，不新增同一成果；这步只用于该次真实任务确认，不重新创建假任务。

本次交付为接入文档和接口描述。3 个写入示例已通过项目现有请求校验器和 OpenAPI 请求 Schema 的离线校验；全部 Schema 引用可解析，相关鉴权、路由与数据库回归共 23 项通过。没有读取你的 Token，也没有替 gorkbot 运行生产写入或宣称已打通真实来源。gorkbot 支持 HTTP 工具已确认，具体产品的 OpenAPI 导入兼容性需以其界面为准。

实现依据：`app/api/agent/v1/`、`lib/agent-knowledge/auth.ts`、`types.ts`、`validation.ts`、`repository.ts`。以上路径相对于项目根目录。
