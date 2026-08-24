import { notFound } from 'next/navigation'
import { getTools } from '@/lib/repositories/tools'
import { getPrompts } from '@/lib/repositories/prompts'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { StudioShell } from '@/components/StudioSection'
import { PromptCard } from '@/components/PromptCard'
import { getSiteHeaderData } from '@/lib/site'
import { getSiteUrl } from '@/lib/site-config'
import { resolveRequestTheme } from '@/lib/server-appearance'

const BASE_URL = getSiteUrl()

export const dynamicParams = true
export const revalidate = 3600

export const metadata = {
  title: '工具与提示词',
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

  const [tools, prompts, headerData] = await Promise.all([
    getTools(env.DB),
    getPrompts(env.DB),
    getSiteHeaderData(env.DB),
  ])
  const requestTheme = await resolveRequestTheme(headerData.defaultTheme)

  return (
    <StudioShell
      eyebrow="TOOLBOX / 05"
      title="好用的工具与提示词"
      description={`收藏 ${tools.length} 件工具和 ${prompts.length} 条可复用提示词。`}
      navLinks={headerData.navLinks}
      initialTheme={requestTheme}
    >
      <section>
        <div className="mb-8">
          <p className="studio-eyebrow">TOOLS</p>
          <h2 className="studio-section-title mt-3">工具收藏</h2>
        </div>
        {tools.length === 0 ? (
          <div className="studio-empty-state">
            <p>工具箱还是空的</p>
            <span>去后台添加第一件工具。</span>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tools.map((tool, index) => {
              const h = host(tool.url)
              const Wrapper = tool.url ? 'a' : 'div'
              return (
                <Wrapper
                  key={tool.id}
                  {...(tool.url
                    ? { href: tool.url, target: '_blank', rel: 'noopener noreferrer nofollow' }
                    : {})}
                  className="group flex flex-col gap-2 rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]/55 p-4 transition-colors hover:border-[var(--editor-accent)]/35 hover:bg-[var(--editor-panel)]"
                  style={{ animation: `fadeInUp 0.4s ease-out ${index * 0.04}s both` }}
                >
                  <div className="flex items-start gap-3">
                    {tool.icon ? (
                      <img
                        src={tool.icon}
                        alt=""
                        loading="lazy"
                        className="w-9 h-9 rounded-lg object-cover border border-[var(--editor-line)] bg-white flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[var(--editor-soft)] flex items-center justify-center text-[var(--stone-gray)] text-sm font-semibold flex-shrink-0">
                        {tool.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-[var(--editor-ink)] leading-snug truncate group-hover:text-[var(--editor-accent)] transition-colors">
                          {tool.name}
                        </h2>
                        {tool.is_pinned === 1 && (
                          <span className="text-[var(--editor-accent)] text-xs flex-shrink-0">★</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--stone-gray)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] border border-[var(--editor-accent)]/15">
                          {TYPE_LABELS[tool.type] ?? tool.type}
                        </span>
                        {h && <span className="truncate">{h}</span>}
                      </div>
                    </div>
                  </div>
                  {tool.description && (
                    <p className="text-sm text-[var(--editor-muted)] leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  )}
                  {tool.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      {tool.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--editor-soft)] text-[var(--stone-gray)]"
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

      <section className="mt-16 border-t border-[var(--editor-line)] pt-12 sm:mt-20 sm:pt-16">
        <div className="mb-8">
          <p className="studio-eyebrow">PROMPTS</p>
          <h2 className="studio-section-title mt-3">高频提示词</h2>
          <p className="studio-page-description mt-3 max-w-2xl">
            真正复用过的提问方式。先看简短说明，需要时展开全文，复制后直接使用。
          </p>
        </div>
        {prompts.length === 0 ? (
          <div className="studio-empty-state">
            <p>提示词收藏还在建立中</p>
            <span>去后台添加第一条可复用的提示词。</span>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {prompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />)}
          </div>
        )}
      </section>
    </StudioShell>
  )
}
