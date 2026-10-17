# Channing Studio：个人大脑与公开展示改造方案

日期：2026-10-16
状态：原始评审与设计稿；当前实施情况见 [交付与上线说明](2026-10-17-personal-brain-implementation.md)
评审基线：`efcba5a`；工作区起始无改动

## 1. 目标与建议

你的定位是：**“我的个人大脑网站，管理我的所有，也负责对外展示。”**

建议保留现有 Next.js + Cloudflare Workers + D1 + R2 技术栈，把产品整理为两个明确的工作空间：

- **私人工作空间 `/admin`**：收集信息、整理知识、推进项目、管理写作和资源、检查自动化运行。默认私密，打开后知道下一步做什么。
- **公开网站 `/`**：介绍你、展示代表项目、分享文章和精选工具/提示词。公开内容来自明确的发布动作。

全站采用**一套设计系统，白天与晚上两种配色**。主题不再改变布局、字体、品牌或功能。

改造顺序：先修复内容保护和发布行为，再统一视觉与后台流程，最后扩展收件箱、项目与任务。已有功能先降噪、整合，避免一次性重写。

“管理所有”先落实为统一入口、搜索、状态和关联。第一版覆盖当前已有内容与工作流；邮件、日历、网盘、财务等尚未确认的系统不在首批接入范围内，保留外链入口即可。

## 2. 本次评审范围与限制

已检查公开页面、后台、编辑器保存流程、主题引用、主要 API/仓储、数据模型、鉴权、媒体读取、部署脚本与现有测试结构。仓库 `app/`、`components/`、`lib/` 合计 231 个受 Git 跟踪文件；现有 36 个测试文件，采用重点路径审查而非逐行审计。

- 本机没有 `node_modules`，也没有 `.env`、`.env.local`、`.dev.vars`、`wrangler.local.toml`。
- 未安装依赖、启动网站、访问生产 D1、登录线上后台或执行部署；未读取任何真实密钥。
- 用 Node 执行了只读检查，确认首页精选候选范围、未置顶提示词空列表，以及密码校验前向客户端传递受保护字段的代码路径。
- 未运行 Vitest、lint、Next/OpenNext build，也未执行浏览器交互与性能测试。下面的运行表现按源码推导，生产发生频率和影响范围仍需恢复环境后确认。
- 本轮只新增此文档，不修改应用、数据库和部署配置。

## 3. 代码评审结论

### 3.1 优先修复的内容保护与发布问题

优先级：P0 为内容保护边界；P1 为错误发布、管理可靠性或改造前置问题；P2 为体验和维护成本。

| 优先级 | 发现与触发条件 | 代码证据 | 改造要求 |
|---|---|---|---|
| P0 | 密码文章在未输入密码、密码错误分支，仍将正文 HTML、正文和密码字段传给 Client Component。客户端是否显示编辑器无法保护已经下发的数据 | `app/[slug]/page.tsx:110`、`:122`、`:154`；`components/FrontPostAdminBoundary.tsx:1`、`:20` | 校验前只输出密码表单和允许公开的标题；验证后的正文在服务端控制。管理员编辑数据走鉴权 API，不从公共页面预先下发 |
| P1 | 点击“保存草稿”时先 `setPublishStatus('draft')`，立即调用读取旧状态的 `handleSave()`；原状态为公开时可能仍按公开状态保存 | `components/NovelEditor.tsx:824`、`:847`、`:1167` | 保存动作显式接收目标状态；增加“公开状态下点击保存草稿”的交互回归 |
| P1 | 编辑已发布文章时，自动保存直接 PATCH 当前文章正文，未独立保存修改稿；因此未点击“更新文章”的修改也会进入已发布数据 | `components/NovelEditor.tsx:507`；`app/api/posts/route.ts:128`、`:183` | 为已发布文章增加独立工作稿；自动保存只写工作稿，明确发布后才更新公开版本 |
| P1 | 编辑器承诺“链接访问”，但公开单篇查询与可见性判断均排除 `is_hidden=1`，冷缓存下链接仍返回 404 | `components/NovelEditor.tsx:949`；`lib/repositories/posts.ts:112`；`lib/repositories/types.ts:63` | 明确区分“私密”与“不列出”；兼容旧状态前先盘点，不擅自把原隐藏内容公开 |
| P1 | 现有媒体读取按 R2 key 直接返回，无身份校验，部分响应可长期公开缓存；不适合存放个人大脑的私密附件 | `app/api/images/[...key]/route.ts:88`、`:99`、`:136` | 保留现有公共图片链路；新增私有附件走独立 bucket/鉴权路由，禁止公共路由读取私有对象 |
| P1 | 工具表没有私密状态，新增即进入公开查询；提示词创建缺省 `is_hidden=0`。当前“收藏”动作不能等同于未来的私人收集 | `lib/repositories/tools.ts:61`；`app/api/tools/route.ts:34`；`app/api/admin/prompts/route.ts` | 新收集内容默认私密，发布为独立操作；历史公开数据显式回填，避免迁移意外公开/撤回 |

