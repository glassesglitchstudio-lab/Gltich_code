import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test"
import { parseIssueUrl } from "../../../../src/cli/cmd/fix/github"

describe("github.ts", () => {
  describe("parseIssueUrl", () => {
    test("parses valid GitHub issue URL", () => {
      const result = parseIssueUrl("https://github.com/user/repo/issues/123")
      expect(result).toEqual({ owner: "user", repo: "repo", number: 123 })
    })

    test("parses URL with hyphens in repo name", () => {
      const result = parseIssueUrl("https://github.com/my-org/my-repo/issues/42")
      expect(result).toEqual({ owner: "my-org", repo: "my-repo", number: 42 })
    })

    test("parses URL with dots in repo name", () => {
      const result = parseIssueUrl("https://github.com/user/repo.name/issues/1")
      expect(result).toEqual({ owner: "user", repo: "repo.name", number: 1 })
    })

    test("parses URL with underscores", () => {
      const result = parseIssueUrl("https://github.com/my_org/my_repo/issues/999")
      expect(result).toEqual({ owner: "my_org", repo: "my_repo", number: 999 })
    })

    test("returns null for non-GitHub URL", () => {
      expect(parseIssueUrl("https://gitlab.com/user/repo/issues/123")).toBeNull()
    })

    test("returns null for GitHub URL without issues path", () => {
      expect(parseIssueUrl("https://github.com/user/repo/pull/123")).toBeNull()
    })

    test("returns null for incomplete URL", () => {
      expect(parseIssueUrl("https://github.com/user/repo")).toBeNull()
    })

    test("returns null for empty string", () => {
      expect(parseIssueUrl("")).toBeNull()
    })

    test("returns null for random string", () => {
      expect(parseIssueUrl("not a url at all")).toBeNull()
    })

    test("parses URL with subpath after issue number", () => {
      const result = parseIssueUrl("https://github.com/user/repo/issues/42#comment")
      expect(result).toEqual({ owner: "user", repo: "repo", number: 42 })
    })

    test("parses large issue numbers", () => {
      const result = parseIssueUrl("https://github.com/user/repo/issues/123456")
      expect(result).toEqual({ owner: "user", repo: "repo", number: 123456 })
    })
  })
})
