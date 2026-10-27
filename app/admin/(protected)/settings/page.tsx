import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSetting } from '@/lib/repositories/settings'
import { detectRuntimeCapabilities } from '@/lib/runtime-capabilities'
import { SettingsManager } from './SettingsManager'
export const metadata={title:'设置'}
export default async function SettingsPage() {
 const env=await getAppCloudflareEnv()
 const nav=env.DB?await getSetting(env.DB,'nav_links'):''
 return <div><header className="workspace-page-heading"><h1>设置</h1></header><SettingsManager initialNavLinks={nav || ''} initialRuntimeCapabilities={detectRuntimeCapabilities(env)}/></div>
}
