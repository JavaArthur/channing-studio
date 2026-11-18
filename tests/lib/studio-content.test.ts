import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_MODULES,
  DEFAULT_STUDIO_CONTENT,
  parseStudioSettings,
  serializeStudioSettings,
  type StudioContent,
} from '@/lib/studio-content'
import { validateStudioContent } from '@/lib/studio-validation'

describe('parseStudioSettings', () => {
  it('returns safe defaults when settings are missing', () => {
    const result = parseStudioSettings({})

    expect(result.profile.eyebrow).toBe('晨启AI')
    expect(result.profile.title).toBe(DEFAULT_STUDIO_CONTENT.profile.title)
    expect(result.labs).toEqual(DEFAULT_STUDIO_CONTENT.labs)
    expect(result.featuredPostSlugs).toEqual([])
    expect(result.homeModules).toEqual(DEFAULT_HOME_MODULES)
  })

  it('parses valid profile, labs, featured posts, and homeModules (projects live in portfolio_projects)', () => {
    const result = parseStudioSettings({
      studio_profile: JSON.stringify({
        eyebrow: '晨启AI',
        title: '让 AI 接住业务',
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
      studio_home_modules: JSON.stringify({
        featuredEssay: true,
        writing: true,
        writingLimit: 8,
        focusAreas: false,
        projects: false,
        projectsLimit: 4,
        tools: true,
        prompts: false,
      }),
    })

    expect(result.profile.title).toBe('让 AI 接住业务')
    expect(result).not.toHaveProperty('projects')
    expect(result.labs[0]?.id).toBe('clipper')
    expect(result.featuredPostSlugs).toEqual(['one', 'two'])
    expect(result.homeModules).toEqual({
      featuredEssay: true,
      writing: true,
      writingLimit: 8,
      focusAreas: false,
      projects: false,
      projectsLimit: 4,
      tools: true,
      prompts: false,
    })
  })

  it('drops malformed entries, clamps module limits, and falls back for invalid JSON', () => {
    const result = parseStudioSettings({
      studio_profile: '{bad json',
      studio_labs: JSON.stringify({ id: 'not-an-array' }),
      studio_featured_posts: JSON.stringify([1, 'valid-slug', '']),
      studio_home_modules: JSON.stringify({
        featuredEssay: 'yes',
        writingLimit: 99,
        projectsLimit: 0,
        projects: false,
      }),
    })

    expect(result.profile).toEqual(DEFAULT_STUDIO_CONTENT.profile)
    expect(result.labs).toEqual(DEFAULT_STUDIO_CONTENT.labs)
    expect(result.featuredPostSlugs).toEqual(['valid-slug'])
    expect(result.homeModules).toEqual({
      ...DEFAULT_HOME_MODULES,
      writingLimit: 12,
      projectsLimit: 1,
      projects: false,
    })
  })

  it('does not mutate the default content while parsing', () => {
    const before: StudioContent = structuredClone(DEFAULT_STUDIO_CONTENT)

    parseStudioSettings({
      studio_profile: JSON.stringify({ title: 'Changed' }),
      studio_home_modules: JSON.stringify({ projects: false, writingLimit: 10 }),
    })

    expect(DEFAULT_STUDIO_CONTENT).toEqual(before)
  })

  it('serializes all editable sections including studio_home_modules to settings payloads', () => {
    const content = structuredClone(DEFAULT_STUDIO_CONTENT)
    content.profile.title = 'New title'
    content.homeModules.projects = false
    content.homeModules.writingLimit = 8

    expect(serializeStudioSettings(content)).toEqual({
      studio_profile: JSON.stringify(content.profile),
      studio_labs: JSON.stringify(content.labs),
      studio_featured_posts: JSON.stringify(content.featuredPostSlugs),
      studio_home_modules: JSON.stringify(content.homeModules),
    })
  })

  it('fills default homeModules for legacy validateStudioContent callers and validates explicit modules', () => {
    const legacyPayload = {
      profile: structuredClone(DEFAULT_STUDIO_CONTENT.profile),
      labs: structuredClone(DEFAULT_STUDIO_CONTENT.labs),
      featuredPostSlugs: ['post-1'],
    }
    const validatedLegacy = validateStudioContent(legacyPayload)
    expect(validatedLegacy.homeModules).toEqual(DEFAULT_HOME_MODULES)

    const customValidated = validateStudioContent({
      ...legacyPayload,
      homeModules: {
        ...DEFAULT_HOME_MODULES,
        projects: false,
        writingLimit: 20,
        projectsLimit: 0,
      },
    })
    expect(customValidated.homeModules.projects).toBe(false)
    expect(customValidated.homeModules.writingLimit).toBe(12)
    expect(customValidated.homeModules.projectsLimit).toBe(1)

    expect(() =>
      validateStudioContent({
        ...legacyPayload,
        homeModules: { ...DEFAULT_HOME_MODULES, projects: 'invalid' },
      }),
    ).toThrow('首页模块开关格式错误')
  })
})
