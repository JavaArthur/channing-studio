'use client'
import { useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Tabs } from '@/components/Tabs'
import { ThemeDropdown } from '@/components/ThemeDropdown'
import { NavLinksEditor } from './NavLinksEditor'
import { ApiTokensManager } from './ApiTokensManager'
import { RuntimeCapabilitiesPanel } from './RuntimeCapabilitiesPanel'
import type { RuntimeCapabilities } from '@/lib/runtime-capabilities'
const AiProviderManager = dynamic(() =>
  import('./AiProviderManager').then((m) => m.AiProviderManager),
)
const AiActionsManager = dynamic(() => import('./AiActionsManager').then((m) => m.AiActionsManager))
const AiImageProviderManager = dynamic(() =>
  import('./AiImageProviderManager').then((m) => m.AiImageProviderManager),
)
const AiImageActionsManager = dynamic(() =>
  import('./AiImageActionsManager').then((m) => m.AiImageActionsManager),
)
const AiPostGeneratorsManager = dynamic(() =>
  import('./AiPostGeneratorsManager').then((m) => m.AiPostGeneratorsManager),
)
function AdvancedPanel({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="brain-panel" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="font-serif min-h-11 min-w-11 cursor-pointer font-medium">{label}</summary>
      {open && <div className="mt-6">{children}</div>}
    </details>
  )
}
interface Props {
  initialNavLinks: string
  initialRuntimeCapabilities: RuntimeCapabilities
}
export function SettingsManager({ initialNavLinks, initialRuntimeCapabilities }: Props) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function save(value: string) {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'nav_links', value }),
      })
      if (!res.ok) throw new Error('导航格式不正确或保存失败')
      setMessage('导航已保存。')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Tabs
      defaultTab="general"
      tabs={[
        {
          id: 'general',
          label: '基础设置',
          content: (
            <div className="space-y-7">
              <section className="brain-panel">
                <h2 className="font-serif font-medium">白天与晚上</h2>
                <div className="mt-4 flex items-center justify-between gap-5">
                  <p className="text-sm text-[var(--editor-muted)]">
                    全站共用日夜配色，首次跟随系统。手动选择只保存在当前浏览器。
                  </p>
                  <ThemeDropdown />
                </div>
              </section>
              <section className="brain-panel">
                <h2 className="font-serif font-medium mb-5">公开导航</h2>
                <NavLinksEditor initialValue={initialNavLinks} onSave={save} saving={saving} />
                {message && (
                  <p role="status" className="mt-3 text-sm">
                    {message}
                  </p>
                )}
              </section>
            </div>
          ),
        },
        {
          id: 'connections',
          label: '连接与访问',
          content: (
            <div className="space-y-6">
              <p className="text-sm text-[var(--editor-muted)]">
                为实际使用的发布工具创建独立 Token。私人笔记与项目 API 仅接受后台会话。
              </p>
              <ApiTokensManager />
              <RuntimeCapabilitiesPanel capabilities={initialRuntimeCapabilities} />
            </div>
          ),
        },
        {
          id: 'advanced',
          label: '高级功能',
          content: (
            <div className="space-y-4">
              <p className="text-sm text-[var(--editor-muted)]">
                AI 功能按需使用。普通收集与保存不会自动调用外部模型。
              </p>
              {[
                ['文本模型', <AiProviderManager key="provider" />],
                ['文本操作', <AiActionsManager key="actions" />],
                ['图片模型', <AiImageProviderManager key="images" />],
                ['图片提示', <AiImageActionsManager key="image-actions" />],
                ['文章生成', <AiPostGeneratorsManager key="generators" />],
              ].map(([label, content]) => (
                <AdvancedPanel label={String(label)} key={String(label)}>
                  {content}
                </AdvancedPanel>
              ))}
            </div>
          ),
        },
      ]}
    />
  )
}
