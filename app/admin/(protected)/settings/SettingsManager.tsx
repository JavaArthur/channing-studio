'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Palette, Globe, KeyRound, MessageSquare, Image, SlidersHorizontal } from 'lucide-react'
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
const categories = [
  {
    id: 'appearance',
    label: '外观',
    Icon: Palette,
    description: '调整你阅读和整理资料时的显示方式。',
  },
  {
    id: 'site',
    label: '公开站点',
    Icon: Globe,
    description: '管理访客看到的导航。修改后点击保存生效。',
  },
  {
    id: 'connections',
    label: '连接与访问',
    Icon: KeyRound,
    description: '管理外部发布工具的访问凭据和服务连接。',
  },
  {
    id: 'text',
    label: '文本模型',
    Icon: MessageSquare,
    description: '配置按需调用的文本模型。普通收录不会调用模型。',
  },
  {
    id: 'image',
    label: '图片模型',
    Icon: Image,
    description: '配置文章创作中使用的图片生成模型。',
  },
  {
    id: 'actions',
    label: '内容操作',
    Icon: SlidersHorizontal,
    description: '调整编辑器里的文本操作、图片提示与文章生成方式。',
  },
]
export function SettingsManager({
  initialNavLinks,
  initialRuntimeCapabilities,
}: {
  initialNavLinks: string
  initialRuntimeCapabilities: RuntimeCapabilities
}) {
  const actionTab = useSearchParams().get('tab') || 'text'
  const current = useSearchParams().get('section') || 'appearance'
  const category = categories.find((c) => c.id === current) || categories[0]
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  async function save(value: string) {
    setSaving(true)
    setMessage('')
    setFailed(false)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'nav_links', value }),
      })
      if (!res.ok) throw new Error('导航格式不正确或保存失败')
      setMessage('导航已保存。')
      return true
    } catch (e) {
      setFailed(true)
      setMessage(e instanceof Error ? e.message : '保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="设置分类">
        {categories.map(({ id, label, Icon }) => (
          <Link
            key={id}
            href={`/admin/settings?section=${id}`}
            aria-current={category.id === id ? 'page' : undefined}
            scroll={false}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}
      </nav>
      <section className="settings-content" key={category.id}>
        <header>
          <h2>{category.label}</h2>
          <p>{category.description}</p>
        </header>
        {category.id === 'appearance' && (
          <div className="settings-field-row">
            <div>
              <h3>显示主题</h3>
              <p>跟随系统或手动选择，仅保存于当前浏览器。</p>
            </div>
            <ThemeDropdown />
          </div>
        )}
        {category.id === 'site' && (
          <>
            <NavLinksEditor initialValue={initialNavLinks} onSave={save} saving={saving} />
            {message && (
              <p role={failed ? 'alert' : 'status'} className="library-feedback">
                {message}
              </p>
            )}
            <div className="settings-field-row">
              <div>
                <h3>首页与作品</h3>
                <p>编辑个人介绍、代表作品和精选内容。</p>
              </div>
              <Link className="admin-button" href="/admin/studio">
                管理站点内容
              </Link>
            </div>
          </>
        )}
        {category.id === 'connections' && (
          <div className="space-y-6">
            <ApiTokensManager />
            <RuntimeCapabilitiesPanel capabilities={initialRuntimeCapabilities} />
          </div>
        )}
        {category.id === 'text' && <AiProviderManager />}
        {category.id === 'image' && <AiImageProviderManager />}
        {category.id === 'actions' && (
          <div className="space-y-6">
            <nav className="settings-action-tabs" aria-label="内容操作分类">{[['text','文本操作'],['image','图片提示'],['generators','文章生成']].map(([id,label])=><Link key={id} href={`/admin/settings?section=actions&tab=${id}`} aria-current={actionTab===id?'page':undefined}>{label}</Link>)}</nav>
            {actionTab==='image'?<AiImageActionsManager/>:actionTab==='generators'?<AiPostGeneratorsManager/>:<AiActionsManager/>}
          </div>
        )}
      </section>
    </div>
  )
}
