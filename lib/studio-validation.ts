import type { StudioContent } from './studio-content'
import { isSafeLink } from './url'
export function validateStudioContent(value: unknown): StudioContent {
  if (!value || typeof value !== 'object') throw new Error('配置格式错误')
  const c = value as StudioContent
  if (
    !c.profile ||
    !Array.isArray(c.projects) ||
    !Array.isArray(c.labs) ||
    !Array.isArray(c.featuredPostSlugs) ||
    !Array.isArray(c.profile.contactLinks) ||
    !Array.isArray(c.profile.capabilities)
  )
    throw new Error('配置结构不完整')
  const required = (v: unknown, max = 4000) =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= max
  if (
    !required(c.profile.title, 300) ||
    !required(c.profile.subtitle) ||
    !required(c.profile.statement) ||
    !required(c.profile.eyebrow, 200)
  )
    throw new Error('请填写首页身份信息')
  if (
    c.projects.length > 100 ||
    c.labs.length > 100 ||
    c.profile.capabilities.length > 10 ||
    c.profile.contactLinks.length > 20 ||
    c.featuredPostSlugs.length > 10
  )
    throw new Error('配置条目过多')
  for (const link of c.profile.contactLinks)
    if (!required(link.label, 100) || !isSafeLink(link.url))
      throw new Error('联系链接必须是站内路径或 http/https 地址')
  for (const item of [...c.projects, ...c.labs])
    if (
      !item ||
      typeof item.visible !== 'boolean' ||
      !required(item.id, 100) ||
      !required(item.title, 200) ||
      !required(item.description) ||
      !isSafeLink(item.href)
    )
      throw new Error('项目或实验的标题、说明、链接不完整')
  for (const project of c.projects)
    if (
      !Array.isArray(project.tags) ||
      project.tags.length > 20 ||
      project.tags.some((tag) => !required(tag, 100))
    )
      throw new Error('项目标签格式不正确')
  for (const lab of c.labs) if (!required(lab.type, 100)) throw new Error('实验类型不正确')
  for (const list of [c.projects, c.labs])
    if (new Set(list.map((i) => i.id)).size !== list.length) throw new Error('条目 ID 不能重复')
  for (const capability of c.profile.capabilities)
    if (!required(capability.title, 200) || !required(capability.description))
      throw new Error('能力说明不完整')
  if (c.featuredPostSlugs.some((slug) => !required(slug, 200) || !/^[a-zA-Z0-9_-]+$/.test(slug)))
    throw new Error('精选文章标识不正确')
  return c
}
