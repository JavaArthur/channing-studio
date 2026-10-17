# 个人大脑改造：交付与上线说明

日期：2026-10-17
分支：`codex/personal-brain`
设计基线：[原始评审与方案](2026-10-16-personal-brain-refactor-plan.md)

## 当前状态

应用改造、本地验证、生产 D1 备份恢复演练、增量迁移和 Worker 部署均已完成。正式站点：https://note.aichanning.cn 。生产操作和验收结果见 [上线记录](2026-10-17-personal-brain-production-release.md)。

后续补充了 gorkbot 通用工作台 API，使用现有 Hermes Token 管理笔记、收集箱和项目，支持去重创建和条件更新；参见 [接入文档](api/gorkbot-workspace-integration.md) 和 [Agent API 上线记录](2026-10-17-agent-brain-release.md)。原后台管理员会话与公开发布流程保留。

导出的 Markdown 提供了 Wrangler 绑定配置，没有包含密钥明文。随后通过 Wrangler OAuth 完成 Cloudflare 登录，核对线上原有 `ADMIN_PASSWORD`、`ADMIN_TOKEN_SALT`、`AI_CONFIG_ENCRYPTION_SECRET`、`HERMES_SYNC_TOKEN` 均存在；部署到原 Worker 时保留了这些 secrets，无需从旧 Mac 复制或重置。

恢复的原始绑定配置保存在仓库外的私有运维目录，权限为 `0600`。当前仓库中的 `wrangler.local.toml` 使用隔离的本地 D1/R2；`.dev.vars` 中是本机生成的开发测试凭据，均被 Git 忽略，不是生产密码。

## 已交付

| 范围 | 实际行为 |
|---|---|
| 首页与导航 | 精简为身份介绍、代表项目、文章、资源和联系；公开页共用导航；无内容的首页可选区块自动隐藏 |
| 日夜配色 | 仅白天和晚上；首次跟随系统，手动选择保存在当前浏览器；旧 terminal 偏好映射为晚上，其余旧布局偏好迁移到白天或系统默认；删除六套旧首页模板及皮肤菜单 |
| 私人工作台 | `/admin` 展示待整理、继续写作、进行中项目、知识笔记；侧栏导航，手机折叠导航；Hermes 仪表盘移至 `/admin/connections` |
| 收集与知识 | 收件箱、私人笔记、标题筛选、分页、归档/恢复；收件箱可整理为笔记或文章草稿，笔记也可转为文章草稿；转换幂等且保留来源，不覆盖已经整理的目标 |
| 项目 | 私人说明、状态、下一步、关联笔记/文章/工具/提示词；公开标题、摘要和链接单独编辑、发布或撤回，私人资料不会随之公开 |
| 搜索 | 后台搜索笔记、收件箱、项目、文章、资源及 Hermes 脱敏知识成果；分表限量查询再合并，适配本地 D1 的查询限制；所有入口继续检查 admin session |
| 写作 | 自动保存与“保存工作稿”写独立工作副本；明确发布才改公开正文；发布版本与工作稿版本校验，双窗口冲突保留当前输入并提示重新打开比较 |
| 密码文章 | 未验证和错误密码分支不再向客户端组件传正文、HTML 或密码；公开文章读取绕过旧 KV 正文缓存，防止撤回后旧副本继续被读取 |
| 资源 | 新工具/提示词默认私密；保存工作版本与公开发布分离；公开页面仅取字段白名单快照，可单独撤回；`/tools`、`/prompts` 是同一资源入口下的两个视图 |
| 内容管理 | 后台文章 SQL 筛选、真实计数、每页 30 条；精选文章按指定 slug 查找，不受前 25 篇限制，并提供标题搜索选择；首页不足时用最近文章补齐 |
| 公开配置 | 工作室配置一次请求、事务写入、版本检查；导航仅允许站内路径或 http/https；配置读取失败不会在后台伪装成可编辑的空数据 |
| 设置减法 | 基础设置、连接与访问、高级功能三个入口；高级面板按展开加载；移除任意 JavaScript 注入和字体/皮肤管理；去掉 AI 配置的固定备用加密密钥 |
| 运行脚本 | 默认开发改为本地 Next；预览通过 Wrangler 直接使用指定配置，不再让适配器隐式读取默认远程绑定，也不再强制终止所有 Wrangler/workerd 进程或执行 `.env.local`；部署必须显式选择配置，且不自动执行 schema/seed；验证使用项目锁定的 OpenNext |

