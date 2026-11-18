# Channing Studio 设计系统 · Obsidian & Warm Paper Atelier

## 1. 美学定位与统一边界

Channing Studio（含对外公开工程手稿站与私人知识工作台）统一采用 **「曜石与暖宣 · 精密工程手稿工坊」（Obsidian & Warm Paper · Precision Editorial Atelier）** 设计语言，灵感汲取自 Stripe Press 的出版物纸感、Linear 的精密 1px 结构线以及 Teenage Engineering 的机械遥测克制感。

核心原则：
1. **全域连续单主题（Zero Split-Theme Discontinuity）**：公开站与私人工作台共享同一套根级色彩与质感语义。日间全站为温润典藏棉宣纸（`#F6F4EF`）与微白羊皮纸表面（`#FCFBF8`）；夜间全站为纯正黑曜碳底（`#0D0D0C`）与暗岩抬升层（`#151513`）。严禁出现“深色封面拼接浅色正文”或“公开站暖纸但后台退回通用蓝白 SaaS”的割裂感。
2. **碳墨主调 + 朱砂信号（Carbon Ink & Signal Vermilion）**：界面 92% 由纸底、1px 精密分割线与碳黑/钨白层级构成；朱砂红（日间 `#C83E1B` / 夜间 `#FF6B42`）仅作为高价值行动号召（CTA）、关键激活指示线、键盘焦点环与引用边线出现。
3. **真实数据与公开身份边界**：对外公开身份严格保持 `Channing`（维护于 `lib/public-profile.ts`），绝不编造虚构客户、虚假统计指标或内部私有信息；私人总控台（`/admin`）与各子工作台全部读取真实数据库查询结果，空状态优雅呈现。

---

## 2. 色彩令牌体系（`styles/tokens.css`）

所有语义变量同时保留历史兼容令牌名（`--editor-*`、`--article-*`、`--cta-*`）与新版工坊语义别名（`--atelier-*`），并映射至 Tailwind v4 `@theme inline`（`app/globals.css`）。

| 语义角色 | CSS 变量 | 日间（Warm Paper） | 夜间（Obsidian） | 用途说明 |
|---|---|---|---|---|
| 全站画布底色 | `--background` / `--editor-app-bg` / `--atelier-canvas` | `#F6F4EF` | `#0D0D0C` | 页面主背景、滚动视口底色 |
| 侧栏导轨底色 | `--atelier-rail` | `#F0EDE5` | `#111110` | 工作台左侧导航栏、次级边栏 |
| 抬升纸面 / 面板 | `--editor-panel` / `--atelier-surface` | `#FCFBF8` | `#151513` | 档案卡、工作台面板、弹层、表格底 |
| 柔和内嵌层 | `--editor-soft` / `--atelier-soft` | `#EFECE4` | `#1C1B18` | 悬停底色、代码块底、内嵌筛选槽 |
| 深层按压 / 砂纸层 | `--editor-sand` / `--atelier-sand` | `#E5E0D5` | `#262420` | 按压态、禁用控件底色、嵌套块 |
| 精密细分割线 | `--editor-line` / `--atelier-hairline` | `#DDD8CC` | `#282622` | 1px 结构网格线、列表与卡片边界 |
| 强化结构线 | `--editor-line-strong` / `--atelier-hairline-strong` | `#B8B0A0` | `#3E3B34` | 重点外框、机械按键描边、十字准星 |
| 主碳墨 / 标题字色 | `--foreground` / `--editor-ink` / `--article-heading` | `#141311` | `#F2EFE8` | 主标题、核心正文与导航激活文字 |
| 长文阅读字色 | `--article-body` / `--atelier-body` | `#2E2C28` | `#D2CEC4` | 文章正文、编辑器长文阅读 |
| 次要说明字色 | `--editor-muted` / `--atelier-muted` | `#656058` | `#9B9589` | 摘要、副标题、表单说明 |
| 遥测 / 元数据灰 | `--stone-gray` / `--atelier-subtle` | `#787268` | `#7E786D` | 日期编号、快捷键说明、次级标签 |
| 工作室碳黑实心 | `--editor-accent`（配 `--editor-accent-ink`） | `#141311` (`#FAF8F5`) | `#F2EFE8` (`#141311`) | 次级实心按钮、高对比选中胶囊 |
| 朱砂信号色 / 链接 | `--atelier-vermilion` / `--coral` / `--editor-link` | `#C83E1B` | `#FF6B42` | 正文链接、激活指示条、焦点环 |
| 朱砂微底 / 边线 | `--atelier-vermilion-soft` / `--atelier-vermilion-line` | `rgba(200,62,27,0.09)` | `rgba(255,107,66,0.14)` | 选中行背景、高亮徽章 |
| 核心主行动按钮 | `--cta-bg` / `--cta-bg-hover` / `--cta-ink` | `#C83E1B` / `#A93112` / `#FFFDF9` | `#E04F26` / `#FF6B42` / `#FFFDF9` | 全站核心提交与主入口 CTA |
| 文本选区高亮 | `--editor-selection` | `#F6D5C9` | `#4A2216` | 浏览器选区与编辑器节点选中态 |
| 状态信标（正常/警告/告警） | `--success` / `--warning` / `--danger` | `#1B6541` / `#854D0E` / `#B42318` | `#6CE0A3` / `#F5C469` / `#FF8B80` | Hermes 同步、发布流水线与表单校验 |

