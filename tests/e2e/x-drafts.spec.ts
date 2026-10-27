import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { XDraft } from '@/lib/repositories/x-drafts'

const password = () =>
  process.env.E2E_ADMIN_PASSWORD ||
  readFileSync('.dev.vars', 'utf8')
    .match(/^ADMIN_PASSWORD=(.*)$/m)?.[1]
    ?.trim()
async function create(request: APIRequestContext, fields: Record<string, string>): Promise<XDraft> {
  const response = await request.post('/api/admin/x-drafts', { data: fields })
  expect(response.status()).toBe(200)
  return (await response.json()).draft
}
async function read(request: APIRequestContext, id: string, q: string): Promise<XDraft> {
  const response = await request.get(
    `/api/admin/x-drafts?account_id=all&status=all&q=${encodeURIComponent(q)}`,
  )
  expect(response.status()).toBe(200)
  return (await response.json()).items.find((draft: XDraft) => draft.id === id)
}
test.beforeEach(async ({ context }) => {
  expect(
    (await context.request.post('/api/admin/login', { data: { password: password() } })).status(),
  ).toBe(200)
})

test('accounts isolate copy, editing preserves originals and only explicit actions complete work', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await context.route('https://x.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Synthetic X destination</p>' }),
  )
  const marker = `运营验收 ${crypto.randomUUID()}`
  const a = await create(context.request, {
    content: `${marker}\nAI 原稿\n\nsecond line  with spaces`,
    source_type: 'aihot',
    source_url: 'https://x.com/example/status/123',
  })
  const b = await create(context.request, {
    content: `${marker} 娱乐文案`,
    account_id: 'bg',
  })
  await page.goto(`/admin/operations?q=${encodeURIComponent(marker)}`)
  const queue = page.getByRole('complementary', { name: '运营内容列表' })
  await expect(queue).toContainText('AI 原稿')
  await expect(queue).not.toContainText('娱乐文案')
  await queue.getByRole('link').filter({ hasText: 'AI 原稿' }).click()
  await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue(a.content)
  await page.getByRole('button', { name: '复制文案', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已复制文案' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(a.content)
  const popup = page.waitForEvent('popup')
  await page.getByRole('link', { name: '去原帖回复' }).click()
  const opened = await popup
  await expect(opened).toHaveURL(a.source_url!)
  await opened.close()
  expect((await read(context.request, a.id, marker)).status).toBe('pending')
  const working = `${marker} 自己的观点 ${'中'.repeat(145)}`
  await page.getByLabel('工作文案', { exact: true }).fill(working)
  await expect(page.getByText('超出常规短帖长度', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '保存文案', exact: true }).click()
  await expect(page.getByText('文案已保存', { exact: true })).toBeVisible()
  await expect
    .poll(async () => (await read(context.request, a.id, marker)).edited_content)
    .toBe(working)
  expect((await read(context.request, a.id, marker)).content).toBe(a.content)
  await page.reload()
  await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue(working)
  await page.getByRole('button', { name: '标记已处理', exact: true }).click()
  await expect(page).toHaveURL(/status=posted/)
  await expect.poll(async () => (await read(context.request, a.id, marker)).status).toBe('posted')
  await page.getByRole('button', { name: '恢复待处理', exact: true }).click()
  await expect(page).toHaveURL(/status=pending/)
  await page.getByRole('button', { name: '忽略', exact: true }).click()
  await expect(page).toHaveURL(/status=discarded/)
  await page
    .getByRole('navigation', { name: '运营账号' })
    .getByRole('link', { name: /娱乐八卦闲聊/ })
    .click()
  await expect(page).toHaveURL(/account_id=bg/)
  await expect(queue).toContainText(b.content)
  await expect(queue).not.toContainText('AI 原稿')
  await queue.getByRole('link').filter({ hasText: b.content }).click()
  await expect(page.getByRole('button', { name: '去原帖回复', exact: true })).toBeDisabled()
  await expect(page.getByText('这条内容没有有效的来源链接', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: '自己发帖' })).toHaveAttribute(
    'href',
    'https://x.com',
  )
})

