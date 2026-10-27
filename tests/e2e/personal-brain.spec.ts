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
    expect((await guest.request.post('/api/admin/library', { data: { action: 'handoff', items: [], instruction: '' } })).status()).toBe(401)
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
  const extensionWarnings: string[] = []
  page.on('console', message => { if (message.text().includes('Duplicate extension names')) extensionWarnings.push(message.text()) })
  try {
    await page.goto(`/editor?edit=${slug}`)
    await page.locator('[contenteditable=true]').first().waitFor()
    expect(extensionWarnings).toEqual([])
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
