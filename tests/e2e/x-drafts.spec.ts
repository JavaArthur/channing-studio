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
  async function expectDraft(id: string, status: string, posted_url: string | null) {
    await expect.poll(async () => {
      const response = await context.request.get(`/api/admin/x-drafts?status=all&q=${encodeURIComponent(marker)}`)
      expect(response.status()).toBe(200)
      const draft = (await response.json()).items.find((item: { id: string }) => item.id === id)
      return { status: draft?.status, posted_url: draft?.posted_url }
    }).toEqual({ status, posted_url })
  }
  async function dismissUndo() {
    await page.getByRole('button', { name: '撤销', exact: true }).locator('..').getByRole('button', { name: '关闭', exact: true }).click()
  }
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
    await expect(card.getByRole('status')).toHaveCount(0, { timeout: 4000 })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await card.getByRole('button', { name: '标记已发', exact: true }).click()
    const link = 'https://x.com/example/status/123'
    await expect(card.getByLabel('帖子链接（可选）')).toBeFocused()
    await card.getByLabel('帖子链接（可选）').press('Escape')
    await expect(card.getByLabel('帖子链接（可选）')).toHaveCount(0)
    await card.getByRole('button', { name: '标记已发', exact: true }).click()
    let patchRequests = 0
    page.on('request', request => { if (request.method() === 'PATCH' && request.url().includes('/api/admin/x-drafts/')) patchRequests++ })
    await card.getByLabel('帖子链接（可选）').fill('javascript:alert(1)')
    await card.getByRole('button', { name: '确认已发', exact: true }).click()
    await expect(card.getByRole('alert')).toContainText('HTTP(S)')
    expect(patchRequests).toBe(0)
    await card.getByLabel('帖子链接（可选）').fill(link)
    await card.getByRole('button', { name: '确认已发', exact: true }).click()
    await expect(card).toHaveCount(0)
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    await expect(card).toBeVisible()
    await expectDraft(ids[0], 'pending', null)
    await card.getByRole('button', { name: '标记已发', exact: true }).click()
    await card.getByLabel('帖子链接（可选）').fill(link)
    await card.getByRole('button', { name: '确认已发', exact: true }).click()
    await expect(card).toHaveCount(0)
    await page.getByRole('navigation', { name: '草稿状态' }).getByRole('link', { name: '已发', exact: true }).click()
    await expect(card.getByRole('link', { name: `已发帖子：${link}` })).toHaveAttribute('href', link)
    await dismissUndo()
    await card.getByRole('button', { name: '恢复待发', exact: true }).click()
    await expect(card).toHaveCount(0)
    await expectDraft(ids[0], 'pending', null)
    // Restoring pending can itself be undone, including the original posted URL.
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    await expect(card).toBeVisible()
    await expectDraft(ids[0], 'posted', link)
    await card.getByRole('button', { name: '恢复待发', exact: true }).click()
    await expect(card).toHaveCount(0)
    await expectDraft(ids[0], 'pending', null)
    await dismissUndo()
    await page.getByRole('navigation', { name: '草稿状态' }).getByRole('link', { name: '待发', exact: true }).click()
    const other = page.locator('article').filter({ hasText: '放弃样本' })
    await other.getByRole('button', { name: '放弃', exact: true }).click()
    await expect(other).toHaveCount(0)
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    await expect(other).toBeVisible()
    await expectDraft(ids[1], 'pending', null)
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
