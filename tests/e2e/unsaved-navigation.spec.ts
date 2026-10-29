import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!password) throw new Error('Set E2E_ADMIN_PASSWORD for the isolated local test server.')
  expect((await context.request.post('/api/admin/login', { data: { password } })).status()).toBe(200)
})

async function holdStudioSave(page: Page) {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  const writes: { content: { profile: { eyebrow: string } }; revision: number }[] = []
  await page.route('**/api/admin/studio', async (route) => {
    // Never forward mutations to the server: this suite needs no database fixtures.
    if (route.request().method() !== 'PUT') return route.continue()
    const body = route.request().postDataJSON()
    writes.push(body)
    await pending
    await route.fulfill({ json: { revision: body.revision + 1 } })
  })
  return { release, writes }
}

async function editStudio(page: Page) {
  await page.goto('/admin/studio')
  await page.getByLabel('眉题', { exact: true }).fill('离页前的修改')
  await page.locator('.workspace-sidebar').getByRole('link', { name: '公开网站' }).click()
  return page.getByRole('dialog', { name: '有未保存的修改' })
}

for (const dismiss of ['继续编辑', 'Escape', '关闭', '外点'] as const) {
  test(`pending save can be dismissed with ${dismiss} without late navigation`, async ({ page }) => {
    const save = await holdStudioSave(page)
    const dialog = await editStudio(page)
    await dialog.getByRole('button', { name: '保存后离开' }).click()
    await expect.poll(() => save.writes.length).toBe(1)
    await expect(dialog.getByRole('button', { name: '正在保存…' })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: '放弃修改' })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: '继续编辑' })).toBeEnabled()

    if (dismiss === '继续编辑') await dialog.getByRole('button', { name: '继续编辑' }).click()
    else if (dismiss === 'Escape') await page.keyboard.press('Escape')
    else if (dismiss === '关闭') await dialog.getByRole('button', { name: '关闭有未保存的修改' }).click()
    else await page.locator('.admin-overlay').click({ position: { x: 8, y: 8 } })

    await expect(dialog).toHaveCount(0)
    // Actual typing verifies Radix released pointer/focus locks while the save is pending.
    await page.getByLabel('眉题', { exact: true }).fill('取消离页后继续编辑')
    await expect(page.getByRole('button', { name: '保存中…', exact: true })).toBeDisabled()
    save.release()
    await expect(page.getByRole('button', { name: '确认更新公开站点' })).toBeEnabled()
    await expect(page.getByText('已保存，公开页面刷新后生效。', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/studio$/)
    await expect(page.getByLabel('眉题', { exact: true })).toHaveValue('取消离页后继续编辑')
    expect(save.writes).toHaveLength(1)

    // The later edit must still be dirty, even after the older save completed.
    await page.locator('.workspace-sidebar').getByRole('link', { name: '公开网站' }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '继续编辑' }).click()
  })
}

test('a reopened navigation waits for the active save and needs its own confirmation', async ({ page }) => {
  const save = await holdStudioSave(page)
  const dialog = await editStudio(page)
  await dialog.getByRole('button', { name: '保存后离开' }).click()
  await expect.poll(() => save.writes.length).toBe(1)
  await dialog.getByRole('button', { name: '继续编辑' }).click()
  await page.getByLabel('眉题', { exact: true }).fill('新离页意图的修改')
  await page.locator('.workspace-sidebar').getByRole('link', { name: '设置', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '正在保存…' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: '放弃修改' })).toBeDisabled()
  expect(save.writes).toHaveLength(1)

  save.release()
  await expect(dialog.getByRole('button', { name: '保存后离开' })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: '放弃修改' })).toBeEnabled()
  await expect(page).toHaveURL(/\/admin\/studio$/)
  expect(save.writes).toHaveLength(1)
  await dialog.getByRole('button', { name: '保存后离开' }).click()
  await expect(page).toHaveURL(/\/admin\/settings(?:\?.*)?$/)
  expect(save.writes).toHaveLength(2)
  expect(save.writes[1].content.profile.eyebrow).toBe('新离页意图的修改')
})

test('confirmed save still navigates once the save succeeds', async ({ page }) => {
  const save = await holdStudioSave(page)
  const dialog = await editStudio(page)
  await dialog.getByRole('button', { name: '保存后离开' }).click()
  await expect.poll(() => save.writes.length).toBe(1)
  await expect(dialog).toBeVisible()
  save.release()
  await expect(page).toHaveURL(/\/$/)
  await expect(dialog).toHaveCount(0)
  expect(save.writes).toHaveLength(1)
})

