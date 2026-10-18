'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void | boolean | Promise<void | boolean>
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  closeOnConfirm?: boolean
}

export function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  type = 'info',
  closeOnConfirm = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const buttonColor = {
    danger: 'bg-[var(--danger-soft-bg)] text-[var(--danger)] ring-1 ring-[var(--danger-line)] hover:brightness-95',
    warning: 'bg-[var(--warning-soft-bg)] text-[var(--warning)] ring-1 ring-[var(--warning-line)] hover:brightness-95',
    info: 'bg-[var(--editor-accent)] hover:brightness-105 text-[var(--editor-accent-ink)]',
  }[type]

  const handleConfirm = async () => {
    if (!onConfirm || submitting) return

    setSubmitting(true)
    try {
      const result = await onConfirm()
      if (result !== false && closeOnConfirm) {
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="bg-[var(--editor-panel)] rounded-lg shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <h3 className="font-serif font-medium text-lg text-[var(--editor-ink)]">
            {title}
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="min-h-11 min-w-11 text-[var(--stone-gray)] hover:text-[var(--editor-ink)] transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {description && (
          <div className="px-6 pb-6">
            <p className="text-sm text-[var(--editor-muted)]">
              {description}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[var(--editor-panel)] rounded-b-lg">
          <button
            onClick={onClose}
            disabled={submitting}
            className="min-h-11 min-w-11 px-4 py-2 text-sm font-medium text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors"
          >
            {cancelText}
          </button>
          {onConfirm && (
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className={`min-h-11 min-w-11 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${buttonColor}`}
            >
              {submitting ? '处理中…' : confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
