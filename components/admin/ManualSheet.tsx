'use client'
import { useState, type ReactNode } from 'react'
import { Modal } from './ui'
import { useUnsavedChanges } from './UnsavedChanges'
export function ManualSheet({
  title,
  value,
  onSave,
  onClose,
  children,
}: {
  title: string
  value: unknown
  onSave: () => Promise<boolean>
  onClose: () => void
  children: ReactNode
}) {
  const [initial] = useState(() => JSON.stringify(value))
  const guard = useUnsavedChanges(JSON.stringify(value) !== initial, onSave)
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