test('failed save retains the draft and allows a deliberate retry', async ({ page }) => {
  let writes = 0
  await page.route('**/api/admin/studio', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    writes++
    await route.fulfill(writes === 1
      ? { status: 503, json: { error: '测试保存失败' } }
      : { json: { revision: route.request().postDataJSON().revision + 1 } })
  })
  const dialog = await editStudio(page)
  await dialog.getByRole('button', { name: '保存后离开' }).click()
  await expect(dialog.getByRole('alert')).toContainText('尚未保存成功')
  await expect(dialog.getByRole('button', { name: '保存后离开' })).toBeEnabled()
  await expect(page).toHaveURL(/\/admin\/studio$/)
  await dialog.getByRole('button', { name: '保存后离开' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(writes).toBe(2)
})

async function holdMutation(
  page: Page,
  endpoint: string,
  respond: (body: Record<string, unknown>, index: number) => unknown,
) {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  const writes: { method: string; body: Record<string, unknown> }[] = []
  await page.route(endpoint, async (route) => {
    if (route.request().method() === 'GET') return route.continue()
    const body = route.request().postDataJSON() as Record<string, unknown>
    if (['get', 'search', 'publication_get'].includes(String(body.action))) return route.continue()
    writes.push({ method: route.request().method(), body })
    const index = writes.length
    await pending
    await route.fulfill({ json: respond(body, index) })
  })
  // Library navigation records usage; keep those writes isolated too.
  await page.route('**/api/admin/library/usage', (route) =>
    route.request().method() === 'GET'
      ? route.continue()
      : route.fulfill({ json: { success: true } }),
  )
  return { release, writes }
}

async function cancelHeldSave(page: Page, writes: unknown[]) {
  const dialog = page.getByRole('dialog', { name: '有未保存的修改' })
  await dialog.getByRole('button', { name: '保存后离开' }).click()
  await expect.poll(() => writes.length).toBe(1)
  await dialog.getByRole('button', { name: '继续编辑' }).click()
  await expect(dialog).toHaveCount(0)
}

test('cancelled capture retains new input and updates the created item on retry', async ({ page }) => {
  const save = await holdMutation(page, '**/api/admin/library', (body, index) => ({
    item: { kind: 'note', id: 'cancelled-capture', revision: index, href: '/admin/library' },
    href: '/admin/library',
  }))
  await page.goto('/admin/library')
  await page.getByRole('button', { name: '手动收录', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '收录内容', exact: true })
  await editor.getByLabel('标题', { exact: true }).fill('提交的收录标题')
  await editor.getByRole('button', { name: '关闭收录内容' }).click()
  await cancelHeldSave(page, save.writes)
  await editor.getByLabel('标题', { exact: true }).fill('取消后的收录标题')
  save.release()
  await expect(editor.getByRole('button', { name: '保存到资料库' })).toBeEnabled()
  await expect(editor.getByLabel('标题', { exact: true })).toHaveValue('取消后的收录标题')
  await expect(page).toHaveURL(/\/admin\/library$/)
  expect(save.writes).toHaveLength(1)

  await editor.getByRole('button', { name: '关闭收录内容' }).click()
  const guard = page.getByRole('dialog', { name: '有未保存的修改' })
  await expect(guard).toBeVisible()
  await guard.getByRole('button', { name: '继续编辑' }).click()
  await editor.getByRole('button', { name: '保存到资料库' }).click()
  await expect(editor).toHaveCount(0)
  expect(save.writes).toHaveLength(2)
  expect(save.writes[1].body).toMatchObject({
    action: 'update', id: 'cancelled-capture', expected_revision: 1,
    changes: { title: '取消后的收录标题' },
  })
})

test('cancelled collection save keeps editing and reuses its saved identity', async ({ page }) => {
  const save = await holdMutation(page, '**/api/admin/library', (body, index) =>
    body.action === 'collection'
      ? { id: 'cancelled-collection' }
      : { collection: { id: 'cancelled-collection', title: body.title, description: body.description, revision: index, item_count: 0 } },
  )
  await page.goto('/admin/collections')
  await page.getByRole('button', { name: '新建资料集' }).click()
  let editor = page.getByRole('dialog', { name: '新建资料集', exact: true })
  await editor.getByLabel('名称', { exact: true }).fill('提交的资料集')
  await editor.getByRole('button', { name: '关闭新建资料集' }).click()
  await cancelHeldSave(page, save.writes)
  await editor.getByLabel('名称', { exact: true }).fill('取消后的资料集')
  save.release()
  editor = page.getByRole('dialog', { name: '编辑资料集', exact: true })
  await expect(editor.getByRole('button', { name: '保存资料集' })).toBeEnabled()
  await expect(editor.getByLabel('名称', { exact: true })).toHaveValue('取消后的资料集')
  await editor.getByRole('button', { name: '关闭编辑资料集' }).click()
  const guard = page.getByRole('dialog', { name: '有未保存的修改' })
  await expect(guard).toBeVisible()
  await guard.getByRole('button', { name: '保存后离开' }).click()
  await expect(editor).toHaveCount(0)
  await expect(guard).toHaveCount(0)
  expect(save.writes).toHaveLength(2)
  expect(save.writes[1].body).toMatchObject({
    action: 'collection_update', id: 'cancelled-collection', expected_revision: 1, title: '取消后的资料集',
  })
})

test('cancelled ManualSheet save keeps new input and later patches the created tool', async ({ page }) => {
  const save = await holdMutation(page, '**/api/tools', () => ({ success: true, id: 987654 }))
  await page.goto('/admin/tools')
  await page.getByRole('button', { name: '添加工具', exact: true }).click()
  let editor = page.getByRole('dialog', { name: '添加工具', exact: true })
  await editor.getByLabel('名称', { exact: true }).fill('提交的工具')
  await editor.getByRole('button', { name: '关闭添加工具' }).click()
  await cancelHeldSave(page, save.writes)
  await editor.getByLabel('名称', { exact: true }).fill('取消后的工具')
  save.release()
  editor = page.getByRole('dialog', { name: '编辑工具', exact: true })
  await expect(editor.getByRole('button', { name: '保存工作版本', exact: true })).toBeEnabled()
  await expect(editor.getByLabel('名称', { exact: true })).toHaveValue('取消后的工具')
  await editor.getByRole('button', { name: '保存工作版本', exact: true }).click()
  await expect(editor).toHaveCount(0)
  expect(save.writes).toHaveLength(2)
  expect(save.writes[0].method).toBe('POST')
  expect(save.writes[1]).toMatchObject({ method: 'PATCH', body: { id: 987654, name: '取消后的工具' } })
})

test('cancelled token creation retains the later name and still exposes the generated token', async ({ page }) => {
  const save = await holdMutation(page, '**/api/admin/tokens', () => ({ token: 'local-test-token-only' }))
  await page.goto('/admin/settings?section=connections')
  await page.getByRole('button', { name: '新增 Token', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '新增 Token', exact: true })
  await editor.getByLabel('用途名称').fill('提交的用途')
  await editor.getByRole('button', { name: '关闭新增 Token' }).click()
  await cancelHeldSave(page, save.writes)
  await editor.getByLabel('用途名称').fill('取消后新用途')
  save.release()
  await expect(editor.getByText('local-test-token-only', { exact: true })).toBeVisible()
  await expect(editor.getByLabel('用途名称')).toHaveValue('取消后新用途')
  await expect(editor.getByRole('button', { name: '生成 Token' })).toBeDisabled()
  await editor.getByRole('button', { name: '我已保存' }).click()
  await expect(editor.getByRole('button', { name: '生成 Token' })).toBeEnabled()
  await expect(editor.getByLabel('用途名称')).toHaveValue('取消后新用途')
  expect(save.writes).toHaveLength(1)
})

test('an unacknowledged token guards navigation even without later input', async ({ page }) => {
  const save = await holdMutation(page, '**/api/admin/tokens', () => ({ token: 'unacknowledged-local-token' }))
  await page.goto('/admin/settings?section=connections')
  await page.getByRole('button', { name: '新增 Token', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '新增 Token', exact: true })
  await editor.getByLabel('用途名称').fill('等待复制的用途')
  await editor.getByRole('button', { name: '关闭新增 Token' }).click()
  await cancelHeldSave(page, save.writes)
  save.release()
  await expect(editor.getByText('unacknowledged-local-token', { exact: true })).toBeVisible()
  await expect(editor.getByLabel('用途名称')).toHaveCount(0)

  // The token sheet stays modal: dispatch the link event to exercise the global guard.
  await page.locator('.workspace-sidebar a[href="/"]').dispatchEvent('click')
  const guard = page.getByRole('dialog', { name: '有未保存的修改' })
  await expect(guard).toBeVisible()
  await guard.getByRole('button', { name: '保存后离开' }).click()
  await expect(guard.getByRole('alert')).toContainText('我已保存')
  await guard.getByRole('button', { name: '放弃修改' }).click()
  await expect(guard.getByRole('alert')).toContainText('我已保存')
  expect(save.writes).toHaveLength(1)
  await expect(page).toHaveURL(/\/admin\/settings\?section=connections$/)
  await guard.getByRole('button', { name: '继续编辑' }).click()
  await expect(editor.getByText('unacknowledged-local-token', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: '我已保存' }).click()
  await page.locator('.workspace-sidebar').getByRole('link', { name: '公开网站' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(save.writes).toHaveLength(1)
})

for (const kind of ['text', 'image'] as const) {
  test(`cancelled ${kind} operation retains its created ID when list refresh fails`, async ({ page }) => {
    const endpoint = `/api/admin/${kind === 'text' ? 'ai-actions' : 'ai-image-actions'}`
    const save = await holdMutation(page, `**${endpoint}**`, () => ({ success: true, id: 876543 }))
    await page.route(`**${endpoint}`, (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      return route.fulfill(save.writes.length
        ? { status: 503, json: { error: '刷新列表失败' } }
        : { json: { actions: [] } })
    })
    for (const provider of ['ai-provider', 'ai-image-provider']) {
      await page.route(`**/api/admin/${provider}`, (route) => route.fulfill({ json: { profiles: [] } }))
    }
    await page.route('**/api/admin/model-status?**', (route) => route.fulfill({ json: {} }))
    await page.goto(`/admin/settings?section=actions&tab=${kind}`)
    await page.getByRole('button', { name: kind === 'text' ? '新增操作' : '新增提示' }).click()
    const title = kind === 'text' ? '编辑文本操作' : '编辑图片提示'
    const editor = page.getByRole('dialog', { name: title, exact: true })
    await editor.getByLabel('名称', { exact: true }).fill('提交的操作')
    await editor.getByLabel('用途', { exact: true }).fill('测试取消保存')
    await editor.getByLabel('操作标识', { exact: true }).fill('cancelled-operation')
    await editor.getByLabel('提示模板', { exact: true }).fill('保留最新文字')
    await editor.getByRole('button', { name: `关闭${title}` }).click()
    await cancelHeldSave(page, save.writes)
    await editor.getByLabel('名称', { exact: true }).fill('取消后编辑的操作')
    save.release()
    await expect(editor.getByRole('alert')).toContainText('刷新列表失败')
    await expect(editor.getByRole('button', { name: '保存修改' })).toBeEnabled()
    await expect(editor.getByLabel('名称', { exact: true })).toHaveValue('取消后编辑的操作')
    await editor.getByRole('button', { name: '保存修改' }).click()
    await expect(editor).toHaveCount(0)
    expect(save.writes).toHaveLength(2)
    expect(save.writes[0].method).toBe('POST')
    expect(save.writes[1]).toMatchObject({ method: 'PUT', body: { id: 876543, label: '取消后编辑的操作' } })
  })
}

test('assigning a saved tool ID alone does not leave the ManualSheet dirty', async ({ page }) => {
  const save = await holdMutation(page, '**/api/tools', () => ({ success: true, id: 987654 }))
  await page.goto('/admin/tools')
  await page.getByRole('button', { name: '添加工具', exact: true }).click()
  const initialEditor = page.getByRole('dialog', { name: '添加工具', exact: true })
  await initialEditor.getByLabel('名称', { exact: true }).fill('只保存一次的工具')
  await initialEditor.getByRole('button', { name: '关闭添加工具' }).click()
  await cancelHeldSave(page, save.writes)
  save.release()
  const editor = page.getByRole('dialog', { name: '编辑工具', exact: true })
  await expect(editor.getByRole('button', { name: '保存工作版本' })).toBeEnabled()
  await editor.getByRole('button', { name: '关闭编辑工具' }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '有未保存的修改' })).toHaveCount(0)
  expect(save.writes).toHaveLength(1)
})
