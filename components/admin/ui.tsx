'use client'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal, X } from 'lucide-react'
export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  return (
    <button
      title={typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined}
      type="button"
      {...props}
      className={`admin-button admin-button-${variant} ${className}`}
    />
  )
}
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input autoComplete="off" {...props} className={`admin-input ${className}`} />
}
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`admin-input ${className}`} />
}
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  sheet = false,
  description,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  sheet?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-overlay" />
        <Dialog.Content
          className={`admin-dialog ${sheet ? 'admin-sheet' : ''}`}
          {...(!description ? { 'aria-describedby': undefined } : {})}
        >
          <header className="admin-dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label={`关闭${title}`}>
                <X size={17} />
              </Button>
            </Dialog.Close>
          </header>
          <div className="admin-dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function Menu({
  label = '更多操作',
  items,
}: {
  label?: string
  items: { label: string; onSelect: () => void; disabled?: boolean; danger?: boolean }[]
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button variant="ghost" aria-label={label}>
          <MoreHorizontal size={17} />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="admin-menu" sideOffset={5} align="end">
          {items.map((item) => (
            <Dropdown.Item
              key={item.label}
              className={item.danger ? 'danger' : ''}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