> 注：`--publication-paper` 固定保持 `#FCFBF8`，专供微信公众号终端预览画布还原目标平台白底体验，不随站点深色模式反黑。

---

## 3. 字体、圆角与精密构件规范

### 字体栈
- **人文衬线展示栈（`--font-editorial-serif`）**：`"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, "Songti SC", serif` —— 用于公开站刊头刊号、英文点睛字标与专著级导语。
- **现代无衬线正文栈（`--font-body`）**：本地自托管 `Geist` WOFF2 + `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif` —— 保证中文标题、UI 控件与长文阅读的清晰度。
- **工程等宽遥测栈（`--font-mono-tech` / `--font-code`）**：本地自托管 `Geist Mono` WOFF2 + 系统等宽回退 —— 用于编号（`01 //`）、日期戳、计数器（强制 `font-variant-numeric: tabular-nums`）、快捷键 `kbd` 与代码块。

### 几何尺度与建筑感辅助类（`styles/hallmark.css` & `app/globals.css`）
- **圆角克制化**：摒弃廉价大圆角气泡，统一使用 `--radius-xs: 4px`（徽章、按键、指示块）、`--radius-sm: 6px`（按钮、输入框、代码框）、`--radius-md: 10px`（档案面板、模态窗）。
- **可复用结构辅助类**：
  - `.atelier-kicker` / `.atelier-eyebrow`：等宽大写章节编号眉题（`INDEX // 01`、`WORKBENCH // COMMAND DESK`）。
  - `.atelier-mono` / `.atelier-serif`：等宽表格数字与典藏衬线切换工具类。
  - `.atelier-hairline-t` / `.atelier-hairline-b` / `.atelier-hairline-y` / `.atelier-hairline-box`：1px 精密分割线与面板容器。
  - `.atelier-dossier` / `.atelier-crosshair`：带四角精密准星刻度（7px 十字角标）的工程档案标本框。
  - `.atelier-badge`（支持 `data-tone="vermilion"`）与 `.atelier-beacon`（支持 `data-tone="healthy" | "warning" | "alert" | "vermilion"`）：状态胶囊与信标圆点。
  - `kbd` / `.atelier-kbd`：带 `1px` 底部微棱边阴影的机械键帽样式。

---

## 4. 公开站与私人工作台架构约定

1. **对外公开专著站（`/`、`/writing`、`/work`、`/labs`、`/tools`、`/prompts`、`/about`、`/[slug]`）**：
   - `StudioHome` 与 `AboutProfile` 保持纯 Server Component，零多余客户端水合负担。
   - 统一刊头（`SiteHeader`：`C/` 徽记、规整导览、`⌘K` 搜索入口、主题切换、移动端抽屉）与统一工作室尾署（`SiteFooter` Colophon：版次印记、RSS、真实社交矩阵与工作台入口）。
   - 首页以左栏自述主张 + 右栏主系统档案卡（`System Dossier 01`）构成非对称首屏，下方依次展开系统矩阵、实践手记与能力边栏、工具与提示词标本架。
2. **私人工程与知识工作台（`/admin`、`/admin/*`、`/editor`）**：
   - 左侧 256px 建筑感导轨（`--atelier-rail`）+ 顶部状态栏 + 主工作区；移动端折叠抽屉保留 `Escape` 关闭与焦点归位。
   - `/admin` 根路由直接呈现 Server Component **私人总控台（Studio Command Center）**：聚合快捷创作入口、真实库存遥测（文章、知识库、待决定项、项目与工具提示词）以及近期知识流与写作管线，所有数据库读取均具备空库容错降级。
   - `/admin/learning`、`/admin/library`、`/admin/operations`、`/admin/publish` 及内容管理页全部对齐暖宣/曜石色彩令牌，彻底清除遗留的硬编码蓝色与冷灰类。

---

## 5. 无障碍与视觉验收门槛

- **对比度与焦点**：正文与背景对比度大于 12:1，次要说明与链接对比度满足 WCAG AA（>= 4.5:1）；全站 `:focus-visible` 呈现清晰可见的 2px 朱砂焦点环（浅色模式下附带外层微白隔离环）。
- **触控与动效**：公开站与移动端交互目标保持 `>= 44px` 点击热区（紧凑图标按钮使用 `.hit-44` / `.hit-area-44` 扩展热区）；严格遵循 `prefers-reduced-motion: reduce`。
- **双模式与多视口实测**：桌面端（`1440×900`）与移动端（`390×844`）在 Light / Dark 双模式下均不得出现横向溢出（`scrollWidth <= innerWidth`）、断层反色或模态框底色失配。
