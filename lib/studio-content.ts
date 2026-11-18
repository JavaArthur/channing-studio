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

export interface HomeModulesConfig {
  featuredEssay: boolean
  writing: boolean
  writingLimit: number
  focusAreas: boolean
  projects: boolean
  projectsLimit: number
  tools: boolean
  prompts: boolean
}

export interface StudioContent {
  profile: StudioProfile
  labs: StudioLab[]
  featuredPostSlugs: string[]
  homeModules: HomeModulesConfig
}

export const STUDIO_SETTING_KEYS = [
  'studio_profile',
  'studio_labs',
  'studio_featured_posts',
  'studio_home_modules',
] as const

export type StudioSettingKey = (typeof STUDIO_SETTING_KEYS)[number]
export type StudioSettingValues = Partial<Record<StudioSettingKey, string | null | undefined>>

export const DEFAULT_HOME_MODULES: HomeModulesConfig = {
  featuredEssay: true,
  writing: true,
  writingLimit: 5,
  focusAreas: true,
  projects: true,
  projectsLimit: 3,
  tools: true,
  prompts: true,
}

export const DEFAULT_STUDIO_CONTENT: StudioContent = {
  profile: {
    eyebrow: '晨启AI',
    title: '让 AI 接住业务，也接得住上线之后。',
    subtitle: 'AI Agent 架构 · Java 后端 · 技术博客',
    statement: '从 Java 后端到 AI Agent，把企业级落地与架构取舍写成可复用的实战手记。',
    contactLinks: [
      { label: 'GitHub', url: 'https://github.com/JavaArthur', openInNewTab: true },
      { label: 'RSS', url: '/feed.xml', openInNewTab: false },
    ],
    capabilities: [
      { title: 'AI Agent 与编排架构', description: '从多步状态机、工具调用权限边界到灰度回退与可观测链路。' },
      { title: 'RAG 与企业知识工程', description: '围绕知识版本治理、混合检索重排与复杂业务问答准确率落地。' },
      { title: 'Java 后端与高可靠交付', description: '在核心交易、并发一致性与跨系统集成中保持可验证的工程质量。' },
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
  homeModules: { ...DEFAULT_HOME_MODULES },
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
    homeModules: { ...DEFAULT_STUDIO_CONTENT.homeModules },
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

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
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

function parseHomeModules(value: unknown, fallback: HomeModulesConfig): HomeModulesConfig {
  if (!isRecord(value)) return { ...fallback }
  return {
    featuredEssay: parseBoolean(value.featuredEssay, fallback.featuredEssay),
    writing: parseBoolean(value.writing, fallback.writing),
    writingLimit: clampInt(value.writingLimit, 1, 12, fallback.writingLimit),
    focusAreas: parseBoolean(value.focusAreas, fallback.focusAreas),
    projects: parseBoolean(value.projects, fallback.projects),
    projectsLimit: clampInt(value.projectsLimit, 1, 6, fallback.projectsLimit),
    tools: parseBoolean(value.tools, fallback.tools),
    prompts: parseBoolean(value.prompts, fallback.prompts),
  }
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
    homeModules: parseHomeModules(parseJson(values.studio_home_modules), defaults.homeModules),
  }
}

export function serializeStudioSettings(content: StudioContent): Record<StudioSettingKey, string> {
  return {
    studio_profile: JSON.stringify(content.profile),
    studio_labs: JSON.stringify(content.labs),
    studio_featured_posts: JSON.stringify(content.featuredPostSlugs),
    studio_home_modules: JSON.stringify(content.homeModules ?? DEFAULT_STUDIO_CONTENT.homeModules),
  }
}
