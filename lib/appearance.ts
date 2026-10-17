export const THEME_COOKIE_NAME = 'qm_site_theme'
export const THEME_STORAGE_KEY = 'channing-color-mode-v1'
export const THEME_CHANGE_EVENT = 'channing-color-mode-change'
export const THEME_OPTIONS = [
  { id: 'light', label: '白天', description: '清晰、轻盈的日间配色' },
  { id: 'dark', label: '晚上', description: '柔和、低亮度的夜间配色' },
] as const
export type Theme = 'light' | 'dark'

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}
export function normalizeTheme(value: string | null | undefined, fallback: Theme = 'light'): Theme {
  if (isTheme(value)) return value
  return value === 'terminal' ? 'dark' : fallback
}
function legacyPreference(): Theme | null {
  try {
    const cookie = document.cookie.split('; ').find((v) => v.startsWith(THEME_COOKIE_NAME + '='))
    const old = cookie
      ? decodeURIComponent(cookie.slice(THEME_COOKIE_NAME.length + 1))
      : window.localStorage.getItem(THEME_COOKIE_NAME)
    if (old === 'terminal') return 'dark'
    if (['refined', 'editorial', 'warm-editorial', 'clarity'].includes(old || '')) return 'light'
  } catch {}
  return null
}
export function getClientThemePreference(fallback: Theme = 'light'): Theme {
  if (typeof window === 'undefined') return fallback
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(saved)) return saved
  } catch {}
  return (
    legacyPreference() ??
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  )
}
export function applyClientTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-color-mode', theme)
  document.documentElement.style.colorScheme = theme
}
export function setClientThemePreference(theme: Theme) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {}
  document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
  try {
    window.localStorage.removeItem(THEME_COOKIE_NAME)
  } catch {}
  applyClientTheme(theme)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}
export function subscribeToThemeChange(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const sync = () => {
    applyClientTheme(getClientThemePreference())
    onChange()
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  window.addEventListener(THEME_CHANGE_EVENT, sync)
  window.addEventListener('storage', sync)
  media?.addEventListener('change', sync)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, sync)
    window.removeEventListener('storage', sync)
    media?.removeEventListener('change', sync)
  }
}

// Runs before paint; only colors change, never the rendered page structure.
export const COLOR_MODE_SCRIPT = `(()=>{try{let k='channing-color-mode-v1',v=localStorage.getItem(k);if(v!=='light'&&v!=='dark'){let c=document.cookie.split('; ').find(x=>x.startsWith('qm_site_theme='));let o=c?decodeURIComponent(c.split('=')[1]):localStorage.getItem('qm_site_theme');v=o==='terminal'?'dark':['refined','editorial','warm-editorial','clarity'].includes(o)?'light':null;if(v)localStorage.setItem(k,v);localStorage.removeItem('qm_site_theme');document.cookie='qm_site_theme=; Path=/; Max-Age=0; SameSite=Lax'}v=v||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.colorMode=v;document.documentElement.style.colorScheme=v}catch{}})()`
