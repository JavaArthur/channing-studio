# Channing Studio 项目协作说明

## 项目定位

这是 Channing 的个人工作室与数据库驱动内容站：公开展示 AI 平台工程、内容自动化、工具收藏、提示词和真实交付记录。

## 技术栈

- Next.js 16 App Router + React 19 + TypeScript
- OpenNext + Cloudflare Workers
- Cloudflare D1 保存文章、工具、提示词和站点设置
- Cloudflare R2 保存图片与媒体
- Vitest 4、Tailwind CSS v4

## 关键入口

| 路径 | 用途 |
|---|---|
| `/` | Channing Studio 首页 |
| `/writing` | 文章归档 |
| `/work` | 项目展示 |
| `/labs` | 实验室与工具链 |
| `/tools` | 工具收藏 |
| `/prompts` | 提示词收藏 |
| `/admin` | 私人知识工作台 |
| `/admin/login` | 后台登录入口 |
| `/admin/studio` | 首页、项目、实验室配置 |
| `/admin/tools` | 工具收藏管理 |
| `/admin/prompts` | 提示词管理 |
| `/editor?new=1` | 新建文章 |

## 开发与验证

```bash
npm install
npm run dev:next       # 纯 Next 本地开发
npm run verify:quick   # lint + test + build
```

Cloudflare Worker 预览和部署需要本地的 `wrangler.local.toml`，它不进 Git：

```bash
npm run cf-typegen
npx opennextjs-cloudflare build
OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml
```

## 数据与后台

- 文章发布：`/admin/posts` 或 `/editor?new=1`。
- 工作室内容：`site_settings` 中的 `studio_*` 配置由 `/admin/studio` 管理。
- 工具收藏：D1 `tools` 表，由 `/admin/tools` 管理。
- 提示词收藏：D1 `prompts` 表，由 `/admin/prompts` 管理；新增表必须先写 migration。
- 知识闭环：D1 只保存 Hermes 运行状态、来源标识和脱敏成果投影，不保存 Flomo 原文。
- 公开页面只读取公开状态；后台 API 必须继续使用现有 admin session 鉴权。

## 安全边界

- `.env*`、`wrangler.local.toml`、`.dev.vars`、备份 SQL、Token 和密钥永远不提交。
- 管理密码只使用 Cloudflare secret `ADMIN_PASSWORD`，不要写入文档、测试或 Git 历史。
- Hermes 协同只使用专用 Worker secret `HERMES_SYNC_TOKEN`，不得复用或代理 Flomo Token。
- 修改生产 D1 前先导出备份；不要在本地随意执行 DELETE。
- 任何外部链接都要限制为 `http` / `https`，用户输入的提示词正文不发送给第三方服务。

## 代码约定

- Server Component 默认；只有交互需要时使用 `'use client'`。
- API 路由不直接拼接 SQL，统一调用 `lib/repositories/*`。
- 数据库变更顺序：先 `db/migrations/*.sql`，再同步 `db/schema.sql`。
- 修改后先跑 focused test，再跑 `npm run verify:quick`。
- 不做与当前需求无关的重构；不要把旧 fork 的身份、域名或内部运维资料带回公开仓库。
