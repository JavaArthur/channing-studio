'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Laptop,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { useToast } from '@/components/Toast'
import { copyMarkdownAsWechatArticleFormat, renderWechatStudioMarkdown } from '@/lib/wechat-studio/copy'
import { THEMES, THEME_GROUPS, type Theme } from '@/lib/wechat-studio/themes'

interface WechatPreviewPanelProps {
  title: string
  html: string
  markdown: string
  onClose?: () => void
}

type PreviewDevice = 'mobile' | 'tablet' | 'pc'
type StudioMode = 'split' | 'preview' | 'source'

const QUICK_THEME_IDS = ['apple', 'claude', 'wechat', 'sspai']

function buildInitialMarkdown(title: string, markdown: string, html: string) {
  const normalized = markdown.trim()
  if (normalized) return normalized

  if (html.trim() && typeof window !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const text = doc.body.textContent?.trim()
    if (text) return title.trim() ? `# ${title.trim()}\n\n${text}` : text
  }

  return title.trim() ? `# ${title.trim()}\n\n` : ''
}

function ThemeSwatch({ theme }: { theme: Theme }) {
  const pick = (style: string, prop: string, fallback: string) => {
    const match = style.match(new RegExp(`${prop}\\s*:\\s*([^;!]+)`, 'i'))
    return match?.[1]?.trim() || fallback
  }

  const bg = pick(theme.styles.container || '', 'background-color', '#fff')
  const text = pick(theme.styles.p || '', 'color', '#333')
  const heading = pick(theme.styles.h1 || '', 'color', text)
  const accent = pick(theme.styles.a || theme.styles.blockquote || '', 'color', heading)

  return (
    <span className="flex h-5 w-12 overflow-hidden rounded-md border border-[var(--editor-line)]">
      {[bg, heading, accent, text].map((color, index) => (
        <span key={`${color}-${index}`} className="flex-1" style={{ backgroundColor: color }} />
      ))}
    </span>
  )
}

function DeviceFrame({
  device,
  children,
}: {
  device: Exclude<PreviewDevice, 'pc'>
  children: ReactNode
}) {
  return (
    <div className={`wechat-studio-device wechat-studio-device-${device}`}>
      <div className="wechat-studio-device-screen">
        <div className="wechat-studio-device-scroll no-scrollbar">{children}</div>
      </div>
      <div className="wechat-studio-device-home" />
    </div>
  )
}

