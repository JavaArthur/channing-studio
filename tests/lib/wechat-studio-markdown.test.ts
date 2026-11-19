import { describe, expect, it } from 'vitest'
import { md } from '@/lib/wechat-studio/markdown'

describe('wechat-studio selective highlight.js markdown renderer', () => {
  it('highlights registered core engineering languages', () => {
    const samples: Array<[string, string]> = [
      ['typescript', 'const answer: number = 42;'],
      ['ts', 'export type User = { id: string };'],
      ['javascript', 'function hello(name) { return name; }'],
      ['java', 'public class App { public static void main(String[] args) {} }'],
      ['python', 'def greet(name):\n    return f"hi {name}"'],
      ['bash', 'echo "hello" && ls -la'],
      ['json', '{"ok": true, "count": 3}'],
      ['yaml', 'name: morning-ai\nversion: 1'],
      ['sql', 'SELECT id, title FROM posts WHERE published = 1;'],
      ['go', 'package main\nfunc main() {}'],
      ['rust', 'fn main() { let x = 1; }'],
      ['dockerfile', 'FROM node:22-alpine\nRUN npm ci'],
    ]

    for (const [lang, code] of samples) {
      const html = md.render(`\`\`\`${lang}\n${code}\n\`\`\``)
      expect(html, `expected ${lang} to render hljs tokens`).toContain('<code class="hljs">')
      expect(html, `expected ${lang} to produce highlight spans`).toContain('class="hljs-')
    }
  })

  it('gracefully falls back to HTML-escaped plaintext for unknown languages without throwing', () => {
    const html = md.render('```unknown-exotic-lang\n<script>alert("xss")</script>\n```')
    expect(html).toContain('<code class="hljs">')
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert')
  })
})
