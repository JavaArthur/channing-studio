# Channing Studio 质量修复与内容扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复文章详情页体验、补齐实验室和工具内容、增加可管理的提示词收藏，并将公开仓库整理为当前 Channing Studio 项目。

**Architecture:** 文章正文保留服务端渲染，相关文章改为公开只读 API + 客户端延迟区域；工具复用现有 D1 `tools` 表；提示词新增独立 D1 表和受保护 CRUD API；公共仓库只保留产品源码、生态工具、CI 和简洁贡献文档。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Cloudflare Workers/OpenNext、Cloudflare D1/R2、Tailwind CSS v4、Vitest 4。

## Global Constraints

- 只在 `/Users/channing/file/github/chen-blog-opensource/.claude/worktrees/channing-studio` 的 `codex/channing-studio` 分支实现，不修改主工作树的用户改动。
- 不新增依赖；提示词正文不发送给第三方服务；所有管理 API 继续复用现有 admin session 鉴权。
- D1 改动先新增 `db/migrations/*.sql`，再同步 `db/schema.sql`；不重跑已有 schema 破坏线上数据。
- 不把密码、Token、Cloudflare ID 或真实绑定写入源码、README、截图或 Git。
- 公开页面优先使用 Studio 壳层；旧博客路由仍可访问，但不再作为个人站首页身份来源。
- 只有新仓库允许历史重写和 force-push；旧 fork `JavaArthur/chen-blog-opensource` 不修改。

---

### Task 1: 解耦文章首屏与相关文章查询

**Files:**
- Create: `app/[slug]/loading.tsx`
- Create: `app/api/posts/[slug]/related/route.ts`
- Create: `components/RelatedPosts.tsx`
- Create: `tests/lib/related-content.test.ts`
- Modify: `app/[slug]/page.tsx`
- Modify: `lib/related-content.ts`（仅导出/复用必要类型）

**Interfaces:**
- API：`GET /api/posts/:slug/related?limit=3` 返回 `{ success: true, related: { strategy, source, results } }`；不存在公开文章返回 404，查询失败返回 200 空数组并记录服务端日志。
- 组件：`RelatedPosts({ slug, initialRelated? }: { slug: string; initialRelated?: RelatedSearchResult | null })`，挂载后请求 API，加载失败隐藏区域。

- [ ] **Step 1: 写纯函数回归测试**

为 `tests/lib/related-content.test.ts` 添加测试，覆盖：公开结果只保留非当前 slug、limit 截断、空查询返回空结果、解析失败不抛出。测试只使用内存对象，不访问 Cloudflare。

- [ ] **Step 2: 运行测试确认测试先失败**

运行：`npx vitest run tests/lib/related-content.test.ts`

预期：新断言在辅助函数尚未导出前失败，确认测试不是假绿。

- [ ] **Step 3: 实现最小 API 与客户端区域**

在 `app/api/posts/[slug]/related/route.ts` 获取公开文章后调用现有 `getRelatedPosts`；在 `app/[slug]/page.tsx` 删除首屏 `await getRelatedPosts`，将原相关内容位置替换为 `<RelatedPosts slug={post.slug} />`。保留 JSON-LD、密码文章和 `incrementViewCount` 行为。

在 `app/[slug]/loading.tsx` 使用文章标题骨架、元信息横线和内容块，不引入新的动画库。

- [ ] **Step 4: 运行 focused 与全量测试**

运行：`npx vitest run tests/lib/related-content.test.ts tests/lib/post-render.test.ts` 和 `npm run test:run`。

预期：相关内容测试与既有 119 个测试全部通过，公开文章仍只渲染一个标题 H1。

- [ ] **Step 5: 提交文章性能修复**

```bash
git add app/'[slug]'/loading.tsx app/api/posts/'[slug]'/related/route.ts components/RelatedPosts.tsx tests/lib/related-content.test.ts app/'[slug]'/page.tsx lib/related-content.ts
git commit -m "fix(article): defer related posts from first render"
```

