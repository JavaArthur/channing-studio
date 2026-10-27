import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STUDIO_CONTENT,
  parseStudioSettings,
  serializeStudioSettings,
  type StudioContent,
} from '@/lib/studio-content'

describe('parseStudioSettings', () => {
  it('returns safe defaults when settings are missing', () => {
    const result = parseStudioSettings({})

    expect(result.profile.title).toBe(DEFAULT_STUDIO_CONTENT.profile.title)
    expect(result.labs).toEqual(DEFAULT_STUDIO_CONTENT.labs)
    expect(result.featuredPostSlugs).toEqual([])
  })

  it('parses valid profile, labs, and featured posts (projects live in portfolio_projects)', () => {
    const result = parseStudioSettings({
      studio_profile: JSON.stringify({
        eyebrow: 'AI Platform',
        title: 'Channing',
        subtitle: '工程与写作',
        statement: '把复杂问题变成可交付系统。',
        contactLinks: [{ label: 'GitHub', url: 'https://github.com/JavaArthur' }],
        capabilities: [{ title: '平台工程', description: '从架构到交付。' }],
      }),
      studio_labs: JSON.stringify([
        {
          id: 'clipper',
          title: 'Chrome Clipper',
          description: '网页剪藏。',
          href: '/ecosystem/chrome-clipper',
          type: 'tool',
          visible: true,
        },
      ]),
      studio_featured_posts: JSON.stringify(['one', 'two']),
    })

    expect(result.profile.title).toBe('Channing')
    expect(result).not.toHaveProperty('projects')
    expect(result.labs[0]?.id).toBe('clipper')
    expect(result.featuredPostSlugs).toEqual(['one', 'two'])
  })

  it('drops malformed entries and falls back for invalid JSON', () => {
    const result = parseStudioSettings({
      studio_profile: '{bad json',
      studio_labs: JSON.stringify({ id: 'not-an-array' }),
      studio_featured_posts: JSON.stringify([1, 'valid-slug', '']),
    })

    expect(result.profile).toEqual(DEFAULT_STUDIO_CONTENT.profile)
    expect(result.labs).toEqual(DEFAULT_STUDIO_CONTENT.labs)
    expect(result.featuredPostSlugs).toEqual(['valid-slug'])
  })

  it('does not mutate the default content while parsing', () => {
    const before: StudioContent = structuredClone(DEFAULT_STUDIO_CONTENT)

    parseStudioSettings({
      studio_profile: JSON.stringify({ title: 'Changed' }),
    })

    expect(DEFAULT_STUDIO_CONTENT).toEqual(before)
  })

  it('serializes the three editable sections to settings payloads', () => {
    const content = structuredClone(DEFAULT_STUDIO_CONTENT)
    content.profile.title = 'New title'

    expect(serializeStudioSettings(content)).toEqual({
      studio_profile: JSON.stringify(content.profile),
      studio_labs: JSON.stringify(content.labs),
      studio_featured_posts: JSON.stringify(content.featuredPostSlugs),
    })
  })
})
