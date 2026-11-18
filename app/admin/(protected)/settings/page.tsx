import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSetting } from '@/lib/repositories/settings'
import { detectRuntimeCapabilities } from '@/lib/runtime-capabilities'
import { SettingsManager } from './SettingsManager'

export const metadata = { title: '设置' }

export default async function SettingsPage() {
  const env = await getAppCloudflareEnv()
  const nav = env.DB ? await getSetting(env.DB, 'nav_links') : ''
  return (
    <div className="atelier-surface-page">
      <header className="workspace-page-heading">
        <div>
          <span className="atelier-eyebrow">SYSTEM // WORKBENCH PREFERENCES</span>
          <h1>设置</h1>
          <p>管理显示主题、公开导航、访问凭据与按需调用的模型服务。</p>
        </div>
      </header>
      <SettingsManager
        initialNavLinks={nav || ''}
        initialRuntimeCapabilities={detectRuntimeCapabilities(env)}
      />
    </div>
  )
}
