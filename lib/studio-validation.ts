import {
  DEFAULT_STUDIO_CONTENT,
  type HomeModulesConfig,
  type StudioContent,
} from './studio-content'
import { isSafeLink } from './url'

function validateHomeModules(raw: unknown): HomeModulesConfig {
  if (raw === undefined) {
    return { ...DEFAULT_STUDIO_CONTENT.homeModules }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('首页模块配置格式错误')
  }
  const m = raw as Record<string, unknown>
  const boolKeys = [
    'featuredEssay',
    'writing',
    'focusAreas',
    'projects',
    'tools',
    'prompts',
  ] as const
  for (const key of boolKeys) {
    if (typeof m[key] !== 'boolean') {
      throw new Error('首页模块开关格式错误')
    }
  }
  if (typeof m.writingLimit !== 'number' || !Number.isFinite(m.writingLimit)) {
    throw new Error('首页文章展示数量不正确')
  }
  if (typeof m.projectsLimit !== 'number' || !Number.isFinite(m.projectsLimit)) {
    throw new Error('首页项目展示数量不正确')
  }
  return {
    featuredEssay: m.featuredEssay as boolean,
    writing: m.writing as boolean,
    writingLimit: Math.min(12, Math.max(1, Math.trunc(m.writingLimit))),
    focusAreas: m.focusAreas as boolean,
    projects: m.projects as boolean,
    projectsLimit: Math.min(6, Math.max(1, Math.trunc(m.projectsLimit))),
    tools: m.tools as boolean,
    prompts: m.prompts as boolean,
  }
}

export function validateStudioContent(value: unknown): StudioContent {
  if (!value || typeof value !== 'object') throw new Error('配置格式错误')
  const c = value as Partial<StudioContent> & { profile?: StudioContent['profile'] }
  if (
    !c.profile ||
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
    c.labs.length > 100 ||
    c.profile.capabilities.length > 10 ||
    c.profile.contactLinks.length > 20 ||
    c.featuredPostSlugs.length > 10
  )
    throw new Error('配置条目过多')
  for (const link of c.profile.contactLinks)
    if (!required(link.label, 100) || !isSafeLink(link.url))
      throw new Error('联系链接必须是站内路径或 http/https 地址')
  for (const item of c.labs)
    if (
      !item ||
      typeof item.visible !== 'boolean' ||
      !required(item.id, 100) ||
      !required(item.title, 200) ||
      !required(item.description) ||
      !isSafeLink(item.href)
    )
      throw new Error('实验的标题、说明、链接不完整')
  for (const lab of c.labs) if (!required(lab.type, 100)) throw new Error('实验类型不正确')
  if (new Set(c.labs.map((i) => i.id)).size !== c.labs.length) throw new Error('条目 ID 不能重复')
  for (const capability of c.profile.capabilities)
    if (!required(capability.title, 200) || !required(capability.description))
      throw new Error('能力说明不完整')
  if (c.featuredPostSlugs.some((slug) => !required(slug, 200) || !/^[a-zA-Z0-9_-]+$/.test(slug)))
    throw new Error('精选文章标识不正确')

  const homeModules = validateHomeModules(c.homeModules)
  return {
    profile: c.profile,
    labs: c.labs,
    featuredPostSlugs: c.featuredPostSlugs,
    homeModules,
  }
}
