'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Button, Modal } from '@/components/admin/ui'
import { X } from 'lucide-react'
export function PropertyPanel({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  children: ReactNode
}) {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const media = matchMedia('(min-width:1440px)')
    const update = () => setWide(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!wide || !open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
        document
          .querySelector<HTMLButtonElement>('.reader-controls button[aria-label="属性"]')
          ?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [wide, open, onOpenChange])
  if (wide)
    return open ? (
      <aside className="reader-property-aside" aria-label="属性">
        <header>
          <h3>属性</h3>
          <Button variant="ghost" aria-label="关闭属性" onClick={() => onOpenChange(false)}>
            <X size={16} />
          </Button>
        </header>
        {children}
      </aside>
    ) : null
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="属性" sheet>
      {children}
    </Modal>
  )
}
