import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSetting } from '@/lib/repositories/settings'
import { detectRuntimeCapabilities } from '@/lib/runtime-capabilities'
import { SettingsManager } from './SettingsManager'
export const metadata={title:'设置'}
export default async function SettingsPage() {
 const env=await getAppCloudflareEnv()
 const nav=env.DB?await getSetting(env.DB,'nav_links'):''
 return <div className="space-y-7"><header><p className="brain-kicker">Preferences & connections</p><h1 className="font-serif font-medium mt-3 text-3xl">设置</h1></header><SettingsManager initialNavLinks={nav || ''} initialRuntimeCapabilities={detectRuntimeCapabilities(env)}/></div>
}
