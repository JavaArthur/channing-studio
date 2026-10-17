import { afterEach, describe, expect, it, vi } from 'vitest'
import { getClientThemePreference, isTheme, normalizeTheme, subscribeToThemeChange, THEME_CHANGE_EVENT, THEME_COOKIE_NAME, THEME_STORAGE_KEY, COLOR_MODE_SCRIPT } from '@/lib/appearance'

function browser(saved: string | null = null, dark = false, cookie = '') {
  const storage = new Map(saved ? [[THEME_STORAGE_KEY, saved]] : [])
  const root = { dataset: {} as Record<string,string>, style: { colorScheme: '' }, setAttribute: vi.fn() }
  const media = { matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const localStorage = { getItem: (k:string) => storage.get(k) ?? null, setItem: (k:string,v:string) => storage.set(k,v), removeItem: (k:string) => storage.delete(k) }
  const listeners = new Map<string, () => void>()
  vi.stubGlobal('document', { cookie, documentElement: root })
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('matchMedia', () => media)
  vi.stubGlobal('window', { localStorage, matchMedia: () => media, addEventListener: (k:string,fn:()=>void) => listeners.set(k,fn), removeEventListener: (k:string) => listeners.delete(k) })
  return { storage, root, listeners }
}
describe('two color modes', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('renders light by default on the server', () => expect(getClientThemePreference()).toBe('light'))
  it('only accepts light and dark while mapping the legacy terminal choice', () => {
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('editorial')).toBe(false)
    expect(normalizeTheme('terminal')).toBe('dark')
  })
  it('follows system until a choice is saved', () => {
    browser(null,true); expect(getClientThemePreference()).toBe('dark')
    browser('light',true); expect(getClientThemePreference()).toBe('light')
  })
  it('migrates legacy preference before paint and clears its cookie', () => {
    const context=browser(null,false,`${THEME_COOKIE_NAME}=terminal`)
    Function(COLOR_MODE_SCRIPT)()
    expect(context.root.dataset.colorMode).toBe('dark')
    expect(context.storage.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.cookie).toContain('Max-Age=0')
  })
  it('listens to same tab, other tabs, and system changes and cleans up', () => {
    const {listeners}=browser()
    const changed=vi.fn()
    const stop=subscribeToThemeChange(changed)
    listeners.get(THEME_CHANGE_EVENT)?.()
    listeners.get('storage')?.()
    expect(changed).toHaveBeenCalledTimes(2)
    stop(); expect(listeners.size).toBe(0)
  })
})
