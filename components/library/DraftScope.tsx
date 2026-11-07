'use client'
import { createContext, useContext, type ReactNode } from 'react'
const Context = createContext('')
export function DraftScope({ scope, children }: { scope: string; children: ReactNode }) {
  return <Context.Provider value={scope}>{children}</Context.Provider>
}
export function useDraftKey(record: string) {
  const scope = useContext(Context)
  return scope ? `studio-private-draft:${scope}:${record}` : null
}
export function clearPrivateDrafts() {
  for (let index = sessionStorage.length - 1; index >= 0; index--) {
    const key = sessionStorage.key(index)
    if (key?.startsWith('studio-private-draft:')) sessionStorage.removeItem(key)
  }
}
