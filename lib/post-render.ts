import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'

export async function renderPostMarkdownToHtml(markdown: string): Promise<string> {
  return (
    await remark()
      .use(remarkGfm)
      .use(remarkHtml, { sanitize: false })
      .process(markdown)
  ).toString()
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

function decodeSimpleHtmlEntities(value: string): string {
  return value.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => HTML_ENTITY_MAP[entity] || entity)
}

export function stripLeadingTitleHeading(html: string, title: string): string {
  const match = html.match(/^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/i)
  if (!match) return html

  const headingText = decodeSimpleHtmlEntities(match[1].replace(/<[^>]*>/g, '')).trim()
  if (!headingText || headingText !== title.trim()) return html
  return html.slice(match[0].length)
}
