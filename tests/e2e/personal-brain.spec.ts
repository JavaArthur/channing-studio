import { test, expect, type BrowserContext, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

function localPassword() {
  const value =
    process.env.E2E_ADMIN_PASSWORD ||
    readFileSync('.dev.vars', 'utf8')
      .match(/^ADMIN_PASSWORD=(.*)$/m)?.[1]
      ?.trim()
  if (!value)
    throw new Error('Configure local ADMIN_PASSWORD in .dev.vars before running smoke tests.')
  return value
}
async function login(context: BrowserContext) {
  expect(
    (
      await context.request.post('/api/admin/login', { data: { password: localPassword() } })
    ).status(),
  ).toBe(200)
}
async function createPost(request: APIRequestContext, password?: string) {
  const slug = `smoke-${crypto.randomUUID()}`
  const response = await request.post('/api/posts', {
    data: {
      slug,
      title: '本地验收文章',
      content: 'PUBLIC_ORIGINAL',
      html: '<p>PUBLIC_ORIGINAL</p>',
      status: 'published',
      password,
    },
  })
  expect(response.status()).toBe(200)
  return slug
}

test('password gates protect HTML/RSC and private APIs reject guests', async ({
  context,
  browser,
}) => {
  await login(context)
  const secret = crypto.randomUUID()
  const slug = await createPost(context.request, secret)
  const guest = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  try {
    for (const suffix of ['', '?pwd=wrong']) {
      const response = await guest.request.get(`/${slug}${suffix}`)
      const html = await response.text()
      expect(html).not.toContain('PUBLIC_ORIGINAL')
      expect(html).not.toContain(secret)
    }
    expect(await (await guest.request.get(`/${slug}?pwd=${secret}`)).text()).toContain(
      'PUBLIC_ORIGINAL',
    )
    expect((await guest.request.get(`/api/admin/posts/${slug}`)).status()).toBe(401)
    expect((await guest.request.get('/api/admin/brain/projects?project=missing')).status()).toBe(
      401,
    )
    expect(
      (
        await guest.request.post('/api/admin/brain/notes', { data: { title: 'forbidden' } })
      ).status(),
    ).toBe(401)
    expect((await guest.request.put(`/api/admin/drafts/${slug}`, { data: {} })).status()).toBe(401)
    expect(
      (
        await guest.request.post('/api/admin/resources/tools/1/publication', {
          data: { publish: true },
        })
      ).status(),
    ).toBe(401)
    expect((await guest.request.put('/api/admin/studio', { data: {} })).status()).toBe(401)
  } finally {
    await context.request.delete(`/api/admin/posts/${slug}`)
    await guest.close()
  }
})

test('work copies do not publish, stale tabs conflict, and explicit publication updates the page', async ({
  page,
  context,
}) => {
  await login(context)
  const slug = await createPost(context.request)
  const second = await context.newPage()
  try {
    await page.goto(`/editor?edit=${slug}`)
    await page.locator('[contenteditable=true]').first().waitFor()
    await second.goto(`/editor?edit=${slug}`)
    await second.locator('[contenteditable=true]').first().waitFor()
    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/admin/drafts/') && r.request().method() === 'PUT',
    )
    await page.locator('[contenteditable=true]').first().fill('PRIVATE_WORKING_VERSION')
    expect((await saved).status()).toBe(200)
    const conflict = second.waitForResponse(
      (r) => r.url().includes('/api/admin/drafts/') && r.request().method() === 'PUT',
    )
    await second.locator('[contenteditable=true]').first().fill('STALE_WINDOW_EDIT')
    expect((await conflict).status()).toBe(409)
    await expect(second.getByText(/工作稿有版本冲突/)).toBeVisible()
    expect(await (await context.request.get(`/${slug}`)).text()).not.toContain(
      'PRIVATE_WORKING_VERSION',
    )
    await page.getByRole('button', { name: '展开发布选项' }).click()
    await page.getByRole('button', { name: '保存工作稿', exact: true }).click()
    expect(await (await context.request.get(`/${slug}`)).text()).toContain('PUBLIC_ORIGINAL')
    const published = page.waitForResponse(
      (r) => r.url().includes(`/api/admin/posts/${slug}`) && r.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: '更新文章', exact: true }).click()
    expect((await published).status()).toBe(200)
    expect(await (await context.request.get(`/${slug}`)).text()).toContain(
      'PRIVATE_WORKING_VERSION',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await second.close()
    await context.request.delete(`/api/admin/posts/${slug}`)
  }
})

