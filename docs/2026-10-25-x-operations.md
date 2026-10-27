# 多账号 X 运营

后台入口：`/admin/operations`。使用现有后台登录，顶部选择「AI Agent 开发」或「娱乐八卦闲聊」。这只是本站的内容分区，跳转 X 后仍需核对浏览器中的登录账号。

外部 Agent 提交已经整理好的、可以使用的原创文案。操作者选择内容后可以复制、去原帖回复、编辑自己的帖子，或主动点击 AI 润色。AI 仅接收当前工作文案和本次要求，使用已配置的默认文本模型；结果先预览，采用后再保存，不自动发布。模型不能证明内容没有抄袭，上游 Agent 与操作者应核对事实、独立表达，不能只替换原文同义词。

Agent 正文保存在 `content`，人工版本保存在 `edited_content`。工作文案初始采用 Agent 正文；保存或重试不会覆盖 Agent 正文。超出 280 加权字符会提示，不阻止保存。复制和跳转不改变状态；互动完成后手动标记已处理，也可以忽略或恢复待处理。

## MCP 投递

工具：`create_x_draft`。`workspace_status`、`list_x_drafts` 和 `create_x_draft` 的返回都包含 `x_account_help`，直接列出 `ai` / `bg`、默认账号及创建和查询示例。每次逻辑创建生成独立 request_key，重试保留原键和所有参数。默认账号 `ai`，娱乐账号 `bg`。

AI Agent 开发示例（省略账号也进入同一分区）：

```json
{
  "request_key": "REPLACE_WITH_UNIQUE_UUID",
  "account_id": "ai",
  "content": "我更关心 Agent 的失败恢复：工具调用超时后，能否知道哪些步骤已经执行，比演示里一次跑通更有参考价值。",
  "source_type": "hot_post",
  "source_url": "https://x.com/example/status/123"
}
```

娱乐闲聊示例：

```json
{
  "request_key": "REPLACE_WITH_ANOTHER_UNIQUE_UUID",
  "account_id": "bg",
  "content": "看综艺时最让我记住的，往往不是安排好的高潮，而是嘉宾没接住梗之后那几秒真实的反应。",
  "source_type": "bg"
}
```

示例链接是占位符，接入时换成真实来源。来源仅限无凭据的 HTTP(S) 地址。未知账号会被拒绝，不会自动归入默认分区。

- `list_x_drafts`：默认 `account_id=ai`、`status=pending`。娱乐内容需指定 `bg`；跨账号显式指定 `all`。搜索覆盖 Agent 原稿与工作文案。
- `get_x_draft`：按 ID 读取账号、原稿、工作文案与当前 revision；原有 char_count/over_limit 仍描述 content，页面按工作文案即时计数。
- `update_x_draft`：使用 expected_revision；人工修改写 edited_content，null 表示使用 Agent 原稿。可更新账号归属。版本冲突返回 412，不能盲目覆盖。
- `pending/posted/discarded`：页面显示待处理/已处理/忽略；保留历史 posted_url，恢复待处理或忽略时沿用旧接口清空链接的规则。
- 旧 `capture_library_item(type=inspiration)` 继续写入默认账号，返回运营详情链接。旧按 ID 读取与编辑继续兼容，资料库列表、搜索、收藏、最近阅读和资料集计数均排除短帖。历史元数据和关联不删除。

## 迁移与验证

先导出生产 D1 并核对备份可恢复，再在隔离数据库演练 `db/migrations/2026-10-25-x-operations.sql`，最后按现有部署流程应用该增量一次。不要重复运行 ALTER TABLE，也不要重放历史迁移。新库使用同步后的 db/schema.sql。

迁移增加 account_id（默认 ai）、edited_content（默认 null）和账号/状态/创建时间索引；历史 ID、正文、revision、状态与创建回执保留。默认账号继续沿用旧创建指纹，因此迁移前的请求键仍能重试。

验证：先运行 X drafts、library 和 MCP focused tests，再执行 `npm run verify:quick`。使用本地隔离 D1 运行 `tests/e2e/x-drafts.spec.ts`；AI 响应在浏览器测试中替换为合成响应，不消耗真实模型配额，不对外发布。

## 上线记录（2026-10-25）

已发布到 `https://note.aichanning.cn/admin/operations`，MCP 服务版本为 `0.3.1`，新版本承接全部流量。账号 ID 仅使用 `ai` 与 `bg`；连接检查、短帖列表和创建结果包含 `x_account_help` 传参说明。

生产 D1 已先备份并恢复演练，再应用本文件所述增量迁移。迁移时 253 条历史短帖默认归入 `ai`，正文、状态、revision 和其他历史表数据保持不变，外键检查通过。备份、发布源码与回退版本记录保存在仓库外的私有运维目录。

验证通过：254 项单元/接口测试、4 项运营页面端到端测试、lint、Next.js 与 OpenNext 构建。生产使用既有 MCP 读写凭据分别验证版本、工具参数、默认账号、分区查询和传参说明；使用现有浏览器登录会话验证两个账号页面、账号筛选 API 和短帖详情。公开页面正常，匿名后台访问继续受鉴权保护。本次线上验收未新增测试短帖，也未调用模型或发布 X 内容。
