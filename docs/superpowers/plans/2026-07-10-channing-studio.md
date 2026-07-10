# Channing Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有 D1 文章发布系统的前提下，把博客首页升级为可由 `/admin/studio` 动态维护的 Channing 个人工作室，并完成身份收口、安全修复、验证和独立仓库迁移准备。

**Architecture:** 文章仍使用 `posts` 表、`/admin/posts` 和 `/editor`；个人工作室配置复用 `site_settings` 的 JSON key/value，不新增 D1 表。公开首页和 `/work`、`/labs`、`/about` 读取类型化配置并在缺失/损坏时回退默认内容，后台新增受保护的 Studio 管理页写回相同配置。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript strict、Tailwind CSS v4、Cloudflare D1/R2、Vitest 4、OpenNext Cloudflare。

## Global Constraints

- 不新增 D1 migration 或表；文章发布、草稿、分类、剪报、工具墙和 API 入口保持兼容。
- Studio 配置只允许通过现有 `site_settings` 和已鉴权的 `/api/admin/settings` 读写。
- 公开导航不暴露 `/admin`；`/admin`、`/admin/studio`、`/editor` 深链仍可用，未登录统一跳转 `/admin/login`。
- 不在 Git、文档、日志或回复中写入真实密码、token、盐、D1/R2 私有标识或 Cloudflare API token。
- 保持 Asia/Shanghai 日期格式化；不重新引入裸 `toLocaleDateString` 或 hydration 期读取主题 cookie。
- 保留 `LICENSE` 与 README 上游致谢；不 force-push、删除旧分支或覆盖用户现有未提交改动。
- 中文 UI 文案和文档使用简体中文，代码标识使用英文；不新增依赖，除非验证确实缺少现有能力。

---

### Task 1: 建立隔离工作区并验证基线

**Files:**
- Create: `docs/superpowers/plans/2026-07-10-channing-studio.md`（本计划）
- Create: `.worktrees/codex-channing-studio/`（Git worktree，目录不入 Git）

**Interfaces:**
- Consumes: 当前 `main` 的设计提交 `4349c62` 和用户工作区中未提交的页面主题改动。
- Produces: 独立分支 `codex/channing-studio`，后续所有代码修改只在该 worktree 进行。

- [x] **Step 1: 确认 worktree 和忽略规则**

运行：

```bash
git status --short
git branch --show-current
git check-ignore -q .worktrees
```

预期：当前仍在 `main`；`.worktrees` 已被忽略；现有未提交文件只属于用户，不被清理。

- [x] **Step 2: 创建 worktree**

运行：

```bash
git worktree add .worktrees/codex-channing-studio -b codex/channing-studio main
cd .worktrees/codex-channing-studio
```

预期：新目录指向 `codex/channing-studio`，主工作区的未提交改动不出现在新 worktree。

- [x] **Step 3: 安装依赖并跑基线测试**

运行：

```bash
npm install
npm run test:run
```

预期：基线测试通过；若失败，记录原始错误并停止，不把基线问题伪装成新改动。

- [x] **Step 4: 提交计划**

运行：

```bash
git add docs/superpowers/plans/2026-07-10-channing-studio.md
git commit -m "docs(studio): add implementation plan"
```

预期：计划单独提交，代码尚未修改。

### Task 2: 建立 Studio 配置契约并覆盖解析边界

**Files:**
- Create: `lib/studio-content.ts`
- Create: `lib/studio-settings.ts`
- Create: `tests/lib/studio-content.test.ts`
- Create: `tests/lib/studio-settings.test.ts`

**Interfaces:**
- Produces: `StudioProfile`、`StudioCapability`、`StudioProject`、`StudioLab`、`StudioContent` 类型；`DEFAULT_STUDIO_CONTENT`；`parseStudioSettings(values)`；`getStudioContent(db)`；`setStudioContent(db, content)`。
- Consumes: `getSetting`、`setSetting` from `lib/repositories/settings.ts`。

- [x] **Step 1: 写失败测试**

