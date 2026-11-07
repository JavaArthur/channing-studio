# 学习与复盘工作台 · 2026-11-08

## 交付范围

`/admin` 现在进入 `/admin/learning`，优先服务日常学习记录与日复盘。新建、按日期回顾、类型切换、关键词查找、资料集筛选、阅读和富文本编辑形成一个闭环。顶部「记一条」在后台各页可用，完整资料库、项目、运营和公开管理继续保留。

没有增加表、migration、第二套笔记模型或默认学习内容。记录使用现有 `notes`、`library_metadata.topics`、`collections`，标记为「学习记录」或「日复盘」。相同标签的旧笔记直接兼容；文章和其他类型不进入此时间线。同一天多篇日复盘使用独立 UUID，不互相覆盖。日期统一为 `Asia/Shanghai`，计数来自真实查询，分页每页 20 条。

保存始终为私人记录。公开站仍只读取已发布内容或公开快照；转文章和公开发布保持独立、显式的原有流程。公开主页收紧大标题宽度和留白，加入作品／文章／资料目录，并与后台共用纸色、墨色、细分隔线和单一重点色。

## 日常使用

1. 登录后台，点「新建学习记录」或「写日复盘」。正文可从空白开始，也可选用思考提纲。
2. 填写标题和正文；主题标签、HTTP(S) 参考链接、现有资料集或项目关联可选。新建资料集仍在原有资料集管理中完成。
3. 保存后直接阅读，点「编辑」修改。编辑状态真实展示待保存、保存中、已保存、失败或版本冲突。
4. 返回列表，按类型、关键词或资料集回顾。需要更广的查找、收藏和整理时进入完整资料库。

## 失败恢复与边界

- 新建和编辑草稿使用当前标签页的 `sessionStorage`。键按管理员凭据的单向摘要、记录类型和记录 ID 隔离；不会将 session token 发到客户端。
- 新建请求先持久化准确的 payload 和幂等标识，再发送。响应不明时锁定请求内容，刷新后重试相同标识；服务端请求哈希继续防止改内容复用同一个 key。
- 浏览器存储失败时新建请求不会发送，明确显示「本次保存未发送」，正文保留可复制。恢复存储后可正常保存。测试确实注入了配额错误并验证 0 次网络写入。
- 未发送的不完整 URL 也可恢复。保存业务校验只在提交时执行，不会丢掉半填表单。
- 编辑恢复保留原 revision；服务端版本已变化时保持冲突，即使连续刷新也不会覆盖较新的内容。已成功提交但响应丢失的同值草稿会被清除。
- 取消「保存后离开」后，已经发出的保存仍可完成；界面给出「打开已保存记录」，不会再次创建或突然跳转。
- 保存成功清除对应草稿，退出成功清除此应用的私人草稿。关闭标签页或清理浏览器存储后不承诺恢复；没有增加跨设备草稿同步。
- 后台列表区分真正空白、筛选无结果、载入中与失败。错误时不显示虚假的 0 条记录。

## 设计依据

Lead 从已安装的乔木 UI 学习插件 `qiaomu-ui-learn-dsh@0.1.4` 提供了参考，使用的是当前插件 13,561 项库中的页面：

