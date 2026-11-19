'use client'

import juice from 'juice'
import { buildWechatExportCss, normalizeWechatExportHtml, type WechatExportStyleTokens } from './wechat-export-style'

type ExportMode = 'clipboard' | 'pdf'

const PRINT_MEDIA_WAIT_TIMEOUT_MS = 5000
const PRINT_IFRAME_FALLBACK_CLEANUP_MS = 1000

const URL_ATTRIBUTES = [
  ['img', 'src'],
  ['a', 'href'],
  ['audio', 'src'],
  ['video', 'src'],
  ['source', 'src'],
  ['iframe', 'src'],
] as const

function shouldRewriteUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('#')) return false
  if (/^(?:[a-z]+:|\/\/)/i.test(trimmed)) return false
  return true
}

function absolutizeUrls(root: Document | Element, baseUrl: string) {
  for (const [selector, attribute] of URL_ATTRIBUTES) {
    for (const element of root.querySelectorAll<HTMLElement>(selector)) {
      const value = element.getAttribute(attribute)
      if (!value || !shouldRewriteUrl(value)) continue
      element.setAttribute(attribute, new URL(value, baseUrl).toString())
    }
  }
}

function waitForLayout(win: Window = window) {
  if (typeof win.requestAnimationFrame !== 'function') {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => resolve())
  })
}