普通收集、工作稿保存和资源管理不会自动调用外部生成模型。现有发布后推荐索引链路保留，只为符合公开条件的文章更新索引。提示词收藏正文不会被发送给第三方服务。

## 数据迁移

新增增量文件：`db/migrations/2026-10-16-personal-brain.sql`。同步维护了新库的 `db/schema.sql`。

- 新增 `posts.revision` 与 `post_working_copies`。
- 工具增加私密标志和公开快照；将历史工具按原先“已公开”语义回填。
- 提示词增加公开快照；只为原先公开的条目回填，原私密正文不进入快照。
- 新建 `inbox_items`、`notes`、`projects`、`project_links` 及索引。
- 不删除旧文章、配置、资源或 Agent 数据；历史隐藏文章继续私密，不自动放开直接链接。

该增量文件只执行一次，前提是目标库已有旧版 Studio 的完整表结构。历史 migration 目录包含不同阶段、不同基线的脚本，**不能把整个目录无差别重放到现有库**。新建空库使用完整 schema；已有库使用经盘点确认的增量文件，二者不混用。

## 本地复核

建议 Node 24。依赖已在本机安装。

```bash
npm ci
# 仅新建的本地空库需要初始化；现有本地库先确认结构
npx wrangler d1 execute DB --local -c wrangler.local.toml --file db/schema.sql
npm run dev:next
```

另开终端验证：

```bash
npm run test:run
npm run test:e2e
# 停止开发服务后再执行：会清理 .next/.open-next
npm run verify:quick
npx opennextjs-cloudflare build
# 已构建产物的隔离 Worker 预览
npx wrangler dev --local -c wrangler.local.toml --port 8787
```

`test:e2e` 需要本地服务和 `.dev.vars` 中的本地管理员凭据。默认连接 `http://127.0.0.1:3000`，仅允许回环地址，不支持对线上站点运行。浏览器首次安装可用 `npx playwright install chromium`。测试创建带验收标识的数据，并在结束后软删除测试文章、撤回和归档测试项目/笔记；不会连接生产 D1。

主要回归覆盖：迁移前后的可见性、工作稿与公开正文隔离、冲突保护、资源快照与撤回、幂等转换、项目关联、200 条以后的分页、原子配置失败回滚、密码文章 HTML/RSC、未登录 API、手机布局和日夜偏好持久化。最终命令结果记录在本文件末尾。

## 生产上线顺序

以下是本次已采用的上线顺序，具体执行结果见上线记录。增量 migration 已在生产执行成功，不能再次执行。不要把本地测试凭据上传到原 Worker。

1. 在目标仓库中恢复生产配置，文件使用 `wrangler.production.local.toml`（已加入忽略规则）。配置中 `main`、`assets` 等相对路径需要相对于仓库，而不是仓库外的导出目录。
2. `npx wrangler login`，然后 `npx wrangler whoami` 核对账户；用 `npx wrangler secret list -c wrangler.production.local.toml` 核对 secret 名称，不导出或打印其值。
3. 核对配置指向原 Worker、D1 和 R2；记录当前 Worker 版本与各业务表行数。确认旧版 `posts`、`tools`、`prompts`、`site_settings` 及 Agent 表的结构，确认新增列/表尚未存在。
4. 导出生产 D1 到仓库外的受保护目录，在隔离数据库导入并演练增量 migration，核对原文章数、工具数、提示词公开/私密数量和关键后台流程。
5. 在维护窗口执行增量 migration，再部署应用。部署脚本只发布 Worker，不再顺便改数据库。
6. 验收旧 URL、登录、资源可见性、密码文章、工作稿发布/撤回、导航配置、Hermes 状态、公共媒体与缓存行为。

