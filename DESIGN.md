# 晨启AI 设计系统 · Obsidian & Warm Paper Editorial Atelier

## 1. 产品定位与内外边界

系统在视觉上统一采用 **「曜石与暖宣 · 精密工程出版物」（Obsidian & Warm Paper · Precision Editorial）** 美学语言，在产品结构上严格区分 **对外个人技术博客（`晨启AI`）** 与 **对内私人工作台（`晨启 · 私人工作台`）**：

1. **对外公开站点 = `晨启AI`（个人技术博客与作者手记）**：
   - 对外唯一主品牌为 **`晨启AI`**（徽记 `晨/`，副标 `AI 工程手记` / `AI 工程与技术博客`）。
   - `Channing` 仅作为作者笔名在个人简介署名处克制出现一次（如 `作者 · Channing`），不在导航、大标题、CTA 或卡片中重复堆砌。
   - **外部零工作台感知**：公开页面严禁出现 `Studio`、`个人工作室`、`公开工作台` 等概念包装，页脚与公开路由不暴露任何指向 `/admin` 的入口链接。
   - **内容阅读优先（Blog-First）**：导航默认以 `01 文章 (/writing)` 为首，其后依次为 `02 项目 (/work)`、`03 百宝箱 (/tools)`、`04 关于 (/about)`。首屏左栏呈现个人技术主张与博客定位，右栏呈现 **`精选长文 // FEATURED ESSAY`** 标本卡片；正文首屏之下紧接最新文章流，其次才是按需吐出的开源项目与工具/提示词百宝箱。
2. **对内私人系统 = `晨启 · 私人工作台`（`/admin` 可插拔吐出中枢）**：
   - `/admin` 仅服务于作者本人的知识沉淀、学习复盘、Hermes 协同与写作编排。
   - 私人工作台通过 `site_settings.studio_home_modules`（`HomeModulesConfig`）实现 **向公开博客首页的可插拔吐出（Pluggable Projection）**：
     - 可独立开关 `featuredEssay`（首屏精选长文）、`writing`（最新文章流 + 篇数上限 `1..12`）、`focusAreas`（写作关注侧栏）、`projects`（开源与实践项目 + 个数上限 `1..6`）、`tools`（常用工具吐出）、`prompts`（提示词吐出）。
     - 任一模块关闭后，公开首页对应区块完全隐藏且后续章节序号（`01 / 02 / 03`）自动连续重排，绝不留空壳或跳号。

---

## 2. 全域连续色彩令牌（`styles/tokens.css`）

公开博客与私人工作台共享同一套根级色彩令牌（日间典藏暖宣 `#F6F4EF`，夜间黑曜碳底 `#0D0D0C`），严禁出现深浅拼接断层或遗留通用蓝白 SaaS 配色。

