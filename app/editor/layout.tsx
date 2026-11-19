import '@/styles/article-prose.css'
import '@/styles/editor-prose.css'
import '@/styles/admin.css'
import 'katex/dist/katex.min.css'

export const metadata = {
  title: '手稿编辑器 · Channing Atelier',
  robots: { index: false, follow: false },
}

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
