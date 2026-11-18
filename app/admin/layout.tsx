import '@/styles/admin.css'
import '@/styles/learning.css'
import '@/styles/operations.css'
import 'katex/dist/katex.min.css'

// Keep private workspace styles out of public entry points, including the homepage.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
