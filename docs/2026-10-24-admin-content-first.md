# Studio 私人后台第二轮重构

本轮交付于本地隔离测试环境。没有部署 Worker、执行生产迁移或修改生产数据。

## 页面行为

- `/admin` 直接进入资料库；默认列表占满内容区，选择后才打开阅读区。桌面行高 64px，首条记录在顶部 144px 以内。关闭阅读区恢复列表滚动位置。
- 两行工具栏承载搜索、类型、排序、数量和收录。多选复用工具栏，交给助手通过弹层复制正文、来源、标识与要求。
- 资料属性移入右侧抽屉，手机使用全屏属性面板。全屏阅读仅改变外壳，不重新创建编辑器。
- 私人笔记、文章摘录、工具说明使用 Tiptap 富文本；提示词和灵感保留精确文本。复制灵感不更改历史状态。
- 资料集使用紧凑列表，支持带 revision 的改名、说明、归档与恢复。
- 设置分为外观、公开站点、连接与访问、文本模型、图片模型、内容操作；分类写入 URL。导航链接以表格维护，移动/删除收进键盘可用的菜单。
- 工具、提示词、模型、Token 的编辑进入抽屉。文章管理、工作室配置、历史连接记录和登录页采用共同的紧凑外壳。公开管理展示当前发布数量。

## 实现边界

`styles/admin.css` 独立作用于私人外壳与相关弹层，公开首页样式仍在 `styles/studio-library.css`。删除上一版后台样式块，排除后台的全局 44px 强制规则；桌面控件 32–36px，触屏控件至少 44px。对话框、抽屉、菜单和工作室分类使用 Radix 基础组件，基本表单保留原生语义。

`lib/document-editor.ts` 提供文章和私人资料共用的文档 schema，媒体/AI 扩展只由正式文章编辑器添加。私人编辑器按需加载；既有 Markdown 存储和 MCP 协议不变。初次挂载不会保存，富文本转换前核对渲染语义；不能无损往返的旧内容保留原文并转入源码编辑。

`lib/library/save-queue.ts` 将 UI 与保存分开：800ms 防抖、单请求串行、合并后续修改、更新返回 revision。正文和属性共用队列。IME 合成期间暂停提交；断网或校验失败保留输入并要求重试；412 冲突不自动覆盖，支持本地/服务端对照和完整复制。内部导航先刷新待保存队列，失败保留编辑现场；关闭或刷新时提示未保存内容。公开发布继续显式确认，私人修改不能更新公开快照。

资料列表仍服务端分页，每页 30 条，仅选中项加载完整正文。新增 `sort=newest|updated|title`、读取单项和资料集版本化更新；查询在仓储层，API 保持管理员 session 鉴权。本轮不新增数据库结构，继续使用第一轮 migration。

## 验证与截图

新增保存队列测试覆盖：无修改不写、中文输入、慢请求期间持续输入、返回 revision、失败重试、冲突保护、输入撤销以及保存期间开始 IME。

浏览器覆盖 0 / 5 / 50 / 500 条隔离样例、分页、行密度、列表位置恢复、平板/手机/深色、抽屉焦点和菜单键盘、富文本代码/表格/撤销、旧格式保留、精确复制、导航刷新队列、断网、多标签页与 Agent 修改冲突，以及公开快照、旧链接、管理员鉴权和公开站点回归。密度样例使用 API 创建，验证后逐条归档，不批量删除数据。

以下为真实本地浏览器截图；内容为隔离验收样例：

- [资料库默认态](screenshots/round2-library.png)
- [详情阅读](screenshots/round2-detail.png)
- [正文编辑](screenshots/round2-edit.png)
- [属性抽屉](screenshots/round2-properties.png)
- [设置页](screenshots/round2-settings.png)
- [手机阅读](screenshots/round2-mobile.png)
- [深色模式](screenshots/round2-dark.png)

参考实现：[shadcn-admin 设置结构](https://github.com/satnaing/shadcn-admin/blob/main/src/features/settings/index.tsx)、[Docmost 属性侧栏](https://github.com/docmost/docmost/blob/main/apps/client/src/features/page-details/components/page-details-aside.tsx)、[AFFiNE](https://github.com/toeverything/AFFiNE)。复用的是信息组织方式，不引入这些项目的路由、协同服务或持久化系统。

最终验证：`verify:quick` 通过（lint、46 个测试文件 / 238 个测试、Next 生产构建）；13 个 Playwright 浏览器流程全部通过。`git diff --check` 无空白错误。本地测试记录已归档，保留原有五条演示资料与登录凭据供继续预览。
