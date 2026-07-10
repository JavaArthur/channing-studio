# Channing Studio 质量修复与内容扩展设计

## 目标

修复文章详情页点击等待、实验室链接失效和工具入口缺失；新增可由后台维护的提示词收藏；清理公开仓库里的内部 Agent 配置与过时身份资料；重写 README 并补充真实页面截图，让 `JavaArthur/channing-studio` 成为可读、可用、可继续维护的个人作品仓库。

## 调查结论

### 文章跳转

`app/[slug]/page.tsx` 在输出正文前依次读取文章、站点头部、请求主题、相关文章。相关文章通过 `lib/related-content.ts` 执行搜索和近期文章查询，属于非首屏内容，却阻塞了详情页响应。线上响应头为 `cache-control: private, no-cache, no-store`；公开文章首次请求实测约 2 秒，后续请求约 0.5–0.8 秒。目标是先显示正文和元信息，相关文章延迟加载，并给路由切换即时 loading 反馈。

### 实验室

D1 当前只有历史 `nav_links` 设置，没有 `studio_labs` 覆盖值，因此应用默认实验室配置。默认配置本身有三条内容，但链接指向 `/ecosystem/...`，这些不是 Next.js 公开路由，线上返回 404。默认链接改为新 GitHub 仓库下对应目录；后台仍可以覆盖标题、描述、链接和可见性。

### 工具

D1 `tools` 表当前有 4 条真实记录，`/tools` 页面可以读取；工作室导航和首页没有展示工具，导致用户误以为收藏丢失。工具继续沿用已有 `tools` 表和 `/admin/tools`，不新增重复数据模型；工作室首页增加可配置数量的工具卡片，`/tools` 进入统一 Studio 壳层并保留完整列表。

### 提示词

提示词是可持续增长、需要标签和复制操作的内容集合，使用 `site_settings` JSON 会难以搜索和编辑。因此新增 D1 `prompts` 表、公开 `/prompts`、受保护 `/admin/prompts` 与 `/api/prompts` / `/api/admin/prompts`。提示词正文只在用户点击复制时进入剪贴板，不默认发送到第三方服务。

### 仓库安全与卫生

当前树没有发现私钥、GitHub/Cloudflare Token 或 `.env` 实体；但旧管理员密码出现在公开 Git 历史中的旧 `AGENTS.md` / `CLAUDE.md` 提交里。部署前必须轮换 `ADMIN_PASSWORD`，然后对新仓库清理历史并 force-push；旧 fork 不修改。`.claude/index.json`、`.codex/hooks.json`、多层 `CLAUDE.md` 和旧 `.github/copilot-instructions.md` 是内部/过时资料，不应继续作为个人作品仓库的一部分发布。

## 方案

### 1. 文章详情页性能

- 新增 `app/[slug]/loading.tsx`，提供与文章布局一致的轻量骨架。
- 把相关文章区域拆成客户端 `RelatedPosts`，通过新的只读 `GET /api/posts/[slug]/related` 请求加载；请求失败时隐藏区域，不影响正文。
- 详情页首屏只等待文章、站点头部和主题数据；相关文章请求在浏览器挂载后触发。
- 保留 `incrementViewCount` 的非阻塞写入和现有公开鉴权逻辑。
- API 复用 `getRelatedPosts`，只允许读取公开文章，不接受任意 SQL 或数据库字段。

### 2. 工作室内容

- `DEFAULT_STUDIO_CONTENT` 的实验室链接改为 `https://github.com/JavaArthur/channing-studio/tree/main/ecosystem/...`。
- `SiteHeader` 的 Studio 导航增加“工具”和“提示词”。
- `StudioHome` 并行读取 `getTools`，展示最多 4 个置顶/排序后的工具；没有工具时显示明确的空状态和后台入口。
- `/tools` 改用 `StudioShell`，保留类型、标签、图标、外链和后台维护能力。
- `/labs` 增加“相关工具”入口，不把工具记录复制到实验室配置。

### 3. 提示词数据与后台

表结构：

```sql
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  source_url TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_prompts_public_order
  ON prompts (is_hidden, is_pinned DESC, sort_order, updated_at DESC);
```

字段约定：`tags` 存 JSON 字符串；公开列表只返回非隐藏记录；管理 API 支持创建、更新、删除、置顶、隐藏、排序；标题、正文必填，URL 只允许 `http` / `https`。

公开页：`/prompts` 展示标题、说明、标签、来源和折叠正文；复制按钮使用 `navigator.clipboard`，不支持时回退为选择文本。管理页：`/admin/prompts` 使用受保护布局，提供列表、编辑、预览、复制和删除确认。

### 4. 公共仓库清理

- 删除已追踪的 `.claude/index.json`、`.codex/hooks.json`、根及模块 `CLAUDE.md`、旧 `.github/copilot-instructions.md`。
- 保留 `.github/workflows/verify.yml`、`.gitignore`、LICENSE、源代码和生态工具本身。
- 重写根 `AGENTS.md` 为简短的公开贡献指南，不含 Cloudflare Account/D1 ID、旧 fork 运维细节或任何凭据。
- 更新 `README.md` 为 Channing Studio 当前说明，包含运行、部署、后台、数据库、工具、提示词和安全操作。
- 截取首页、工具、实验室、提示词页的桌面首屏，保存到 `docs/screenshots/`，README 只引用这些静态截图。

### 5. 历史清理与发布

1. 先由用户在本地更新 `.env.local` 的 `ADMIN_PASSWORD`，使用 `wrangler secret put` 同步到 Cloudflare；不在聊天或 Git 中传递密码。
2. 备份新仓库当前远端状态。
3. 使用新仓库专用的清洁历史重写流程移除旧内部文档和敏感历史；只对 `JavaArthur/channing-studio` force-push，旧 `JavaArthur/chen-blog-opensource` 不动。
4. 运行完整验证、D1 migration、部署和线上路由/后台回归。

## 验收标准

- 点击公开文章时，正文路由有即时 loading，首屏不等待相关文章；相关文章失败不影响正文。
- `/labs` 三条默认内容都能打开对应 GitHub 目录；后台覆盖链接后仍然生效。
- `/`、`/labs`、`/tools` 能看到 D1 中的工具；`/admin/tools` 修改后公开页回读最新数据。
- `/prompts` 展示公开提示词，复制按钮可用；`/admin/prompts` 可完成增删改、隐藏、置顶和排序。
- 新仓库当前树不含 `.env`、私钥、Token、`.claude`、`.codex` 和过时 Agent 文档；历史清理后敏感字符串扫描无命中。
- README 与线上页面身份一致，截图可加载；`npm run verify:quick`、migration、部署和线上烟测全部通过。
