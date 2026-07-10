import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}))

vi.mock('@/lib/repositories/settings', () => ({
  getSetting: mocks.getSetting,
  setSetting: mocks.setSetting,
}))

import { getStudioContent, setStudioContent } from '@/lib/studio-settings'

describe('studio settings persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSetting.mockResolvedValue(null)
    mocks.setSetting.mockResolvedValue(undefined)
  })

  it('reads all Studio keys and returns safe defaults', async () => {
    const result = await getStudioContent({ kind: 'db' } as never)

    expect(mocks.getSetting).toHaveBeenCalledTimes(4)
    expect(result).toEqual(DEFAULT_STUDIO_CONTENT)
  })

  it('serializes each Studio section to its own site setting', async () => {
    const content = structuredClone(DEFAULT_STUDIO_CONTENT)
    content.profile.title = 'Updated'
    content.featuredPostSlugs = ['featured-post']

    await setStudioContent({ kind: 'db' } as never, content)

    expect(mocks.setSetting).toHaveBeenCalledTimes(4)
    expect(mocks.setSetting).toHaveBeenCalledWith(
      { kind: 'db' },
      'studio_profile',
      JSON.stringify(content.profile),
    )
    expect(mocks.setSetting).toHaveBeenCalledWith(
      { kind: 'db' },
      'studio_projects',
      JSON.stringify(content.projects),
    )
    expect(mocks.setSetting).toHaveBeenCalledWith(
      { kind: 'db' },
      'studio_labs',
      JSON.stringify(content.labs),
    )
    expect(mocks.setSetting).toHaveBeenCalledWith(
      { kind: 'db' },
      'studio_featured_posts',
      JSON.stringify(content.featuredPostSlugs),
    )
  })
})
