# 晨启AI博客（channing-blog-opensource）— 项目手册

> 面向未来的自己 / 接手开发者 / Codex。一页纸搞懂这个博客怎么跑、怎么部署、怎么恢复、怎么贡献。

## 变更日志（Changelog）

- 2026-05-15：修复构建期 Cloudflare 本地 DO / AI binding warning 与 OpenNext duplicate-case warning——生产构建阶段不再拉起 Wrangler 平台代理，Workers AI 显式标记 remote，PDF 导出库移出服务端模块图。
- 2026-05-06：修复首页 ISR 缓存不生效——配置 R2 incremental cache + DO sharded tag cache + DO queue，添加 wrangler 绑定。
- 2026-04-27：初始化 Architect 扩展结构——新增「项目愿景」「架构总览」「模块结构图（Mermaid）」「模块索引」「编码规范」「AI 使用指引」等章节；同步为各子模块生成 `AGENTS.md` 与面包屑导航。原有部署/已知坑/贡献上游等运营内容完整保留。
- 2026-04-27：修复 D1 FTS5 SQLITE_CORRUPT_VTAB，搜索降级走 LIKE；新增「外链图片粘贴自动转存 R2」并已向上游开 PR。

## 项目愿景（Project Vision）

一个「自托管、可迁移、低成本」的个人博客系统，配套把「剪藏 / Obsidian 发布 / Codex Skill 发布」整条内容生产链路打通。核心目标：

- **不被平台绑架**：数据都在自己的 D1 / R2，随时可导出迁移。
- **单人低心智成本运维**：Cloudflare Workers + D1 + R2 全家桶，月费 $5 级别。
- **内容工具链闭环**：浏览器剪藏、Obsidian 插件、Codex Skill 三种入口都直连同一份后端 API。

## 架构总览（Architecture Overview）

```
┌───────────────┐   ┌──────────────────────┐   ┌───────────────────┐
│ Content Input │ → │  Next.js 16 (App Router) │ → │ Cloudflare Worker │
│  - Web 编辑器 │   │  - app/api/* (REST)      │   │  via OpenNext     │
│  - Chrome 剪藏│   │  - app/admin/** (后台)   │   └─────────┬─────────┘
│  - Obsidian   │   │  - app/[slug]  (前台)    │             │
│  - Codex Skill│  └──────────┬───────────┘             │
└───────────────┘              │                         │
                               ▼                         ▼
                       ┌───────────────┐         ┌──────────────┐
                       │  lib/ 业务层   │         │  D1 (SQLite) │
                       │  - repositories│◀───────▶│  posts/tags  │
                       │  - editor-*    │         │  ai_config   │
                       │  - remote-img  │         └──────────────┘
                       └──────┬─────────┘                  ▲
                              │                            │
                              ▼                            │
                       ┌───────────────┐                   │
                       │  R2 Bucket    │                   │
                       │  (images/*)   │───────────────────┘
                       └───────────────┘
```

核心运行时：
- **Next.js 16** App Router，通过 `@opennextjs/cloudflare` 打包成 Worker。
- **D1** 存文章、标签、分类、AI 配置、API Token；FTS5 暂关（详见坑 1）。
- **R2** 存所有图片与媒体；通过 `/api/images/[...key]` 统一读取。
- **Tiptap 3.x** 编辑器，带外链图粘贴自动转存钩子。

## 模块结构图（Module Structure）

