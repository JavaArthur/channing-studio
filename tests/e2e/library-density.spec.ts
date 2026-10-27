import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
const password = () =>
  process.env.E2E_ADMIN_PASSWORD ||
  readFileSync('.dev.vars', 'utf8')
    .match(/^ADMIN_PASSWORD=(.*)$/m)?.[1]
    ?.trim()
async function action(request: APIRequestContext, data: unknown) {
  const response = await request.post('/api/admin/library', { data })
  expect(response.status()).toBe(200)
  return response.json()
}
test('0/5/50/500 fixtures: compact density, pagination, restored scroll, responsive drawers and screenshots', async ({
  page,
  context,
}) => {
  test.setTimeout(240000)
  expect(
    (await context.request.post('/api/admin/login', { data: { password: password() } })).status(),
  ).toBe(200)
  const marker = 'density-' + crypto.randomUUID().slice(0, 8)
  const titles = [
    '把 Agent 的结果保存为可复用的上下文',
    '个人知识库的检索，比收录更重要',
    '构建可靠的自动化工作流',
    '一份适合长期维护的阅读笔记',
    '从文章里提取值得留下的判断',
    '设计工具箱：交互、原型与验证',
    '信息架构：用主题连接不同类型的内容',
    '小团队如何保持工程交付质量',
    '提示词的边界、输入与输出约定',
    '保存灵感，然后继续手头的事',
  ]
  const body =
    '## 从收录到取用\n\n保存内容的价值，在下一次需要时能够迅速找到。\n\n### 三个值得保留的部分\n\n- 原始来源，方便重新核对\n- 关键观点，保留自己的判断\n- 适用场景，知道什么时候再用\n\n> 资料留在这里，思考可以继续。\n\n```ts\nconst context = { source: "Studio", reusable: true }\n```\n\n| 内容 | 使用方式 |\n| --- | --- |\n| 文章摘录 | 查找依据 |\n| 工具 | 比较与取用 |'
  const records: { kind: string; id: string; revision: number; href: string }[] = []
  try {
    for (let batch = 0; batch < 500; batch += 10)
      await Promise.all(
        Array.from({ length: 10 }, async (_, offset) => {
          const i = batch + offset
          const type = (['note', 'article', 'tool', 'prompt', 'inspiration'] as const)[i % 5]
          const result = await action(context.request, {
            action: 'capture',
            input: {
              request_key: crypto.randomUUID(),
              type,
              title: titles[i % titles.length] + (i >= 10 ? ` · ${i + 1}` : ''),
              content: body,
              summary: '保留来源、关键观点和适用场景，在需要的时候重新取用。',
              source_url: `https://example.com/studio/${marker}/${i}`,
              topics: [
                '产品与工程',
                `${marker}-500`,
                ...(i < 50 ? [`${marker}-50`] : []),
                ...(i < 5 ? [`${marker}-5`] : []),
              ],
              saved_reason: '用于本地隔离环境的版面和交互验收。',
            },
          })
          records[i] = { ...result.item, href: result.href }
        }),
      )
    await mkdir('docs/screenshots', { recursive: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin/library')
    expect((await page.locator('.library-row').first().boundingBox())!.y).toBeLessThanOrEqual(144)
    for (const count of [0, 5, 50, 500]) {
      await page.goto('/admin/library?sort=title&topic=' + marker + '-' + count)
      await expect(page.locator('.library-view-options')).toContainText(`${count} 条`)
      await expect(page.locator('.library-row')).toHaveCount(Math.min(count, 30))
      await expect(page.getByRole('region', { name: '内容详情' })).toHaveCount(0)
      if (count === 0)
        await expect(page.getByRole('heading', { name: '这里还没有内容' })).toBeVisible()
      else {
        const density = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('.library-row')].map((el) =>
            el.getBoundingClientRect(),
          )
          return {
            top: rows[0].top,
            height: rows[0].height,
            visible: rows.filter((r) => r.bottom <= innerHeight).length,
            list: document.querySelector('.library-list')!.getBoundingClientRect().width,
            parent: document.querySelector('.library-split')!.getBoundingClientRect().width,
          }
        })
        expect(density.top).toBeLessThanOrEqual(190)
        expect(density.height).toBe(64)
        expect(density.list).toBe(density.parent)
        if (count >= 50) expect(density.visible).toBeGreaterThanOrEqual(10)
      }
      if (count === 50) await page.screenshot({ path: 'docs/screenshots/round3-library.png' })
      if (count === 500) {
        await page.getByRole('link', { name: '下一页', exact: true }).click()
        await expect(page.getByRole('navigation', { name: '资料分页' })).toContainText('第 2 页')
        await expect(page.locator('.library-row')).toHaveCount(30)
      }
    }
    await page.goto('/admin/library?topic=' + marker + '-50')
    await page.locator('.library-list').evaluate((el) => (el.scrollTop = 300))
    const previous = await page.locator('.library-list').evaluate((el) => el.scrollTop)
    await page.locator('.library-row-link').nth(6).click()
    await expect(page.getByRole('region', { name: '内容详情' })).toBeVisible()
    await page.getByRole('link', { name: '返回列表', exact: true }).click()
    expect(await page.locator('.library-list').evaluate((el) => el.scrollTop)).toBe(previous)
    await page.goto(
      '/admin/library?topic=' +
        marker +
        '-50&sort=title&item=' +
        records[0].kind +
        ':' +
        records[0].id,
    )
    await page.screenshot({ path: 'docs/screenshots/round3-detail.png' })
    await page.getByRole('button', { name: '编辑', exact: true }).click()
    await expect(page.getByRole('textbox', { name: '资料正文编辑器' })).toBeVisible()
    await page.screenshot({ path: 'docs/screenshots/round3-edit.png' })
    await page.getByRole('button', { name: '属性', exact: true }).click()
    await expect(page.getByRole('complementary', { name: '属性', exact: true })).toBeVisible()
    await page.screenshot({ path: 'docs/screenshots/round3-properties.png' })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    for (const width of [834, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(records[0].href)
      await expect(page.getByRole('region', { name: '内容详情' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await page.getByRole('button', { name: '属性', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: '属性', exact: true })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      await page.keyboard.press('Escape')
      if (width === 390) await page.screenshot({ path: 'docs/screenshots/round3-mobile.png' })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin/library')
    expect((await page.locator('.library-row').first().boundingBox())!.y).toBeLessThanOrEqual(144)
    await page.goto('/admin/settings?section=site')
    await page.screenshot({ path: 'docs/screenshots/round3-site-settings.png' })
    await page.goto('/admin/library?topic=' + marker + '-50')
    await page.getByRole('button', { name: '切换到晚上模式' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark')
    await page.screenshot({ path: 'docs/screenshots/round3-dark.png' })
  } finally {
    for (let i = 0; i < records.length; i += 10)
      await Promise.all(
        records
          .slice(i, i + 10)
          .filter(Boolean)
          .map(async (item) => {
            const current = (
              await action(context.request, { action: 'get', kind: item.kind, id: item.id })
            ).item
            await action(context.request, {
              action: 'update',
              kind: item.kind,
              id: item.id,
              expected_revision: current.revision,
              changes: { archived: true },
            })
          }),
      )
  }
})
