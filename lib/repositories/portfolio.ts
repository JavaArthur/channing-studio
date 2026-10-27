import { BrainApiError } from '@/lib/agent-brain/validation'
import {
  parsePublicPortfolioPayload,
  PORTFOLIO_STATUSES,
  toPublicPortfolioProject,
  type PortfolioInput,
  type PortfolioLink,
  type PortfolioProject,
  type PortfolioStatus,
  type PublicPortfolioProject,
} from '@/lib/portfolio'
import { isHttpUrl } from '@/lib/url'
import type { Database } from './schema'

interface PortfolioRow {
  id: number
  slug: string
  title: string
  summary: string
  status: string
  tags: string | null
  site_url: string | null
  repo_url: string | null
  repo_public: number
  links: string | null
  local_path: string | null
  is_pinned: number
  sort_order: number
  published_payload: string | null
  published_at: number | null
  updated_at: number
}

const ORDER = 'ORDER BY is_pinned DESC, sort_order, updated_at DESC, id'

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseLinks(value: string | null): PortfolioLink[] {
  return parseJsonArray(value).flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const { label, url } = item as Record<string, unknown>
    return typeof label === 'string' && isHttpUrl(url) ? [{ label, url }] : []
  })
}

function mapRow(row: PortfolioRow): PortfolioProject {
  const status = (PORTFOLIO_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as PortfolioStatus)
    : 'active'
  const published = parsePublicPortfolioPayload(row.published_payload)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status,
    tags: parseJsonArray(row.tags).filter((tag): tag is string => typeof tag === 'string'),
    site_url: row.site_url,
    repo_url: row.repo_url,
    repo_public: row.repo_public === 1,
    links: parseLinks(row.links),
    local_path: row.local_path,
    is_pinned: row.is_pinned === 1,
    sort_order: row.sort_order,
    published,
    publish_stale: !!published && row.updated_at > (row.published_at ?? 0),
    updated_at: row.updated_at,
  }
}

function bindInput(input: PortfolioInput) {
  return [
    input.slug,
    input.title,
    input.summary,
    input.status,
    JSON.stringify(input.tags),
    input.site_url,
    input.repo_url,
    input.repo_public ? 1 : 0,
    JSON.stringify(input.links),
    input.local_path,
    input.is_pinned ? 1 : 0,
    input.sort_order,
  ]
}

function isUniqueSlugError(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed: portfolio_projects\.slug/.test(error.message)
}

export async function listPortfolioProjects(db: Database): Promise<PortfolioProject[]> {
  const { results } = await db.prepare(`SELECT * FROM portfolio_projects ${ORDER}`).all<PortfolioRow>()
  return results.map(mapRow)
}

export async function getPublicPortfolio(db: Database): Promise<PublicPortfolioProject[]> {
  const { results } = await db
    .prepare(
      `SELECT id, published_payload FROM portfolio_projects
       WHERE published_payload IS NOT NULL AND status != 'archived' ${ORDER}`,
    )
    .all<Pick<PortfolioRow, 'id' | 'published_payload'>>()
  return results.flatMap((row) => {
    const project = parsePublicPortfolioPayload(row.published_payload)
    if (!project) console.error(`Portfolio project ${row.id}: unreadable public payload skipped`)
    return project ? [project] : []
  })
}

export async function createPortfolioProject(db: Database, input: PortfolioInput): Promise<number> {
  try {
    const result = await db
      .prepare(
        `INSERT INTO portfolio_projects
         (slug,title,summary,status,tags,site_url,repo_url,repo_public,links,local_path,is_pinned,sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(...bindInput(input))
      .run()
    return result.meta.last_row_id
  } catch (error) {
    if (isUniqueSlugError(error)) throw new BrainApiError(409, `标识「${input.slug}」已被使用`)
    throw error
  }
}

export async function updatePortfolioProject(db: Database, id: number, input: PortfolioInput) {
  try {
    const result = await db
      .prepare(
        `UPDATE portfolio_projects SET slug=?,title=?,summary=?,status=?,tags=?,site_url=?,repo_url=?,
         repo_public=?,links=?,local_path=?,is_pinned=?,sort_order=?,updated_at=strftime('%s','now')
         WHERE id=?`,
      )
      .bind(...bindInput(input), id)
      .run()
    if (!result.meta.changes) throw new BrainApiError(404, '项目不存在')
  } catch (error) {
    if (isUniqueSlugError(error)) throw new BrainApiError(409, `标识「${input.slug}」已被使用`)
    throw error
  }
}

export async function deletePortfolioProject(db: Database, id: number) {
  const result = await db.prepare('DELETE FROM portfolio_projects WHERE id=?').bind(id).run()
  if (!result.meta.changes) throw new BrainApiError(404, '项目不存在')
}

/** Publishing snapshots the current working copy; later private edits do not leak until republished. */
export async function setPortfolioPublished(db: Database, id: number, publish: boolean) {
  if (!publish) {
    const result = await db
      .prepare('UPDATE portfolio_projects SET published_payload=NULL, published_at=NULL WHERE id=?')
      .bind(id)
      .run()
    if (!result.meta.changes) throw new BrainApiError(404, '项目不存在')
    return
  }
  const row = await db.prepare('SELECT * FROM portfolio_projects WHERE id=?').bind(id).first<PortfolioRow>()
  if (!row) throw new BrainApiError(404, '项目不存在')
  const project = mapRow(row)
  if (!project.summary) throw new BrainApiError(400, '公开前请先填写项目简介')
  const payload = toPublicPortfolioProject(project)
  await db
    .prepare(
      "UPDATE portfolio_projects SET published_payload=?, published_at=strftime('%s','now') WHERE id=?",
    )
    .bind(JSON.stringify(payload), id)
    .run()
}