```mermaid
graph TD
    Root["(Root) 晨启AI博客"] --> App["app/"]
    Root --> Lib["lib/"]
    Root --> Components["components/"]
    Root --> DB["db/"]
    Root --> Scripts["scripts/"]
    Root --> Ecosystem["ecosystem/"]

    App --> AppApi["app/api (REST)"]
    App --> AppAdmin["app/admin (后台)"]
    App --> AppPublic["app/[slug] (前台)"]

    Lib --> LibRepo["lib/repositories"]
    Lib --> LibEditor["lib/editor-*"]

    Ecosystem --> Clipper["chrome-clipper"]
    Ecosystem --> Obsidian["obsidian-publisher"]
    Ecosystem --> Skill["channing-blog-publish-skill"]

    click App "./app/AGENTS.md" "查看 app 模块文档"
    click Lib "./lib/AGENTS.md" "查看 lib 模块文档"
    click Components "./components/AGENTS.md" "查看 components 模块文档"
    click DB "./db/AGENTS.md" "查看 db 模块文档"
    click Scripts "./scripts/AGENTS.md" "查看 scripts 模块文档"
    click Ecosystem "./ecosystem/AGENTS.md" "查看 ecosystem 模块文档"
    click Clipper "./ecosystem/chrome-clipper/AGENTS.md" "查看 chrome-clipper 文档"
    click Obsidian "./ecosystem/obsidian-publisher/AGENTS.md" "查看 obsidian-publisher 文档"
    click Skill "./ecosystem/channing-blog-publish-skill/AGENTS.md" "查看 Codex Skill 文档"
```

## 模块索引（Module Index）

| 模块路径 | 一句话职责 | 关键入口 | 文档 |
|---|---|---|---|
| `app/` | Next.js 路由层（API + 前台 + 后台） | `app/page.tsx`、`app/api/**/route.ts` | [app/AGENTS.md](./app/AGENTS.md) |
| `lib/` | 业务与数据访问层（repositories、editor 钩子、远程图转存） | `lib/repositories/posts.ts` | [lib/AGENTS.md](./lib/AGENTS.md) |
| `components/` | React UI 组件（编辑器、后台表单、公共 UI） | `components/editor/*` | [components/AGENTS.md](./components/AGENTS.md) |
| `db/` | D1 schema、seed、迁移脚本 | `db/schema.sql`、`db/migrations/*.sql` | [db/AGENTS.md](./db/AGENTS.md) |
| `scripts/` | Cloudflare 初始化/部署/预览/类型生成脚本 | `scripts/cf-deploy.sh` | [scripts/AGENTS.md](./scripts/AGENTS.md) |
| `ecosystem/chrome-clipper/` | 浏览器剪藏扩展（Manifest V3） | `manifest.json`、`background.js` | [ecosystem/chrome-clipper/AGENTS.md](./ecosystem/chrome-clipper/AGENTS.md) |
| `ecosystem/obsidian-publisher/` | Obsidian 一键发布插件 | `main.ts` | [ecosystem/obsidian-publisher/AGENTS.md](./ecosystem/obsidian-publisher/AGENTS.md) |
| `ecosystem/channing-blog-publish-skill/` | Codex Skill 发布工具 | `SKILL.md` | [ecosystem/channing-blog-publish-skill/AGENTS.md](./ecosystem/channing-blog-publish-skill/AGENTS.md) |

---

## 一、项目速览

| 维度 | 值 |
|---|---|
| 性质 | `joeseesun/qiaomu-blog-opensource` 的本地 fork，已 rebrand 成 channing |
| 上游 | https://github.com/joeseesun/qiaomu-blog-opensource |
| fork | https://github.com/JavaArthur/chen-blog-opensource |
| 技术栈 | Next.js 16 + OpenNext + Cloudflare Workers (Paid) + D1 + R2 |
| 线上域名 | https://note.aichanning.cn（自定义）/ https://channing-blog-opensource.xiekangchen0930.workers.dev（workers.dev 临时域） |
| Worker 名 | `channing-blog-opensource` |
| CF Account | `01b7f083e0a678ebfc6378fc1f68a75a` |
| D1 库名 / ID | `channing-blog-db` / `f19765b5-a4a9-4b82-b1a9-df92d802859c` |
| R2 Bucket | `channing-blog-images` |
| 后台入口 | `/admin`（使用 Cloudflare secret `ADMIN_PASSWORD` 登录） |

