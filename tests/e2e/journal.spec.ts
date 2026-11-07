import { test, expect, type APIRequestContext } from '@playwright/test'
const password = process.env.E2E_ADMIN_PASSWORD
async function action(request: APIRequestContext, body: unknown) {
  const response = await request.post('/api/admin/library', { data: body })
  expect(response.status()).toBe(200)
  return response.json()
}
test.beforeEach(async ({ context }) => {
  expect(password, 'Set E2E_ADMIN_PASSWORD for an isolated local database').toBeTruthy()
  expect((await context.request.post('/api/admin/login', { data: { password } })).status()).toBe(200)
})
test('daily learning creates, persists after refresh, edits, searches and stays private', async ({ page, context, playwright }) => {
  const title = `学习闭环 ${crypto.randomUUID()}`
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/learning$/)
  await page.getByRole('link', { name: '记一条', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '新建学习记录' })).toBeVisible()
  await page.getByLabel('记录标题', { exact: true }).fill(title)
  await page.getByLabel('记录正文', { exact: true }).fill('这是合成的学习验收内容。')
  await page.getByLabel('主题标签', { exact: true }).fill('验收，工程')
  await page.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  const id = new URL(page.url()).searchParams.get('item')!
  await page.reload()
  await expect(page.locator('.library-prose')).toContainText('这是合成的学习验收内容。')
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.getByRole('textbox', { name: '资料正文编辑器' }).fill('真实编辑后的合成验收内容。')
  await expect(page.locator('.reader-topline .save-state')).toHaveText('已保存')
  expect((await action(context.request, { action: 'get', kind: 'note', id })).item.content).toContain('真实编辑后')
  await page.getByRole('link', { name: '返回列表', exact: true }).click()
  await page.getByLabel('查找学习记录').fill(title)
  await page.getByRole('button', { name: '查找', exact: true }).click()
  await expect(page.locator('.journal-entry')).toHaveCount(1)
  await expect(page.locator('.journal-entry')).toContainText('真实编辑后')
  await page.getByLabel('查找学习记录').fill(`missing-${crypto.randomUUID()}`)
  await page.getByRole('button', { name: '查找', exact: true }).click()
  await page.getByRole('link', { name: '清除筛选', exact: true }).click()
  await expect(page.getByLabel('查找学习记录')).toHaveValue('')
  const anonymous = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
  try {
    expect((await anonymous.post('/api/admin/library', { data: { action: 'get', kind: 'note', id } })).status()).toBe(401)
    const adminPage = await anonymous.get(`/admin/learning?item=${id}`)
    expect(adminPage.url()).toContain('/admin/login')
    expect(await adminPage.text()).not.toContain(title)
    for (const route of ['/', '/writing', '/tools', '/prompts', '/sitemap.xml']) {
      const publicPage = await anonymous.get(route)
      expect(await publicPage.text()).not.toContain(title)
    }
  } finally { await anonymous.dispose() }
})
test('uncertain create locks its payload and refresh retries the same committed request without duplication', async ({ page, context }) => {
  const title = `请求不明 ${crypto.randomUUID()}`
  await page.goto('/admin/learning?new=reflection')
  await page.getByLabel('记录标题', { exact: true }).fill(title)
  await page.getByLabel('记录正文', { exact: true }).fill('同一请求不可重复创建。')
  let sent: unknown
  await page.route('**/api/admin/library', async (route) => {
    const body = route.request().postDataJSON()
    if (body.action === 'capture') {
      sent = body
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      await route.fulfill({ status: 503, json: { error: '合成的响应丢失，请重试确认。' } })
    } else await route.continue()
  })
  await page.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('响应丢失')
  await expect(page.getByLabel('记录正文', { exact: true })).toBeDisabled()
  page.on('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByLabel('记录正文', { exact: true })).toHaveValue('同一请求不可重复创建。')
  await expect(page.getByLabel('记录正文', { exact: true })).toBeDisabled()
  await page.unroute('**/api/admin/library')
  const retry = page.waitForRequest((request) => request.url().endsWith('/api/admin/library') && request.postDataJSON()?.action === 'capture')
  await page.getByRole('button', { name: '重试确认保存', exact: true }).click()
  expect((await retry).postDataJSON()).toEqual(sent)
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  expect((await action(context.request, { action: 'search', query: { journal: 'reflection', q: title } })).total).toBe(1)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.includes('new-journal:reflection')))).toHaveLength(0)
})
test('failed edit survives hard reload and stale drafts remain conflicts on subsequent reloads', async ({ page, context }) => {
  const { item } = await action(context.request, { action: 'capture', input: { request_key: crypto.randomUUID(), type: 'note', title: `草稿恢复 ${crypto.randomUUID()}`, content: '原有内容', topics: ['学习记录'] } })
  await page.goto(`/admin/learning?item=${item.id}`)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.route('**/api/admin/library', (route) => route.request().postDataJSON()?.action === 'update' ? route.fulfill({ status: 503, json: { error: '暂时离线' } }) : route.continue())
  await page.getByRole('textbox', { name: '资料正文编辑器' }).fill('本地恢复正文')
  await expect(page.locator('.save-problem')).toContainText('保存失败')
  page.on('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.locator('.save-problem')).toContainText('已恢复未保存的草稿')
  await expect(page.locator('.library-prose')).toContainText('本地恢复正文')
  await page.unroute('**/api/admin/library')
  await page.getByRole('button', { name: '重试保存', exact: true }).click()
  await expect(page.locator('.reader-topline .save-state')).toHaveText('已保存')
  const before = (await action(context.request, { action: 'get', kind: 'note', id: item.id })).item
  await action(context.request, { action: 'update', kind: 'note', id: item.id, expected_revision: before.revision, changes: { content: '并发新版本' } })
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.getByRole('textbox', { name: '资料正文编辑器' }).fill('本地冲突草稿')
  await expect(page.locator('.save-problem')).toContainText('版本冲突')
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.reload()
    await expect(page.locator('.save-problem')).toContainText('版本冲突')
    await expect(page.locator('.library-prose')).toContainText('本地冲突草稿')
    await expect(page.getByRole('button', { name: '重试保存', exact: true })).toHaveCount(0)
  }
  expect((await action(context.request, { action: 'get', kind: 'note', id: item.id })).item.content).toBe('并发新版本')
})
test('cancelled navigation waits for the real save and exposes its saved record without a second create', async ({ page, context }) => {
  const title = `取消离页 ${crypto.randomUUID()}`
  await page.goto('/admin/learning?new=learning')
  await page.getByLabel('记录标题', { exact: true }).fill(title)
  await page.getByLabel('记录正文', { exact: true }).fill('测试取消离页时已发出的真实保存')
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let writes = 0
  await page.route('**/api/admin/library', async (route) => {
    if (route.request().postDataJSON()?.action === 'capture') { writes++; await held }
    await route.continue()
  })
  await page.getByRole('button', { name: '关闭新建学习记录', exact: true }).click()
  const guard = page.getByRole('dialog', { name: '有未保存的修改' })
  await guard.getByRole('button', { name: '保存后离开' }).click()
  await expect.poll(() => writes).toBe(1)
  await guard.getByRole('button', { name: '继续编辑' }).click()
  release()
  await expect(page.getByRole('button', { name: '打开已保存记录' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: '新建学习记录' })).toBeVisible()
  await page.getByRole('button', { name: '打开已保存记录' }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  expect(writes).toBe(1)
  expect((await action(context.request, { action: 'search', query: { journal: 'learning', q: title } })).total).toBe(1)
})
test('unavailable browser storage prevents capture until its request is recoverable', async ({ page, context }) => {
  const title = `存储失败 ${crypto.randomUUID()}`
  await page.goto('/admin/learning?new=learning')
  await expect(page.getByLabel('记录标题', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.assign(window, { restoreStudioStorage: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('studio-private-draft:')) throw new DOMException('Synthetic quota failure', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  let captures = 0
  await page.route('**/api/admin/library', async (route) => {
    const body = route.request().postDataJSON()
    if (body.action === 'capture') {
      captures++
      const stored = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.includes('new-journal:learning')).map((key) => JSON.parse(sessionStorage.getItem(key)!)))
      expect(stored).toHaveLength(1)
      expect(stored[0]).toEqual({ form: body.input, pending: true })
    }
    await route.continue()
  })
  await page.getByLabel('记录标题', { exact: true }).fill(title)
  await page.getByLabel('记录正文', { exact: true }).fill('存储恢复前保留这份合成正文。')
  await page.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '本次保存未发送' })).toBeVisible()
  await expect(page.getByLabel('记录正文', { exact: true })).toBeEnabled()
  await expect(page.getByLabel('记录正文', { exact: true })).toHaveValue('存储恢复前保留这份合成正文。')
  expect(captures).toBe(0)
  expect((await action(context.request, { action: 'search', query: { journal: 'learning', q: title } })).total).toBe(0)
  await page.evaluate(() => (window as Window & { restoreStudioStorage: () => void }).restoreStudioStorage())
  await page.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  expect(captures).toBe(1)
  expect((await action(context.request, { action: 'search', query: { journal: 'learning', q: title } })).total).toBe(1)
})
test('unsent drafts survive refresh, remain isolated by type and clear after successful logout', async ({ page }) => {
  await page.goto('/admin/learning?new=learning')
  await page.getByLabel('记录标题', { exact: true }).fill('未提交的学习草稿')
  await page.getByLabel('记录正文', { exact: true }).fill('仍然是私人本地草稿')
  await page.getByLabel('参考链接', { exact: true }).fill('https://')
  page.on('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByLabel('记录标题', { exact: true })).toHaveValue('未提交的学习草稿')
  await expect(page.getByLabel('参考链接', { exact: true })).toHaveValue('https://')
  await page.goto('/admin/learning?new=reflection')
  await expect(page.getByLabel('记录正文', { exact: true })).toHaveValue('')
  await page.goto('/admin/learning')
  await page.locator('.workspace-sidebar').getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/login/)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('studio-private-draft:')))).toHaveLength(0)
})
