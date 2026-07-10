import { describe, expect, it } from 'vitest'
import { stripLeadingTitleHeading } from '@/lib/post-render'

describe('stripLeadingTitleHeading', () => {
  it('removes a leading h1 when it repeats the article title', () => {
    const html = '<h1>AI 写得越像人，人越要留下毛边</h1><p>正文</p>'

    expect(stripLeadingTitleHeading(html, 'AI 写得越像人，人越要留下毛边')).toBe('<p>正文</p>')
  })

  it('decodes simple entities before comparing the title', () => {
    expect(stripLeadingTitleHeading('<h1>A &amp; B</h1><p>正文</p>', 'A & B')).toBe('<p>正文</p>')
  })

  it('keeps a different or non-leading h1', () => {
    expect(stripLeadingTitleHeading('<h1>另一个标题</h1><p>正文</p>', '文章标题')).toContain('<h1>另一个标题</h1>')
    expect(stripLeadingTitleHeading('<p>引言</p><h1>文章标题</h1>', '文章标题')).toContain('<h1>文章标题</h1>')
  })
})