## 二、日常开发工作流

### 本地开发（热重载，连远程 D1/R2）

```bash
npm install            # 首次或依赖变动时
npm run dev            # Next.js dev server，速度最快
# 或
npm run preview        # 在 Worker runtime 下预览，行为最接近线上
```

**注意**：本地 dev server 通过 `wrangler.local.toml` 里的真实 D1/R2 绑定，**读写的就是线上数据**。别在本地随手跑 DELETE。

### 改代码 → 部署全流程

```bash
# 1. 改代码
# 2. 局部校验
npm run verify:quick   # lint + test + build 的快速版

# 3. 部署（先构建，再用 wrangler 直发，避免 opennext deploy 拉起本地 DO 代理）
set -a; source .env.local; set +a
npx opennextjs-cloudflare build
OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml

# 4. 看线上日志（调试神器）
npx wrangler tail -c wrangler.local.toml
```

### 日常管理命令

```bash
# 查线上数据库
set -a; source .env.local; set +a
npx wrangler d1 execute DB --remote --command "SELECT count(*) FROM posts" -c wrangler.local.toml

# 导出数据库备份
npx wrangler d1 export DB --remote --output=backup-$(date +%F).sql -c wrangler.local.toml

# 列 R2 图片
npx wrangler r2 object list channing-blog-images

# 查看已上传的 secrets（只列 name，值看不到）
npx wrangler secret list -c wrangler.local.toml

# 滚动更换某个 secret
printf "新密码" | npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml
```

## 三、首次部署 SOP

> 从零部署到线上 · 顺序严格、每一步都验证

### 1. 准备环境

```bash
npm install
cp .env.example .env.local
```

然后编辑 `.env.local`：

```env
ADMIN_PASSWORD=你的强密码
ADMIN_TOKEN_SALT=$(openssl rand -hex 32)          # 手动跑命令替换
AI_CONFIG_ENCRYPTION_SECRET=$(openssl rand -hex 32) # 手动跑命令替换
NEXT_PUBLIC_SITE_URL=https://your-domain.com       # 先填占位，拿到真实域名后回填
```

### 2. Cloudflare 认证

```bash
npx wrangler login                                 # 浏览器 OAuth（推荐）
# 或在 .env.local 里放 CLOUDFLARE_API_TOKEN（仅本地，切勿进 git）
```

### 3. 初始化远程资源（D1 / R2）

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

这一步会：
- 复制 `wrangler.toml` → `wrangler.local.toml`（**git 不追踪**）
- 创建 D1 database
- 创建 R2 bucket
- 应用 `db/schema.sql` + `db/seed-template.sql`

**额外步骤**：`cf-init.sh` 不会自动创建 ISR cache bucket，需手动创建：

```bash
npx wrangler r2 bucket create channing-blog-next-cache
```

然后确认 `wrangler.local.toml` 包含 ISR 相关绑定（`NEXT_INC_CACHE_R2_BUCKET`、`NEXT_CACHE_DO_QUEUE`、`NEXT_TAG_CACHE_DO_SHARDED`），这些已在 `wrangler.toml` 模板中配置。

**⚠️ 已知坑 1**：`cf-init.sh` 在某些 wrangler 版本下，`--update-config` 不会把 D1 ID 写回配置，导致后续命令报 "Couldn't find DB with name 'DB'"。**必须手动核对** `wrangler.local.toml` 里有没有：

```toml
[[d1_databases]]
binding = "DB"
database_name = "channing-blog-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 一定要有
remote = true

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "channing-blog-images"
```

没有就自己加，或者从命令输出里粘贴。

### 4. 设置 secrets（加密存 CF 云端）

```bash
set -a; source .env.local; set +a    # 导出 env 供 wrangler 使用
printf "$ADMIN_PASSWORD"             | npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml
printf "$ADMIN_TOKEN_SALT"           | npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
printf "$AI_CONFIG_ENCRYPTION_SECRET"| npx wrangler secret put AI_CONFIG_ENCRYPTION_SECRET -c wrangler.local.toml
```

