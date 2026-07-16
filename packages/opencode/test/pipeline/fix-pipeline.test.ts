import { describe, it, expect, beforeEach, vi } from "bun:test"
import { parseIssueUrl } from "../../src/cli/cmd/fix/github"
import { parseFileOperations, extractJsonFromMarkdown, extractFileList } from "../../src/cli/cmd/fix/parser"
import { parseReviewResponse } from "../../src/cli/cmd/fix/index"
import { loadPrompt, fillTemplate } from "../../src/cli/cmd/fix/prompts-loader"

describe("Fix Pipeline - 7 Fazli Entegrasyon Testi", () => {
  describe("Faz 1: Issue Triage", () => {
    it("should parse valid GitHub issue URL", () => {
      const result = parseIssueUrl("https://github.com/owner/repo/issues/123")
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        number: 123,
      })
    })

    it("should return null for invalid URL", () => {
      expect(parseIssueUrl("https://github.com/owner/repo")).toBeNull()
      expect(parseIssueUrl("invalid-url")).toBeNull()
      expect(parseIssueUrl("")).toBeNull()
    })

    it("should handle URL with extra path segments", () => {
      const result = parseIssueUrl("https://github.com/owner/repo/issues/456/comments")
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        number: 456,
      })
    })
  })

  describe("Faz 2: Planning - Prompt Templates", () => {
    it("should load triager prompt", () => {
      const prompt = loadPrompt("triager")
      expect(prompt).toBeTruthy()
      expect(typeof prompt).toBe("string")
      expect(prompt.length).toBeGreaterThan(0)
    })

    it("should load planner prompt", () => {
      const prompt = loadPrompt("planner")
      expect(prompt).toBeTruthy()
      expect(typeof prompt).toBe("string")
    })

    it("should load file-discovery prompt", () => {
      const prompt = loadPrompt("file-discovery")
      expect(prompt).toBeTruthy()
    })

    it("should load code-proposer prompt", () => {
      const prompt = loadPrompt("code-proposer")
      expect(prompt).toBeTruthy()
    })

    it("should load reviewer prompts", () => {
      const technical = loadPrompt("technical-reviewer")
      const style = loadPrompt("style-reviewer")
      const security = loadPrompt("security-reviewer")
      expect(technical).toBeTruthy()
      expect(style).toBeTruthy()
      expect(security).toBeTruthy()
    })

    it("should fill template with variables", () => {
      const template = "Issue: {title}, Body: {body}"
      const result = fillTemplate(template, { title: "Test Issue", body: "Test body" })
      expect(result).toBe("Issue: Test Issue, Body: Test body")
    })

    it("should handle missing template variables", () => {
      const template = "Issue: {title}, Missing: {missing}"
      const result = fillTemplate(template, { title: "Test" })
      expect(result).toContain("Test")
      expect(result).toContain("{missing}")
    })

    it("should fill multiple same variables", () => {
      const template = "{x} and {x} again"
      const result = fillTemplate(template, { x: "hello" })
      expect(result).toBe("hello and hello again")
    })
  })

  describe("Faz 3: File Discovery - Parser", () => {
    it("should parse file operations from LLM output", () => {
      const output = `### Changes for \`src/index.ts\`:
\`\`\`typescript
export const x = 1
\`\`\`

### Changes for \`src/utils.ts\`:
\`\`\`typescript
export const y = 2
\`\`\`
`
      const result = parseFileOperations(output)
      expect(result).toHaveLength(2)
      expect(result[0].action).toBe("modify")
      expect(result[0].file_path).toBe("src/index.ts")
      expect(result[1].action).toBe("modify")
      expect(result[1].file_path).toBe("src/utils.ts")
    })

    it("should parse delete operations", () => {
      const output = "Delete file: `src/old.ts`"
      const result = parseFileOperations(output)
      expect(result).toHaveLength(1)
      expect(result[0].action).toBe("delete")
      expect(result[0].file_path).toBe("src/old.ts")
    })

    it("should handle empty operations", () => {
      const result = parseFileOperations("")
      expect(result).toHaveLength(0)
    })

    it("should extract JSON from markdown code blocks", () => {
      const text = 'Here is the result:\n```json\n{"key": "value", "number": 42}\n```\nDone.'
      const result = extractJsonFromMarkdown(text)
      expect(result).toEqual({ key: "value", number: 42 })
    })

    it("should extract full text as JSON if valid", () => {
      const text = '{"key": "value", "number": 42}'
      const result = extractJsonFromMarkdown(text)
      expect(result).toEqual({ key: "value", number: 42 })
    })

    it("should return null for no JSON", () => {
      const result = extractJsonFromMarkdown("No JSON here")
      expect(result).toBeNull()
    })

    it("should extract file list from backtick format", () => {
      const text = `
Modified files:
- \`src/index.ts\`
- \`src/utils.ts\`
- \`test/index.test.ts\`
`
      const files = extractFileList(text)
      expect(files).toContain("src/index.ts")
      expect(files).toContain("src/utils.ts")
      expect(files).toContain("test/index.test.ts")
    })

    it("should extract file list from plain paths", () => {
      const text = `
src/index.ts
src/utils.ts
`
      const files = extractFileList(text)
      expect(files).toContain("src/index.ts")
      expect(files).toContain("src/utils.ts")
    })

    it("should not duplicate files", () => {
      const text = `\`src/index.ts\` and src/index.ts`
      const files = extractFileList(text)
      expect(files.filter((f) => f === "src/index.ts")).toHaveLength(1)
    })

    it("should skip HTTP URLs", () => {
      const text = "`http://example.com/file.ts`"
      const files = extractFileList(text)
      expect(files).toHaveLength(0)
    })
  })

  describe("Faz 5: Review & Revision - Review Parser", () => {
    it("should parse approved review from JSON", () => {
      const reviewText = `
\`\`\`json
{
  "verdict": "LGTM",
  "score": 90,
  "feedback": "Code looks good",
  "suggestions": ["Add error handling"],
  "issues": []
}
\`\`\`
`
      const result = parseReviewResponse(reviewText)
      expect(result.approved).toBe(true)
      expect(result.score).toBe(90)
      expect(result.suggestions).toContain("Add error handling")
    })

    it("should parse rejected review", () => {
      const reviewText = `
\`\`\`json
{
  "verdict": "needs changes",
  "score": 40,
  "feedback": "Security issues found",
  "issues": [
    {"file": "src/auth.ts", "line": 42, "message": "SQL injection", "severity": "error"}
  ]
}
\`\`\`
`
      const result = parseReviewResponse(reviewText)
      expect(result.approved).toBe(false)
      expect(result.score).toBe(40)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].severity).toBe("error")
    })

    it("should parse bare JSON review", () => {
      const reviewText = '{"verdict": "safe", "score": 75, "feedback": "OK"}'
      const result = parseReviewResponse(reviewText)
      expect(result.approved).toBe(true)
      expect(result.score).toBe(75)
    })

    it("should handle text-only review", () => {
      const reviewText = "This code is LGTM and looks safe"
      const result = parseReviewResponse(reviewText)
      expect(result.approved).toBe(true)
    })

    it("should handle empty review", () => {
      const result = parseReviewResponse("")
      expect(result.approved).toBe(false)
      expect(result.score).toBe(0)
    })

    it("should clamp score to 0-100", () => {
      const reviewText = '{"verdict": "safe", "score": 150}'
      const result = parseReviewResponse(reviewText)
      expect(result.score).toBe(100)

      const reviewText2 = '{"verdict": "safe", "score": -10}'
      const result2 = parseReviewResponse(reviewText2)
      expect(result2.score).toBe(0)
    })

    it("should handle Turkish verdict keywords", () => {
      const reviewText = '{"verdict": "guvenli", "score": 80}'
      const result = parseReviewResponse(reviewText)
      expect(result.approved).toBe(true)
    })

    it("should handle 'no issues' verdict", () => {
      const reviewText = '{"verdict": "no issues", "score": 85}'
      const result = parseReviewResponse(reviewText)
      expect(result.approved).toBe(true)
    })

    it("should parse issues array", () => {
      const reviewText = `
\`\`\`json
{
  "verdict": "needs changes",
  "score": 60,
  "issues": [
    {"file": "a.ts", "line": 10, "message": "Bug", "severity": "error"},
    {"file": "b.ts", "line": 20, "message": "Warning", "severity": "warning"},
    {"file": "c.ts", "line": 30, "message": "Info", "severity": "info"}
  ]
}
\`\`\`
`
      const result = parseReviewResponse(reviewText)
      expect(result.issues).toHaveLength(3)
      expect(result.issues[0].severity).toBe("error")
      expect(result.issues[1].severity).toBe("warning")
      expect(result.issues[2].severity).toBe("info")
    })

    it("should default invalid severity to info", () => {
      const reviewText = `
\`\`\`json
{
  "verdict": "safe",
  "issues": [{"file": "a.ts", "line": 1, "message": "test", "severity": "unknown"}]
}
\`\`\`
`
      const result = parseReviewResponse(reviewText)
      expect(result.issues[0].severity).toBe("info")
    })
  })

  describe("Faz 6: Apply & Test - File Operations", () => {
    it("should parse multiple file operations in order", () => {
      const output = `### Changes for \`src/app.ts\`:
\`\`\`typescript
fixed code
\`\`\`

Delete file: \`src/old.ts\`

### Changes for \`src/new.ts\`:
\`\`\`typescript
new file
\`\`\`
`
      const ops = parseFileOperations(output)
      expect(ops).toHaveLength(3)
      expect(ops[0].action).toBe("modify")
      expect(ops[0].file_path).toBe("src/app.ts")
      expect(ops[1].action).toBe("delete")
      expect(ops[1].file_path).toBe("src/old.ts")
      expect(ops[2].action).toBe("modify")
      expect(ops[2].file_path).toBe("src/new.ts")
    })

    it("should preserve code content", () => {
      const output = "### Changes for `src/index.ts`:\n```\nconst x = 1\n```\n"
      const ops = parseFileOperations(output)
      expect(ops.length).toBeGreaterThan(0)
      expect(ops[0].code).toContain("const x = 1")
    })
  })

  describe("Pipeline Bütüncül Akış", () => {
    it("should have all 7 phase prompts", () => {
      const phases = [
        "triager",
        "planner",
        "file-discovery",
        "code-proposer",
        "technical-reviewer",
        "style-reviewer",
        "security-reviewer",
      ]

      for (const phase of phases) {
        const prompt = loadPrompt(phase)
        expect(prompt).toBeTruthy()
        expect(typeof prompt).toBe("string")
      }
    })

    it("should have additional utility prompts", () => {
      const utilityPrompts = ["change-explainer", "summary-comment", "code-proposer-debate"]

      for (const prompt of utilityPrompts) {
        const loaded = loadPrompt(prompt)
        expect(loaded).toBeTruthy()
      }
    })
  })
})