---

### Task 2: 修复实验室链接并接入工具展示

**Files:**
- Modify: `lib/studio-content.ts`
- Modify: `components/SiteHeader.tsx`
- Modify: `components/StudioHome.tsx`
- Modify: `app/page.tsx`
- Modify: `app/labs/page.tsx`
- Modify: `app/tools/page.tsx`
- Create: `tests/lib/studio-home.test.ts`（补充工具选择逻辑）

**Interfaces:**
- 新增纯函数 `selectStudioTools<T extends { is_pinned: number; sort_order: number; created_at: number }>(tools: T[], limit = 4): T[]`，按置顶、排序、创建时间稳定截断。
- `StudioHome` 新增 `tools: Tool[]` 属性；页面通过 `Promise.all` 并行读取 `getStudioContent`、`getSiteHeaderData`、`getPosts`、`getTools`。

- [ ] **Step 1: 写工具选择测试并确认失败**

在 `tests/lib/studio-home.test.ts` 增加置顶优先、sort_order 次序、limit 截断测试，运行 focused test，确认新函数不存在时失败。

- [ ] **Step 2: 实现选择逻辑和默认 GitHub 链接**

将三个默认实验室链接改成：

```ts
https://github.com/JavaArthur/channing-studio/tree/main/ecosystem/chrome-clipper
https://github.com/JavaArthur/channing-studio/tree/main/ecosystem/obsidian-publisher
https://github.com/JavaArthur/channing-studio/tree/main/ecosystem/channing-blog-publish-skill
```

新增 `selectStudioTools`，不复制工具记录，只负责展示排序。

- [ ] **Step 3: 接入 Studio 首页、Labs 和导航**

Studio 导航增加 `/tools`；首页在“正在折腾”后增加“工具箱”区块，展示最多 4 个工具、类型、描述、标签和外链；无数据时显示“去后台添加第一件工具”并链接 `/admin/tools`。Labs 页增加进入 `/tools` 的入口。

- [ ] **Step 4: 统一工具页视觉与语义**

将 `app/tools/page.tsx` 改用 `StudioShell`，保留现有 DB 查询、图标失败回退、外链安全属性和空状态；页面 H1 为“工具箱”，metadata/canonical 与 Channing Studio 一致。

- [ ] **Step 5: 运行测试、lint、构建并提交**

运行：`npx vitest run tests/lib/studio-home.test.ts tests/lib/studio-content.test.ts`、`npm run lint`、`npm run build`。

```bash
git add lib/studio-content.ts lib/studio-home.ts components/SiteHeader.tsx components/StudioHome.tsx app/page.tsx app/labs/page.tsx app/tools/page.tsx tests/lib/studio-home.test.ts
git commit -m "feat(studio): surface tools and fix lab links"
```

---

### Task 3: 新增提示词 D1 模块与公共页面

**Files:**
- Create: `db/migrations/2026-07-10-create-prompts.sql`
- Modify: `db/schema.sql`
- Create: `lib/repositories/prompts.ts`
- Create: `app/api/prompts/route.ts`
- Create: `app/api/admin/prompts/route.ts`
- Create: `app/api/admin/prompts/[id]/route.ts`
- Create: `app/prompts/page.tsx`
- Create: `components/PromptCard.tsx`
- Create: `components/PromptCopyButton.tsx`
- Create: `tests/lib/prompts.test.ts`

**Interfaces:**
- `Prompt`：`id/title/description/prompt/category/tags/source_url/is_pinned/is_hidden/sort_order/created_at/updated_at`，`tags` 在 TypeScript 层为 `string[]`。
- `getPrompts(db, options?: { includeHidden?: boolean }): Promise<Prompt[]>`、`createPrompt`、`updatePrompt`、`deletePrompt`。
- 公共 GET 只返回公开记录；管理 API 使用既有 admin session，并对 title/prompt 必填、source_url 协议和 tags JSON 做校验。

- [ ] **Step 1: 写迁移与 repository 测试**

