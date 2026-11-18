import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { getTools } from '@/lib/repositories/tools'
import { ResourceTabs } from '@/components/ResourceTabs'
import { isHttpUrl, isSafeLink } from '@/lib/url'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { StudioLink, StudioShell } from '@/components/StudioSection'
import { getSiteHeaderData } from '@/lib/site'
import { getSiteUrl } from '@/lib/site-config'
import { resolveRequestTheme } from '@/lib/server-appearance'
import '@/styles/studio-indexes.css'

const BASE_URL = getSiteUrl()

export const dynamicParams = true
export const dynamic = 'force-dynamic'

export const metadata = {
  title: '工具收藏',
  description: '按类型整理的工具、代码仓库与 Mac 软件收藏。',
  alternates: { canonical: `${BASE_URL}/tools` },
}

const TYPE_LABELS: Record<string, string> = {
  url: '在线工具',
  repo: '代码仓库',
  'mac-app': 'Mac 软件',
  other: '其他收藏',
}

function host(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export default async function ToolsPage() {
  const env = await getAppCloudflareEnv()
  if (!env?.DB) notFound()

  const [tools, headerData] = await Promise.all([
    getTools(env.DB),
    getSiteHeaderData(env.DB),
  ])
  const requestTheme = await resolveRequestTheme(headerData.defaultTheme)
  const types = [...new Set(tools.map((tool) => tool.type))]
  const groups = types.map((type) => ({ type, tools: tools.filter((tool) => tool.type === type) }))

  return (
    <StudioShell
      eyebrow="RESOURCES / 工具收藏"
      className="studio-index-page"
      title="工具架"
      description="在线工具、代码仓库与 Mac 软件。按类型浏览收藏，再沿着标签和原始链接继续探索。"
      navLinks={headerData.navLinks}
      initialTheme={requestTheme}
    >
      <ResourceTabs active="tools" />
      {tools.length === 0 ? (
        <div className="studio-empty-state">
          <p>工具箱还是空的</p>
          <span>公开收藏正在整理中。</span>
          <StudioLink href="/prompts">浏览提示词</StudioLink>
        </div>
      ) : (
        <>
          {groups.length > 1 && (
            <nav className="index-contents" aria-label="工具分类目录">
              {groups.map((group, index) => <a key={group.type} href={`#tool-group-${index}`}><span>{TYPE_LABELS[group.type] ?? group.type}</span><span>{group.tools.length}</span></a>)}
            </nav>
          )}
          {groups.map((group, index) => (
            <section key={group.type} id={`tool-group-${index}`} className="index-resource-section" aria-labelledby={`tool-heading-${index}`}>
              <div className="index-section-heading"><span className="index-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h2 id={`tool-heading-${index}`}>{TYPE_LABELS[group.type] ?? group.type}</h2><span className="index-meta">{group.tools.length} 项</span></div>
              <div className="index-tool-grid">
                {group.tools.map((tool) => {
                  const h = host(tool.url)
                  const safeUrl = tool.url && isHttpUrl(tool.url) ? tool.url : null
                  const Wrapper = safeUrl ? 'a' : 'div'
                  return (
                    <Wrapper key={tool.id} {...(safeUrl ? { href: safeUrl, target: '_blank', rel: 'noopener noreferrer nofollow' } : {})} className="index-tool-entry">
                      <div className="index-tool-heading">
                        {tool.icon && isSafeLink(tool.icon) ? (
                          <img src={tool.icon} alt="" loading="lazy" width={36} height={36} className="index-tool-icon" />
                        ) : <span className="index-tool-icon index-tool-initial" aria-hidden="true">{tool.name.slice(0, 1).toUpperCase()}</span>}
                        <div><h3>{tool.name}</h3>{h && <span className="index-location">{h}</span>}</div>
                        {safeUrl && <ArrowUpRight size={18} aria-hidden="true" />}
                      </div>
                      {tool.is_pinned === 1 && <span className="index-pinned">置顶收藏</span>}
                      {tool.description && <p>{tool.description}</p>}
                      {tool.tags.length > 0 && <ul className="index-tags" aria-label="标签">{tool.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
                    </Wrapper>
                  )
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </StudioShell>
  )
}
