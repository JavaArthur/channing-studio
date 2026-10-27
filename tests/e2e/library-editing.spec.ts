import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
const password = () =>
  process.env.E2E_ADMIN_PASSWORD ||
  readFileSync('.dev.vars', 'utf8')
    .match(/^ADMIN_PASSWORD=(.*)$/m)?.[1]
    ?.trim()
const markdown =
  '## 研究笔记\n\n正文包含 **加粗** 和 [来源](https://example.com)。\n\n- 第一项\n- 第二项\n\n> 引用内容\n\n```ts\nconst value = 42\n```\n\n| 名称 | 用途 |\n| --- | --- |\n| Studio | 整理资料 |'
async function action(request: APIRequestContext, data: unknown) {
  const r = await request.post('/api/admin/library', { data })
  expect(r.status()).toBe(200)
  return r.json()
}
test.beforeEach(async ({ context }) => {
  expect(
    (await context.request.post('/api/admin/login', { data: { password: password() } })).status(),
  ).toBe(200)
})
test('rich editing preserves tables/code/undo, properties share autosave and focus does not remount', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const created = await action(context.request, {
    action: 'capture',
    input: {
      request_key: crypto.randomUUID(),
      type: 'note',
      title: '富文本验证',
      content: markdown,
    },
  })
  await page.goto(created.href)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  const editor = page.getByRole('textbox', { name: '资料正文编辑器' })
  await expect(editor).toBeVisible()
  await expect(editor.locator('table')).toHaveCount(1)
  await expect(editor.locator('pre')).toContainText('const value = 42')
  let writes = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/api/admin/library') && r.postDataJSON()?.action === 'update') writes++
  })
  await page.waitForTimeout(900)
  expect(writes).toBe(0)
  await editor.press('ControlOrMeta+End')
  await editor.press('ArrowDown')
  await editor.press('End')
  await editor.press('Enter')
  await page.keyboard.insertText('新增的观点')
  await expect(page.locator('.reader-topline .save-state')).toHaveText('已保存')
  const saved = (
    await action(context.request, { action: 'get', kind: created.item.kind, id: created.item.id })
  ).item
  expect(saved.content).toContain('新增的观点')
  expect(saved.content).toContain('const value = 42')
  expect(saved.content).toContain('|')
  await editor.evaluate((el) => el.setAttribute('data-preserved', 'yes'))
  await page.getByRole('button', { name: '全屏阅读' }).click()
  await expect(editor).toHaveAttribute('data-preserved', 'yes')
  await page.getByRole('button', { name: '属性', exact: true }).click()
  await page.getByRole('textbox', { name: '摘要', exact: true }).fill('新的摘要')
  await expect(page.locator('.reader-properties .save-state')).toHaveText('已保存')
  await page.getByRole('button', { name: '关闭属性' }).click()
  await expect(editor).toHaveAttribute('data-preserved', 'yes')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(editor).not.toContainText('新增的观点')
  await expect(page.locator('.reader-topline .save-state')).toHaveText('已保存')
  const undone = (
    await action(context.request, { action: 'get', kind: created.item.kind, id: created.item.id })
  ).item
  expect(undone.summary).toBe('新的摘要')
  expect(undone.content).toContain('const value = 42')
  expect(undone.content).not.toContain('新增的观点')
  expect(errors).toEqual([])
})
test('autosave serializes slow requests, flushes navigation and protects local edits after offline and conflicts', async ({
  page,
  context,
}) => {
  const created = await action(context.request, {
    action: 'capture',
    input: {
      request_key: crypto.randomUUID(),
      type: 'prompt',
      title: '保存队列验证',
      content: 'exact  text\n\nline',
    },
  })
  await page.goto(created.href)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  const editor = page.getByLabel('正文（精确文本）')
  let active = 0,
    max = 0,
    writes = 0
  await page.route('**/api/admin/library', async (route) => {
    if (route.request().postDataJSON()?.action === 'update') {
      active++
      max = Math.max(max, active)
      writes++
      await new Promise((r) => setTimeout(r, 1100))
      await route.continue()
      active--
    } else await route.continue()
  })
  await editor.fill('one')
  await expect(page.locator('.save-state')).toHaveText('保存中…')
  await editor.fill('two  with spaces\n\n第三行')
  await page.getByRole('link', { name: '返回列表', exact: true }).click()
  await expect(page.getByRole('region', { name: '内容详情' })).toHaveCount(0)
  expect(max).toBe(1)
  expect(writes).toBe(2)
  const current = (
    await action(context.request, { action: 'get', kind: created.item.kind, id: created.item.id })
  ).item
  expect(current.content).toBe('two  with spaces\n\n第三行')
  await page.unroute('**/api/admin/library')
  await page.goto(created.href)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.route('**/api/admin/library', (route) =>
    route.request().postDataJSON()?.action === 'update'
      ? route.abort('internetdisconnected')
      : route.continue(),
  )
  await editor.fill('offline local')
  await expect(page.locator('.save-problem')).toContainText('保存失败')
  await page.getByRole('link', { name: '返回列表', exact: true }).click()
  await expect(editor).toHaveValue('offline local')
  await page.unroute('**/api/admin/library')
  await page.getByRole('button', { name: '重试保存' }).click()
  await expect(page.locator('.reader-topline .save-state')).toHaveText('已保存')
  const before = (
    await action(context.request, { action: 'get', kind: created.item.kind, id: created.item.id })
  ).item
  await action(context.request, {
    action: 'update',
    kind: before.kind,
    id: before.id,
    expected_revision: before.revision,
    changes: { content: 'Agent concurrent' },
  })
  await editor.fill('local conflict')
  await expect(page.locator('.save-problem')).toContainText('版本冲突')
  await expect(editor).toHaveValue('local conflict')
  await page.getByRole('button', { name: '对照服务端版本' }).click()
  await expect(page.getByRole('dialog', { name: '版本冲突' })).toContainText('Agent concurrent')
  await page.getByRole('button', { name: '放弃本地修改并重新载入' }).click()
  await expect(page.locator('.exact-reading')).toHaveText('Agent concurrent')
})
test('legacy Markdown falls back without a mount write; prompt composition preserves exact whitespace', async ({
  page,
  context,
}) => {
  const mediaRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('example.com/private.png')) mediaRequests.push(request.url())
  })
  const source =
    '<details><summary>旧格式</summary>保留 HTML</details>\n\n![图片](https://example.com/private.png)'
  const legacy = await action(context.request, {
    action: 'capture',
    input: { request_key: crypto.randomUUID(), type: 'note', title: '旧格式', content: source },
  })
  await page.goto(legacy.href)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page.getByLabel('正文（Markdown）')).toHaveValue(source)
  await expect(
    page.getByText('原文包含不能无损转换的格式，已保留原文。请使用源码编辑。'),
  ).toBeVisible()
  expect(
    (await action(context.request, { action: 'get', kind: legacy.item.kind, id: legacy.item.id }))
      .item.revision,
  ).toBe(legacy.item.revision)
  expect(mediaRequests).toEqual([])
  const prompt = await action(context.request, {
    action: 'capture',
    input: {
      request_key: crypto.randomUUID(),
      type: 'prompt',
      title: '中文输入法',
      content: 'initial',
    },
  })
  await page.goto(prompt.href)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  const input = page.getByLabel('正文（精确文本）')
  await input.dispatchEvent('compositionstart')
  await input.fill('正在输入  中文\n\n')
  await page.waitForTimeout(1000)
  expect(
    (await action(context.request, { action: 'get', kind: prompt.item.kind, id: prompt.item.id }))
      .item.content,
  ).toBe('initial')
  await input.dispatchEvent('compositionend')
  await expect(page.locator('.reader-topline .save-state')).toHaveText('已保存')
  expect(
    (await action(context.request, { action: 'get', kind: prompt.item.kind, id: prompt.item.id }))
      .item.content,
  ).toBe('正在输入  中文\n\n')
})
test('settings categories survive refresh, drawers trap focus and menus support keyboard', async ({
  page,
}) => {
  await page.goto('/admin/settings?section=site')
  await expect(page.getByRole('heading', { name: '公开站点', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '公开站点', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '链接 1 操作' }).click()
  await expect(page.getByRole('menuitem', { name: '上移' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: '文本模型', exact: true }).click()
  await page.getByRole('button', { name: '+ 新增配置', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '新增配置' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
test('touch reader keeps 44px controls and full-screen editing fits a phone', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  try {
    expect(
      (await context.request.post('/api/admin/login', { data: { password: password() } })).status(),
    ).toBe(200)
    const item = await action(context.request, {
      action: 'capture',
      input: {
        request_key: crypto.randomUUID(),
        type: 'note',
        title: '触屏验收',
        content: '## 正文\n\n移动端内容',
      },
    })
    const page = await context.newPage()
    await page.goto(item.href)
    for (const control of await page.locator('.reader-controls button').all()) {
      const box = await control.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.width).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: '全屏阅读' }).click()
    expect((await page.locator('.library-reader').boundingBox())!.y).toBe(0)
    await page.getByRole('button', { name: '属性', exact: true }).click()
    expect((await page.getByRole('dialog', { name: '属性' }).boundingBox())!.width).toBe(390)
  } finally {
    await context.close()
  }
})