在 `tests/lib/prompts.test.ts` 使用 mock D1 覆盖 tags 序列化/解析、公开过滤、管理列表包含隐藏记录、更新只写入提供字段。先运行并确认缺少 repository 时失败。

- [ ] **Step 2: 创建迁移与 repository**

新增计划中的 `prompts` 表和索引；在 `db/schema.sql` 同步幂等定义。repository 复用 `ensureSchema`、`Database` 和现有 mapper 风格，解析坏 tags 时回退空数组。

- [ ] **Step 3: 实现公共与管理 API**

公共 `GET /api/prompts` 支持 `category`、`tag`、`limit`；管理 API 支持 GET/POST/PATCH/DELETE。所有管理写操作返回 `{ success: true }` 或 `{ error }`，不返回密码、Token 或内部绑定。

- [ ] **Step 4: 实现 `/prompts` 公共页**

使用 `StudioShell`；每张卡展示标题、说明、分类、标签、来源和折叠正文。`PromptCopyButton` 使用 `navigator.clipboard.writeText`，失败时展示可选中的 textarea，不向网络发送 prompt 正文。

- [ ] **Step 5: 运行测试并提交数据模块**

运行：`npx vitest run tests/lib/prompts.test.ts`、`npm run lint`、`npm run build`。

```bash
git add db/migrations/2026-07-10-create-prompts.sql db/schema.sql lib/repositories/prompts.ts app/api/prompts/route.ts app/api/admin/prompts app/prompts/page.tsx components/PromptCard.tsx components/PromptCopyButton.tsx tests/lib/prompts.test.ts
git commit -m "feat(prompts): add database-backed prompt library"
```

---

### Task 4: 提示词后台与工作室入口

**Files:**
- Create: `app/admin/(protected)/prompts/page.tsx`
- Create: `app/admin/(protected)/prompts/PromptsManager.tsx`
- Modify: `app/admin/(protected)/layout.tsx`
- Modify: `components/SiteHeader.tsx`
- Modify: `components/StudioHome.tsx`
- Modify: `app/page.tsx`
- Create: `tests/app/api/admin/prompts.route.test.ts`

**Interfaces:**
- 后台管理器通过 `/api/admin/prompts` 读写，不直接访问 D1；保存后更新本地列表，不整页刷新。
- 首页只展示置顶公开提示词的标题和适用场景，点击进入 `/prompts`，不在首页渲染完整 prompt 正文。

- [ ] **Step 1: 写未授权 API 测试**

测试 GET/POST/PATCH/DELETE 在缺少 admin session 时返回 401；测试无标题或空 prompt 返回 400。运行 focused test 确认失败。

- [ ] **Step 2: 实现后台管理器**

提供新增、编辑、删除、隐藏、置顶、排序、标签和来源 URL 表单；长 prompt 使用 textarea；删除需要二次确认；网络错误显示可操作提示。

- [ ] **Step 3: 接入后台导航和首页预览**

后台导航增加“提示词”；Studio 导航增加“提示词”；首页新增“常用提示词”轻量预览区块。

- [ ] **Step 4: 运行 API/全量验证并提交**

运行：`npx vitest run tests/app/api/admin/prompts.route.test.ts tests/lib/prompts.test.ts`、`npm run verify:quick`。

```bash
git add app/admin/'(protected)'/prompts app/admin/'(protected)'/layout.tsx components/SiteHeader.tsx components/StudioHome.tsx app/page.tsx tests/app/api/admin/prompts.route.test.ts
git commit -m "feat(admin): add prompt library management"
```

---

### Task 5: 公共仓库清理与 README/截图

