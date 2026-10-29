import { test, expect } from '@playwright/test'

// Exercise hydrated controls and modal cleanup, not just successful HTTP responses.
test('public controls still work after search opens, closes and navigates', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/search?*', route => route.fulfill({ json: { results: [{
    slug: 'work', title: '交互检查作品', description: '搜索结果点击验证',
    category: null, published_at: 1700000000, password: false,
  }] } }))
  await page.goto('/')
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(0)
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  const input = page.getByPlaceholder('搜索文章...')
  await expect(input).toBeFocused()
  await input.press('Escape')
  await expect(input).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await page.getByRole('button', { name: '切换到晚上模式' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await input.fill('交互')
  await page.getByRole('link', { name: /交互检查作品/ }).click()
  await expect(page).toHaveURL(/\/work$/)
  await expect(input).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await page.getByRole('button', { name: '切换到白天模式' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light')
  expect(errors).toEqual([])
})

test('library menus, dialogs and editor remain usable across repeated transitions', async ({ page, context, baseURL }) => {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
    throw new Error('This fixture test must run against the isolated local server.')
  }
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!password) throw new Error('Set E2E_ADMIN_PASSWORD for the isolated local test server.')
  expect((await context.request.post('/api/admin/login', { data: { password } })).status()).toBe(200)
  const title = '交互检查 ' + crypto.randomUUID().slice(0, 8)
  const response = await context.request.post('/api/admin/library', { data: {
    action: 'capture', input: { request_key: crypto.randomUUID(), type: 'note', title,
      content: '## 本地检查\n\n用于验证菜单、弹窗和编辑入口。', topics: [title] },
  } })
  expect(response.status()).toBe(200)
  const { item } = await response.json()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto('/admin/library?topic=' + encodeURIComponent(title))
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: '手动收录', exact: true }).click()
      await expect(page.getByRole('dialog', { name: '收录内容', exact: true })).toBeVisible()
      await page.getByRole('button', { name: '关闭收录内容', exact: true }).click()
      await expect(page.locator('body')).not.toHaveCSS('pointer-events', 'none')
      await page.getByRole('button', { name: '筛选资料', exact: true }).click()
      await expect(page.getByRole('dialog', { name: '筛选资料', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('body')).not.toHaveCSS('pointer-events', 'none')
    }
    await page.getByRole('button', { name: title + '的操作', exact: true }).click()
    await page.getByRole('menuitem', { name: '打开内容', exact: true }).click()
    await expect(page.getByRole('region', { name: '内容详情' })).toBeVisible()
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.getByRole('button', { name: '属性', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '属性', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '关闭属性', exact: true }).click()
    await expect(page.locator('body')).not.toHaveCSS('pointer-events', 'none')
    await page.getByRole('button', { name: '复制给助手', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '复制给助手', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('body')).not.toHaveCSS('pointer-events', 'none')
    await page.getByRole('button', { name: '全屏阅读', exact: true }).click()
    await page.getByRole('button', { name: '退出全屏', exact: true }).click()
    await page.getByRole('button', { name: '编辑', exact: true }).click()
    await expect(page.getByRole('textbox', { name: '资料正文编辑器', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '完成编辑', exact: true }).click()
    await page.getByRole('link', { name: '返回列表', exact: true }).click()
    await expect(page.getByRole('region', { name: '内容详情' })).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    const current = await context.request.post('/api/admin/library', { data: { action: 'get', kind: item.kind, id: item.id } })
    const latest = (await current.json()).item
    const cleanup = await context.request.post('/api/admin/library', { data: {
      action: 'update', kind: item.kind, id: item.id, expected_revision: latest.revision, changes: { archived: true },
    } })
    expect(cleanup.status()).toBe(200)
  }
})