| 语义角色 | CSS 变量 | 日间（Warm Paper） | 夜间（Obsidian） | 用途说明 |
|---|---|---|---|---|
| 全站画布底色 | `--background` / `--editor-app-bg` / `--atelier-canvas` | `#F6F4EF` | `#0D0D0C` | 页面主背景、滚动视口底色 |
| 侧栏导轨底色 | `--atelier-rail` | `#F0EDE5` | `#111110` | 私人工作台左侧导航轨、次级边栏 |
| 抬升纸面 / 面板 | `--editor-panel` / `--atelier-surface` | `#FCFBF8` | `#151513` | 精选长文卡、工作台面板、弹层、表格底 |
| 柔和内嵌层 | `--editor-soft` / `--atelier-soft` | `#EFECE4` | `#1C1B18` | 悬停底色、代码块底、内嵌筛选槽 |
| 深层按压 / 砂纸层 | `--editor-sand` / `--atelier-sand` | `#E5E0D5` | `#262420` | 按压态、禁用控件底色、嵌套块 |
| 精密细分割线 | `--editor-line` / `--atelier-hairline` | `#DDD8CC` | `#282622` | 1px 结构网格线、列表与卡片边界 |
| 强化结构线 | `--editor-line-strong` / `--atelier-hairline-strong` | `#B8B0A0` | `#3E3B34` | 重点外框、机械按键描边、十字准星 |
| 主碳墨 / 标题字色 | `--foreground` / `--editor-ink` / `--article-heading` | `#141311` | `#F2EFE8` | 主标题、核心正文与导航激活文字 |
| 长文阅读字色 | `--article-body` / `--atelier-body` | `#2E2C28` | `#D2CEC4` | 博客文章正文、编辑器长文阅读 |
| 次要说明字色 | `--editor-muted` / `--atelier-muted` | `#656058` | `#9B9589` | 摘要、副标题、表单说明 |
| 遥测 / 元数据灰 | `--stone-gray` / `--atelier-subtle` | `#787268` | `#7E786D` | 日期编号、快捷键说明、次级标签 |
| 碳黑实心强调 | `--editor-accent`（配 `--editor-accent-ink`） | `#141311` (`#FAF8F5`) | `#F2EFE8` (`#141311`) | 次级实心按钮、高对比选中胶囊 |
| 朱砂信号色 / 链接 | `--atelier-vermilion` / `--coral` / `--editor-link` | `#C83E1B` | `#FF6B42` | 正文链接、激活指示条、焦点环 |
| 朱砂微底 / 边线 | `--atelier-vermilion-soft` / `--atelier-vermilion-line` | `rgba(200,62,27,0.09)` | `rgba(255,107,66,0.14)` | 选中行背景、高亮徽章 |
| 核心主行动按钮 | `--cta-bg` / `--cta-bg-hover` / `--cta-ink` | `#C83E1B` / `#A93112` / `#FFFDF9` | `#E04F26` / `#FF6B42` / `#FFFDF9` | 全站核心提交与主阅读 CTA |
| 文本选区高亮 | `--editor-selection` | `#F6D5C9` | `#4A2216` | 浏览器选区与编辑器节点选中态 |
| 状态信标（正常/警告/告警） | `--success` / `--warning` / `--danger` | `#1B6541` / `#854D0E` / `#B42318` | `#6CE0A3` / `#F5C469` / `#FF8B80` | 模块吐出状态、同步流水线与表单校验 |

> 注：`--publication-paper` 固定保持 `#FCFBF8`，专供微信公众号终端预览画布还原目标平台白底体验。

---

## 3. 字体、几何与结构构件规范

- **人文衬线展示栈（`--font-editorial-serif`）**：`"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, "Songti SC", serif` —— 用于章节大号、刊头装饰与专著感导语。
- **现代无衬线正文栈（`--font-body`）**：本地自托管 `Geist` WOFF2 + `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif` —— 服务中文标题、正文阅读与高密度工作台控件。
- **工程等宽遥测栈（`--font-mono-tech` / `--font-code`）**：本地自托管 `Geist Mono` WOFF2 + 系统等宽回退 —— 用于编号（`01 //`）、日期戳、表格数字（`tabular-nums`）、快捷键 `kbd` 与代码块。
- **圆角与精密辅助类**：统一使用 `--radius-xs: 4px`、`--radius-sm: 6px`、`--radius-md: 10px`；共享 `.atelier-kicker`、`.atelier-mono`、`.atelier-serif`、`.atelier-hairline-*`、`.atelier-crosshair`、`.atelier-badge`、`.atelier-beacon` 与 `.atelier-kbd`。

---

## 4. 数据真实性与视觉验收门槛

- 对外履历与公开联系渠道集中维护于 `lib/public-profile.ts`，保持真实可核验，不虚构运行统计或商业客户。
- 桌面端（`1440×960`）与移动端（`390×844`）在日间 / 夜间双模式及模块插拔开启 / 关闭状态下，均须保证零横向溢出（`scrollWidth <= innerWidth`）、高对比度可读性、44px 触控热区与可见键盘焦点。