**⚠️ 已知坑 2**：如果 shell 没 `source .env.local` 导出变量，wrangler 会报 `Failed to fetch auth token: 400 Bad Request`。记得 `set -a; source .env.local; set +a`。

### 5. 生成类型 + 构建 + 部署

```bash
npm run cf-typegen
set -a; source .env.local; set +a
npx opennextjs-cloudflare build
OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml
```

**⚠️ 已知坑 3**：Workers **Free** 计划 script size 上限 3 MiB，本项目 handler.mjs 有约 11 MiB，**必须用 Workers Paid 计划（$5/月，10 MiB 上限）**。首次部署如果报 `exceeded size limit of 3 MiB`，去 https://dash.cloudflare.com/<ACCOUNT_ID>/workers/plans 升级。

### 6. 绑自定义域名（可选）

CF Dashboard → Workers & Pages → `channing-blog-opensource` → Settings → Domains & Routes → **+ Add → Custom domain** → 填你的域名。

记得回填 `NEXT_PUBLIC_SITE_URL` 到：
- `.env.local`
- `wrangler.local.toml`

再跑一次 deploy。

## 四、已知坑 + 故障恢复手册

### 坑 1：autosave 500，D1 报 SQLITE_CORRUPT_VTAB

**现象**：`PATCH /api/posts` 返回 500，错误信息 `D1_ERROR: database disk image is malformed: SQLITE_CORRUPT (extended: SQLITE_CORRUPT_VTAB)`。