测试必须覆盖：空设置返回默认身份和空集合；合法 JSON 返回完整配置；缺字段、错误类型和非法 JSON 被丢弃并回退；`studio_featured_posts` 空数组表示自动使用最新文章；设置写入把五个 key 序列化为 JSON。

运行：

```bash
npx vitest run tests/lib/studio-content.test.ts tests/lib/studio-settings.test.ts
```

预期：测试先因模块不存在而失败。

- [x] **Step 2: 实现最小类型和默认值**

在 `lib/studio-content.ts` 中定义严格字段：

```ts
export interface StudioLink { label: string; url: string; openInNewTab?: boolean }
export interface StudioCapability { title: string; description: string }
export interface StudioProject { id: string; title: string; description: string; href: string; tags: string[]; visible: boolean }
export interface StudioLab { id: string; title: string; description: string; href: string; type: string; visible: boolean }
export interface StudioProfile {
  eyebrow: string
  title: string
  subtitle: string
  statement: string
  contactLinks: StudioLink[]
  capabilities: StudioCapability[]
}
export interface StudioContent {
  profile: StudioProfile
  projects: StudioProject[]
  labs: StudioLab[]
  featuredPostSlugs: string[]
}
```

默认内容只使用已确认的公开事实：晨启AI博客、Chrome Clipper、Obsidian Publisher、发布 Skill；不得添加雇主、客户或未经确认的指标。

- [x] **Step 3: 实现解析与 D1 适配**

`parseStudioSettings` 逐 key 做 JSON 解析、字段过滤和默认合并；`getStudioContent` 并行读取 `studio_profile`、`studio_projects`、`studio_labs`、`studio_featured_posts` 和旧 `default_theme/nav_links` 不混在同一配置对象内。`setStudioContent` 逐 key 调用 `setSetting`，不直接写 SQL。

- [x] **Step 4: 跑测试并提交**

运行：

```bash
npx vitest run tests/lib/studio-content.test.ts tests/lib/studio-settings.test.ts
git add lib/studio-content.ts lib/studio-settings.ts tests/lib/studio-content.test.ts tests/lib/studio-settings.test.ts
git commit -m "feat(studio): add database-backed content settings"
```

预期：新增解析和持久化边界测试全部通过。

### Task 3: 实现公开 Studio 页面和文章归档

