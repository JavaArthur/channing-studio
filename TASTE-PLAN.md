# Taste A · 工程作品档案

当前版本（2026-11-09 主题修正）：白天整页冷灰白，晚上整页深灰绿，作品表面随主题以微差区分；封面与阅读区共用底色。用户明确指出原深色封面接浅色阅读区突兀，原“明暗分区”设计与通过结论撤回。以下 Dealer 和首轮评审记录为历史，现行颜色规范以 DESIGN.md 为准。

本轮由 lead 修改主题变量与卡片/header/focus 硬编码；另一位 Agent 对明暗交界、两种桌面全页、两种手机全页、菜单与搜索弹层共10张实拍独立复核。后续主题验收必须分别覆盖首屏、区块交界、页尾、整页滚动和交互状态，不能用技术测试或单屏对比度代替整页视觉连续性。

## 已读与边界

已读项目 AGENTS.md、ENGINEERING.md，以及 `/tmp/studio-taste-skill-20261108/skills/taste-skill/SKILL.md` 与五份必读 refs：copy.md、copy-voice.md、system.md、layout-v4.md、sections.md。

这是个人工程作品站。沿用 `content.profile` 真实文案，不以商业公司模板重写第一人称表达；不虚构客户、收入、使用量、项目封面、产品 UI 或流转图。所有项目与资源来自现有 props，保留项目网站和公开源码链接。

## Dealer 记录与设计决策

- `assets/layout/deal.mjs --type software --history .taste-skill/layout-history.json` 得到 `triptych`。以三部分阅读为起点，最终适配为横向作者字标、叙述与档案页、作品索引；将轮播拼贴改为静态真实作品，避免为没有封面数据的项目编造图像。
- `scripts/start.mjs deal --page software --trade developer --history .taste-skill/history.json` 得到 cool-grey-cobalt / graphite-safety-orange / white-link-blue；type 为 Familjen Grotesk + IBM Plex Mono（另选 Manrope、Chivo）。遵照用户当前约束选择 graphite-safety-orange。英文作者字标使用本机 Bodoni/Didot/Times，中文使用现有系统 sans，档案标签使用系统 mono；不请求字体、不增加包。字标衬线与正文无衬线承担不同阅读角色。
- 记忆点：石墨封面上跨栏的 Channing 字标，与一张浅灰绿作品选页。首个项目的 slug、状态、技术标签和真实摘要构成其版面；其余项目沿同一底线排布。数字只是页面目录序号，不暗示业绩、日期或总量。
- 页面骨架：超大作者字标 → 较小的动态介绍与作品选页并排 → 项目索引 → 工作方向边注与实践记录并排 → 工具/提示词参考书架 → 真实联系链接。不同信息采用不同密度，不重复营销卡片模块。
- 固定动态字段：eyebrow、title、subtitle、statement、capabilities、contactLinks。文章、工具、提示词入口和现有查询逻辑不变。空项目显示作品入口，空文章/资源不生成虚构内容。
- 内容自然撑高；不使用定高截断、行数裁切。窄屏按阅读顺序改为单列，保留完整标题；焦点清晰、44px 操作目标、无自动动画。

## 性能与集成

StudioHome 保持 Server Component。复用现有 SiteHeader、SearchEntry 和 ThemeDropdown，通用组件与全站 tokens 均不修改。新 CSS 从 StudioHome 导入，所有规则限定在 `.atlas-home` 下。无图片请求、无 WebGL、无新 JS 依赖、无全局 kit、无 static export。

浏览器遵守用户的 ego-browser 约定，由 lead 统一验收，不调用技能自带的其他浏览器脚本。全屏尺寸和公司模板按本站真实内容调整，这是实现取舍；没有把它描述为用户逐项指定的例外。候选作者不操作 build、commit 或 deploy，生产构建由 lead 负责。

## 验证记录

- `eslint components/StudioHome.tsx`：通过，无输出。
- `git diff --check`：通过。
- `vitest run tests/lib/studio-home.test.ts tests/lib/studio-content.test.ts`：2 个文件、9 项测试全部通过；仅 Node module.register 弃用提示。
- 静态自审：所有新增 CSS 选择器均以 `.atlas-home` 为根（暗色根条件也限定该类）；没有全局导入、客户端边界或包变更。所有内容自然撑高、摘要不截断；无项目时仍保留作品入口，其他空集合隐藏；联系链接全部保留；项目仅使用公开 props。
- Dealer 临时目录已清理，抽取结果和取舍保存在本文件中。
- Lead 已提供 A/B 桌面、手机及 A 暗色截图，并验证首轮 320/390/768/820/1024/1440 无横向溢出。本候选未自行调用浏览器、build、commit 或 deploy。

## 截图评审后的定向修正

- 独立评审选择 A（82 对 B 76）。保留石墨封面、作者字标、主作品选页和书目三段节奏，不换构图。
- 项目索引使用自动列轨道，随真实条目数量均分，消除两个后续项目占用三列时的空槽。
- 浅色项目选页链接显式固定为 `#242921`，hover 为 `#96391d`，不再继承暗色主题的浅蓝色；footer 链接回归局部墨色。
- 文章 section 在 DOM 中先于工作方向 aside；桌面显式 grid placement 保留边注布局，手机自然阅读与键盘顺序一致。
- 技术标签与文章日期 12px；项目摘要、文章摘要、方向说明、资源说明最小 14px（包括手机断点）。
- masthead 的泛化文字替换为首个真实 capability title；若为空使用动态 subtitle，限制文字容器宽度并允许换行。
- Lead 已完成放大字号后的明暗桌面/手机复拍、全量 lint、280 项测试及 OpenNext production build；独立审稿复审通过，保留手机首屏余量和系统字体差异等边界。
- 已将审核后的首页组件、局部 CSS 与设计/性能文档定向整合回原项目，并逐字节核对源文件；候选源码与对照版继续保留在各自 worktree。未向 main 提交、推送或发布。运行记录见 PERFORMANCE.md。
