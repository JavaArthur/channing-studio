import type { SiteNavLink } from '@/lib/site'

export type StudioLink = Pick<SiteNavLink, 'label' | 'url' | 'openInNewTab'>

export interface StudioCapability {
  title: string
  description: string
}

export interface StudioLab {
  id: string
  title: string
  description: string
  href: string
  type: string
  visible: boolean
}

export interface StudioProfile {
  eyebrow: string
  title: string
  subtitle: string
  statement: string
  contactLinks: StudioLink[]
  capabilities: StudioCapability[]
}

export interface StudioContent {
  profile: StudioProfile
  labs: StudioLab[]
  featuredPostSlugs: string[]
}

export const STUDIO_SETTING_KEYS = [
  'studio_profile',
  'studio_labs',
  'studio_featured_posts',
] as const

export type StudioSettingKey = (typeof STUDIO_SETTING_KEYS)[number]
export type StudioSettingValues = Partial<Record<StudioSettingKey, string | null | undefined>>

export const DEFAULT_STUDIO_CONTENT: StudioContent = {
  profile: {
    eyebrow: 'CHANNING STUDIO',
    title: '把复杂问题变成可交付系统。',
    subtitle: 'AI 平台工程落地者 · 内容创作者',
    statement: '我把重复三遍的事自动化，把工程判断写成可以复用的系统。',
    contactLinks: [
      { label: 'GitHub', url: 'https://github.com/JavaArthur/channing-studio', openInNewTab: true },
      { label: 'RSS', url: '/feed.xml', openInNewTab: false },
    ],
    capabilities: [
      { title: 'AI 平台工程', description: '从架构边界、数据链路到上线运维，关注能否真正交付。' },
      { title: '内容自动化', description: '把剪藏、写作、排版和发布串成低心智成本的工作流。' },
      { title: '产品化交付', description: '先解决用户真正要完成的事，再决定系统应该长什么样。' },
    ],
  },
  labs: [
    {
      id: 'chrome-clipper',
      title: 'Chrome Clipper',
      description: '把网页内容剪藏成可继续编辑的草稿。',
      href: 'https://github.com/JavaArthur/channing-studio/tree/main/ecosystem/chrome-clipper',
      type: 'tool',
      visible: true,
    },
    {
      id: 'obsidian-publisher',
      title: 'Obsidian Publisher',
      description: '从 Obsidian 一键发布到博客。',
      href: 'https://github.com/JavaArthur/channing-studio/tree/main/ecosystem/obsidian-publisher',
      type: 'tool',
      visible: true,
    },
    {
      id: 'publish-skill',
      title: 'Blog Publish Skill',
      description: '通过 Agent 工作流准备和发布文章。',
      href: 'https://github.com/JavaArthur/channing-studio/tree/main/ecosystem/channing-blog-publish-skill',
      type: 'skill',
      visible: true,
    },
  ],
  featuredPostSlugs: [],
}

function cloneDefaultContent(): StudioContent {
  return {
    profile: {
      ...DEFAULT_STUDIO_CONTENT.profile,
      contactLinks: DEFAULT_STUDIO_CONTENT.profile.contactLinks.map((link) => ({ ...link })),
      capabilities: DEFAULT_STUDIO_CONTENT.profile.capabilities.map((capability) => ({ ...capability })),
    },
    labs: DEFAULT_STUDIO_CONTENT.labs.map((lab) => ({ ...lab })),
    featuredPostSlugs: [...DEFAULT_STUDIO_CONTENT.featuredPostSlugs],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function parseLinks(value: unknown, fallback: StudioLink[]): StudioLink[] {
  if (!Array.isArray(value)) return fallback.map((link) => ({ ...link }))
  return value
    .filter(isRecord)
    .map((link) => ({
      label: typeof link.label === 'string' ? link.label.trim() : '',
      url: typeof link.url === 'string' ? link.url.trim() : '',
      openInNewTab: link.openInNewTab === true,
    }))
    .filter((link) => link.label && link.url)
}

function parseCapabilities(value: unknown, fallback: StudioCapability[]): StudioCapability[] {
  if (!Array.isArray(value)) return fallback.map((capability) => ({ ...capability }))
  return value
    .filter(isRecord)
    .map((capability) => ({
      title: typeof capability.title === 'string' ? capability.title.trim() : '',
      description: typeof capability.description === 'string' ? capability.description.trim() : '',
    }))
    .filter((capability) => capability.title && capability.description)
}

function parseLabs(value: unknown, fallback: StudioLab[]): StudioLab[] {
  if (!Array.isArray(value)) return fallback.map((lab) => ({ ...lab }))
  return value
    .filter(isRecord)
    .map((lab) => ({
      id: typeof lab.id === 'string' ? lab.id.trim() : '',
      title: typeof lab.title === 'string' ? lab.title.trim() : '',
      description: typeof lab.description === 'string' ? lab.description.trim() : '',
      href: typeof lab.href === 'string' ? lab.href.trim() : '',
      type: typeof lab.type === 'string' ? lab.type.trim() : 'tool',
      visible: lab.visible !== false,
    }))
    .filter((lab) => lab.id && lab.title && lab.description && lab.href)
}

function parseFeaturedPosts(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((slug): slug is string => typeof slug === 'string')
    .map((slug) => slug.trim())
    .filter(Boolean)
}

export function parseStudioSettings(values: StudioSettingValues): StudioContent {
  const defaults = cloneDefaultContent()
  const profileValue = parseJson(values.studio_profile)
  const profile = isRecord(profileValue)
    ? {
        ...defaults.profile,
        eyebrow: parseString(profileValue.eyebrow, defaults.profile.eyebrow),
        title: parseString(profileValue.title, defaults.profile.title),
        subtitle: parseString(profileValue.subtitle, defaults.profile.subtitle),
        statement: parseString(profileValue.statement, defaults.profile.statement),
        contactLinks: parseLinks(profileValue.contactLinks, defaults.profile.contactLinks),
        capabilities: parseCapabilities(profileValue.capabilities, defaults.profile.capabilities),
      }
    : defaults.profile

  return {
    profile,
    labs: parseLabs(parseJson(values.studio_labs), defaults.labs),
    featuredPostSlugs: parseFeaturedPosts(parseJson(values.studio_featured_posts)),
  }
}

export function serializeStudioSettings(content: StudioContent): Record<StudioSettingKey, string> {
  return {
    studio_profile: JSON.stringify(content.profile),
    studio_labs: JSON.stringify(content.labs),
    studio_featured_posts: JSON.stringify(content.featuredPostSlugs),
  }
}