**Files:**
- Create: `components/StudioHome.tsx`
- Create: `components/StudioSection.tsx`
- Create: `app/writing/page.tsx`
- Create: `app/work/page.tsx`
- Create: `app/labs/page.tsx`
- Create: `app/about/page.tsx`
- Modify: `app/page.tsx`
- Modify: `components/SiteHeader.tsx`
- Modify: `components/SiteFooter.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `StudioContent`、`getStudioContent`、现有 `getPosts`/`getPostsCount`、`getSiteHeaderData`。
- Produces: 首页、作品、实验室、关于我和文章归档可访问；首页在 D1 失败时仍显示默认身份与作品，不显示空白。

- [x] **Step 1: 写首页数据边界测试**

在 `tests/lib/studio-content.test.ts` 增加“featuredPostSlugs 非空只取指定公开 slug，空数组取最近三篇”的纯逻辑测试；不在组件测试中 mock 整个 Cloudflare runtime。

- [x] **Step 2: 实现 Studio 首页**

`app/page.tsx` 保留 `revalidate = 3600`，并行读取 Studio 配置、站点头数据和最多 3 篇 `kind='post'` 公开文章；渲染 `StudioHome`。`StudioHome` 按设计顺序输出身份区、能力证据、精选作品、实验室、最新文章和页脚 CTA；整个页面只有一个 H1。

- [x] **Step 3: 实现 `/writing`**

把当前文章列表查询迁移到 `app/writing/page.tsx`，保留分页参数、分类映射、主题切换、canonical 和 `HomeClient` 文章列表行为。根路径不再显示 25 篇文章列表，`/writing` 成为完整文章入口。

- [x] **Step 4: 实现三个静态路由**

`/work`、`/labs`、`/about` 读取同一 Studio 配置，分别显示项目、实验室与个人介绍；所有链接使用 `Link` 或带 `noopener noreferrer` 的外链；D1 不可用时使用默认配置。

- [x] **Step 5: 更新公开导航和视觉样式**

公开导航默认改为“作品、文章、实验室、关于我、GitHub、RSS、搜索”；过滤 `Admin`/`/admin`，保留后台深链；剪报与工具改为相关页入口，不再作为首页主导航。新增 `studio-*` CSS 类，复用暖纸张、墨蓝、铜橙变量和现有响应式断点，不引入新的字体依赖或渐变背景。

- [x] **Step 6: 更新全站 metadata**

将 `app/layout.tsx`、首页和新路由的标题、描述、JSON-LD 统一为 Channing Studio / 晨启AI；canonical 统一走 `getSiteUrl()`，不再使用上游作者和错误默认域名。

- [x] **Step 7: 跑验证并提交**

运行：

```bash
npm run lint
npm run test:run
npm run build
git add app/page.tsx app/writing app/work app/labs app/about app/layout.tsx app/globals.css components/StudioHome.tsx components/StudioSection.tsx components/SiteHeader.tsx components/SiteFooter.tsx
git commit -m "feat(studio): add personal homepage and public sections"
```

预期：lint、现有测试和 Next.js build 全部通过。

### Task 4: 增加 `/admin/studio` 动态管理入口

**Files:**
- Create: `app/admin/(protected)/studio/page.tsx`
- Create: `app/admin/(protected)/studio/StudioManager.tsx`
- Modify: `app/admin/(protected)/layout.tsx`
- Modify: `app/api/admin/settings/route.ts`
- Modify: `tests/app/api/admin-settings.route.test.ts`

**Interfaces:**
- Consumes: `getStudioContent`、`setStudioContent`、现有 admin cookie 鉴权和 settings API。
- Produces: 登录管理员可编辑身份、能力、作品、实验室和精选文章；保存后公开页面刷新回读。

- [x] **Step 1: 扩展 API 测试**

在现有 settings route 测试中增加：未登录 POST 返回 401；`studio_projects` 对象数组被 JSON 序列化；空 key/undefined value 返回 400。不要改变现有 `font_mode` 等 key 的行为。

- [x] **Step 2: 实现管理页加载**

`page.tsx` 在受保护 layout 下读取 `getStudioContent(env.DB)`，将已经解析的配置传给客户端 `StudioManager`；无 DB 时显示明确的“数据库未配置”状态，不渲染假成功。

- [x] **Step 3: 实现客户端编辑器**

`StudioManager.tsx` 使用受控表单：文本字段、能力卡数组、作品/实验室增删与上下移、可见性开关、精选 slug 输入。保存按钮分别写入五个 settings key，所有 `resp.json()` 显式断言 `{ success?: boolean; error?: string }`，成功后显示状态并刷新页面。

- [x] **Step 4: 接入后台导航并验证鉴权**

在 admin header 增加“工作室”链接；不在公开 `SiteHeader` 添加 Admin。验证 `/admin/studio` 未登录重定向 `/admin/login`，登录后可访问。

- [x] **Step 5: 跑测试并提交**

运行：

```bash
npx vitest run tests/app/api/admin-settings.route.test.ts tests/lib/studio-content.test.ts tests/lib/studio-settings.test.ts
git add app/admin/'(protected)'/studio app/admin/'(protected)'/layout.tsx app/api/admin/settings/route.ts tests/app/api/admin-settings.route.test.ts
git commit -m "feat(admin): add studio content management"
```

预期：settings API 回归测试和 Studio 配置测试通过。

### Task 5: 修复文章语义、身份残留和安全文档

**Files:**
- Create: `tests/lib/post-render.test.ts`
- Modify: `lib/post-render.ts`
- Modify: `app/[slug]/page.tsx`
- Modify: `components/SiteHeader.tsx`
- Modify: `app/admin/login/page.tsx`
- Modify: `components/themes/HomeVariantB.tsx`
- Modify: `components/themes/HomeVariantC.tsx`
- Modify: `app/admin/(protected)/settings/NavLinksEditor.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app/layout.tsx`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `lib/site-config.ts`

**Interfaces:**
- Produces: 文章详情页 DOM 只有一个 H1；无上游作者/仓库兜底链接；仓库文档不再包含真实后台凭据；后台入口和新站点身份文案一致。

- [x] **Step 1: 写标题去重测试**

为 `stripLeadingTitleHeading(html, title)` 写测试：首个 h1 文本等于文章标题时移除；首个 h1 不同、h1 不在开头或 HTML 为空时保持原文。

- [x] **Step 2: 实现最小渲染修复**

在 `lib/post-render.ts` 添加无 DOM 依赖的安全字符串处理，并在 `app/[slug]/page.tsx` 只对公开渲染内容和 `TwitterEmbedsEnhancer` 使用处理后的 HTML；编辑器原始 HTML 和数据库字段不改写。

- [x] **Step 3: 清理身份与文档**

更新 `package.json` repository/homepage/bugs 到新仓库候选；更新 `lib/site-config.ts` 默认生产域名为 `https://note.aichanning.cn`；更新默认导航、登录页 logo 和 README；从 `AGENTS.md` 删除真实后台密码，只保留 secret 设置说明。

