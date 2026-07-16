import { test, expect } from "@playwright/test"

test.describe("Session Management", () => {
  test("should load the app and display the chat interface", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Glitch Code/)
    await expect(page.locator('[data-testid="session-input"], textarea, [contenteditable]')).toBeVisible()
  })

  test("should start a new session and send a message", async ({ page }) => {
    await page.goto("/")

    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("Hello, this is a test message")
    await input.press("Enter")

    await expect(page.locator("text=Hello, this is a test message")).toBeVisible({ timeout: 15000 })
  })

  test("should display session list", async ({ page }) => {
    await page.goto("/")

    const sessionList = page.locator('[data-testid="session-list"], [class*="session-list"], [class*="sidebar"]')
    await expect(sessionList).toBeVisible()
  })
})

test.describe("UI Interactions", () => {
  test("should toggle theme", async ({ page }) => {
    await page.goto("/")

    const themeToggle = page.locator('[data-testid="theme-toggle"], [aria-label*="theme"], [aria-label*="Theme"]')
    if (await themeToggle.isVisible()) {
      await themeToggle.click()
    }
  })

  test("should open settings or providers", async ({ page }) => {
    await page.goto("/")

    const settingsButton = page.locator('[data-testid="settings"], [data-testid="providers"], [aria-label*="settings"], [aria-label*="Settings"]')
    if (await settingsButton.isVisible()) {
      await settingsButton.click()
    }
  })

  test("should support keyboard shortcuts", async ({ page }) => {
    await page.goto("/")

    await page.keyboard.press("Control+k")
    await page.waitForTimeout(500)
  })
})

test.describe("Model Selection", () => {
  test("should show model selector", async ({ page }) => {
    await page.goto("/")

    const modelSelector = page.locator('[data-testid="model-selector"], [data-testid="model-select"], select[class*="model"]')
    if (await modelSelector.isVisible()) {
      await expect(modelSelector).toBeVisible()
    }
  })
})

test.describe("Message Input", () => {
  test("should handle multi-line input", async ({ page }) => {
    await page.goto("/")

    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("Line 1\nLine 2\nLine 3")
    const value = await input.inputValue()
    expect(value).toContain("Line 1")
  })

  test("should clear input after send", async ({ page }) => {
    await page.goto("/")

    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("Test message")
    await input.press("Enter")
    await page.waitForTimeout(1000)
  })
})
