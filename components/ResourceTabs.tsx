import Link from 'next/link'

export function ResourceTabs({ active }: { active: 'tools' | 'prompts' }) {
  return (
    <nav
      aria-label="资源类型"
      className="public-resource-tabs"
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
          className="public-resource-tab"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