命令模板（从仓库目录执行）：

```bash
# 文件需由真实导出配置恢复，不使用本地开发配置覆盖
chmod 600 wrangler.production.local.toml
npx wrangler whoami
npx wrangler secret list -c wrangler.production.local.toml

# 备份目录在仓库外，文件可能包含所有私有数据
umask 077
mkdir -p "$HOME/.local/share/channing-studio/backups"
backup_path="$HOME/.local/share/channing-studio/backups/pre-brain-$(date +%Y%m%d-%H%M%S).sql"
npx wrangler d1 export DB --remote -c wrangler.production.local.toml --output "$backup_path"

# 完成备份恢复演练、结构盘点与增量脚本审阅后，只执行一次
npx wrangler d1 execute DB --remote -c wrangler.production.local.toml --file db/migrations/2026-10-16-personal-brain.sql
CF_CONFIG_PATH="$PWD/wrangler.production.local.toml" npm run deploy
```

回滚优先恢复已记录的 Worker 版本，保留增量表和工作稿数据。不要直接执行破坏性逆向 SQL。若确认需要恢复数据，把备份恢复到新 D1，核对数量和抽样内容后再切换绑定；旧库和备份先保留。旧应用不认识新私密资源语义，回滚时必须关闭相关写入并复核公开查询，不能假定任意旧版本都兼容。

## 本轮边界

- 生产数据、绑定、secret 名称、备份恢复、迁移与部署已核对。未取得管理员密码明文，未代替用户登录生产后台进行写入测试；真实 Hermes 同步与外部 AI 请求未触发。
- 私人收集只支持文本和来源链接。原 R2 上传仍是公共媒体链路，不作为私人附件。独立私有附件、任务截止日期、邮件/日历等新来源接入留待实际需要时增加。
- 项目关联已覆盖手动笔记、文章、工具与提示词；Hermes 脱敏成果可在私有搜索和同步页面查看，尚未加入项目关联选择器。
- 保留高级 AI 模块的原有兼容初始化与 SQL 组织方式。本轮只移除常规内容仓储的运行时 DDL；完整迁移旧 AI 初始化逻辑需要先盘点实际线上结构，不能在缺少基线时直接删除兼容路径。
- 资源采用当前公开快照，不提供历史版本浏览界面；私人笔记的并发编辑暂为后写覆盖。文章和工作室配置具有版本冲突校验。
- 为优先保证公私边界，公开内容页面使用动态读取，RSS 不缓存；尚未宣称生产缓存命中率或性能提升。

## 最终验证结果

- Node 24.22.0 下 `npm run verify:quick` 通过：ESLint 无错误/警告，38 个测试文件、163 项测试通过，Next.js 生产构建成功。
- 同一版本完成 OpenNext Cloudflare 构建，生成 `.open-next/worker.js`。
- 以 `wrangler dev --local -c wrangler.local.toml --port 8787` 启动隔离 Worker；4 条 Playwright 回归全部通过，包含密码 HTML/RSC、私有 API、工作副本/双窗口冲突、公开发布/撤回、项目关联、草稿 URL 恢复和手机设置面板。
- 本地 Worker 的 R2 图片上传、读取、MIME 和字节一致性检查通过；只使用合成测试图片。
- 对 12 个公开/后台/编辑页面，在白天/晚上及 390/768/1440px 下检查共 72 个组合：未发现横向溢出、后台读取错误或浏览器页面异常；另已人工查看首页、工作台及手机截图。
- `git diff --check` 与修改脚本的 `bash -n` 通过；本地配置/凭据在 Git 忽略范围。源码和新增文档的高置信度密钥格式扫描无匹配，未把导出凭据加入版本控制。
- 本地预览：`http://127.0.0.1:8787/`；后台沿用 `/admin` 登录。开发凭据仅在本机被忽略的 `.dev.vars` 中。

本节列出隔离本地验证。后续生产备份恢复、迁移和正式域名验收单独记录在上线记录中；真实外部集成和长期 CDN 性能仍不在本次验证结论内。
