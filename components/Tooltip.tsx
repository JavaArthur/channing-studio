'use client'

import { useRef, useState, type ReactNode } from 'react'

const SHOW_DELAY = 100
const HIDE_DELAY = 100

const placementStyles = {
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
} as const

export function Tooltip({
  label,
  placement = 'bottom',
  children,
}: {
  label: string
  placement?: keyof typeof placementStyles
  children: ReactNode
}) {
  const [visible, setVisible] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    showTimer.current = setTimeout(() => setVisible(true), SHOW_DELAY)
  }
  const hide = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY)
  }

  if (!label) return <>{children}</>

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className={`absolute ${placementStyles[placement]} z-[60] pointer-events-none whitespace-nowrap rounded-md bg-[var(--editor-ink)] px-2 py-1 text-xs text-[var(--editor-panel)] shadow-sm transition-opacity duration-150 ${visible ? 'opacity-100' : 'hidden'}`}
      >
        {label}
      </span>
    </span>
  )
}
