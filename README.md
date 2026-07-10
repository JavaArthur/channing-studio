# Channing Studio（晨启AI）

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/JavaArthur/channing-studio)
[![Use this template](https://img.shields.io/badge/GitHub-Use%20this%20template-111111?logo=github)](https://github.com/JavaArthur/channing-studio/generate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Channing 的个人工作室与自托管内容系统：用一个站点承载作品、实验室、文章和完整的发布工具链。

- 在线站点：<https://note.aichanning.cn>
- 项目仓库：<https://github.com/JavaArthur/channing-studio>
- 上游项目：<https://github.com/joeseesun/qiaomu-blog-opensource>

## 项目定位

这是一个数据库驱动的个人工作室。D1 继续保存文章、草稿、分类和站点设置；首页的身份、作品、实验室和精选文章通过 `/admin/studio` 动态维护。平台账号可能被封，算法流量会波动，但自己的站点不会。

## 相比上游的主要改进

| 方向 | 改进内容 |
|------|---------|
| 微信排版 | 内置排版引擎 + `POST /api/v1/convert` API，8 套主题一键转换，编辑器内嵌实时预览面板 |
| 交互体验 | 全站 55+ tooltip 从原生 title（延迟 500ms+）替换为自研快速 Tooltip 组件（100ms） |
| 编辑器增强 | 图片右键菜单、lightbox 大图预览、可拖拽侧边栏、外链图粘贴自动转存 R2 |
| 首页主题 | 5 套主题（含 Apple 风格 clarity），上游仅 1 套 |
| 数据稳定性 | 修复 D1 FTS5 SQLITE_CORRUPT_VTAB 导致的 autosave 500 错误，搜索降级 LIKE 兜底 |
| 部署健壮性 | schema.sql 幂等化，解决重复部署报 "table already exists" |
| 剪藏工具 | Chrome Clipper 支持 GFM 表格、剪藏后自动打开草稿编辑器 |
| 发布工具链 | Obsidian 一键发布插件、Claude Skill 发布工具 |
| 工程化 | 模块级 CLAUDE.md 文档树、完整的 AI 辅助开发指引 |
| 个人工作室 | 首页、作品、实验室、关于我和文章归档统一到一个公开主站 |

## 核心能力

- 前台、后台双编辑器，所见即所得，接近飞书 / Notion 的写作体验
- 五套首页主题（含 Apple 风格 clarity），移动端友好，开箱即用
- 微信排版引擎：8 套主题 + 3 档字号，编辑器内嵌实时预览，一键复制到公众号
- `POST /api/v1/convert` API：Markdown 转微信 HTML，支持 Bearer Token 认证，程序化调用
- Bubble Menu + Ask AI，选中文本就能改写、润色、扩写、翻译
- AI 自动处理摘要、标签、SEO slug、封面图
- AI 生图模型配置、历史记录、插入替换工作流
- 图片右键菜单：下载、复制、设为封面、对齐、裁剪、参考生图
- 发布状态：公开、草稿、密码访问、链接访问
- Cloudflare Workers + D1 + R2 全家桶，月费 $5 级别，不需要维护服务器
- Studio 内容通过 D1 `site_settings` 动态维护，不需要改代码才能更新首页

## 截图预览

### 五套首页主题

![五套首页主题](docs/screenshots/home-themes.webp)

### 编辑器与微信排版预览

![编辑器总览](docs/screenshots/editor-overview.webp)

### Ask AI / Bubble Menu

![Ask AI](docs/screenshots/ask-ai.png)

### 后台设置与主题、API Token 管理

![后台设置](docs/screenshots/admin-settings.webp)

### AI 模型与生图配置

![图片模型配置](docs/screenshots/image-provider.png)

## 配套生态

写作入口放在最顺手的地方，最终都回到同一个博客后台。

| 工具 | 说明 | 文档 |
|------|------|------|
| [Chrome Clipper](ecosystem/chrome-clipper/) | 浏览器网页剪藏，直接进入草稿箱 | [README](ecosystem/chrome-clipper/README.md) |
| [Obsidian Publisher](ecosystem/obsidian-publisher/) | 从 Obsidian 一键发布到博客 | [README](ecosystem/obsidian-publisher/README.md) |
| [Claude Skill](ecosystem/channing-blog-publish-skill/) | 通过 Claude 命令工作流直接发布 | [SKILL.md](ecosystem/channing-blog-publish-skill/SKILL.md) |

## 快速开始

### 一键部署到 Cloudflare

点击顶部的 **Deploy to Cloudflare** 按钮，Cloudflare 会自动创建 D1 / R2 绑定并部署。

部署时需要准备：

| 变量 | 说明 |
|------|------|
| `ADMIN_PASSWORD` | 后台登录密码 |
| `ADMIN_TOKEN_SALT` | Token 加盐（`openssl rand -hex 32`） |
| `AI_CONFIG_ENCRYPTION_SECRET` | AI 配置加密密钥（`openssl rand -hex 32`） |
| `NEXT_PUBLIC_SITE_URL` | 站点域名 |
| `AI_API_KEY` | AI 模型 API Key（可选，后台也可配置） |

### 手动部署（CLI）

```bash
npm install
cp .env.example .env.local    # 编辑填入上述变量
npx wrangler login
npm run cf:init -- --site-url=https://your-domain.com
npm run build
npm run deploy
```

### 本地开发

```bash
git clone https://github.com/JavaArthur/channing-studio.git
cd channing-studio
npm install
cp .env.example .env.local
npm run dev
```

常用入口：

| 路径 | 说明 |
|------|------|
| `/` | Channing Studio 首页 |
| `/work` | 作品 |
| `/labs` | 实验室 |
| `/writing` | 文章归档 |
| `/about` | 关于我 |
| `/admin` | 后台管理（登录入口） |
| `/admin/studio` | 首页、作品、实验室内容管理 |
| `/editor` | 文章编辑器 |

### 发布与后台入口

1. 访问 `https://note.aichanning.cn/admin`。
2. 使用 Cloudflare Worker secret `ADMIN_PASSWORD` 登录；未登录访问 `/editor` 会自动跳回登录页。
3. `/admin/posts` 管理文章状态，点“写文章”或访问 `/editor?new=1` 创建文章。
4. `/admin/studio` 修改首页身份、能力卡、作品、实验室和精选文章；保存后刷新公开页面即可生效。

后台密码只通过 Cloudflare secret 管理，不写入 README、`AGENTS.md` 或 Git 历史。

## 微信排版 API

`POST /api/v1/convert` — 将 Markdown 转为微信公众号兼容的富文本 HTML。

```bash
curl -X POST "https://note.aichanning.cn/api/v1/convert" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer qm_xxxxxxxxxxxxx" \
  -d '{"markdown": "# 标题\n\n**加粗**文本", "theme": "apple"}'
```

**参数：**

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `markdown` | 是 | - | Markdown 文本 |
| `theme` | 否 | `apple` | 主题 ID |
| `fontSize` | 否 | `medium` | `small` / `medium` / `large` |
| `outputFormat` | 否 | `fragment` | `fragment`（粘贴用）/ `standalone`（独立页面） |
| `responseFormat` | 否 | `json` | `json` / `html` |

**可用主题：**

| 分组 | 主题 ID | 风格 |
|------|---------|------|
| 经典 | `apple` / `wechat` / `claude` | Mac 风格 / 微信原生 / Claude 风格 |
| 潮流 | `notion` / `github` / `sspai` | Notion / GitHub / 少数派 |
| 更多 | `solarized` / `ink` | Solarized / 水墨 |

完整文档见 [docs/api/convert.md](docs/api/convert.md)。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| 编辑器 | Tiptap 3.x (Novel) |
| 部署 | OpenNext + Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| 存储 | Cloudflare R2 |
| 样式 | Tailwind CSS v4 |

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发（热重载） |
| `npm run preview` | Worker 运行时本地预览 |
| `npm run build` | 构建应用 |
| `npm run deploy` | 部署到 Cloudflare Workers |
| `npm run verify:quick` | lint + test + build 快速验证 |
| `npm run cf:init` | 初始化 Cloudflare 资源 |

## 项目结构

```
app/                    # Next.js 路由层（API + 前台 + 后台）
lib/                    # 业务逻辑与数据访问层
  └── wechat-studio/    # 微信排版引擎（主题、Markdown 渲染、兼容层）
components/             # React UI 组件
db/                     # D1 schema、seed、迁移脚本
scripts/                # Cloudflare 部署脚本
ecosystem/
  ├── chrome-clipper/    # 浏览器剪藏扩展
  ├── obsidian-publisher/# Obsidian 发布插件
  └── channing-blog-publish-skill/ # Claude Skill
```

详细架构文档见 [CLAUDE.md](CLAUDE.md)。

## 贡献

欢迎提 Issue 和 PR。通用修复和新功能会在保留上游致谢的前提下独立维护。

## 致谢

- 上游项目：[qiaomu-blog-opensource](https://github.com/joeseesun/qiaomu-blog-opensource) by [joeseesun](https://github.com/joeseesun)

## 作者

- **Channing** — [GitHub](https://github.com/JavaArthur) / [Studio](https://note.aichanning.cn)

## License

[MIT](LICENSE)
