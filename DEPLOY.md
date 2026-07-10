# 部署指南

Channing Studio（晨启AI）的正式部署方式是 `OpenNext + Cloudflare Workers`。文章和工作室内容都由 Cloudflare D1 持久化，图片与媒体放在 R2；网站不是静态文件，发布后可从后台动态管理。

## 首次部署

### 1. 安装依赖和环境变量

```bash
npm install
cp .env.example .env.local
```

至少填写：

```env
ADMIN_PASSWORD=请替换为独立的高强度密码
ADMIN_TOKEN_SALT=请替换为随机字符串
AI_CONFIG_ENCRYPTION_SECRET=请替换为另一组随机字符串
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 初始化资源

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

如果还要启用公共缓存 KV：

```bash
npm run cf:init -- --site-url=https://your-domain.com --with-kv
```

这一步会生成本地的 `wrangler.local.toml`，并自动写入真实 D1 / R2 / KV 绑定。

### 4. 设置 secrets

```bash
npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
npx wrangler secret put AI_CONFIG_ENCRYPTION_SECRET -c wrangler.local.toml
```

如需外部 AI：

```bash
npx wrangler secret put AI_API_KEY -c wrangler.local.toml
```

### 5. 生成类型并部署

```bash
npm run cf-typegen
npx opennextjs-cloudflare build
OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml
```

不要使用 `npm run deploy` 作为生产部署入口：该脚本会重复执行 schema，在已有 D1 数据库上可能因表已存在而失败。表结构变更请单独执行对应 migration。

## 后台与内容发布

部署完成后访问 `https://你的域名/admin`，使用 Cloudflare secret `ADMIN_PASSWORD` 登录。登录后：

- `/admin/posts`：管理文章列表、发布状态和删除操作。
- `/editor?new=1`：新建并发布文章；文章正文和元数据写入 D1，图片上传到 R2。
- `/admin/studio`：维护首页身份介绍、能力项、项目、实验室和精选文章 slug；保存后公开页面会读取最新的 D1 配置。

如果后台无法登录，先确认 `ADMIN_PASSWORD` 与 `ADMIN_TOKEN_SALT` 都已通过 `wrangler secret put` 设置；不要把密码写进仓库文档或配置文件。

## 本地 Worker 预览

```bash
npm run preview
```

脚本会优先读取 `wrangler.local.toml`。模板仓库里的 `wrangler.toml` 不带真实资源绑定，不能直接拿来部署生产。

## 日常更新

```bash
git pull
npm install
npm run verify:quick
npx opennextjs-cloudflare build
OPEN_NEXT_DEPLOY=true npx wrangler deploy -c wrangler.local.toml
```

## 常见问题

### `npm run deploy` 报缺少 D1 或 R2

先执行：

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

### 后台登录提示鉴权未配置完成

至少补齐：

```bash
npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
```

### AI Provider 已保存的 Key 无法解密

通常是 `AI_CONFIG_ENCRYPTION_SECRET` 或 `ADMIN_TOKEN_SALT` 被改了。建议固定 `AI_CONFIG_ENCRYPTION_SECRET`，不要和 token salt 复用。

### RSS / sitemap / canonical 指向错域名

检查：

- `.env.local`
- `wrangler.local.toml`

两处的 `NEXT_PUBLIC_SITE_URL` 必须一致。