async function waitForDocumentMediaReady(doc: Document, timeoutMs = PRINT_MEDIA_WAIT_TIMEOUT_MS) {
  const imageTasks = Array.from(doc.querySelectorAll<HTMLImageElement>('img'))
    .filter((img) => !img.complete)
    .map((img) => new Promise<void>((resolve) => {
      const cleanup = () => {
        img.removeEventListener('load', cleanup)
        img.removeEventListener('error', cleanup)
        resolve()
      }

      img.addEventListener('load', cleanup, { once: true })
      img.addEventListener('error', cleanup, { once: true })
    }))

  const fontsReady = typeof doc.fonts?.ready?.then === 'function'
    ? doc.fonts.ready.then(() => undefined).catch(() => undefined)
    : Promise.resolve()

  const allReady = Promise.all([fontsReady, ...imageTasks]).then(() => undefined)
  if (timeoutMs <= 0) {
    await allReady
    return
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      allReady,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function cleanAttributeValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function readCssVar(style: CSSStyleDeclaration, name: string, fallback: string) {
  const value = style.getPropertyValue(name)
  return value ? cleanAttributeValue(value) : fallback
}

function readWechatExportStyleTokens(): WechatExportStyleTokens {
  const rootStyle = window.getComputedStyle(document.documentElement)
  const bodyStyle = window.getComputedStyle(document.body)
  const bodyFont = readCssVar(rootStyle, '--body-font', bodyStyle.fontFamily || 'Arial, Helvetica, sans-serif')

  return {
    background: readCssVar(rootStyle, '--background', '#f5f4ed'),
    panelBackground: readCssVar(rootStyle, '--editor-panel', '#faf9f5'),
    softBackground: readCssVar(rootStyle, '--editor-soft', '#e8e6dc'),
    lineColor: readCssVar(rootStyle, '--editor-line', '#f0eee6'),
    inkColor: readCssVar(rootStyle, '--editor-ink', '#141413'),
    mutedColor: readCssVar(rootStyle, '--editor-muted', '#5e5d59'),
    accentColor: readCssVar(rootStyle, '--editor-accent', '#c96442'),
    linkColor: readCssVar(rootStyle, '--editor-link', '#c96442'),
    codeBackground: readCssVar(rootStyle, '--editor-code-bg', '#faf9f5'),
    codeBorderColor: readCssVar(rootStyle, '--editor-code-border', '#e8e6dc'),
    quoteBackground: readCssVar(rootStyle, '--editor-quote-bg', '#faf9f5'),
    articleHeadingColor: readCssVar(rootStyle, '--article-heading', '#17120d'),
    articleBodyColor: readCssVar(rootStyle, '--article-body', '#2b241c'),
    articleQuoteColor: readCssVar(rootStyle, '--article-quote', '#51473a'),
    articleQuoteBorderColor: readCssVar(rootStyle, '--article-quote-border', '#cdb796'),
    articleQuoteNestedBorderColor: readCssVar(rootStyle, '--article-quote-nested-border', '#b8a68a'),
    articleQuoteNestedBackground: readCssVar(rootStyle, '--article-quote-nested-bg', 'rgba(0, 0, 0, 0.02)'),
    bodyFontFamily: bodyFont,
    monoFontFamily: readCssVar(rootStyle, '--font-geist-mono', '"SFMono-Regular", Consolas, monospace'),
    titleFontFamily: bodyFont || 'Georgia, "Noto Serif SC", serif',
  }
}

function normalizeMediaAttributes(root: ParentNode) {
  for (const image of root.querySelectorAll<HTMLImageElement>('img')) {
    const width = image.getAttribute('width')
    const height = image.getAttribute('height')

    if (width) {
      image.removeAttribute('width')
      image.style.width = /^\d+$/.test(width) ? `${width}px` : width
    }

    if (height) {
      image.removeAttribute('height')
      image.style.height = /^\d+$/.test(height) ? `${height}px` : height
    }
  }
}

function normalizeCodeBlockMarkup(root: ParentNode) {
  for (const pre of root.querySelectorAll<HTMLPreElement>('pre')) {
    if (!pre.querySelector('code'))
      continue

    pre.classList.add('code__pre')
  }
}

function getMediaSource(element: Element) {
  if (element instanceof HTMLMediaElement) {
    return element.currentSrc || element.getAttribute('src') || ''
  }

  if (element instanceof HTMLIFrameElement) {
    return element.getAttribute('src') || ''
  }

  return (
    element.getAttribute('src')
    || element.querySelector('iframe')?.getAttribute('src')
    || element.querySelector('source')?.getAttribute('src')
    || ''
  )
}

function createPdfMediaPlaceholder(
  doc: Document,
  options: {
    href: string
    kind: 'video' | 'embed'
    title?: string
  },
) {
  const figure = doc.createElement('figure')
  figure.className = 'pdf-media-placeholder'
  figure.setAttribute('data-pdf-media-kind', options.kind)

  const poster = doc.createElement('div')
  poster.className = 'pdf-media-placeholder__poster'

  const play = doc.createElement('span')
  play.className = 'pdf-media-placeholder__play'
  play.textContent = '▶'
  poster.appendChild(play)

  const caption = doc.createElement('figcaption')
  caption.className = 'pdf-media-placeholder__caption'

  const title = doc.createElement('strong')
  title.className = 'pdf-media-placeholder__title'
  title.textContent = options.title?.trim() || (options.kind === 'video' ? '视频内容' : '嵌入内容')
  caption.appendChild(title)

  const description = doc.createElement('p')
  description.className = 'pdf-media-placeholder__description'
  description.textContent = options.kind === 'video'
    ? 'PDF 中无法直接播放视频，请打开下方链接查看。'
    : 'PDF 中无法直接展示该嵌入内容，请打开下方链接查看。'
  caption.appendChild(description)

  if (options.href) {
    const link = doc.createElement('a')
    link.className = 'pdf-media-placeholder__link'
    link.href = options.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = options.href
    caption.appendChild(link)
  }

  figure.appendChild(poster)
  figure.appendChild(caption)
  return figure
}

function replaceUnsupportedPdfEmbeds(doc: Document) {
  for (const youtube of Array.from(doc.querySelectorAll<HTMLElement>('div[data-youtube-video]'))) {
    const src = getMediaSource(youtube)
    youtube.replaceWith(createPdfMediaPlaceholder(doc, {
      href: src,
      kind: 'video',
      title: '嵌入视频',
    }))
  }

  for (const video of Array.from(doc.querySelectorAll<HTMLVideoElement>('video'))) {
    const src = getMediaSource(video)
    const title = video.getAttribute('title') || undefined
    video.replaceWith(createPdfMediaPlaceholder(doc, {
      href: src,
      kind: 'video',
      title,
    }))
  }

  for (const iframe of Array.from(doc.querySelectorAll<HTMLIFrameElement>('iframe'))) {
    const src = getMediaSource(iframe)
    iframe.replaceWith(createPdfMediaPlaceholder(doc, {
      href: src,
      kind: 'embed',
      title: iframe.getAttribute('title') || '嵌入内容',
    }))
  }
}

function normalizeExportMarkup(html: string, mode: ExportMode = 'clipboard') {
  const parser = new DOMParser()
  const doc = parser.parseFromString(normalizeWechatExportHtml(html), 'text/html')
  absolutizeUrls(doc, window.location.origin)
  normalizeMediaAttributes(doc)
  normalizeCodeBlockMarkup(doc)

  if (mode === 'pdf') {
    replaceUnsupportedPdfEmbeds(doc)
  }

  return doc.body.innerHTML
}

function buildWechatExportFragment(title: string, html: string) {
  return `
    <section class="wechat-export-root">
      <article class="wechat-export-article">
        <p class="wechat-export-title">${escapeHtml(title)}</p>
        <div class="wechat-export-content">${html}</div>
      </article>
    </section>
  `
}

export function buildArticlePrintCss(tokens: WechatExportStyleTokens) {
  return `
@page {
  size: A4 portrait;
  margin: 18mm 16mm 18mm 16mm;
}

@media print {
  html,
  body {
    background: #ffffff !important;
  }
}

html,
body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: ${tokens.articleBodyColor};
  font-family: ${tokens.bodyFontFamily};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.wechat-export-root {
  max-width: 100%;
  margin: 0 auto;
}

.wechat-export-article {
  padding: 0;
}

.wechat-export-title {
  margin: 0 0 1.25em;
  padding-bottom: 0.6em;
  border-bottom: 1px solid ${tokens.lineColor};
  color: ${tokens.articleHeadingColor};
  font-family: ${tokens.titleFontFamily};
  font-size: 24px;
  font-weight: 700;
  line-height: 1.38;
  letter-spacing: 0.01em;
}

.wechat-export-content pre.code__pre,
.wechat-export-content .hljs.code__pre,
.wechat-export-content pre {
  background: ${tokens.codeBackground};
  border: 1px solid ${tokens.codeBorderColor};
  border-radius: 6px;
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
}

.wechat-export-content pre.code__pre > code,
.wechat-export-content .hljs.code__pre > code,
.wechat-export-content pre > code {
  display: block;
  padding: 0.85em 1em;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}

.wechat-export-content img {
  max-width: 100% !important;
  height: auto !important;
  break-inside: avoid;
  page-break-inside: avoid;
}
`.trim()
}

export function buildArticlePrintDocument(
  title: string,
  normalizedHtml: string,
  tokens: WechatExportStyleTokens,
) {
  const normalizedTitle = title.trim() || '无标题'
  const baseCss = buildWechatExportCss(tokens)
  const printCss = buildArticlePrintCss(tokens)
  const fragment = buildWechatExportFragment(normalizedTitle, normalizedHtml)

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(normalizedTitle)}</title>
    <style>${baseCss}\n${printCss}</style>
  </head>
  <body>
    ${fragment}
  </body>
</html>`
}

function buildWechatClipboardHtml(title: string, html: string) {
  const normalizedTitle = title.trim() || '无标题'
  const normalizedHtml = normalizeExportMarkup(html, 'clipboard')
  const css = buildWechatExportCss(readWechatExportStyleTokens())
  const fragment = buildWechatExportFragment(normalizedTitle, normalizedHtml)

  const exportedHtml = juice.inlineContent(fragment, css, {
    applyWidthAttributes: true,
    applyHeightAttributes: true,
    applyAttributesTableElements: true,
    preserveImportant: true,
    resolveCSSVariables: false,
    removeStyleTags: false,
  })

  return {
    exportedHtml,
    normalizedTitle,
  }
}

function copyUsingExecCommand(html: string, plainText: string) {
  return new Promise<void>((resolve, reject) => {
    const textarea = document.createElement('textarea')
    textarea.value = plainText
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    textarea.style.opacity = '0'

    const handleCopy = (event: ClipboardEvent) => {
      event.preventDefault()
      event.clipboardData?.setData('text/html', html)
      event.clipboardData?.setData('text/plain', plainText)
    }

    document.body.appendChild(textarea)
    document.addEventListener('copy', handleCopy)
    textarea.select()

    try {
      const ok = document.execCommand('copy')
      if (!ok) {
        throw new Error('execCommand failed')
      }
      resolve()
    } catch (error) {
      reject(error instanceof Error ? error : new Error('复制失败'))
    } finally {
      document.removeEventListener('copy', handleCopy)
      textarea.remove()
    }
  })
}

async function writeClipboardHtml(html: string, plainText: string) {
  if (window.isSecureContext && navigator.clipboard?.write) {
    try {
      if (typeof ClipboardItem === 'undefined') {
        throw new TypeError('ClipboardItem is not supported in this browser.')
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      // fall through to legacy copy
    }
  }

  await copyUsingExecCommand(html, plainText)
}

export async function copyAsWechatArticleFormat(title: string, html: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('当前环境不支持复制')
  }

  const { exportedHtml, normalizedTitle } = buildWechatClipboardHtml(title, html)
  const plainText = new DOMParser()
    .parseFromString(exportedHtml, 'text/html')
    .body.textContent?.trim() || normalizedTitle

  await writeClipboardHtml(exportedHtml, plainText)
}

export async function downloadArticleAsPdf(title: string, html: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('当前环境不支持导出 PDF')
  }

  const normalizedTitle = title.trim() || '无标题'
  const normalizedHtml = normalizeExportMarkup(html, 'pdf')
  const tokens = readWechatExportStyleTokens()
  const printDocumentHtml = buildArticlePrintDocument(normalizedTitle, normalizedHtml, tokens)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('title', normalizedTitle)
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'
  iframe.style.pointerEvents = 'none'

  let cleaned = false
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    if (fallbackTimer !== undefined) {
      clearTimeout(fallbackTimer)
      fallbackTimer = undefined
    }
    iframe.remove()
  }

  document.body.appendChild(iframe)

  try {
    const frameWindow = iframe.contentWindow
    const frameDocument = iframe.contentDocument ?? frameWindow?.document

    if (!frameWindow || !frameDocument) {
      throw new Error('初始化打印容器失败')
    }

    frameDocument.open()
    frameDocument.write(printDocumentHtml)
    frameDocument.close()

    await waitForLayout(frameWindow)
    await waitForDocumentMediaReady(frameDocument)

    if (typeof frameWindow.addEventListener === 'function') {
      frameWindow.addEventListener('afterprint', cleanup, { once: true })
    }

    frameWindow.focus?.()
    if (typeof frameWindow.print !== 'function') {
      throw new Error('当前浏览器不支持打印导出 PDF')
    }
    frameWindow.print()

    fallbackTimer = setTimeout(cleanup, PRINT_IFRAME_FALLBACK_CLEANUP_MS)
  } catch (error) {
    cleanup()
    throw error
  }
}
