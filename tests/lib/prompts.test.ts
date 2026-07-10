import { describe, expect, it } from 'vitest'
import { mapPromptRow, normalizePromptUrl, parsePromptTags } from '@/lib/repositories/prompts'

describe('prompt repository helpers', () => {
  it('parses valid tags and safely falls back for invalid JSON', () => {
    expect(parsePromptTags('["写作", "AI"]')).toEqual(['写作', 'AI'])
    expect(parsePromptTags('{"tag":"写作"}')).toEqual([])
    expect(parsePromptTags('not-json')).toEqual([])
  })

  it('normalizes only http and https source urls', () => {
    expect(normalizePromptUrl('https://example.com/prompt')).toBe('https://example.com/prompt')
    expect(normalizePromptUrl('javascript:alert(1)')).toBeNull()
    expect(normalizePromptUrl('not-a-url')).toBeNull()
  })

  it('maps a database row without exposing raw tags JSON', () => {
    const result = mapPromptRow({
      id: 1,
      title: '文章提纲',
      description: '写作前使用',
      prompt: '请拆解文章结构',
      category: '写作',
      tags: '["大纲"]',
      source_url: 'https://example.com',
      is_pinned: 1,
      is_hidden: 0,
      sort_order: 2,
      created_at: 100,
      updated_at: 101,
    })

    expect(result).toEqual({
      id: 1,
      title: '文章提纲',
      description: '写作前使用',
      prompt: '请拆解文章结构',
      category: '写作',
      tags: ['大纲'],
      source_url: 'https://example.com',
      is_pinned: 1,
      is_hidden: 0,
      sort_order: 2,
      created_at: 100,
      updated_at: 101,
    })
  })
})
