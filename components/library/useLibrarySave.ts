'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { LibrarySaveQueue } from '@/lib/library/save-queue'
import type { LibraryItem } from '@/lib/library/types'
import { libraryRequest } from './client'
export function useLibrarySave(item: LibraryItem) {
  const router = useRouter()
  const [queue] = useState(
    () =>
      new LibrarySaveQueue(
        item,
        async (revision, changes) =>
          (
            await libraryRequest({
              action: 'update',
              kind: item.kind,
              id: item.id,
              expected_revision: revision,
              changes,
            })
          ).item,
      ),
  )
  const state = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  useEffect(() => {
    queue.accept(item)
  }, [queue, item])
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (queue.dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    // Capture links throughout the shell, including filters and settings. A failed save keeps this editor mounted.
    function navigate(event: MouseEvent) {
      const anchor = (event.target as HTMLElement).closest('a')
      const logout = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-admin-logout]')
      if (
        !queue.dirty ||
        (!anchor && !logout) ||
        anchor?.target === '_blank' ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0 ||
        (anchor && (anchor.origin !== location.origin || anchor.hash))
      )
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      void queue.flush().then((ok) => {
        if (!ok) return
        if (logout) logout.click()
        else if (anchor) router.push(anchor.href, { scroll: false })
      })
    }
    let currentUrl = location.href
    function pop() {
      if (!queue.dirty) {
        currentUrl = location.href
        return
      }
      const target = location.href
      history.pushState(history.state, '', currentUrl)
      void queue.flush().then((ok) => {
        if (ok) {
          currentUrl = target
          router.replace(target)
        }
      })
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', navigate, true)
    window.addEventListener('popstate', pop)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', navigate, true)
      window.removeEventListener('popstate', pop)
      queue.dispose()
    }
  }, [queue, router])
  return { queue, ...state }
}
