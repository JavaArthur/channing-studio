import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Markdown } from 'tiptap-markdown'
// Shared document schema; adapters own persistence. Private documents never register media/AI extensions.
export function createDocumentCore({ html = false, privateLinks = true } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      ...(privateLinks
        ? {
            link: {
              openOnClick: false,
              protocols: ['http', 'https'],
              isAllowedUri: (url: string) => /^https?:\/\//i.test(url),
            },
          }
        // The article editor supplies Novel's own link and underline extensions.
        : { link: false, underline: false }),
    }),
    Table.configure({ resizable: false, HTMLAttributes: { class: 'tiptap-table' } }),
    TableRow,
    TableCell,
    TableHeader,
    Markdown.configure({ html, transformPastedText: true, transformCopiedText: true }),
  ]
}
declare module '@tiptap/core' {
  interface Storage {
    markdown: { getMarkdown: () => string }
  }
}
