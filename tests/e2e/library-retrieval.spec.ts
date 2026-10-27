import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
const password = () =>
  process.env.E2E_ADMIN_PASSWORD ||
  readFileSync('.dev.vars', 'utf8')
    .match(/^ADMIN_PASSWORD=(.*)$/m)?.[1]
    ?.trim()
async function login(c: BrowserContext) {
  expect(
    (await c.request.post('/api/admin/login', { data: { password: password() } })).status(),
  ).toBe(200)
}
async function action(r: APIRequestContext, data: unknown) {
  const res = await r.post('/api/admin/library', { data })
  expect(res.status(), await res.text()).toBe(200)
  return res.json()
}
async function usage(r: APIRequestContext, data: unknown) {
  const res = await r.post('/api/admin/library/usage', { data })
  expect(res.status()).toBe(200)
}
test.beforeEach(async ({ context }) => login(context))
test('ranked search, context preview and selection survive pagination and cancellation', async ({
  page,
  context,
}) => {
  const marker = 'retrieval-' + crypto.randomUUID().slice(0, 8),
    refs: { kind: string; id: string }[] = []
  try {
    for (let i = 0; i < 32; i++) {
      const saved = await action(context.request, {
        action: 'capture',
        input: {
          request_key: crypto.randomUUID(),
          type: i === 1 ? 'prompt' : 'note',
          title: `${marker} ${String(i).padStart(2, '0')}`,
          summary: '浏览器自动化',
          content: '前言\n'.repeat(120) + `  CONTEXT_${i}\n\n`,
          source_url: 'https://example.com/' + marker + '/' + i,
          topics: [marker],
        },
      })
      refs.push(saved.item)
    }
    await page.goto('/admin/library?q=' + marker + '&sort=title')
    await expect(page.locator('.library-row')).toHaveCount(30)
    await page.getByRole('checkbox', { name: `选择 ${marker} 00`, exact: true }).check()
    await page.getByRole('link', { name: '下一页', exact: true }).click()
    await page.getByRole('checkbox', { name: `选择 ${marker} 30`, exact: true }).check()
    await page.getByRole('button', { name: '复制给助手', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '复制给助手', exact: true })
    await dialog.getByLabel('你想继续做什么？').fill('比较两条资料的使用场景')
    await expect(dialog.locator('.handoff-preview')).toContainText('CONTEXT_0')
    await expect(dialog.locator('.handoff-preview')).toContainText('CONTEXT_30')
    await expect(dialog.locator('.handoff-preview')).toContainText(
      '直达链接：http://localhost:3000/admin/library/',
    )
    await page.screenshot({ path: 'docs/screenshots/round3-handoff.png' })
    await dialog.getByRole('button', { name: '关闭复制给助手' }).click()
    await expect(page.getByRole('button', { name: '已选 2 条' })).toBeVisible()
    await page.getByRole('button', { name: '复制给助手', exact: true }).click()
    await expect(dialog.getByLabel('你想继续做什么？')).toHaveValue('比较两条资料的使用场景')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await dialog.getByRole('button', { name: '复制给助手', exact: true }).click()
    await expect(dialog.getByRole('status')).toContainText('已复制内容')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('  CONTEXT_30\n\n')
    await dialog.getByRole('button', { name: '关闭复制给助手' }).click()
    await page.getByRole('button', { name: '取消全部选择' }).click()
    await page.getByRole('textbox', { name: '搜索资料内容' }).fill(marker + ' CONTEXT_7')
    await page.getByRole('button', { name: '提交搜索' }).click()
    await expect(page.locator('.library-row')).toHaveCount(1)
    await expect(page.locator('.library-row mark').last()).toHaveText('CONTEXT_7')
    await page.screenshot({ path: 'docs/screenshots/round3-search.png' })
    await page.getByRole('link', { name: '设置', exact: true }).click()
    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByRole('textbox', { name: '搜索资料内容' })).toBeFocused()
  } finally {
    for (const ref of refs) {
      const { item } = await action(context.request, { action: 'get', kind: ref.kind, id: ref.id })
      await action(context.request, {
        action: 'update',
        kind: ref.kind,
        id: ref.id,
        expected_revision: item.revision,
        changes: { archived: true },
      })
    }
  }
})
test('curated public version stays independent and concurrent publishing requires explicit reconciliation', async ({
  page,
  context,
}) => {
  const created = await action(context.request, {
    action: 'capture',
    input: {
      request_key: crypto.randomUUID(),
      type: 'tool',
      title: '公开版本验证',
      content: 'PRIVATE_BODY',
      summary: 'PRIVATE_SUMMARY',
      source_url: 'https://example.com/' + crypto.randomUUID(),
    },
  })
  let item = created.item
  try {
    item = (
      await action(context.request, {
        action: 'publish',
        kind: item.kind,
        id: item.id,
        expected_revision: item.revision,
        publish: true,
        fields: {
          title: 'Curated title',
          description: 'CURATED_PUBLIC',
          url: 'https://example.com/public',
        },
      })
    ).item
    await page.goto(created.href)
    await page.getByRole('button', { name: '更多操作', exact: true }).click()
    await page.getByRole('menuitem', { name: '编辑公开版本' }).click()
    const modal = page.getByRole('dialog', { name: '编辑公开版本' })
    await expect(modal.getByLabel('公开标题', { exact: true })).toHaveValue('Curated title')
    await modal.getByLabel('公开介绍').fill('LOCAL_PUBLIC_EDIT')
    const remote = (
      await action(context.request, {
        action: 'publish',
        kind: item.kind,
        id: item.id,
        expected_revision: item.revision,
        publish: true,
        fields: {
          title: 'Other tab',
          description: 'REMOTE_EDIT',
          url: 'https://example.com/public',
        },
      })
    ).item
    await modal.getByRole('button', { name: '确认发布这个版本' }).click()
    await expect(modal).toContainText('版本冲突')
    await expect(modal.getByLabel('公开介绍')).toHaveValue('LOCAL_PUBLIC_EDIT')
    await modal.getByRole('button', { name: '已核对，保留本地文案继续编辑' }).click()
    await modal.getByRole('button', { name: '确认发布这个版本' }).click()
    await expect(modal).toHaveCount(0)
    const publication = await action(context.request, {
      action: 'publication_get',
      kind: item.kind,
      id: item.id,
    })
    expect(publication.fields.description).toBe('LOCAL_PUBLIC_EDIT')
    expect(publication.revision).toBeGreaterThan(remote.revision)
    await page.getByRole('button', { name: '更多操作', exact: true }).click()
    await page.getByRole('menuitem', { name: '编辑公开版本' }).click()
    await modal.getByRole('button', { name: '撤回公开' }).click()
    await expect(modal).toHaveCount(0)
    const hidden = await action(context.request, {
      action: 'publication_get',
      kind: item.kind,
      id: item.id,
    })
    expect(hidden.published).toBe(false)
    expect(hidden.fields.description).toBe('LOCAL_PUBLIC_EDIT')
  } finally {
    item = (await action(context.request, { action: 'get', kind: item.kind, id: item.id })).item
    item = (
      await action(context.request, {
        action: 'publish',
        kind: item.kind,
        id: item.id,
        expected_revision: item.revision,
        publish: false,
        fields: { title: 'withdraw', description: '' },
      })
    ).item
    await action(context.request, {
      action: 'update',
      kind: item.kind,
      id: item.id,
      expected_revision: item.revision,
      changes: { archived: true },
    })
  }
})
test('manual settings protect close, navigation, failed saves and browser Back', async ({
  page,
}) => {
  await page.goto('/admin/settings?section=appearance')
  await page.getByRole('link', { name: '公开站点', exact: true }).click()
  const field = page.getByLabel('链接 1 名称'),
    original = await field.inputValue()
  await field.fill('未保存的名称')
  await page.getByRole('link', { name: '文本模型', exact: true }).click()
  const guard = page.getByRole('dialog', { name: '有未保存的修改' })
  await expect(guard).toBeVisible()
  await guard.getByRole('button', { name: '继续编辑' }).click()
  await expect(field).toHaveValue('未保存的名称')
  await page.route('**/api/admin/settings', (route) =>
    route.fulfill({ status: 500, json: { error: 'offline' } }),
  )
  await page.getByRole('link', { name: '文本模型', exact: true }).click()
  await guard.getByRole('button', { name: '保存后离开' }).click()
  await expect(guard.getByRole('alert')).toBeVisible()
  await guard.getByRole('button', { name: '继续编辑' }).click()
  await expect(field).toHaveValue('未保存的名称')
  await page.unroute('**/api/admin/settings')
  await page.evaluate(() => history.back())
  await expect(guard).toBeVisible()
  await guard.getByRole('button', { name: '继续编辑' }).click()
  await expect(field).toHaveValue('未保存的名称')
  await page.getByRole('link', { name: '外观', exact: true }).click()
  await guard.getByRole('button', { name: '放弃修改' }).click()
  await expect(page).toHaveURL(/section=appearance/)
  await page.getByRole('link', { name: '公开站点', exact: true }).click()
  await expect(field).toHaveValue(original)
  await page.getByRole('link', { name: '内容操作', exact: true }).click()
  await expect(page.locator('.operation-row')).toHaveCount(6)
  await expect(page.locator('.operation-row')).not.toContainText(['检查配置中…'])
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.screenshot({ path: 'docs/screenshots/round3-settings.png' })
  await page
    .locator('.operation-row')
    .first()
    .getByRole('button', { name: '编辑', exact: true })
    .click()
  const edit = page.getByRole('dialog', { name: '编辑文本操作' })
  await edit.getByLabel('提示模板').fill('UNSAVED TEMPLATE')
  await edit.getByRole('button', { name: '关闭编辑文本操作' }).click()
  await expect(guard).toBeVisible()
  await guard.getByRole('button', { name: '继续编辑' }).click()
  await expect(edit.getByLabel('提示模板')).toHaveValue('UNSAVED TEMPLATE')
  await edit.getByRole('button', { name: '关闭编辑文本操作' }).click()
  await guard.getByRole('button', { name: '放弃修改' }).click()
})
test('two independent sessions share pins and recent records, usage failure never blocks reading', async ({
  page,
  context,
  browser,
}) => {
  const second = await browser.newContext({ baseURL: 'http://localhost:3000' })
  await login(second)
  const created = await action(context.request, {
    action: 'capture',
    input: {
      request_key: crypto.randomUUID(),
      type: 'note',
      title: '跨设备阅读 ' + crypto.randomUUID().slice(0, 5),
      content: '## 正文\n\n在手机和电脑接着使用。',
    },
  })
  const group = await action(context.request, {
    action: 'collection',
    title: '持续研究 ' + crypto.randomUUID().slice(0, 5),
    description: '常用主题资料集',
  })
  try {
    await usage(context.request, { action: 'collection', id: group.id, pinned: true })
    const list = await (await second.request.get('/api/admin/library/usage')).json()
    expect(
      list.collections.some((c: { id: string; pinned: number }) => c.id === group.id && c.pinned),
    ).toBe(true)
    await page.goto(created.href)
    await expect
      .poll(async () => {
        const r = await action(second.request, { action: 'search', query: { recent: true } })
        return r.items.some((i: { id: string }) => i.id === created.item.id)
      })
      .toBe(true)
    const detail = await action(second.request, {
      action: 'get',
      kind: created.item.kind,
      id: created.item.id,
    })
    expect(detail.item.revision).toBe(created.item.revision)
    await page.getByRole('button', { name: '属性', exact: true }).click()
    await expect(page.getByRole('complementary', { name: '属性' })).toBeVisible()
    await expect(page.locator('.admin-overlay')).toHaveCount(0)
    await page.screenshot({ path: 'docs/screenshots/round3-properties.png' })
    await page.getByRole('button', { name: '关闭属性' }).click()
    await page.getByRole('link', { name: '全部内容', exact: true }).first().click()
    await page.screenshot({ path: 'docs/screenshots/round3-collections.png' })
    await page.route('**/api/admin/library/usage', async (route) => {
      if (route.request().method() === 'POST')
        await route.fulfill({ status: 500, json: { error: '使用记录暂未同步' } })
      else await route.continue()
    })
    await page.goto(created.href)
    await expect(page.locator('.usage-sync-error')).toBeVisible()
    await expect(page.locator('.library-prose')).toContainText('在手机和电脑接着使用')
    await page.unroute('**/api/admin/library/usage')
    await page.getByRole('button', { name: '重试同步' }).click()
    await expect(page.locator('.usage-sync-error')).toHaveCount(0)
    await usage(second.request, { action: 'clear', history: 'reads' })
    expect(
      (await action(context.request, { action: 'search', query: { recent: true } })).total,
    ).toBe(0)
  } finally {
    const { item } = await action(context.request, {
      action: 'get',
      kind: created.item.kind,
      id: created.item.id,
    })
    await action(context.request, {
      action: 'update',
      kind: item.kind,
      id: item.id,
      expected_revision: item.revision,
      changes: { archived: true },
    })
    const data = await (await context.request.get('/api/admin/library/usage')).json()
    const c = data.collections.find((x: { id: string }) => x.id === group.id)
    await action(context.request, {
      action: 'collection_update',
      id: c.id,
      expected_revision: c.revision,
      title: c.title,
      description: c.description,
      archived: true,
    })
    await second.close()
  }
})

test('logging out flushes private edits before clearing the session', async ({page, context}) => {
  const created = await action(context.request, {action:'capture',input:{request_key:crypto.randomUUID(),type:'prompt',title:'Logout autosave',content:'Before'}})
  try {
    await page.goto(created.href)
    await page.getByRole('button',{name:'编辑',exact:true}).click()
    await page.getByRole('textbox',{name:'正文（精确文本）'}).fill('Saved before logout  \n')
    await page.getByRole('button',{name:'退出登录'}).first().click()
    await expect(page).toHaveURL(/admin\/login/)
    await login(context)
    const {item} = await action(context.request,{action:'get',kind:created.item.kind,id:created.item.id})
    expect(item.content).toBe('Saved before logout  \n')
  } finally {
    await login(context)
    const {item} = await action(context.request,{action:'get',kind:created.item.kind,id:created.item.id})
    await action(context.request,{action:'update',kind:item.kind,id:item.id,expected_revision:item.revision,changes:{archived:true}})
  }
})
