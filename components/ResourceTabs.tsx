import Link from 'next/link'

export function ResourceTabs({ active }: { active: 'tools' | 'prompts' }) {
  return (
    <nav
      aria-label="资源类型"
      className="mb-8 flex gap-3 border-b border-[var(--editor-line)] pb-4"
    >
      {(
        [
          ['tools', '工具收藏'],
          ['prompts', '提示词'],
        ] as const
      ).map(([key, label]) => (
        <Link
          key={key}
          href={`/${key}`}
          aria-current={active === key ? 'page' : undefined}
          className={`min-h-11 min-w-11 ${active === key ? 'brain-button' : 'brain-secondary'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
