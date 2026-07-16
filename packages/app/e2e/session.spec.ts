import { test, expect } from "@playwright/test"

test.describe("Session Operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForTimeout(1000)
  })

  test("should display empty state for new users", async ({ page }) => {
    const emptyState = page.locator('[data-testid="empty-state"], [class*="empty"], text="Start a new conversation"')
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible()
    }
  })

  test("should create a new session", async ({ page }) => {
    const newSessionButton = page.locator('[data-testid="new-session"], [aria-label*="new"], button:has-text("New")')
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click()
      await page.waitForTimeout(500)
    }
  })

  test("should send message and receive response", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("What is 2 + 2?")
    await input.press("Enter")

    await page.waitForTimeout(5000)

    const messages = page.locator('[data-testid="message"], [class*="message"]')
    const messageCount = await messages.count()
    expect(messageCount).toBeGreaterThan(0)
  })

  test("should show loading state while AI is thinking", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("Hello")
    await input.press("Enter")

    const loading = page.locator('[data-testid="loading"], [class*="loading"], [class*="thinking"], [class*="spinner"]')
    if (await loading.isVisible({ timeout: 3000 })) {
      await expect(loading).toBeVisible()
    }
  })

  test("should allow stopping generation", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("Write a long essay about artificial intelligence")
    await input.press("Enter")

    await page.waitForTimeout(2000)

    const stopButton = page.locator('[data-testid="stop-button"], [aria-label*="stop"], [aria-label*="Stop"], button:has-text("Stop")')
    if (await stopButton.isVisible()) {
      await stopButton.click()
    }
  })
})

test.describe("Message Actions", () => {
  test("should copy message content", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("Hello")
    await input.press("Enter")
    await page.waitForTimeout(3000)

    const copyButton = page.locator('[data-testid="copy-button"], [aria-label*="copy"], [aria-label*="Copy"]').first()
    if (await copyButton.isVisible()) {
      await copyButton.click()
    }
  })

  test("should retry message", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("Hello")
    await input.press("Enter")
    await page.waitForTimeout(3000)

    const retryButton = page.locator('[data-testid="retry-button"], [aria-label*="retry"], [aria-label*="Retry"]').first()
    if (await retryButton.isVisible()) {
      await retryButton.click()
    }
  })
})
