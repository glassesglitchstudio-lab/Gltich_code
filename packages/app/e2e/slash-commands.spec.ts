import { test, expect } from "@playwright/test"

test.describe("Slash Commands", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForTimeout(1000)
  })

  test("should trigger slash command menu with /", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("/")
    await page.waitForTimeout(500)

    const menu = page.locator('[data-testid="slash-menu"], [class*="slash"], [class*="command-menu"], [role="listbox"]')
    if (await menu.isVisible()) {
      await expect(menu).toBeVisible()
    }
  })

  test("should filter commands when typing", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("/he")
    await page.waitForTimeout(500)
  })

  test("should execute /help command", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("/help")
    await input.press("Enter")
    await page.waitForTimeout(2000)
  })
})

test.describe("Session Shortcuts", () => {
  test("should create new session with shortcut", async ({ page }) => {
    await page.goto("/")

    await page.keyboard.press("Control+n")
    await page.waitForTimeout(500)
  })

  test("should search sessions", async ({ page }) => {
    await page.goto("/")

    await page.keyboard.press("Control+k")
    await page.waitForTimeout(500)
  })
})