- [x] **Step 4: 验证安全边界并提交**

运行：

```bash
npx vitest run tests/lib/post-render.test.ts
# 运行凭据扫描，确认仓库不包含真实后台密码或 token 值
git diff --check
git add lib/post-render.ts tests/lib/post-render.test.ts 'app/[slug]/page.tsx' components/SiteHeader.tsx components/themes/HomeVariantB.tsx components/themes/HomeVariantC.tsx app/admin/'(protected)'/settings/NavLinksEditor.tsx app/admin/login/page.tsx package.json README.md AGENTS.md lib/site-config.ts
git commit -m "fix(site): close identity and article semantics gaps"
```

预期：grep 不输出任何真实凭据或上游默认身份，标题去重测试通过。

### Task 6: 完整验证、设计检查与上线准备

**Files:**
- Modify: `README.md`
- Modify: `DEPLOY.md`
- Modify: `docs/superpowers/specs/2026-07-10-channing-studio-design.md`（仅记录已验证差异）

- [ ] **Step 1: 跑项目快速验证**

运行：

```bash
npm run verify:quick
```

预期：lint、Vitest、Next build 全部通过。

- [ ] **Step 2: 运行视觉检查**

运行：

```bash
openwolf designqc --routes / /writing /work /labs /about
```

读取 `.wolf/designqc-captures/` 中的截图，检查首屏层次、暖色对比度、移动端导航、CTA 触达面积和是否只有一个 H1；发现问题先修复再重跑。

- [ ] **Step 3: Worker 预览冒烟**

运行：

```bash
npm run preview
```

逐页验证 `/`、`/writing`、`/work`、`/labs`、`/about`、`/admin`、`/admin/studio`、`/editor?new=1`；不在没有认证时提交任何表单。

- [ ] **Step 4: 轮换 Cloudflare secrets**

需要用户在本地确认新管理密码后执行：

```bash
set -a; source .env.local; set +a
printf '%s' "$ADMIN_PASSWORD" | npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml
printf '%s' "$ADMIN_TOKEN_SALT" | npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
```

预期：Cloudflare secret 列表只显示名称；不把 secret 值写入终端输出或 Git。

- [ ] **Step 5: 部署并验证线上**

运行：

```bash
set -a; source .env.local; set +a
npx opennextjs-cloudflare build
OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml
```

验证线上首页、文章 H1 数量、`/admin` 登录、`/admin/studio` 修改后回读、响应头和 canonical；不使用 `npm run deploy`。

- [ ] **Step 6: 创建独立 GitHub 仓库（部署验证通过后）**

先运行 `gh auth status`。认证有效时创建 `JavaArthur/channing-studio`（若已存在使用 `JavaArthur/channing-ai-studio`），保留旧远端为 `legacy`，只推送验证后的 `main`；认证失效时暂停并告诉用户执行登录，不删除旧仓库。

- [ ] **Step 7: 提交最终变更**

运行：

```bash
git status --short
git diff --check
git log --oneline -8
```

预期：只包含本次 Studio 改动；生成最终交付摘要和用户必须完成的 secret/GitHub 操作清单。
