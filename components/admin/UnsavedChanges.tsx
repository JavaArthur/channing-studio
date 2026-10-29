'use client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { Button, Modal } from './ui'
type Entry = { dirty: boolean; save: () => Promise<boolean>; discard: () => void }
type Guard = {
  register: (id: string, entry: Entry | null) => void
  request: (next: () => void) => void
}
const Context = createContext<Guard>({ register: () => {}, request: (next) => next() })
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const entries = useRef(new Map<string, Entry>())
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const register = useCallback((id: string, entry: Entry | null) => {
    if (entry) entries.current.set(id, entry)
    else entries.current.delete(id)
  }, [])
  const request = useCallback((next: () => void) => {
    if ([...entries.current.values()].some((e) => e.dirty)) {
      setError('')
      setPending(() => next)
    } else next()
  }, [])
  useEffect(() => {
    const dirty = () => [...entries.current.values()].some((e) => e.dirty)
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (
        !a ||
        !dirty() ||
        e.defaultPrevented ||
        e.button ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        a.target === '_blank' ||
        a.origin !== location.origin ||
        a.href === location.href
      )
        return
      e.preventDefault()
      e.stopImmediatePropagation()
      request(() => router.push(a.href, { scroll: false }))
    }
    // Index browser history so a blocked Back/Forward can restore the current form before Next navigates.
    let index = Number(history.state?.studioIndex || 0)
    const push = history.pushState.bind(history),
      replace = history.replaceState.bind(history)
    replace({ ...history.state, studioIndex: index }, '')
    history.pushState = (data, unused, url) => {
      index++
      push({ ...data, studioIndex: index }, unused, url)
    }
    history.replaceState = (data, unused, url) =>
      replace({ ...data, studioIndex: index }, unused, url)
    let restoring = false,
      permitted = false
    const pop = (e: PopStateEvent) => {
      const target = Number(e.state?.studioIndex ?? index - 1)
      if (restoring) {
        restoring = false
        e.stopImmediatePropagation()
        return
      }
      if (!dirty() || permitted) {
        permitted = false
        index = target
        return
      }
      const delta = index - target
      if (!delta) return
      e.stopImmediatePropagation()
      restoring = true
      history.go(delta)
      request(() => {
        permitted = true
        history.go(-delta)
      })
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', click, true)
    window.addEventListener('popstate', pop, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', click, true)
      window.removeEventListener('popstate', pop, true)
      history.pushState = push
      history.replaceState = replace
    }
  }, [request, router])
  async function leave(save: boolean) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      for (const entry of entries.current.values())
        if (entry.dirty) {
          if (save) {
            if (!(await entry.save())) {
              setError('尚未保存成功，请检查表单后重试。')
              return
            }
          } else entry.discard()
        }
      const next = pending
      setPending(null)
      next?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，修改仍保留在当前页面。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Context.Provider value={{ register, request }}>
      {children}
      <Modal
        open={!!pending}
        busy={busy}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null)
        }}
        title="有未保存的修改"
        description="离开前选择如何处理当前修改。"
      >
        <div className="admin-form">
          {error && <p role="alert" className="admin-form-error">{error}</p>}
          <p role="status" className="sr-only">{busy ? '正在保存，请稍候。' : ''}</p>
          <Button variant="primary" disabled={busy} aria-busy={busy} onClick={() => void leave(true)}>
            {busy ? '正在保存…' : '保存后离开'}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void leave(false)}>
            放弃修改
          </Button>
          <Button disabled={busy} onClick={() => setPending(null)}>
            继续编辑
          </Button>
        </div>
      </Modal>
    </Context.Provider>
  )
}
export function useUnsavedChanges(
  dirty: boolean,
  save: () => Promise<boolean>,
  discard: () => void = () => {},
) {
  const id = useId(),
    { register, request } = useContext(Context)
  const current = useRef({ dirty, save, discard })
  current.current = { dirty, save, discard }
  useEffect(() => {
    register(id, {
      get dirty() {
        return current.current.dirty
      },
      save: () => current.current.save(),
      discard: () => current.current.discard(),
    })
    return () => register(id, null)
  }, [id, register])
  return request
}