test('AI is opt-in, preview requires adoption, failures preserve the working copy', async ({
  page,
  context,
}) => {
  const draft = await create(context.request, {
    content: `润色验收 ${crypto.randomUUID()}`,
    account_id: 'bg',
  })
  let calls = 0
  await page.route('**/api/editor/ai', async (route) => {
    calls++
    expect(route.request().postDataJSON()).toMatchObject({ action: 'custom', text: draft.content })
    expect(route.request().postDataJSON().customPrompt).toContain('更简短')
    expect(route.request().postDataJSON().customPrompt).toContain('不把传闻写成确定事实')
    await route.fulfill({
      contentType: 'text/plain; charset=utf-8',
      body: '合成的独立表达，不是原稿。',
    })
  })
  await page.goto(`/admin/operations?item=${draft.id}`)
  await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue(draft.content)
  expect(calls).toBe(0)
  await page.getByLabel('AI 润色的补充要求（可选）').fill('更简短')
  await page.getByRole('button', { name: 'AI 润色', exact: true }).click()
  const preview = page.getByRole('region', { name: '润色预览' })
  await expect(preview).toContainText('合成的独立表达')
  await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue(draft.content)
  await page.getByRole('button', { name: '采用润色', exact: true }).click()
  await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue(
    '合成的独立表达，不是原稿。',
  )
  expect((await read(context.request, draft.id, draft.content)).edited_content).toBeNull()
  await page.getByRole('button', { name: '保存文案', exact: true }).click()
  await expect
    .poll(async () => (await read(context.request, draft.id, draft.content)).edited_content)
    .toBe('合成的独立表达，不是原稿。')
  await page.unroute('**/api/editor/ai')
  await page.route('**/api/editor/ai', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: '测试模型暂不可用' }),
    }),
  )
  await page.getByRole('button', { name: 'AI 润色', exact: true }).click()
  await expect(page.getByRole('region', { name: '文案编辑区' }).getByRole('alert')).toContainText(
    '测试模型暂不可用',
  )
  await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue(
    '合成的独立表达，不是原稿。',
  )
})

test('navigation guards save or discard changes and stale edits cannot overwrite Agent updates', async ({
  page,
  context,
}) => {
  const draft = await create(context.request, { content: `冲突验收 ${crypto.randomUUID()}` })
  await page.goto(`/admin/operations?item=${draft.id}`)
  await page.getByLabel('工作文案', { exact: true }).fill('尚未保存的意见')
  await page
    .getByRole('navigation', { name: '运营账号' })
    .getByRole('link', { name: /娱乐八卦闲聊/ })
    .click()
  await expect(page.getByRole('dialog', { name: '有未保存的修改' })).toBeVisible()
  await page.getByRole('button', { name: '继续编辑', exact: true }).click()
  await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue('尚未保存的意见')
  await page
    .getByRole('navigation', { name: '运营账号' })
    .getByRole('link', { name: /娱乐八卦闲聊/ })
    .click()
  await page.getByRole('button', { name: '保存后离开', exact: true }).click()
  await expect(page).toHaveURL(/account_id=bg/)
  const saved = await read(context.request, draft.id, draft.content)
  expect(saved.edited_content).toBe('尚未保存的意见')
  await page.goto(`/admin/operations?item=${draft.id}`)
  await page.getByLabel('工作文案', { exact: true }).fill('这次放弃')
  await page
    .getByRole('navigation', { name: '运营账号' })
    .getByRole('link', { name: /娱乐八卦闲聊/ })
    .click()
  await page.getByRole('button', { name: '放弃修改', exact: true }).click()
  await expect(page).toHaveURL(/account_id=bg/)
  expect((await read(context.request, draft.id, draft.content)).edited_content).toBe(
    saved.edited_content,
  )
  await page.goto(`/admin/operations?item=${draft.id}`)
  await page.getByLabel('工作文案', { exact: true }).fill('保留我的未保存版本')
  expect(
    (
      await context.request.patch(`/api/admin/x-drafts/${draft.id}`, {
        data: {
          expected_revision: saved.revision,
          changes: { edited_content: '另一个已保存版本' },
        },
      })
    ).status(),
  ).toBe(200)
  await page.getByRole('button', { name: '保存文案', exact: true }).click()
  await expect(page.getByRole('region', { name: '文案编辑区' }).getByRole('alert')).toContainText(
    '已被其他人或 Agent 修改',
  )
  await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue('保留我的未保存版本')
  expect((await read(context.request, draft.id, draft.content)).edited_content).toBe(
    '另一个已保存版本',
  )
})

test('legacy links resolve accounts, library excludes short posts, and mobile/themes fit', async ({
  page,
  context,
}) => {
  const marker = `入口验收 ${crypto.randomUUID()}`
  const draft = await create(context.request, { content: marker, account_id: 'bg' })
  const paths = [
    `/admin/library/inspiration/${draft.id}`,
    `/admin/library?kind=inspiration&item=inspiration:${draft.id}`,
  ]
  for (const path of paths) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/admin\/operations\?.*account_id=bg/)
    await expect(page.getByLabel('工作文案', { exact: true })).toHaveValue(marker)
  }
  await page.goto('/admin/x-drafts')
  await expect(page).toHaveURL(/\/admin\/operations/)
  await page.goto(`/admin/library?q=${encodeURIComponent(marker)}`)
  await expect(page.locator('.library-row')).toHaveCount(0)
  const response = await context.request.post('/api/admin/library', {
    data: { action: 'search', query: { q: marker } },
  })
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ total: 0 })
  await page.goto(`/admin/operations?item=${draft.id}`)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (mode) => document.documentElement.setAttribute('data-color-mode', mode),
        theme,
      )
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await expect(page.getByLabel('工作文案', { exact: true })).toBeVisible()
      await page.screenshot({
        path: `/tmp/channing-x-operations-20261025/operations-${width}-${theme}.png`,
        fullPage: true,
      })
    }
  }
  await page.getByRole('link', { name: '返回列表', exact: true }).click()
  await expect(page.getByRole('complementary', { name: '运营内容列表' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/account_id=bg/)
})