**Files:**
- Delete: `.claude/index.json`, `.codex/hooks.json`, root and nested `CLAUDE.md`, `.github/copilot-instructions.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Create: `docs/screenshots/studio-home.png`, `docs/screenshots/tools.png`, `docs/screenshots/labs.png`, `docs/screenshots/prompts.png`

**Interfaces:**
- README 只描述 Channing Studio 当前仓库、D1/R2、后台入口、发布步骤、工具、提示词和安全边界；不出现旧 fork 的运维指令、旧域名、真实资源 ID 或旧作者身份。
- 截图不含登录态、Token、文章私密内容或终端窗口；使用公开页面生成。

- [ ] **Step 1: 清理追踪的内部文件**

删除已追踪内部 Agent 文件，保留 `.github/workflows/verify.yml`、生态工具源码和 `.gitignore` 的忽略规则。确认 `git ls-files` 不再列出 `.claude/`、`.codex/` 或 `CLAUDE.md`。

- [ ] **Step 2: 重写公开文档**

重写 `AGENTS.md` 为简短贡献规范；重写 `README.md` 为当前站点的定位、结构、部署、后台、D1/R2、工具、提示词和常见问题。所有命令使用当前仓库和 `wrangler.local.toml` 约定。

- [ ] **Step 3: 生成并检查截图**

启动本地/线上公开页面，用 OpenWolf/浏览器截图四个页面；逐张检查没有旧品牌、密码、Token 或空白数据；README 使用相对链接引用截图。

- [ ] **Step 4: 运行安全扫描并提交**

运行：

```bash
git ls-files | rg '(^|/)(\.env($|\.)|\.claude|\.codex|.*\.pem$|.*\.key$)' || true
git grep -n -I -E '(BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_|github_pat_|CLOUDFLARE_API_TOKEN=|ADMIN_PASSWORD=)' -- ':!package-lock.json' ':!.env.example' || true
git diff --check
```

预期：不输出真实密钥或内部 Agent 文件。

```bash
git add -u .claude .codex .github/copilot-instructions.md AGENTS.md CLAUDE.md README.md docs/screenshots
git commit -m "docs(repo): reset public project documentation"
```

---

### Task 6: 迁移、secret 轮换、历史清理与上线

**Files:**
- Modify: `.env.local`（仅本地，不提交）
- Create: 临时 D1 备份文件（仅本地，不提交）

**Interfaces:**
- D1 migration 只创建 `prompts` 表，不修改 `posts/tools/site_settings`。
- 线上部署使用 `npx opennextjs-cloudflare build` 后接 `OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml`。

- [ ] **Step 1: 轮换管理员密码**

用户在本地 `.env.local` 设置新 `ADMIN_PASSWORD`；执行 `printf '%s' "$ADMIN_PASSWORD" | npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml`。不输出密码，不轮换 `AI_CONFIG_ENCRYPTION_SECRET`。

- [ ] **Step 2: 备份并执行 D1 migration**

执行 `npx wrangler d1 export DB --remote --output=backup-$(date +%F)-before-prompts.sql -c wrangler.local.toml`，确认文件不进入 Git；再执行 `npx wrangler d1 execute DB --remote --file=db/migrations/2026-07-10-create-prompts.sql -c wrangler.local.toml`。

- [ ] **Step 3: 构建部署并线上回归**

运行 `npm run verify:quick`，构建部署后验证 `/`、`/writing`、`/work`、`/labs`、`/tools`、`/prompts`、文章页、`/admin`、`/admin/studio`、`/admin/tools`、`/admin/prompts`。未登录后台应 307；登录后应 200；公开 API 不应返回隐藏 prompt。

- [ ] **Step 4: 清理新仓库 Git 历史**

在确认新密码已生效、远端新仓库已备份后，使用新仓库专用清洁历史流程移除内部 Agent 文档和旧敏感内容；仅对 `studio/main` force-push，旧 fork 保持原样。完成后重复敏感字符串扫描和 `git fsck --no-reflogs --unreachable` 检查。

- [ ] **Step 5: 推送并记录交付**

```bash
git push studio HEAD:main
git status --short
git log --oneline -8
```

预期：工作树干净，GitHub `JavaArthur/channing-studio` 的 `main` 为验证过的提交，README 截图可加载。