export function WechatPreviewPanel({ title, html, markdown, onClose }: WechatPreviewPanelProps) {
  const toast = useToast()
  const [activeTheme, setActiveTheme] = useState('apple')
  const [device, setDevice] = useState<PreviewDevice>('pc')
  const [mode, setMode] = useState<StudioMode>('split')
  const [themeOpen, setThemeOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const [localMarkdown, setLocalMarkdown] = useState(() => buildInitialMarkdown(title, markdown, html))

  useEffect(() => {
    setLocalMarkdown(buildInitialMarkdown(title, markdown, html))
  }, [title, markdown, html])

  const activeThemeMeta = THEMES.find(theme => theme.id === activeTheme) || THEMES[0]
  const quickThemes = QUICK_THEME_IDS
    .map(id => THEMES.find(theme => theme.id === id))
    .filter((theme): theme is Theme => Boolean(theme))

  const renderedHtml = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return renderWechatStudioMarkdown(localMarkdown, activeTheme)
  }, [localMarkdown, activeTheme])

  const handleCopy = useCallback(async () => {
    if (copying) return
    setCopying(true)
    try {
      await copyMarkdownAsWechatArticleFormat(localMarkdown, activeTheme)
      toast.success('已复制公众号格式')
    } catch {
      toast.error('复制公众号格式失败')
    } finally {
      setCopying(false)
    }
  }, [activeTheme, copying, localMarkdown, toast])

  const previewContent = (
    <div
      className="preview-content min-w-full"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  )

  return (
    <section className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[var(--background)] text-[var(--editor-ink)]">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--editor-line)] bg-[var(--editor-panel)]/75 px-4 py-3 backdrop-blur-2xl">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--stone-gray)]" />
          <div className="min-w-0">
            <div className="font-serif truncate text-sm font-medium">公众号排版工作台</div>
            <div className="truncate text-xs text-[var(--stone-gray)]">{activeThemeMeta.name} · {activeThemeMeta.description}</div>
          </div>
        </div>

        <div className="h-5 w-px bg-[var(--editor-soft)]" />

        <div className="flex items-center gap-1 rounded-full bg-[var(--editor-soft)] p-1">
          {quickThemes.map(theme => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setActiveTheme(theme.id)}
              className={`min-h-11 min-w-11 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activeTheme === theme.id ? 'bg-[var(--editor-panel)] text-[var(--editor-ink)] shadow-sm' : 'text-[var(--stone-gray)] hover:text-[var(--editor-ink)]'
              }`}
            >
              {theme.name}
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setThemeOpen(open => !open)}
            className="min-h-11 min-w-11 inline-flex items-center gap-2 rounded-full border border-[var(--editor-line)] bg-[var(--editor-panel)] px-3 py-1.5 text-xs font-medium text-[var(--editor-ink)] shadow-sm transition hover:bg-[var(--editor-soft)]"
          >
            全部 {THEMES.length} 款
            <ChevronDown className={`h-3.5 w-3.5 transition ${themeOpen ? 'rotate-180' : ''}`} />
          </button>
          {themeOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(720px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] shadow-2xl">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="font-serif text-sm font-medium">选择排版风格</span>
                <button
                  type="button"
                  onClick={() => setThemeOpen(false)}
                  className="min-h-11 min-w-11 rounded-full p-1 text-[var(--stone-gray)] hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]"
                  aria-label="关闭主题选择"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[65vh] overflow-y-auto px-5 pb-5">
                {THEME_GROUPS.map((group, index) => (
                  <div key={group.label} className={index ? 'mt-4 border-t border-[var(--editor-line)] pt-4' : ''}>
                    <div className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--stone-gray)]">{group.label}</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {group.themes.map(theme => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            setActiveTheme(theme.id)
                            setThemeOpen(false)
                          }}
                          className={`min-h-11 min-w-11 flex flex-col items-start gap-1.5 rounded-xl p-3 text-left transition ${
                            activeTheme === theme.id ? 'bg-[var(--editor-accent)]/10 ring-2 ring-[var(--editor-accent)]' : 'bg-[var(--editor-soft)] hover:bg-[var(--editor-sand)]'
                          }`}
                        >
                          <span className="flex w-full items-center justify-between">
                            <ThemeSwatch theme={theme} />
                            {activeTheme === theme.id && <Check className="h-4 w-4 text-[var(--editor-accent)]" />}
                          </span>
                          <span className="font-serif text-sm font-medium">{theme.name}</span>
                          <span className="line-clamp-2 text-xs leading-snug text-[var(--stone-gray)]">{theme.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-full bg-[var(--editor-soft)] p-1">
          {([
            ['mobile', Smartphone, '手机预览'],
            ['tablet', Tablet, '平板预览'],
            ['pc', Monitor, '桌面预览'],
          ] as const).map(([value, Icon, label]) => (
            <Tooltip key={value} label={label}>
              <button
                type="button"
                onClick={() => setDevice(value)}
                className={`min-h-11 min-w-11 inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                  device === value ? 'bg-[var(--editor-panel)] text-[var(--editor-accent)] shadow-sm' : 'text-[var(--stone-gray)] hover:text-[var(--editor-ink)]'
                }`}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            </Tooltip>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full bg-[var(--editor-soft)] p-1">
          {([
            ['split', Laptop, '双栏'],
            ['preview', Smartphone, '仅预览'],
            ['source', FileText, '原始 Markdown'],
          ] as const).map(([value, Icon, label]) => (
            <Tooltip key={value} label={label}>
              <button
                type="button"
                onClick={() => setMode(value)}
                className={`min-h-11 min-w-11 inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                  mode === value ? 'bg-[var(--editor-panel)] text-[var(--editor-accent)] shadow-sm' : 'text-[var(--stone-gray)] hover:text-[var(--editor-ink)]'
                }`}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            </Tooltip>
          ))}
        </div>

        <Tooltip label="同步当前博客正文">
          <button
            type="button"
            onClick={() => setLocalMarkdown(buildInitialMarkdown(title, markdown, html))}
            className="min-h-11 min-w-11 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--stone-gray)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]"
            aria-label="同步当前博客正文"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </Tooltip>

        <button
          type="button"
          onClick={handleCopy}
          disabled={copying}
          className="min-h-11 min-w-11 inline-flex items-center gap-2 rounded-full bg-[var(--editor-accent)] px-4 py-2 text-sm font-medium text-[var(--editor-accent-ink)] transition hover:bg-[var(--editor-accent)] disabled:opacity-50"
        >
          <Copy className="h-4 w-4" />
          {copying ? '复制中' : '复制公众号格式'}
        </button>

        {onClose && (
          <Tooltip label="返回博客编辑器">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--stone-gray)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]"
              aria-label="返回博客编辑器"
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>

      <div className={`grid min-h-0 flex-1 ${mode === 'split' ? 'grid-cols-1 lg:grid-cols-[38.2fr_61.8fr]' : 'grid-cols-1'}`}>
        {mode !== 'preview' && (
          <div className="flex min-h-0 flex-col border-r border-[var(--editor-line)] bg-[var(--editor-panel)]">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--editor-line)] px-4">
              <span className="text-xs font-medium uppercase tracking-widest text-[var(--stone-gray)]">Markdown 源码</span>
              <span className="text-xs text-[var(--stone-gray)]">{localMarkdown.length.toLocaleString()} 字符</span>
            </div>
            <textarea
              value={localMarkdown}
              onChange={event => setLocalMarkdown(event.target.value)}
              spellCheck={false}
              className="min-h-11 min-w-11 flex-1 resize-none bg-[var(--editor-panel)] px-5 py-4 font-mono text-sm leading-7 text-[var(--editor-ink)] outline-none"
            />
          </div>
        )}

        {mode !== 'source' && (
          <div className="relative min-h-0 overflow-y-auto bg-[var(--editor-app-bg)]/70">
            <div className={`mx-auto flex min-h-full items-start justify-center px-4 py-10 ${device === 'pc' ? 'max-w-[1040px]' : ''}`}>
              {device === 'pc' ? (
                <div className="w-full overflow-hidden rounded-3xl border border-[var(--editor-line)] bg-[var(--editor-panel)] shadow-whisper">
                  {previewContent}
                </div>
              ) : (
                <DeviceFrame device={device}>{previewContent}</DeviceFrame>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
