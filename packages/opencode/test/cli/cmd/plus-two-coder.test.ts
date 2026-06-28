import { describe, expect, test } from "bun:test"
import {
  evaluateSolution,
  buildInitialPrompt,
  buildDebatePrompt,
  buildCritiquePrompt,
  buildConsensusContext,
  selectModels,
  type CoderOpinion,
} from "../../../src/cli/cmd/plus-two-coder"

describe("plus-two-coder", () => {
  describe("evaluateSolution", () => {
    test("returns base score for empty solution", () => {
      expect(evaluateSolution("")).toBe(50)
    })

    test("adds points for code blocks", () => {
      expect(evaluateSolution("Here is the solution:\n```\nconsole.log('hello')\n```")).toBeGreaterThanOrEqual(60)
    })

    test("adds points for long solutions", () => {
      const longSolution = "a".repeat(600)
      expect(evaluateSolution(longSolution)).toBeGreaterThanOrEqual(70)
    })

    test("adds points for performance mentions", () => {
      expect(evaluateSolution("This solution has good performance")).toBeGreaterThanOrEqual(55)
    })

    test("adds points for security mentions", () => {
      expect(evaluateSolution("This handles security properly")).toBeGreaterThanOrEqual(55)
    })

    test("adds points for test mentions", () => {
      expect(evaluateSolution("Write a test for this")).toBeGreaterThanOrEqual(55)
    })

    test("caps at 100", () => {
      const perfectSolution = "```\n" + "a".repeat(600) + "\n```\nperformans guvenlik test error"
      expect(evaluateSolution(perfectSolution)).toBeLessThanOrEqual(100)
    })
  })

  describe("buildInitialPrompt", () => {
    test("includes the task", () => {
      const prompt = buildInitialPrompt("Build a REST API")
      expect(prompt).toContain("Build a REST API")
    })

    test("includes formatting instructions", () => {
      const prompt = buildInitialPrompt("test task")
      expect(prompt).toContain("## Cozum")
      expect(prompt).toContain("## Gerekce")
      expect(prompt).toContain("## Alternatifler")
    })
  })

  describe("buildDebatePrompt", () => {
    const opinions: CoderOpinion[] = [
      {
        model: "gpt-4o",
        provider: "openai",
        solution: "Use a for loop",
        critique: "Could be more functional",
        score: 65,
      },
      {
        model: "claude-sonnet",
        provider: "anthropic",
        solution: "Use map/filter",
        critique: "Good approach",
        score: 80,
      },
    ]

    test("includes all previous opinions", () => {
      const prompt = buildDebatePrompt("task", opinions, "context")
      expect(prompt).toContain("gpt-4o")
      expect(prompt).toContain("claude-sonnet")
      expect(prompt).toContain("Use a for loop")
      expect(prompt).toContain("Use map/filter")
    })

    test("includes task and context", () => {
      const prompt = buildDebatePrompt("my task", opinions, "my context")
      expect(prompt).toContain("my task")
      expect(prompt).toContain("my context")
    })
  })

  describe("buildCritiquePrompt", () => {
    test("includes the solution to critique", () => {
      const prompt = buildCritiquePrompt("task", "const x = 1")
      expect(prompt).toContain("const x = 1")
      expect(prompt).toContain("task")
    })

    test("includes scoring instructions", () => {
      const prompt = buildCritiquePrompt("task", "solution")
      expect(prompt).toContain("## Skor")
      expect(prompt).toContain("## Elestiri")
    })
  })

  describe("buildConsensusContext", () => {
    const opinions: CoderOpinion[] = [
      { model: "best", provider: "a", solution: "Best solution text", critique: "Great", score: 90 },
      { model: "mid", provider: "b", solution: "Mid solution", critique: "Okay", score: 70 },
      { model: "worst", provider: "c", solution: "Worst solution", critique: "Poor", score: 50 },
    ]

    test("identifies best and worst", () => {
      const ctx = buildConsensusContext(opinions)
      expect(ctx).toContain("En iyi cozum: a/best (Skor: 90)")
      expect(ctx).toContain("En zayif cozum: a/worst (Skor: 50)")
    })

    test("includes truncated solution and critique", () => {
      const ctx = buildConsensusContext(opinions)
      expect(ctx).toContain("Best solution text")
      expect(ctx).toContain("Great")
    })
  })

  describe("selectModels", () => {
    const providers = {
      openai: { models: { "gpt-4o": {}, "gpt-4o-mini": {} } },
      anthropic: { models: { "claude-sonnet-4-20250514": {} } },
    }

    test("uses provided models when valid", () => {
      const result = selectModels(["openai/gpt-4o", "anthropic/claude-sonnet-4-20250514"], providers)
      expect(result).toHaveLength(2)
      expect(result[0].providerID as string).toBe("openai")
      expect(result[0].modelID).toBe("gpt-4o")
    })

    test("auto-selects when no models provided", () => {
      const result = selectModels(undefined, providers)
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.length).toBeLessThanOrEqual(3)
    })

    test("limits to 3 models max", () => {
      const manyProviders = {
        a: { models: { m1: {}, m2: {} } },
        b: { models: { m3: {}, m4: {} } },
        c: { models: { m5: {}, m6: {} } },
      }
      const result = selectModels(undefined, manyProviders)
      expect(result.length).toBeLessThanOrEqual(3)
    })
  })
})
