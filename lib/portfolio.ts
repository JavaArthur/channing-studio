import { z } from 'zod'
import { isHttpUrl, isSafeLink } from '@/lib/url'

export const PORTFOLIO_STATUSES = ['active', 'maintained', 'paused', 'archived'] as const
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number]

export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatus, string> = {
  active: '迭代中',
  maintained: '稳定运行',
  paused: '暂停',
  archived: '已归档',
}

export interface PortfolioLink {
  label: string
  url: string
}

/** The only shape that may reach the public site. */
export interface PublicPortfolioProject {
  slug: string
  title: string
  summary: string
  status: PortfolioStatus
  tags: string[]
  site_url: string | null
  repo_url: string | null
}

export interface PortfolioProject {
  id: number
  slug: string
  title: string
  summary: string
  status: PortfolioStatus
  tags: string[]
  site_url: string | null
  repo_url: string | null
  repo_public: boolean
  links: PortfolioLink[]
  local_path: string | null
  is_pinned: boolean
  sort_order: number
  published: PublicPortfolioProject | null
  /** Working copy changed after the last publish. */
  publish_stale: boolean
  updated_at: number
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .default(null)

export const portfolioInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, '标识只能使用小写字母、数字和连字符'),
    title: z.string().trim().min(1, '请填写项目名称').max(120),
    summary: z.string().trim().max(600).default(''),
    status: z.enum(PORTFOLIO_STATUSES).default('active'),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
    site_url: optionalText(2000).refine(
      (value) => value === null || isSafeLink(value),
      '网站地址必须是 http/https 链接或站内路径',
    ),
    repo_url: optionalText(2000).refine(
      (value) => value === null || isHttpUrl(value),
      '仓库地址必须是 http/https 链接',
    ),
    repo_public: z.boolean().default(false),
    links: z
      .array(
        z
          .object({
            label: z.string().trim().min(1, '请填写链接名称').max(40),
            url: z.string().trim().refine(isHttpUrl, '快捷链接必须是 http/https 链接'),
          })
          .strict(),
      )
      .max(12)
      .default([]),
    local_path: optionalText(500).refine(
      (value) => value === null || /^[/~]/.test(value),
      '本地路径需以 / 或 ~ 开头',
    ),
    is_pinned: z.boolean().default(false),
    sort_order: z.number().int().min(-9999).max(9999).default(0),
  })
  .strict()

export type PortfolioInput = z.output<typeof portfolioInputSchema>

export function toPublicPortfolioProject(input: PortfolioInput): PublicPortfolioProject {
  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    status: input.status,
    tags: input.tags,
    site_url: input.site_url,
    repo_url: input.repo_public ? input.repo_url : null,
  }
}

const publicSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().catch(''),
  status: z.enum(PORTFOLIO_STATUSES).catch('active'),
  tags: z.array(z.string()).catch([]),
  site_url: z.string().nullable().catch(null).transform((v) => (isSafeLink(v) ? v : null)),
  repo_url: z.string().nullable().catch(null).transform((v) => (isHttpUrl(v) ? v : null)),
})

/** Narrows a stored public payload; returns null for rows that cannot be shown safely. */
export function parsePublicPortfolioPayload(value: string | null): PublicPortfolioProject | null {
  if (!value) return null
  let json: unknown
  try {
    json = JSON.parse(value)
  } catch {
    return null
  }
  const result = publicSchema.safeParse(json)
  return result.success ? result.data : null
}

/** Primary destination for a card: the live site first, then a public repository. */
export function portfolioHref(project: Pick<PublicPortfolioProject, 'site_url' | 'repo_url'>) {
  return project.site_url ?? project.repo_url
}
