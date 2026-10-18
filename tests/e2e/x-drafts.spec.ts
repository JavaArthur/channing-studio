import { test, expect, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

function localPassword() {
  const value = process.env.E2E_ADMIN_PASSWORD || readFileSync('.dev.vars', 'utf8').match(/^ADMIN_PASSWORD=(.*)$/m)?.[1]?.trim()
  if (!value) throw new Error('Configure local ADMIN_PASSWORD in .dev.vars before running smoke tests.')
  return value
}
async function login(context: BrowserContext) {
  expect((await context.request.post('/api/admin/login', { data: { password: localPassword() } })).status()).toBe(200)
}
test('copies exact multiline drafts, tracks posting and discards without deleting', async ({ page, context }) => {
  await login(context)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const marker = `X 草稿验收 ${crypto.randomUUID()}`
  const content = `${marker}\n第一行\n\nsecond line  with spaces\nhttps://example.com`
  const ids: string[] = []
  try {
    for (const body of [content, `${marker} 放弃样本`]) {
      const response = await context.request.post('/api/admin/x-drafts', { data: { content: body, source_type: 'aihot' } })
      expect(response.status()).toBe(200)
      ids.push((await response.json()).draft.id)
    }
    await page.goto(`/admin/x-drafts?q=${encodeURIComponent(marker)}`)
    const card = page.locator('article').filter({ hasText: 'second line' })
    await card.getByRole('button', { name: '一键复制', exact: true }).click()
    await expect(card.getByRole('status')).toHaveText('已复制到剪贴板')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(content)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await card.getByRole('button', { name: '标记已发', exact: true }).click()
    const link = 'https://x.com/example/status/123'
    await card.getByLabel('帖子链接（可选）').fill(link)
    await card.getByRole('button', { name: '确认已发', exact: true }).click()
    await expect(card).toHaveCount(0)
    await page.getByRole('navigation', { name: '草稿状态' }).getByRole('link', { name: '已发', exact: true }).click()
    await expect(card.getByRole('link', { name: `已发帖子：${link}` })).toHaveAttribute('href', link)
    await page.getByRole('navigation', { name: '草稿状态' }).getByRole('link', { name: '待发', exact: true }).click()
    const other = page.locator('article').filter({ hasText: '放弃样本' })
    await other.getByRole('button', { name: '放弃', exact: true }).click()
    await expect(other).toHaveCount(0)
    await page.getByRole('navigation', { name: '草稿状态' }).getByRole('link', { name: '放弃', exact: true }).click()
    await expect(other.getByRole('button', { name: '恢复待发' })).toBeVisible()
  } finally {
    const response = await context.request.get(`/api/admin/x-drafts?status=all&q=${encodeURIComponent(marker)}`)
    expect(response.status()).toBe(200)
    for (const draft of (await response.json()).items) {
      if (ids.includes(draft.id) && draft.status !== 'discarded')
        expect((await context.request.patch(`/api/admin/x-drafts/${draft.id}`, { data: { expected_revision: draft.revision, changes: { status: 'discarded' } } })).status()).toBe(200)
    }
  }
})
