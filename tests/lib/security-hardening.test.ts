import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildArticlePrintCss, buildArticlePrintDocument } from '@/lib/wechat-copy'
import type { WechatExportStyleTokens } from '@/lib/wechat-export-style'
import nextConfigFactory from '@/next.config'

const SAMPLE_TOKENS: WechatExportStyleTokens = {
  background: '#f5f4ed',
  panelBackground: '#faf9f5',
  softBackground: '#e8e6dc',
  lineColor: '#f0eee6',
  inkColor: '#141413',
  mutedColor: '#5e5d59',
  accentColor: '#c96442',
  linkColor: '#c96442',
  codeBackground: '#faf9f5',
  codeBorderColor: '#e8e6dc',
  quoteBackground: '#faf9f5',
  articleHeadingColor: '#17120d',
  articleBodyColor: '#2b241c',
  articleQuoteColor: '#51473a',
  articleQuoteBorderColor: '#cdb796',
  articleQuoteNestedBorderColor: '#b8a68a',
  articleQuoteNestedBackground: 'rgba(0, 0, 0, 0.02)',
  bodyFontFamily: 'Georgia, serif',
  monoFontFamily: '"SF Mono", monospace',
  titleFontFamily: 'Georgia, serif',
}

describe('PDF print export & baseline security headers', () => {
  it('removes unverified external html2pdf CDN script injection', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/wechat-copy.ts'), 'utf8')
    expect(source).not.toContain('cdn.jsdelivr.net')
    expect(source).not.toContain('html2pdf')
  })

  it('builds a clean self-contained print document with @page rules and escaped title', () => {
    const css = buildArticlePrintCss(SAMPLE_TOKENS)
    expect(css).toContain('@page')
    expect(css).toContain('size: A4 portrait')

    const doc = buildArticlePrintDocument('AI <Agent> & PDF', '<p>正文内容</p>', SAMPLE_TOKENS)
    expect(doc).toContain('<!DOCTYPE html>')
    expect(doc).toContain('<title>AI &lt;Agent&gt; &amp; PDF</title>')
    expect(doc).toContain('<p>正文内容</p>')
    expect(doc).not.toContain('<script')
  })

  it('includes baseline CSP and security headers in production Next config', async () => {
    const prodConfig = nextConfigFactory('phase-production-build')
    const headerRules = await prodConfig.headers?.()
    const catchAll = headerRules?.find((rule) => rule.source === '/(.*)')
    expect(catchAll).toBeDefined()

    const headerMap = new Map(catchAll!.headers.map((h) => [h.key, h.value]))
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headerMap.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')

    const csp = headerMap.get('Content-Security-Policy') || ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://platform.twitter.com")
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain('https://www.youtube-nocookie.com')
  })
})