test('collect, organize and associate privately; public snapshots and both color modes work', async ({
  page,
  context,
}) => {
  await login(context)
  const title = `本地流程验收 ${crypto.randomUUID().slice(0, 8)}`
  let projectId = ''
  let inboxId = ''
  try {
    await page.goto('/admin/inbox')
    await page.getByRole('button', { name: '收集一条想法', exact: true }).click()
    await page.getByLabel('标题', { exact: true }).fill(title)
    await page.getByLabel('内容', { exact: true }).fill('PRIVATE_NOTE_SMOKE')
    const created = page.waitForResponse(
      (r) => r.url().endsWith('/api/admin/brain/inbox') && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: '保存', exact: true }).click()
    inboxId = (await (await created).json()).id
    const item = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    await item.getByRole('button', { name: '整理为笔记', exact: true }).click()
    await expect(item.getByText('已整理', { exact: true })).toBeVisible()
    await page.goto('/admin/search?q=' + encodeURIComponent(title))
    await expect(page.getByRole('link').filter({ hasText: title }).first()).toBeVisible()
    const project = await context.request.post('/api/admin/brain/projects', {
      data: { title, description: 'PRIVATE_PROJECT_SMOKE', next_action: 'PRIVATE_NEXT_ACTION' },
    })
    projectId = (await project.json()).id
    await page.goto('/admin/projects?q=' + encodeURIComponent(title))
    await page.getByRole('button', { name: '相关资料 +' }).click()
    await page.getByLabel('按标题查找资料').fill(title)
    await page.getByRole('button', { name: '查找', exact: true }).click()
    await page.getByRole('button', { name: '关联', exact: true }).click()
    await expect(page.getByRole('button', { name: '取消关联', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '公开展示设置', exact: true }).click()
    await page.getByLabel('公开标题', { exact: true }).fill('Reviewed public project')
    await page.getByLabel('公开摘要', { exact: true }).fill('Reviewed summary only')
    await page.getByLabel('作品链接', { exact: true }).fill('https://example.com')
    await page.getByRole('button', { name: '确认发布这份内容', exact: true }).click()
    await expect(page.getByText('已公开 · 独立版本', { exact: true })).toBeVisible()
    const work = await (await context.request.get('/work')).text()
    expect(work).toContain('Reviewed public project')
    expect(work).not.toContain('PRIVATE_PROJECT_SMOKE')
    expect(work).not.toContain('PRIVATE_NEXT_ACTION')
    await page.getByRole('button', { name: '撤回公开', exact: true }).click()
    await expect(page.getByText('私密', { exact: true })).toBeVisible()
    expect(await (await context.request.get('/work')).text()).not.toContain(
      'Reviewed public project',
    )
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/admin', '/admin/projects']) {
        await page.goto(path)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
      }
    }
    await page.goto('/')
    await page.getByRole('button', { name: '切换到晚上模式' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark')
  } finally {
    if (projectId) {
      await context.request.post('/api/admin/brain/projects', {
        data: { id: projectId, action: 'publish', publish: false },
      })
      await context.request.post('/api/admin/brain/projects', {
        data: { id: projectId, action: 'archive' },
      })
    }
    if (inboxId) {
      await context.request.post('/api/admin/brain/inbox', {
        data: { id: inboxId, action: 'archive' },
      })
      await context.request.post('/api/admin/brain/notes', {
        data: { id: `inbox-${inboxId}`, action: 'archive' },
      })
    }
  }
})

test('draft URL edits survive reopening and article settings fit a phone',async({page,context})=>{
  await login(context)
  const slug=await createPost(context.request)
  try {
    expect((await context.request.put(`/api/admin/drafts/${slug}`,{data:{baseRevision:0,revision:0,title:'Draft title',content:'Draft body',html:'<p>Draft body</p>',new_slug:slug+'-next'}})).status()).toBe(200)
    await page.goto(`/editor?edit=${slug}`)
    await page.locator('[contenteditable=true]').first().waitFor()
    await page.getByRole('button',{name:'展开侧边栏',exact:true}).click()
    await expect(page.getByPlaceholder(slug,{exact:true})).toHaveValue(slug+'-next')
    await page.setViewportSize({width:390,height:844})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    expect(await (await context.request.get(`/${slug}`)).text()).toContain('PUBLIC_ORIGINAL')
  } finally { await context.request.delete(`/api/admin/posts/${slug}`) }
})