- [Fieldnote dashboard](https://agent.kombai.com/kombai-inspiration-library/app-pages/dashboards/web/7/index.html)：紧凑分组导航、明确新建动作、下划线类型切换。
- [Loomfield Studio dashboard](https://agent.kombai.com/kombai-inspiration-library/app-pages/dashboards/web/38/index.html)：安静边框、标题与状态层级、克制内容密度。
- [Fieldnote editor](https://agent.kombai.com/kombai-inspiration-library/app-pages/rich-text-editor/web/1/index.html)：仅借鉴保存／私人状态与显式发布动作分离；没有照搬其画布、协作和工作流。

色彩和字体继续遵循仓内 [DESIGN.md](../DESIGN.md)，没有引入面板指标、连续学习天数或虚构增长统计。桌面以时间线和整理入口两栏组织；375px 单栏保留触手可及的新建和筛选，深浅色使用共享语义 token。

## 验证结果

所有测试和截图只使用新建的本地 D1 与合成数据，未接触生产 D1 或私人历史内容。现有测试未删除、跳过或弱化。

| 检查 | 实际结果 |
| --- | --- |
| 改动前 Vitest | 50 files / 263 tests，通过 |
| focused journal + save queue | 11 / 11，通过 |
| 最终 `npm run verify:quick` | lint、TypeScript、Next 生产构建通过；51 files / 268 tests 全通过 |
| 既有编辑、离页、公开导航与首轮学习流回归 | 27 / 27，通过 |
| 最终学习流 E2E（Next 本地 D1） | 6 / 6，通过，含配额故障和取消离页 |
| 完整 `opennextjs-cloudflare build` | 通过，生成真实 Worker |
| 编译 Worker 上学习流 + 公开导航 | 9 / 9，通过 |
| 已登录后缺失 DB 的真实 Worker | 4 / 4，通过：错误可见、无假 0 计数、重试可用、无页面异常 |
| 独立工程 API / D1 审核 | 5 / 5，通过 |
| 独立 UX 全流程审核 | 22 / 22，通过；最后 Worker 存储边界复验 7 / 7 |
| 5000 条 SQLite 查询 | 最终 quick 实测 101.5ms，返回 30 条预览；不是生产 D1 性能保证 |

反向验收覆盖未认证 API 401、后台跳转登录、私人标记不出现在公开主页／文章／工具／提示词／sitemap、同日复盘不覆盖、幂等重试不重复、修改同 key 返回 409、过期 revision 返回 412，以及两次刷新后仍拒绝过期草稿覆盖。

构建过程曾尝试在普通 `next build` 之后使用 `--skipNextBuild`，因普通构建没有 standalone 产物而报 `ENOENT ... .next/standalone/.next/server/pages-manifest.json`。已使用完整 OpenNext 构建成功验证，没有填造产物或忽略错误。Node `module.register()` 废弃和 Playwright `NO_COLOR` 提示为环境警告。

## 前后截图

最终截图来自编译 Worker，三个列表样例均明确标为「合成验收」，筛选计数是真实本地记录数；它们不会写入生产或作为应用默认数据。

- [改造前后台](screenshots/learning-2026-11-08/before-admin.png) ／ [改造前公开站](screenshots/learning-2026-11-08/before-public.png)
- [后台桌面](screenshots/learning-2026-11-08/after-admin-desktop.png) ／ [桌面深色](screenshots/learning-2026-11-08/after-admin-desktop-dark.png)
- [后台手机](screenshots/learning-2026-11-08/after-admin-mobile.png) ／ [手机深色](screenshots/learning-2026-11-08/after-admin-mobile-dark.png)
- [新建记录](screenshots/learning-2026-11-08/after-capture-desktop.png)
- [数据库不可用](screenshots/learning-2026-11-08/after-error-mobile.png) ／ [错误深色状态](screenshots/learning-2026-11-08/after-error-mobile-dark.png)
- [公开站桌面](screenshots/learning-2026-11-08/after-public-desktop.png) ／ [公开站手机](screenshots/learning-2026-11-08/after-public-mobile.png)

## 本地运行与后续

隔离配置为忽略目录内的 `.wrangler/learning-20261108/wrangler.local.toml`，只绑定本地合成 D1/R2/DO；状态在 `.wrangler/learning-20261108/state`。Wrangler 使用 `--persist-to .../state`，Next 开发绑定使用 `CF_LOCAL_PERSIST_PATH=.../state/v3`。该配置和合成登录信息不作为部署配置提交。

```bash
# 已有本轮合成状态可直接使用；从空状态开始才执行 schema，绝不能指向已有生产库。
WRANGLER_SEND_METRICS=false npx wrangler d1 execute DB --local \
  -c .wrangler/learning-20261108/wrangler.local.toml \
  --persist-to .wrangler/learning-20261108/state --file db/schema.sql

npm run verify:quick
WRANGLER_SEND_METRICS=false npx opennextjs-cloudflare build \
  -c .wrangler/learning-20261108/wrangler.local.toml
WRANGLER_SEND_METRICS=false npx wrangler dev --local \
  -c .wrangler/learning-20261108/wrangler.local.toml \
  --persist-to .wrangler/learning-20261108/state --ip 127.0.0.1 --port 3104

# E2E_ADMIN_PASSWORD 由本地合成配置提供，不读取真实凭据。
E2E_BASE_URL=http://127.0.0.1:3104 npx playwright test \
  tests/e2e/journal.spec.ts tests/e2e/public-navigation.spec.ts
```

本页记录本地验收阶段，截图和写入测试均来自独立合成 D1。本轮无需 schema 变更；后续已按用户授权推送并发布到既有生产 Worker，实际版本、线上只读验收和回滚步骤见[生产发布记录](release-20261108.md)。原有未跟踪 `paseo.json` 未改动。
