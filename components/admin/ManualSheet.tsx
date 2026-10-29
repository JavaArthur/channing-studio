'use client'
import { useState, type ReactNode } from 'react'
import { Modal } from './ui'
import { useUnsavedChanges, type SaveHandler } from './UnsavedChanges'
export function ManualSheet({
  title,
  value,
  onSave,
  onClose,
  children,
}: {
  title: string
  // Pass editable fields only; server-assigned identity is not an unsaved change.
  value: unknown
  onSave: SaveHandler
  onClose: () => void
  children: ReactNode
}) {
  const [saved, setSaved] = useState(() => JSON.stringify(value))
  const guard = useUnsavedChanges(JSON.stringify(value) !== saved, async (context) => {
    const submitted = JSON.stringify(value)
    const ok = await onSave(context)
    if (ok) setSaved(submitted)
    return ok
  })
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) guard(onClose)
      }}
      title={title}
      sheet
    >
      <div className="admin-form">{children}</div>
    </Modal>
  )
}
