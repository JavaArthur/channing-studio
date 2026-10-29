import { test, expect } from '@playwright/test'

test('mobile navigation closes with Escape and keeps the resource section active', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const toggle = page.getByRole('button', { name: '打开菜单', exact: true })
  await toggle.click()
  const navigation = page.getByRole('navigation', { name: '移动导航', exact: true })
  await expect(navigation).toBeVisible()
  await navigation.getByRole('link', { name: '作品', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(navigation).toBeHidden()
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await toggle.click()
  await navigation.getByRole('link', { name: '资源', exact: true }).click()
  await expect(page).toHaveURL(/\/tools$/)
  await expect(navigation).toBeHidden()
  await page.goto('/prompts')
  await page.getByRole('button', { name: '打开菜单', exact: true }).click()
  await expect(navigation.getByRole('link', { name: '资源', exact: true })).toHaveAttribute('data-active', '')
})

test('skip navigation moves keyboard focus into the current page', async ({ page }) => {
  for (const path of ['/', '/work', '/search']) {
    await page.goto(path)
    const skip = page.getByRole('link', { name: '跳到主要内容', exact: true })
    await skip.focus()
    await expect(skip).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
  }
})

test('search submits a shareable GET query and preserves it in the field', async ({ page }) => {
  await page.goto('/search')
  const query = page.locator('main input[name="q"]')
  const value = 'Hallmark query & 中文'
  await query.fill(value)
  await query.press('Enter')
  await expect(page).toHaveURL(url => url.pathname === '/search' && url.searchParams.get('q') === value)
  await expect(query).toHaveValue(value)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('搜索文章')
  await expect(page.locator('main a a')).toHaveCount(0)
})
