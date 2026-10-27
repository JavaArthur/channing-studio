'use client'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { useState } from 'react'
import { Button, Input, Menu } from '@/components/admin/ui'
interface NavLink {
  label: string
  url: string
  openInNewTab: boolean
}
const defaultLinks: NavLink[] = [
  { label: '作品', url: '/work', openInNewTab: false },
  { label: '文章', url: '/writing', openInNewTab: false },
  { label: '资源', url: '/tools', openInNewTab: false },
  { label: '关于我', url: '/about', openInNewTab: false },
]
export function NavLinksEditor({
  initialValue,
  onSave,
  saving,
}: {
  initialValue: string
  onSave: (value: string) => Promise<boolean>
  saving: boolean
}) {
  const [links, setLinks] = useState<NavLink[]>(() => {
    try {
      const parsed = JSON.parse(initialValue)
      return Array.isArray(parsed) ? parsed : defaultLinks
    } catch {
      return defaultLinks
    }
  })
  const [saved,setSaved] = useState(()=>JSON.stringify(links))
  async function save() { const value=JSON.stringify(links); const ok=await onSave(value); if(ok)setSaved(value); return ok }
  useUnsavedChanges(JSON.stringify(links)!==saved,save,()=>setLinks(JSON.parse(saved)))
  function update(index: number, patch: Partial<NavLink>) {
    setLinks(links.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  }
  function move(index: number, step: number) {
    const next = [...links]
    ;[next[index], next[index + step]] = [next[index + step], next[index]]
    setLinks(next)
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <table className="nav-link-table">
        <thead>
          <tr>
            <th scope="col">名称</th>
            <th scope="col">地址</th>
            <th scope="col">新窗口</th>
            <th scope="col">
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {links.map((link, index) => (
            <tr key={index}>
              <td>
                <Input
                  required
                  aria-label={`链接 ${index + 1} 名称`}
                  value={link.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
              </td>
              <td>
                <Input
                  required
                  aria-label={`链接 ${index + 1} 地址`}
                  value={link.url}
                  onChange={(e) => update(index, { url: e.target.value })}
                />
              </td>
              <td>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`链接 ${index + 1} 在新窗口打开`}
                    checked={link.openInNewTab}
                    onChange={(e) => update(index, { openInNewTab: e.target.checked })}
                  />
                </label>
              </td>
              <td>
                <Menu
                  label={`链接 ${index + 1} 操作`}
                  items={[
                    { label: '上移', disabled: index === 0, onSelect: () => move(index, -1) },
                    {
                      label: '下移',
                      disabled: index === links.length - 1,
                      onSelect: () => move(index, 1),
                    },
                    {
                      label: '删除链接',
                      danger: true,
                      onSelect: () => setLinks(links.filter((_, i) => i !== index)),
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="nav-link-actions">
        <Button
          variant="ghost"
          onClick={() => setLinks([...links, { label: '', url: '', openInNewTab: false }])}
        >
          ＋ 添加链接
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? '保存中…' : '保存导航'}
        </Button>
      </div>
    </form>
  )
}
