# Ecosystem

这个仓库不只开源博客主站，也把配套发布工具一起放进来了，方便你直接复用整套工作流。

## 包含的配套工具

- [`chrome-clipper`](./chrome-clipper/README.md)：浏览器网页剪藏，直接进入博客草稿箱
- [`obsidian-publisher`](./obsidian-publisher/README.md)：从 Obsidian 一键发布到博客
- [`channing-blog-publish-skill`](./channing-blog-publish-skill/README.md)：从 Claude Skill / 命令工作流直接发布

## 私人协同组件

`hermes-flomo-knowledge-sync` 已迁移到独立私有仓库 [`JavaArthur/channing-agent-skills`](https://github.com/JavaArthur/channing-agent-skills/tree/main/skills/hermes-flomo-knowledge-sync)。博客只保留知识工作台和 Agent API，不保存 Flomo Token，也不再维护 Skill 源码副本。

## 统一接入方式

这三个工具都通过博客后台生成的 `API Token` 访问你的站点：

- 后台路径：`/admin/settings`
- 站点地址示例：`https://your-domain.com`

这个公开仓库里的版本已经去掉了默认绑定私有站点的配置。
