import MarkdownIt from 'markdown-it'
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true })
const safe = (value: string) =>
  /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value) || value.startsWith('#')
markdown.validateLink = safe
const linkOpen = markdown.renderer.rules.link_open
markdown.renderer.rules.link_open = (tokens, idx, options, env, renderer) => {
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  if (/^https?:/i.test(tokens[idx].attrGet('href') || '')) tokens[idx].attrSet('target', '_blank')
  return linkOpen
    ? linkOpen(tokens, idx, options, env, renderer)
    : renderer.renderToken(tokens, idx, options)
}
// Reading private notes must not silently load third-party tracking images.
markdown.renderer.rules.image = (tokens, idx) => {
  const url = tokens[idx].attrGet('src') || ''
  const alt = markdown.utils.escapeHtml(tokens[idx].content || '查看图片')
  return safe(url)
    ? `<a href="${markdown.utils.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${alt}</a>`
    : alt
}
export function renderLibraryMarkdown(content: string) {
  return markdown.render(content)
}
const sourceScanner = new MarkdownIt({ html: true })
// Inspect syntax before it reaches a DOM parser: even a detached image can make a network request.
export function requiresSourceEditor(content: string) {
  const hasMedia = (tokens: ReturnType<MarkdownIt['parse']>): boolean =>
    tokens.some(
      (token) =>
        ['image', 'html_block', 'html_inline'].includes(token.type) ||
        (!!token.children && hasMedia(token.children)),
    )
  return hasMedia(sourceScanner.parse(content, {}))
}
