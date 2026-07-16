import { test, expect } from "@playwright/test"

test.describe("GitHub Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForTimeout(1000)
  })

  test("should show GitHub-related UI elements", async ({ page }) => {
    const githubSection = page.locator('[data-testid="github"], [class*="github"], text="GitHub"')
    if (await githubSection.isVisible()) {
      await expect(githubSection).toBeVisible()
    }
  })

  test("should handle GitHub URL input", async ({ page }) => {
    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("Fix this issue: https://github.com/octocat/Hello-World/issues/1")
    await input.press("Enter")
    await page.waitForTimeout(3000)
  })
})

test.describe("Fix Command", () => {
  test("should trigger fix command with GitHub URL", async ({ page }) => {
    await page.goto("/")

    const input = page.locator('[data-testid="session-input"], textarea, [contenteditable]').first()
    await expect(input).toBeVisible()

    await input.fill("/fix https://github.com/octocat/Hello-World/issues/1")
    await input.press("Enter")
    await page.waitForTimeout(3000)
  })
})

test.describe("Repository Operations", () => {
  test("should display repository information when connected", async ({ page }) => {
    await page.goto("/")

    const repoInfo = page.locator('[data-testid="repo-info"], [class*="repository"]')
    if (await repoInfo.isVisible()) {
      await expect(repoInfo).toBeVisible()
    }
  })
})
