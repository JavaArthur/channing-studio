'use client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import type { LibraryKind, LibraryQuery } from '@/lib/library/types'
import type { Collection } from './client'
export type Selection = Record<string, { kind: LibraryKind; id: string; title: string }>
type Usage = { collections: Collection[]; searches: LibraryQuery[] }
const Context = createContext<{
  usage: Usage
  checked: Selection
  setChecked: React.Dispatch<React.SetStateAction<Selection>>
  instruction: string
  setInstruction: (value: string) => void
  sync: (data: unknown) => Promise<boolean>
  reload: () => Promise<void>
} | null>(null)
export function WorkspaceState({ children }: { children: ReactNode }) {
  const [usage, setUsage] = useState<Usage>({ collections: [], searches: [] })
  const [checked, setChecked] = useState<Selection>({}),
    [instruction, setInstruction] = useState('')
  const [error, setError] = useState(''),
    retry = useRef<unknown>(null)
  const router = useRouter(),
    path = usePathname(),
    guard = useUnsavedChanges(false, async () => true)
  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/library/usage', { cache: 'no-store' })
      if (!res.ok) throw new Error('使用记录暂未同步')
      setUsage(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '同步失败')
    }
  }, [])
  const sync = useCallback(
    async (data: unknown) => {
      try {
        const res = await fetch('/api/admin/library/usage', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error((await res.json()).error || '使用记录暂未同步')
        retry.current = null
        setError('')
        await reload()
        return true
      } catch (e) {
        retry.current = data
        setError(e instanceof Error ? e.message : '使用记录暂未同步')
        return false
      }
    },
    [reload],
  )
  useEffect(() => {
    void reload()
    const focus = () => {
      void reload()
      window.dispatchEvent(new Event('studio:usage-focus'))
    }
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [reload])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.library-search input')
        if (input) {
          input.focus()
          input.select()
        } else guard(() => router.push('/admin/library?focus=search'))
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [router, guard, path])
  return (
    <Context.Provider
      value={{ usage, checked, setChecked, instruction, setInstruction, sync, reload }}
    >
      {children}
      {error && (
        <div className="usage-sync-error" role="status">
          {error}
          <button onClick={() => void (retry.current ? sync(retry.current) : reload())}>
            重试同步
          </button>
        </div>
      )}
    </Context.Provider>
  )
}
export function useWorkspace() {
  const state = useContext(Context)
  if (!state) throw new Error('WorkspaceState is required')
  return state
}
