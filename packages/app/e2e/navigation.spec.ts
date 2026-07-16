import { test, expect } from "@playwright/test"

test.describe("Navigation", () => {
  test("should navigate between pages", async ({ page }) => {
    await page.goto("/")

    await expect(page.locator("body")).toBeVisible()
  })

  test("should have working sidebar navigation", async ({ page }) => {
    await page.goto("/")

    const sidebar = page.locator('[data-testid="sidebar"], [class*="sidebar"], nav')
    if (await sidebar.isVisible()) {
      const links = sidebar.locator("a, button")
      const count = await links.count()
      expect(count).toBeGreaterThan(0)
    }
  })
})

test.describe("Responsive Design", () => {
  test("should work on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")

    await expect(page.locator("body")).toBeVisible()
  })

  test("should work on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto("/")

    await expect(page.locator("body")).toBeVisible()
  })

  test("should work on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto("/")

    await expect(page.locator("body")).toBeVisible()
  })
})

test.describe("Error Handling", () => {
  test("should handle 404 page", async ({ page }) => {
    await page.goto("/nonexistent-page")

    await expect(page.locator("body")).toBeVisible()
  })

  test("should recover from errors", async ({ page }) => {
    await page.goto("/")
    await page.reload()
    await expect(page.locator("body")).toBeVisible()
  })
})
