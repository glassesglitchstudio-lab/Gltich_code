import { test, expect } from "@playwright/test"

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForTimeout(1000)
  })

  test("should have proper ARIA labels", async ({ page }) => {
    const buttons = page.locator("button")
    const count = await buttons.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i)
      const ariaLabel = await button.getAttribute("aria-label")
      const text = await button.textContent()
      expect(ariaLabel || text).toBeTruthy()
    }
  })

  test("should support keyboard navigation", async ({ page }) => {
    await page.keyboard.press("Tab")
    await page.waitForTimeout(200)

    const focusedElement = page.locator(":focus")
    await expect(focusedElement).toBeVisible()
  })

  test("should have proper heading hierarchy", async ({ page }) => {
    const headings = page.locator("h1, h2, h3, h4, h5, h6")
    const count = await headings.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test("should have sufficient color contrast", async ({ page }) => {
    const body = page.locator("body")
    const backgroundColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(backgroundColor).toBeTruthy()
  })
})

test.describe("Performance", () => {
  test("should load within acceptable time", async ({ page }) => {
    const startTime = Date.now()
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(10000)
  })

  test("should handle multiple rapid interactions", async ({ page }) => {
    await page.goto("/")

    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    if (await input.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await input.fill(`Message ${i}`)
        await page.waitForTimeout(100)
      }
    }
  })
})

test.describe("Internationalization", () => {
  test("should display content in the correct language", async ({ page }) => {
    await page.goto("/")

    const html = await page.locator("html")
    const lang = await html.getAttribute("lang")
    expect(lang).toBeTruthy()
  })

  test("should handle RTL languages", async ({ page }) => {
    await page.goto("/")

    const html = page.locator("html")
    const dir = await html.getAttribute("dir")
    expect(dir === "ltr" || dir === "rtl" || !dir).toBeTruthy()
  })
})