**根因**：Cloudflare D1 的 FTS5 支持不稳，shadow tables 容易跟主表失步，后续每次 `UPDATE posts` 触发 `posts_au` 就炸。[参考 emdash-cms#252](https://github.com/emdash-cms/emdash/issues/252)。

**修复**（本仓库已经处理，schema.sql 把 FTS 注释了；如果接手历史数据库仍有损坏的 FTS，跑一次）：

```bash
set -a; source .env.local; set +a
npx wrangler d1 execute DB --remote --file=db/migrations/2026-04-27-drop-fts.sql -c wrangler.local.toml
```

搜索降级走 `lib/repositories/search.ts` 里的 LIKE 兜底，用户无感。

**未来想重启 FTS5**：等 Cloudflare D1 对 FTS5 的支持稳定，跑 `db/migrations/enable-fts.sql`。

### 坑 2：外链图片粘贴后 403 / 无法渲染

**现象**：粘贴 `![](https://cdn.gooo.ai/xxx.jpg)` 之类外链图，显示裂图。

**根因**：第三方 CDN 有 Referer 防盗链。

**当前方案**：编辑器粘贴时会自动调 `/api/uploads/from-url` 把图拉到自家 R2 再替换 src，用户看到 "已转存 N 张外链图片" 的 toast 提示。如果失败会单独提示哪张。

**如果转存也失败**（对方彻底封 bot），手动另存图再上传。

### 坑 3：Worker script size > 3 MiB

见「首次部署 SOP」步骤 5 最底下。**Paid 计划是硬需求**。

### 坑 4：wrangler 报 "Failed to fetch auth token: 400 Bad Request"

本地 shell 没 `source .env.local`，wrangler 同时读到不完整的 env。

```bash
set -a; source .env.local; set +a    # 每次新开终端都要跑
```

或者改用 `npx wrangler login`（浏览器 OAuth，一劳永逸，不用放 token）。

### 坑 5：`npm run deploy` 报 "table posts already exists"

`scripts/cf-deploy.sh` 每次部署都会重跑 `db/schema.sql`，但 schema 不是幂等的。

**绕过方法**：跳过 npm script，先构建，再用 wrangler 直发：

```bash
set -a; source .env.local; set +a
npx opennextjs-cloudflare build
OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml
```

表结构要变更时再单独跑 migration：

```bash
npx wrangler d1 execute DB --remote --file=db/migrations/你的迁移.sql -c wrangler.local.toml
```

### 坑 6：首页 `revalidate = 3600` 不生效，响应头始终 no-cache

**现象**：页面设了 `export const revalidate = 3600`，但线上响应头是 `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`，每次请求都打到 Worker。

**根因**：`@opennextjs/cloudflare` 默认空配置（`defineCloudflareConfig()`）没有 cache backend。ISR 需要显式配置 `incrementalCache`（R2）+ `tagCache`（DO）+ `queue`（DO），否则运行时无处存缓存，降级为每次重渲染。

**修复**：
1. `open-next.config.ts` 配置 `r2IncrementalCache` + `doShardedTagCache` + `doQueue`
2. `wrangler.toml` 添加 `NEXT_INC_CACHE_R2_BUCKET`（R2）、`NEXT_CACHE_DO_QUEUE` 和 `NEXT_TAG_CACHE_DO_SHARDED`（Durable Objects）绑定
3. 首次部署前需创建 R2 cache bucket：`npx wrangler r2 bucket create channing-blog-next-cache`
### 坑 6：通过 API 批量发布文章时图片丢失

**现象**：用 `POST /api/posts` 批量发布含图片的 Markdown 文章后，编辑器和前台看到的图片全部裂开。

**根因**：数据库有两个内容字段——`content`（Markdown 源）和 `html`（渲染后 HTML）。
- `POST /api/posts` 提交 `content` 后，后端会用 `remark` 渲染出 `html` 并同时存储。
- 如果 content 里的图片路径是本地路径（如 `/images/2025/07/xxx.webp`）或外链（如 `http://qiniu.xxx/...`），html 字段会原封不动保存这些无效路径。
- 后续用 `PATCH /api/posts` 只更新 `content` 字段时，**`html` 字段不会自动重新渲染**，编辑器仍展示旧的 html。

**正确做法**：通过 API 发布含图片文章时，必须先处理图片再发布：

1. **发布前**：扫描 Markdown 中所有图片引用
   - 本地图片 → `POST /api/uploads`（multipart）上传到 R2，拿到 `/api/images/...` 路径
   - 外链图片 → `POST /api/uploads/from-url` 服务端转存，拿到 `/api/images/...` 路径
2. **替换** content 中的旧路径为 R2 路径
3. **发布** `POST /api/posts`，此时 html 字段渲染出来的也是正确的 R2 路径

**如果已经发错了**：需要同时更新 content 和 html 两个字段。两种修复方式：
- 方式 A：`PATCH /api/posts` 同时传 `content` + `html` 两个字段（html 也需要做路径替换）
- 方式 B：直接在 D1 执行 SQL（适合批量修复）：
  ```sql
  UPDATE posts SET html = REPLACE(html, '旧路径', '新R2路径') WHERE slug='xxx';
  ```

**关键提醒**：
- `PATCH /api/posts` 需要 `current_slug` 字段定位文章（不是 URL path parameter）
- 编辑器和前台展示优先读 `html` 字段，`content` 仅用于 Markdown 回显和搜索
- 发布脚本/Skill 务必在发布前完成图片上传和路径替换，不要事后补

### 坑 7：`next build` 刷 Cloudflare 本地 DO / AI binding warning

**现象**：本地跑 `npm run build` / `npm run verify:quick` 时，日志反复出现：
- `You have defined bindings to the following internal Durable Objects`
- `A DurableObjectNamespace in the config referenced the class ... but no such Durable Object class is exported`
- `AI bindings always access remote resources`

**根因**：生产构建阶段调用 `getCloudflareContext({ async: true })` 会让 Wrangler 拉起本地平台代理并读取完整 `wrangler.toml`。这会把 ISR 用的内部 Durable Objects 当成本地开发绑定检查，而此时 `.open-next/worker.js` 还没生成，导致 DO 导出检查误报；Workers AI 默认就是远端资源，也会提示计费 warning。

**当前方案**：
1. `lib/cloudflare.ts` 在 `NEXT_PHASE=phase-production-build` 时返回空 Cloudflare context，构建不再读线上 D1/R2，也不再拉起本地 DO。
2. `next.config.ts` 只在 `next dev` 阶段初始化 `initOpenNextCloudflareForDev`。
3. `wrangler.toml` / `wrangler.local.toml` 的 `[ai]` 绑定显式设置 `remote = true`。
4. `worker.ts` 从 `@opennextjs/cloudflare/durable-objects/*` 稳定导出 DO 类，不依赖构建前不存在的 `.open-next/worker.js` 转导出。
5. 部署使用 `npx opennextjs-cloudflare build` + `OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml`，避免 `opennextjs-cloudflare deploy` 的 cache populate 阶段再次拉起本地平台代理。

如确实需要在生产构建阶段读取 Cloudflare 远端绑定，可临时设置：

```bash
OPENNEXT_USE_CLOUDFLARE_CONTEXT_DURING_BUILD=1 npm run build
```

默认不要这么做；它会让构建依赖线上资源，降低可复现性。

### 坑 8：OpenNext 打包出现 `duplicate-case` warning

**现象**：`npx opennextjs-cloudflare build` 在 `Bundling the OpenNext server` 阶段出现 `This case clause will never be evaluated because it duplicates an earlier case clause [duplicate-case]`。

**根因**：`html2pdf.js` 依赖的 `html2canvas@1.4.1` 内部存在重复 `case 22`。即使只在 client 函数里动态 `import('html2pdf.js')`，Turbopack 仍会生成服务端动态 chunk，OpenNext 最终 bundle 会扫描到它。

**当前方案**：PDF 导出改为点击时从浏览器加载固定版本 `https://cdn.jsdelivr.net/npm/html2pdf.js@0.14.0/dist/html2pdf.bundle.min.js`，并从 npm 依赖中移除 `html2pdf.js`。这样服务端 bundle 不再包含 `html2canvas`，warning 消失，PDF 能力仍保留在浏览器端。

## 五、项目结构要点

```
app/
├── api/
│   ├── uploads/route.ts             # 文件上传（admin）
│   ├── uploads/from-url/route.ts    # 外链图自动转存到 R2（新增，贡献回上游）
│   ├── images/[...key]/route.ts     # R2 图片读取
│   ├── admin/ai-*                   # AI 管理后台 API
│   └── editor/ai-*                  # 编辑器 AI 交互
├── admin/                           # 后台页面
├── [slug]/page.tsx                  # 文章详情页
└── page.tsx                         # 首页（4 套主题，lib/site-config 控制）

lib/
├── repositories/                    # DB 仓储层
│   ├── schema.ts                    # ensureSchema（列迁移）
│   ├── posts.ts                     # 文章 CRUD
│   └── search.ts                    # 搜索（FTS5 优先，LIKE 兜底）
├── editor-extensions.tsx            # Tiptap 扩展配置 + 粘贴钩子
├── editor-file-upload.ts            # 编辑器上传辅助
├── remote-image-rehost.ts           # 外链图扫描 + 转存（新增）
└── editor-rehost-toast.ts           # toast 事件桥（新增）

db/
├── schema.sql                       # 表结构（FTS5 部分已注释）
├── seed-template.sql                # 默认种子数据
└── migrations/                      # 迁移脚本
    ├── 2026-04-27-drop-fts.sql
    └── enable-fts.sql

scripts/
├── cf-init.sh                       # 首次初始化资源
├── cf-deploy.sh                     # 完整部署（含 schema 重跑，易踩坑）
├── cf-preview.sh                    # 本地 Worker runtime 预览
└── cf-typegen.sh                    # CloudflareEnv 类型生成

wrangler.toml                        # 模板（进 git）
wrangler.local.toml                  # 真实绑定（gitignore）
.env.local                           # 本地环境变量（gitignore）
.env.local.secrets.bak               # secrets 备份（gitignore）
```

## 六、安全约束

- `.env.local`、`wrangler.local.toml`、`.env.local.secrets.bak` **永远不进 git**（.gitignore 已配）。
- 若怀疑 `CLOUDFLARE_API_TOKEN` 泄露，立刻去 https://dash.cloudflare.com/profile/api-tokens **Roll**。
- 生产数据库和本地 dev 共用一份 D1，慎跑破坏性 SQL；改表前先 `d1 export --remote` 备份。
- 新增 secret 只走 `wrangler secret put`，不要写进 `wrangler.toml`（那份会进 git）。

## 七、贡献回上游

- fork：`JavaArthur/chen-blog-opensource`
- 上游：`joeseesun/qiaomu-blog-opensource`（has_issues=false，只能开 PR）
- 策略：通用修复 / 新功能 cherry-pick 到专用分支（如 `upstream-contribute`），不带 rebrand 污染；独立 commit 便于上游 cherry-pick。

示例流程：

```bash
# 从某个干净基线切分支
git checkout -b upstream-feature-xxx 某个上游兼容的 commit

# cherry-pick 目标 commits
git cherry-pick <feat-commit> <fix-commit>

# 推 fork
git push -u origin upstream-feature-xxx

# 开 PR 到上游
gh pr create --repo joeseesun/qiaomu-blog-opensource \
  --base main --head JavaArthur:upstream-feature-xxx \
  --title "..." --body-file /tmp/pr.md
```

当前已开 PR：https://github.com/joeseesun/qiaomu-blog-opensource/pull/1（feat + 2 个 fix）。

## 八、测试策略（Testing Strategy）

- 框架：**Vitest 4**（`vitest.config.ts`）。跑法：`npm run test` / `npm run test:run`。
- `tests/` 下残留部分上游遗留类型报错，跑 `npx tsc --noEmit` 时忽略，不要当作新引入问题。
- 新业务代码**建议**补测，尤其是 `lib/repositories/**` 与 `lib/remote-image-rehost.ts` 这类纯逻辑。
- 端到端/冒烟：目前靠 `npm run preview`（Worker runtime 本地预览）人工回归。

## 九、编码规范（Coding Standards）

- TypeScript strict。代码用英文，注释/文档用中文。
- React 19 + Next.js App Router。Server Component 默认，带交互再 `'use client'`。
- 样式用 Tailwind v4；避免大块内联 style。
- 数据访问统一走 `lib/repositories/*`，**不要**在 `app/api/**/route.ts` 里直接写 SQL。
- 新增敏感配置走 `wrangler secret put`，禁止硬编码。
- 提交遵循 `~/.Codex/rules/git-workflow.md` 的 Conventional Commits 约定。

## 十、AI 使用指引（给 Codex / AI 助手）

- 任何涉及 CF/D1/R2 的操作前，先 `set -a; source .env.local; set +a`。
- 改 schema → 先写 `db/migrations/*.sql`，**再** 改 `db/schema.sql`，不要直接编辑 schema 后指望 cf-deploy 能处理。
- 部署用 `npx opennextjs-cloudflare build` 后接 `OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml`，**不要用** `npm run deploy`（会重跑 schema）。
- 本地跑 `npx tsc --noEmit` 时，`tests/` 下存在上游遗留的类型报错，不要当作新引入问题。
- 发现新的 Cloudflare 平台坑，**加到本文件「已知坑」章节**，别光 fix 不 doc。
- 改代码后主动跑 `npm run verify:quick`（lint + test + build）。
- 回贡上游时保持 commit 干净、不夹带 rebrand；详见「七、贡献回上游」。
