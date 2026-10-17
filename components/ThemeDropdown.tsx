'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import {
  getClientThemePreference,
  setClientThemePreference,
  subscribeToThemeChange,
  type Theme,
} from '@/lib/appearance'

export function ThemeDropdown({ initialTheme = 'light' }: { initialTheme?: Theme }) {
  const theme = useSyncExternalStore(
    subscribeToThemeChange,
    getClientThemePreference,
    () => initialTheme,
  )
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="color-mode-toggle"
      onClick={() => setClientThemePreference(next)}
      aria-label={`切换到${next === 'light' ? '白天' : '晚上'}模式`}
      title={`切换到${next === 'light' ? '白天' : '晚上'}模式`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
