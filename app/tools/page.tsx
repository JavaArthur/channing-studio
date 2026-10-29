import { notFound } from 'next/navigation'
import { getTools } from '@/lib/repositories/tools'
import { ResourceTabs } from '@/components/ResourceTabs'
import { isHttpUrl, isSafeLink } from '@/lib/url'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { StudioLink, StudioShell } from '@/components/StudioSection'
import { getSiteHeaderData } from '@/lib/site'
import { getSiteUrl } from '@/lib/site-config'
import { resolveRequestTheme } from '@/lib/server-appearance'

const BASE_URL = getSiteUrl()

export const dynamicParams = true
export const dynamic = 'force-dynamic'

export const metadata = {
  title: '工具收藏',
  description: '收藏的好用工具、仓库、Mac 软件和可直接复用的提示词。',
  alternates: { canonical: `${BASE_URL}/tools` },
}

const TYPE_LABELS: Record<string, string> = {
  url: '工具',
  repo: '仓库',
  'mac-app': 'Mac',
  other: '其他',
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

  return (
    <StudioShell
      title="值得留下的工具。"
      description={tools.length ? `我在工作中使用并推荐的 ${tools.length} 件工具。` : '我在工作中使用并推荐的工具。'}
      navLinks={headerData.navLinks}
      initialTheme={requestTheme}
    >
      <ResourceTabs active="tools" />
      <section>
        <h2 className="sr-only">工具收藏</h2>
        {tools.length === 0 ? (
          <div className="studio-empty-state">
            <p>工具箱还是空的</p>
            <span>公开收藏正在整理中。</span>
            <StudioLink href="/prompts">浏览提示词</StudioLink>
          </div>
        ) : (
          <div className="public-tool-grid">
            {tools.map((tool) => {
              const h = host(tool.url)
              const safeUrl = tool.url && isHttpUrl(tool.url) ? tool.url : null
              const Wrapper = safeUrl ? 'a' : 'div'
              return (
                <Wrapper
                  key={tool.id}
                  {...(safeUrl
                    ? { href: safeUrl, target: '_blank', rel: 'noopener noreferrer nofollow' }
                    : {})}
                  className="public-tool-entry group"
                >
                  <div className="flex items-start gap-3">
                    {tool.icon && isSafeLink(tool.icon) ? (
                      <img
                        src={tool.icon}
                        alt=""
                        loading="lazy"
                         width={36}
                         height={36}
                        className="w-9 h-9 rounded-lg object-cover border border-[var(--editor-line)] bg-[var(--editor-panel)] flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[var(--editor-soft)] flex items-center justify-center text-[var(--stone-gray)] text-sm font-semibold flex-shrink-0">
                        {tool.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-serif font-medium text-[var(--editor-ink)] leading-snug break-words group-hover:text-[var(--editor-accent)] transition-colors">
                          {tool.name}
                        </h2>
                        {tool.is_pinned === 1 && (
                          <span className="public-tool-pinned">置顶</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--stone-gray)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-md bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] border border-[var(--editor-accent)]/15">
                          {TYPE_LABELS[tool.type] ?? tool.type}
                        </span>
                        {h && <span className="truncate">{h}</span>}
                      </div>
                    </div>
                  </div>
                  {tool.description && (
                    <p className="public-tool-description">
                      {tool.description}
                    </p>
                  )}
                  {tool.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      {tool.tags.map((tag) => (
                        <span
                          key={tag}
                          className="public-tool-tag"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Wrapper>
              )
            })}
          </div>
        )}
      </section>

    </StudioShell>
  )
}