P0 是源码中确认的边界错误，尚未对线上受保护文章进行请求验证。Next.js 会把传给 Client Component 的 props 放进 RSC 数据，因此“界面上没有显示正文”不能作为保护依据。[Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

### 3.2 管理与内容一致性问题

| 优先级 | 发现与影响 | 代码证据 | 建议 |
|---|---|---|---|
| P1 | 后台改导航，工作室页面不采用：`studioMode` 直接选择硬编码导航 | `components/SiteHeader.tsx:53` | 一份经过校验的导航配置，所有公开页共用；后台有预览 |
| P1 | 工作室保存拆成 4 次独立请求，失败时可能已写入部分配置 | `app/admin/(protected)/studio/StudioManager.tsx:57`；`lib/studio-content.ts:44` | 单次请求、服务端校验、D1 batch 原子写入；返回版本号与明确结果 |
| P1 | 部署脚本仍对远程库执行完整 schema 和 seed，与 README 的已有库操作说明冲突 | `scripts/cf-deploy.sh:17`；`README.md` | 初始化与部署分离；旧库只执行已审阅增量 migration。不能声称该脚本必然删数据，但其混合职责不适合继续作为常用部署入口 |
| P1 | 后台文章列表最多取 200 条，再在内存筛选和计数；规模增加后漏掉旧内容，统计也只是截断结果 | `app/admin/(protected)/posts/page.tsx:24`、`:45` | SQL 过滤、分页、独立 COUNT；列表仅取摘要字段 |
| P2 | 首页精选只能从前 25 条候选中选。候选按置顶、发布时间排序，较旧指定文章可能永远不出现 | `app/page.tsx:39`；`lib/studio-home.ts:1` | 按精选 ID/slug 单独查询公开文章，再以最新内容补足 |
| P2 | 首页判断全部提示词是否为空，实际只渲染置顶项；有内容但无置顶时出现空列表 | `components/StudioHome.tsx:119` | 先计算最终展示集合，再决定隐藏区块或显示内容 |
| P2 | 工作室能力卡以包含可编辑标题的字符串作 key；输入标题导致节点重建，可能中断焦点 | `app/admin/(protected)/studio/StudioManager.tsx:115` | 稳定 ID；内部 ID 不作为日常编辑字段 |
| P2 | `/tools` 已包含提示词全集，`/prompts` 又提供同一批内容，导航仍给两者相同权重 | `app/tools/page.tsx:42`、`:135`；`app/prompts/page.tsx:16` | 统一“资源”入口，工具与提示词分视图，保留原 URL |
| P2 | 数据读取失败、未配置和真正无内容多处混为默认内容/空态，后台不易判断为什么没有数据 | `app/page.tsx:54`；`app/prompts/page.tsx:32`；`lib/repositories/settings.ts:13` | 区分空内容、未配置、读取失败；公共页不展示运维细节，后台明确可恢复操作 |

### 3.3 架构与冗余

- **6 套布局模板大部分已成为遗留代码。** 当前路由没有引用 `HomeClient`，`/writing` 直接使用 StudioShell；但 `ThemeDropdown`、`appearance.ts`、页头分支及全局 CSS 仍在提供 6 种风格。删除模板主要降低维护成本，不能据此直接宣称首屏包体会减少 6 倍。
- **主题定义重复。** `lib/appearance.ts`、`lib/theme-registry.ts`、`components/HomeClient.tsx` 各有一套映射；布局、配色、字体与客户端恢复逻辑绑在一起。`app/globals.css` 共 2,105 行，还混合编辑器、文章、旧主题和 Studio 样式。
- **后台重心偏向单一集成。** `/admin` 直接呈现 `KnowledgeDashboard`，首次使用主要是等待 Hermes 同步；没有统一“待处理、继续写作、推进项目”入口。Hermes 应是个人大脑的输入来源和状态面板之一。
- **设置页负担过重。** 11 个标签混合导航、分类、代码、主题、Token、文本模型、图片模型、生成器和运行环境；分类又有独立页面。应改为基础设置、外部连接、高级功能三个层次。
- **编辑器可保留，但职责需要拆开。** `NovelEditor.tsx` 1,657 行、`InlineArticleEditor.tsx` 613 行；保存、发布、AI、媒体、导出等交叉。已有自动保存与重试，不应重复发明；应先统一保存协议，再按职责拆分。
- **迁移与业务请求混用。** `lib/repositories/schema.ts` 在读取请求中执行 ALTER TABLE 并吞掉错误；tools/AI/Token 路径也有运行时建表。多个 AI API 直接编写 SQL，未遵守仓库“API 调仓储”的约定。
- **缓存策略需要重新核实。** 根布局通过 `resolveRequestTheme()` 读 cookie；多个页面设置 `revalidate`，写入侧主要只更新可选 KV 版本，设置/提示词写入又缺统一失效入口。`cookies()` 会影响动态渲染，不能简单断言页面一定缓存一小时，也不能认为刷新一定取到新内容。[Next.js cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)
- **密钥缺失时降级过宽。** `lib/ai-provider-profiles.ts:170` 的加密密钥选择最终回退到源码常量；缺少专用 secret/salt 时不应继续保存提供商 Key。未确认生产是否触发该分支。
- **公共扩展脚本进入私人工作区。** 根布局加载 `custom_js`，覆盖登录、后台与编辑器。个人大脑引入更多私密数据前，应把任意脚本注入移出私有页面；保留必要统计时采用明确配置。

值得保留的基础：Server Component 页面、已建立的仓储层、管理员会话及登录限流、D1/R2、文章编辑与媒体上传、工具/提示词管理、Hermes 的独立 Token 和脱敏投影约束、现有测试与 CI。

## 4. 信息架构：私人工作空间为主，公开展示为出口

### 4.1 私人工作空间

统一显示名称为“我的大脑”，继续使用 `/admin` 路径和现有鉴权。

| 一级入口 | 日常目的 | 首批内容 | 后续扩展 |
|---|---|---|---|
| 总览 `/admin` | 回到工作现场 | 快速收集、最近编辑、草稿、待整理资源、进行中项目、连接异常 | 到期任务、每周回顾 |
| 收件箱 `/admin/inbox` | 把输入变成行动 | 手动想法、链接、现有剪藏；Hermes 脱敏成果候选独立标识来源 | 更多来源适配、去重 |
| 知识与资源 | 查找可复用内容 | 知识成果、工具、提示词、剪藏，提供类型筛选和来源入口 | 项目关联、使用记录 |
| 项目 `/admin/projects` | 推进正在做的事 | 项目状态、下一步、关联资料、独立公开摘要 | 轻量任务与归档 |
| 写作与发布 `/admin/posts` | 从草稿到公开成果 | 继续编辑、草稿、公开文章、回收站、待发布修改稿 | 内容复盘 |
| 站点与连接 | 管理出口和外部来源 | 公开首页配置、导航、Hermes、Token、按需 AI、运行诊断 | 新来源配置 |

桌面采用固定侧栏与主工作区；手机采用简短导航抽屉。工具、提示词、分类作为二级入口，避免横向塞满导航。旧 `/admin/tools`、`/admin/prompts`、`/admin/studio` 路由继续可用。

后台首页线框：

```text
我的大脑                         [搜索我的内容] [快速收集]
总览        继续处理
收件箱      ├─ 最近编辑的草稿 / 当前项目下一步
知识与资源  ├─ 待整理内容（来源、状态、处理动作）
项目        └─ 待发布修改（明确区分线上版本）
写作与发布
站点与连接  最近活动                     连接状态
            我上次做了什么               Hermes 最近成功时间
            哪些内容刚刚公开             失败原因 / 查看详情
```

不把“长时间未使用”做成惩罚性红色提醒；提供“从上次停下的地方继续”。未启用的集成不占据主区域。概览卡必须链接到可处理的列表。

### 4.2 四条核心流程

1. **收集**：输入标题、链接或简短想法即可保存；默认私密，允许以后补分类。Flomo 仍在原系统保存原文，本站只接收来源标识与脱敏成果。
2. **整理**：收件箱可归入资源、关联项目、转成写作草稿或归档。转换时保留来源关系，重复操作不生成多份内容。
3. **推进**：项目有状态、下一步、相关笔记/工具/文章；手动录入可独立完成，不依赖 Hermes 在线。
4. **发布**：从指定内容生成公开草稿，审阅实际公开字段与附件，确认后发布；后续私密修改不自动同步到公开版本。

个人大脑的统一搜索必须在鉴权后执行；公开搜索只访问公开投影。不会通过客户端隐藏结果来隔离私密数据。

## 5. 公开首页与各模块重设计

### 5.1 首页

公开首页回答“你是谁、做了什么、值得读什么”，内容控制在少量有效区块。

```text
Channing Studio        作品  文章  资源  关于    搜索  日/夜

一句定位 + 简短介绍
[查看作品] [阅读文章]

代表项目：2–3 项
问题 / 实际结果 / 我的贡献 / 案例或演示链接

精选或最近文章：3–5 篇
标题 / 摘要 / 日期 / 分类

精选资源：最多 4 项
工具与提示词混合精选，显示类型

联系方式 / GitHub / RSS / 管理入口
```

现有大篇幅能力卡、独立实验室区和重复口号移到关于/作品页；不再把每个数据表都展示成首页栏目。无公开内容的可选区块自动隐藏，不向访客显示“去后台添加”。不公开私人任务量、收件箱标题和 Hermes 诊断。

### 5.2 模块取舍

| 当前模块 | 处理方式 | 具体变化 |
|---|---|---|
| `/writing` | 保留并统一 | 文章搜索、分类、分页；同一文章列表组件用于归档和分类 |
| `/{slug}` | 保留原 URL | 专注阅读；后台编辑跳转统一编辑器，减少两套编辑体验；密码保护先修复 |
| `/work` | 保留并强化 | 从技术标签卡升级为案例摘要；私有项目状态与公开展示字段分开 |
| `/labs` | 降为二级视图 | 从作品页进入实验内容；首轮保留 URL，避免未经核实的重定向破坏链接 |
| `/tools` | 成为“资源”主入口 | 工具为默认视图，提示词为另一视图，不再整页堆叠两套全集 |
| `/prompts` | 保留独立 URL | 使用资源页面框架；标签、搜索、展开、复制；正文不发往第三方 |
| `/about` | 保留 | 个人介绍、工作方式、能力、联系信息；减少首页重复 |
| `/clippings` | 收集优先私密 | 私人收件箱/资源中管理；历史已公开剪藏逐项保留或撤回，不批量改变可见性 |
| `/search`、分类、RSS、sitemap | 保留并对齐 | 统一公开过滤；sitemap 补齐主要公开模块；不包含私密/不列出内容 |

首批保留现有路径，优先调整导航与组件，避免“为了改名而迁移 URL”。以后确需合并 URL，单独建立一对一永久重定向与 canonical 规则。

## 6. 设计系统：只保留白天和晚上

### 6.1 视觉基线

建议采用中性灰与单一蓝色强调色，让内容和项目结果成为重点。以下是待视觉验证的初始 token，不是已经验证的对比度结果。

| Token | 白天 | 晚上 |
|---|---|---|
| 页面背景 | `#F7F8FA` | `#111318` |
| 面板背景 | `#FFFFFF` | `#191D24` |
| 主文字 | `#17202A` | `#E6EAF0` |
| 次文字 | `#526071` | `#A4AFBD` |
| 边框 | `#DDE2E8` | `#343C48` |
| 强调/链接 | `#2457C5` | `#8AB4FF` |

- 页面内容宽约 1,152px，正文宽约 720–760px；手机正文 16px 起，行高约 1.8。
- 保留本地 Geist 与中文系统字体；代码使用等宽字体。首批关闭任意字体预设，不再按皮肤加载 Google Fonts。
- 统一卡片、表单、按钮、状态标签、弹窗、空态和错误态；公开页与后台共用 token，按任务采用不同布局。
- 功能状态不能只靠颜色；键盘焦点、移动端菜单和减弱动画偏好纳入验收。

### 6.2 主题行为与迁移

- 实际模式只有 `light | dark`；UI 是太阳/月亮切换，没有额外皮肤菜单。
- 未手动选择时根据系统偏好决定；“跟随系统”是首次默认行为，不增加第三种皮肤。用户选择后本机持久化，前台、后台、编辑器一致。
- 建议使用版本化本地存储 `channing-color-mode-v1`；只改变 `<html data-color-mode>` 和 CSS 变量，不改变 React 页面结构。
- 在首屏脚本中恢复偏好；脚本失败时由 CSS 系统偏好兜底。切换按钮首屏保持中性结构，挂载后再显示状态，避免 hydration 差异。
- 旧 `qm_site_theme` cookie/localStorage 仅迁移读取一次：`terminal → dark`；明确浅色皮肤 → `light`；`default`、无值、异常值 → 系统默认。新偏好优先，迁移后清除旧值。
- 站点 `default_theme` 停止参与布局和请求级主题选择，旧值先保留用于回滚；不要用管理员个人主题覆盖访客偏好。
- Tailwind 的 `dark:` 统一绑定新属性，不能继续只听系统媒体查询，否则手动切换后局部颜色会错位。
- 微信导出排版主题属于输出格式，独立于网站日夜模式；首轮只折叠其入口，后续根据使用频率再精简。

待删除：`components/themes/*`、`HomeClient`、`theme-registry`、多皮肤 ThemeDropdown/ThemeSwitcher 及旧 CSS 分支。删除前检查全部引用和类型依赖；不机械删除文章/编辑器共用样式。

## 7. 技术结构与数据边界

### 7.1 保持单仓库，明确服务端职责

```text
公开页面 ──> 公开查询服务 ──> 公开字段/已发布版本
私人后台 ──> 管理会话鉴权 ──> 工作稿、收件箱、项目、资源
Agent API ──> 专用 Token ──> 来源标识、运行状态、脱敏成果
                              │
                     校验 / 发布 / 原子写入
                              │
                         repositories
                              │
                       D1 / R2 bindings
```

建议按修改范围逐步落地：

```text
app/(public)/...                 公开布局；路由组不改变 URL
app/admin/(protected)/...        私人布局与现有会话
components/ui/                   共享基础组件
components/public/              首页、阅读、资源展示
components/brain/               总览、收件箱、项目
components/editor/              编辑器和发布面板
lib/services/                   保存工作稿、发布、公开投影
lib/repositories/               全部 SQL 与分页查询
lib/validation/                 URL、状态、配置结构校验
styles/tokens.css                日夜变量
styles/article.css              阅读样式
styles/editor.css               编辑器样式
```

不引入微服务、第二套前端或通用插件平台；不把所有业务塞进一个万能 JSON 表。页面默认 Server Component，筛选交互、复制按钮、编辑器等局部使用 Client Component。

### 7.2 公私隔离规则

| 内容 | 私人数据 | 对外数据 |
|---|---|---|
| 项目 | 进度、下一步、资料、内部备注 | 单独编辑并发布的标题、摘要、成果和链接 |
| 文章 | 草稿与尚未发布的修改 | 已发布版本；公开查询不取工作稿 |
| 工具/提示词 | 新收集内容、私人备注 | 明确公开的内容；公开 API 仅选择白名单字段 |
| Hermes | 来源 ID、运行状态、脱敏成果 | 经人工选择转成公开文章/资源的成果 |
| 文件 | 私有附件与素材 | 发布时显式挑选的公共媒体副本 |

必须在服务端完成隔离：私有 API 与页面 `private, no-store`；公共缓存不存管理员 DTO。密码/hash、API Key、内部备注、Flomo 原文不进入公共 HTML、RSC、JSON、搜索、RSS、sitemap 或 metadata。

提示词库正文始终不发送给第三方服务。其他私人内容的外部 AI 处理默认关闭，只在用户选择具体内容并明确触发时执行；收集、保存、搜索不能隐式调用外部 AI。

已有“密码文章”是访问控制，不是端到端加密。重构期间避免把它当成私人知识库容器；先修补验证前的数据下发，再决定保留密码分享还是只使用私密/公开两类。`unlisted` 如保留，只表示可通过链接访问，不代表保密。

媒体建议新增 `PRIVATE_FILES` R2 binding，由 `/api/admin/files/[id]` 鉴权读取；现有 `IMAGES` 仅承载公共素材。只创建私有前缀不够，因为当前公共路由可读取任意 key。公共媒体撤回需处理 CDN 缓存；已经公开的文件不能承诺完全收回。

### 7.3 数据模型分阶段演进

**第一阶段必需：**

- 保留 `posts`、`tools`、`prompts`、`site_settings` 和全部 Agent 表。
- 新增 `post_working_copies`：`post_id`、编辑内容、`revision`、`base_published_revision`、时间；`posts` 增加发布版本号，继续承载公开版本。自动保存只写工作稿，发布检查版本冲突，避免旧请求覆盖新内容。
- tools/prompts 增加明确的可见性字段，新增内容默认私密；历史 tools 全量按“原已公开”回填，prompts 根据现有 `is_hidden` 保留语义。私人备注单独字段存储且不出公共 DTO。
- tools/prompts 同时保存独立的 `published_payload`、发布版本和时间：payload 仅允许各自类型的公开字段，公共查询只读已发布快照；编辑字段属于工作版本。历史已公开条目初始化快照，随后显式发布才替换快照，避免只有一个 visibility 字段却让私有修改实时公开。项目公开摘要同样采用独立快照。
- 工作室配置仍可使用 `studio_*`，改为类型校验、单请求原子写、稳定条目 ID、配置版本；不为几个公开首页区块提前建复杂 CMS。
- 若本阶段还未完成私有附件链路，私人收集仅支持文本与来源链接，不能复用公开上传接口冒充私有附件。

**第二阶段，建立个人大脑闭环：**

| 表/对象 | 最小字段与职责 |
|---|---|
| `inbox_items` | ID、来源类型/引用、标题、用户手动输入的短文本、处理状态、目标对象引用、时间；来源引用有唯一约束，避免重复导入 |
| `notes` | 用户主动整理的私有笔记：标题、正文、标签、来源引用、归档状态、版本与时间；需要公开时转为文章草稿，不直接公开笔记原文 |
| `projects` | ID、名称、私有描述、状态、下一步、时间；公开摘要独立存储并明确发布 |
| `project_links` | 项目与文章、资源、脱敏知识成果的关联；写入校验目标存在，避免复制正文 |
| `tasks`（项目有实际需要时） | 项目 ID、标题、状态、可选截止时间；先做列表，不做复杂多级流程 |
| `files`（启用私有附件时） | 对象 key、用途、关联对象、可见性、MIME、大小；所有读取先核验记录与权限 |

Flomo/Hermes 来源条目不向 `inbox_items` 写入 Flomo 原文；展示已有脱敏 `knowledge_artifacts` 的引用即可。Hermes 外部 API、版本约束和专用 `HERMES_SYNC_TOKEN` 保持兼容。手动知识录入与 Agent 投影分开，不伪造成一次 Agent 同步。

### 7.4 API、缓存与迁移

- 新后台写接口继续强制 admin session；对现有发布插件保留兼容 API。集成 Token 后续按用途收敛权限，不给新私人工作区无差别授权。
- `GET /api/admin/overview` 聚合摘要；`GET /api/admin/search` 搜索私有对象；公共 `/api/search` 始终使用公开查询。
- `PUT /api/admin/studio` 原子保存配置；配置 schema 白名单、字段长度、数组数量、URL 协议和版本冲突都在服务端验证。
- 文章工作稿保存与发布为两个明确动作；返回 `revision`、`savedAt`、`publishedAt`，界面区分“已保存”和“已公开”。
- 分页过滤下推 SQL；首页只查询所需数量和字段，不获取全部提示词正文再截断。外部 URL 只允许 http/https，站内路径另设校验。
- URL 元信息抓取统一校验目标、重定向和大小/超时限制；现有 `resp.text().slice(...)` 是读完再截断，不是真正的读取上限。
- 第一阶段把正确性放在缓存收益前：私有、密码、分享校验均不进入共享缓存；公开内容先形成一致的发布失效入口，再验证 OpenNext 的 R2/DO 缓存行为。没有验证前不承诺 ISR 命中率。
- 移除根布局为皮肤读取 cookie 的需求后，再根据实际构建结果决定公开路由缓存；所有发布、撤回和首页配置变更都要验证刷新效果，旧 KV 缓存与 Next 缓存分别处理。
- 数据库变更先写 `db/migrations/*.sql`，再更新 `db/schema.sql`。上线前导出生产备份，在副本上验证。
- 现有 migration 同时存在数字编号、日期命名、启用/移除 FTS 等历史文件；不能直接把整个目录交给迁移工具全部重放。先核对线上 schema 和迁移记录，建立基线，再使用统一增量序列。[Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- 禁止业务请求执行 DDL；部署不再顺带初始化或 seed。新增字段/表优先保持旧版本兼容，回滚应用时无需删除新表。

## 8. 管理后台具体减法

| 能力 | 决策 |
|---|---|
| 富文本、自动保存、Markdown 导入导出、媒体上传 | 保留，统一编辑入口与保存协议 |
| 文章分类、筛选、公开状态、回收站 | 保留；完善真正分页、统计和误操作恢复 |
| 前台直接编辑 | 首批改为鉴权后“编辑”入口跳转；减少客户端暴露管理数据和双编辑器逻辑 |
| 首页/作品配置 | 保留，加入搜索选择精选、联系链接编辑、预览与保存反馈 |
| 工具/提示词 | 合并导航入口；数据仍按各自模型管理，新增私密状态 |
| Hermes 看板 | 保留，移到连接详情；总览只显示最近同步摘要和异常入口 |
| AI 文本/图片/生成器 | 折叠到高级功能，按需启用；缺 Key 时普通写作正常工作 |
| 6 套网站皮肤、字体菜单 | 删除，改为日夜模式 |
| 任意自定义 JS | 从私人区域移除；公开统计以明确字段配置，避免私人内容被第三方脚本读取 |
| Chrome Clipper / Obsidian Publisher / 发布 Skill | 保留接口兼容；连接页面显示用途和状态，不要求全部重新配置 |
| 知识图谱、自动多 Agent 编排、全平台连接 | 暂缓；先验证日常收集、检索、推进与发布确实被使用 |

## 9. 分期实施与验收

下列是后续实施拆分，不表示本次已开始。单人专注开发粗估：可重新使用的第一版约 7–12 个工作日；包含收件箱和项目闭环的版本约 12–20 个工作日。数据状态、设计修改和现有集成兼容可能改变工期，恢复环境后再估算。

| 阶段 | 交付 | 完成标志 |
|---|---|---|
| A：恢复环境与数据基线 | 配置迁移、隔离开发库、实际数据盘点、现状截图、测试基线 | 明确哪些内容/集成在使用；本地不写生产；备份可恢复 |
| B：保护与保存 | P0 修复、草稿状态修复、已发布工作稿、私密默认、发布边界、部署拆分 | 未验证访问拿不到正文；草稿不误发布；自动保存不改线上版本 |
| C：统一视觉与入口 | 日夜 token、删除旧主题、共享页头、精简首页、后台总览与导航 | 前后台日夜一致；没有布局皮肤菜单；登录后可以继续工作 |
| D：内容管理可用性 | 分页/搜索、精选选择、原子配置保存、预览、资源视图 | 旧文章可找到；设置可靠生效；新资源先私密再公开 |
| E：个人大脑闭环 | 收件箱、项目、来源关联、私有搜索；按需任务/附件 | 一条输入能被整理、关联项目、转成草稿并发布 |
| F：收尾与迁移上线 | 老 URL/API 回归、数据迁移演练、文档和回滚步骤 | 生产验收通过；无需重新学习所有旧工作流 |

**验证要求：**

1. 先补并运行 focused tests，再执行仓库要求的 `npm run verify:quick`；CI 使用 Node 24，本机当前 Node 26，实施时对齐 Node 24。
2. 密码文章：匿名无密码/错误密码的 HTML、RSC、JSON 中均不得含正文、密码或管理字段；正确授权后的访问单独测试。
3. 发布：选择公开后点击“保存草稿”仍保存私密；编辑已发布文章并等待自动保存，公开版本保持不变；显式发布才更新。
4. 私密资源与项目：直接 URL、公共 API、搜索、RSS、sitemap、OG 元数据和媒体 URL 均不能绕过授权；不能只测试菜单是否隐藏。
5. 迁移：旧皮肤偏好、旧导航、隐藏文章、工具/提示词可见性和现有 Hermes API 均有兼容用例；不删除旧数据。
6. 管理：超过 200 条文章时仍可搜索和翻页；配置写入中断不出现半份保存；非 http/https 外链被拒绝。
7. 视觉：白天/晚上 × 390/768/1440px；覆盖首页、文章、资源、登录、总览、表单、编辑器、弹窗和错误态。检查键盘焦点与正文/按钮对比度。
8. Cloudflare：完成 OpenNext build 与隔离环境预览，验证 D1/R2、路由、失效和鉴权；纯 Next build 不能代替 Worker 验证。

上线采用小批次：先兼容性增量 schema，再应用；保留旧公开 URL、旧设置和旧 Worker 版本。数据库回滚不依赖破坏性逆向 migration，先通过应用回滚/功能开关止损，必要时从备份恢复到新库并核对。

## 10. 两台 Mac 之间复制配置与密钥

### 10.1 先区分三类东西

| 类型 | 本项目例子 | 迁移方法 |
|---|---|---|
| 本地配置/绑定 | `wrangler.local.toml`、`.env.local`、`.dev.vars` | 从旧 Mac 经 SSH/SCP 复制，先落在仓库外的私有临时目录 |
| Cloudflare Worker secrets | `ADMIN_PASSWORD`、`ADMIN_TOKEN_SALT`、`AI_CONFIG_ENCRYPTION_SECRET`、`HERMES_SYNC_TOKEN`、可选 `AI_API_KEY` | 已在同一个 Worker 上配置的值无需因换电脑而重设；本地副本仍需从原保存处取得 |
| 云端数据与加密 Key | D1 中 AI profile 密文、文章、配置；R2 媒体 | 绑定同一资源即可继续使用；开发使用隔离副本，不能把密文当作原始 API Key |

Worker secret 设置后不能通过 Wrangler/控制台读回明文；`secret list` 只用于核对名称等信息。旧 Mac 没有原值时，从密码管理器/原服务恢复或轮换，不部署“打印 secret”的接口。[Cloudflare environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)

### 10.2 在旧 Mac 上确认文件名

旧 Mac 开启“系统设置 → 通用 → 共享 → 远程登录”，仅允许需要的用户。已有 SSH 可连接则无需改变设置。

在旧 Mac 的项目目录执行，只列文件名，不显示内容：

```bash
cd '/旧电脑上的项目绝对路径/channing-studio'
for studio_file in wrangler.local.toml .env.local .env .dev.vars; do
  if [ -f "$studio_file" ]; then
    printf '%s\n' "$studio_file"
  fi
done
```

不要复制整个 `~/.ssh`、Cloudflare 登录缓存或整个家目录；这次只需要本站配置。若旧环境用了命名环境文件，确认名称后再逐个添加，避免通配符带出无关凭据。

### 10.3 在新 Mac 上拉取

以下命令是模板，本次没有执行。替换 SSH 用户/地址与旧项目路径，只运行旧机实际存在的文件对应的 scp 行。首次连接核对主机指纹，不禁用 SSH 主机校验。

```bash
STUDIO_OLD_HOST='旧用户名@旧Mac的IP或主机名'
STUDIO_OLD_REPO='/旧电脑上的项目绝对路径/channing-studio'
umask 077
STUDIO_TRANSFER_DIR="$(mktemp -d "${TMPDIR:-/tmp}/channing-secrets.XXXXXX")"
chmod 700 "$STUDIO_TRANSFER_DIR"

scp "${STUDIO_OLD_HOST}:${STUDIO_OLD_REPO}/wrangler.local.toml" "$STUDIO_TRANSFER_DIR/"
scp "${STUDIO_OLD_HOST}:${STUDIO_OLD_REPO}/.env.local" "$STUDIO_TRANSFER_DIR/"
scp "${STUDIO_OLD_HOST}:${STUDIO_OLD_REPO}/.dev.vars" "$STUDIO_TRANSFER_DIR/"
# 如果旧机实际用的是 .env，再单独复制：
# scp "${STUDIO_OLD_HOST}:${STUDIO_OLD_REPO}/.env" "$STUDIO_TRANSFER_DIR/"

find "$STUDIO_TRANSFER_DIR" -type f -exec chmod 600 {} +
printf '配置暂存于：%s\n' "$STUDIO_TRANSFER_DIR"
```

在本机本地编辑器里核对绑定目标；文件内容不要贴进聊天。把原生产配置保留作参考，准备开发用 `wrangler.local.toml` 指向独立 D1/R2，再启动任何预览服务。特别注意 `npm run dev` 设置了 `PREVIEW_REMOTE=1`，本次不能用它随手试生产数据。

核对后可用下面的“不覆盖已有文件”方式放入本机项目目录；不要在尚未确认资源目标时直接启动开发：

```bash
cd '/本机项目绝对路径/channing-studio'
for studio_file in wrangler.local.toml .env.local .env .dev.vars; do
  if [ -f "$STUDIO_TRANSFER_DIR/$studio_file" ] && [ ! -e "$studio_file" ]; then
    install -m 600 "$STUDIO_TRANSFER_DIR/$studio_file" "$studio_file"
  fi
done

git check-ignore -- wrangler.local.toml .env.local .env .dev.vars
git status --short
```

Wrangler 本地 secret 读取中，存在 `.dev.vars` 时不会再把 `.env` 文件值合入其 `env`。Next 的 `.env.local` 与 Worker binding 又是不同入口，因此不要假定复制两份内容后会自动合并；对照旧环境整理一份清晰的配置来源表。[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

### 10.4 新 Mac 的 Cloudflare 身份

开发环境和依赖准备好后，在新机重新登录，不迁移旧机登录缓存：

```bash
npx wrangler login
npx wrangler whoami
npx wrangler secret list -c wrangler.local.toml
```

`secret list` 面向该配置选中的 Worker；先确认 Worker 名称/环境。仅更换开发电脑不需要重新执行 `secret put`，它是写入操作。

只有目标 Worker 确实缺少配置、并准备恢复服务时，才按需要交互式设置对应名称：

```bash
npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
npx wrangler secret put AI_CONFIG_ENCRYPTION_SECRET -c wrangler.local.toml
# 使用 Hermes 时：
npx wrangler secret put HERMES_SYNC_TOKEN -c wrangler.local.toml
# 使用环境变量形式的 AI 服务时：
npx wrangler secret put AI_API_KEY -c wrangler.local.toml
```

这些命令会修改目标 Worker 的 secrets，不属于本次复制动作；没有把真实值放在命令参数、文档或 shell 历史中。不要对整份 `.env.local` 无筛选 bulk 上传。

**特别注意 `AI_CONFIG_ENCRYPTION_SECRET`：**已有 D1 提供商密文依赖原密钥，恢复同一批密文时必须保留原值；历史代码还可能使用 `ADMIN_TOKEN_SALT` 作为回退。不能为了“配置齐全”直接生成一个新 secret 覆盖，否则旧密文可能无法解密。确需轮换时应设计解密旧数据、重新加密、验证和回滚流程。后台密码/salt 轮换会影响会话；Hermes Token 轮换需要同步外部客户端。

副本确认可用后，按文件名删除临时传输副本，并把长期备份放入密码管理器或加密存储。密钥不提交 Git；D1 备份同样不提交。

## 11. 开工前的决策与待核实项

已确认：个人大脑与公开展示并存、仅日夜模式、先方案后实施、旧机 macOS 可 SSH。

建议直接采用：保留技术栈与公开 URL；后台作为工作主入口；手动收集可独立使用；Hermes 保留；新内容默认私密；AI 降为可选；统一编辑器和发布协议。

恢复环境后核实以下内容，再确定数据迁移清单：

- 线上实际文章/资源数量、哪些密码或隐藏文章需要保留、哪些资源已对外公开。
- Hermes、Clipper、Obsidian 和 AI 能力中哪些仍在用；Token 使用范围及迁移兼容要求。
- “管理所有”下一批最重要的来源与工作类型：优先接入实际每天使用的 1–2 个系统。
- 项目是否需要任务截止日期和附件；如果暂不需要，先以“下一步 + 相关资料”覆盖。
- 现有生产 schema、加密密钥来源、D1/R2 绑定与真实部署流程。

第一版的成功标准是：你能快速收下一条信息，之后找得到、用得上，能推进一个项目，并把其中一部分可靠地发布到外部。首页和皮肤改造服务于这条工作流程。
