'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
export function GlobalShortcuts() {
  const router=useRouter()
  const path=usePathname()
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      const privatePage=path.startsWith('/admin') || path==='/editor'
      if((event.metaKey || event.ctrlKey) && event.key.toLowerCase()==='k' && privatePage) {
        event.preventDefault()
        router.push('/admin/search')
      } else if(event.ctrlKey && event.metaKey && event.key.toLowerCase()==='n') {
        event.preventDefault()
        router.push('/editor?new=1')
      }
    }
    window.addEventListener('keydown',handler)
    return ()=>window.removeEventListener('keydown',handler)
  },[router,path])
  return null
}
