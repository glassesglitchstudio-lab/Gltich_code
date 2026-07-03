import { describe, expect, test } from "bun:test"
import {
  evaluateSolution,
  parseLLMScore,
  buildInitialPrompt,
  buildDebatePrompt,
  buildCritiquePrompt,
  buildConsensusContext,
  selectModels,
  type CoderOpinion,
} from "../../../src/cli/cmd/plus-two-coder"

describe("plus-two-coder", () => {
  describe("parseLLMScore", () => {
    test("parses score from markdown header", () => {
      expect(parseLLMScore("## Skor: 85")).toBe(85)
    })

    test("parses score with single hash", () => {
      expect(parseLLMScore("# Skor: 42")).toBe(42)
    })

    test("parses score from mixed text", () => {
      const text = "Some analysis\n## Skor: 72\nMore text"
      expect(parseLLMScore(text)).toBe(72)
    })

    test("parses score zero", () => {
      expect(parseLLMScore("## Skor: 0")).toBe(0)
    })

    test("parses score 100", () => {
      expect(parseLLMScore("## Skor: 100")).toBe(100)
    })

    test("returns null for missing score", () => {
      expect(parseLLMScore("No score here at all")).toBeNull()
    })

    test("returns null for score > 100", () => {
      expect(parseLLMScore("## Skor: 150")).toBeNull()
    })

    test("returns null for negative score", () => {
      expect(parseLLMScore("## Skor: -5")).toBeNull()
    })

    test("returns null for non-numeric score", () => {
      expect(parseLLMScore("## Skor: abc")).toBeNull()
    })

    test("handles case insensitive", () => {
      expect(parseLLMScore("## SKOR: 60")).toBe(60)
    })

    test("parses score from JSON format", () => {
      expect(parseLLMScore('{"score": 85}')).toBe(85)
    })

    test("parses score from JSON with other fields", () => {
      expect(parseLLMScore('{"verdict": "LGTM", "score": 72, "issues": []}')).toBe(72)
    })

    test("parses score from JSON with spaces", () => {
      expect(parseLLMScore('{ "score" : 55 }')).toBe(55)
    })

    test("returns null for JSON without score", () => {
      expect(parseLLMScore('{"verdict": "LGTM"}')).toBeNull()
    })

    test("returns null for JSON score > 100", () => {
      expect(parseLLMScore('{"score": 150}')).toBeNull()
    })
  })

  describe("evaluateSolution", () => {
    test("returns base score for empty solution", () => {
      // 40 base - 10 (length < 100) - 5 (no ```/function/class) = 25
      expect(evaluateSolution("")).toBe(25)
    })

    test("adds points for code blocks", () => {
      const result = evaluateSolution("Here is the solution:\n```\nconsole.log('hello')\n```")
      // 40 + 8 (```) - 10 (length < 100) = 38
      expect(result).toBe(38)
    })

    test("adds points for long solutions", () => {
      const longSolution = "a".repeat(600)
      const result = evaluateSolution(longSolution)
      // 40 + 5 (>200) + 8 (>500) - 5 (no ```/function/class) = 48
      expect(result).toBe(48)
    })

    test("adds points for performance mentions", () => {
      const result = evaluateSolution("This solution has good performance")
      // 40 + 3 (performance) - 10 (length < 100) - 5 (no markers) = 28
      expect(result).toBe(28)
    })

    test("adds points for security mentions", () => {
      const result = evaluateSolution("This handles security properly")
      // 40 + 3 (security) - 10 (length < 100) - 5 (no markers) = 28
      expect(result).toBe(28)
    })

    test("adds points for test mentions", () => {
      const result = evaluateSolution("Write a test for this")
      // 40 + 3 (test) - 10 (length < 100) - 5 (no markers) = 28
      expect(result).toBe(28)
    })

    test("caps at 100", () => {
      const perfectSolution = "```\n" + "a".repeat(600) + "\n```\nperformans guvenlik test error"
      expect(evaluateSolution(perfectSolution)).toBeLessThanOrEqual(100)
    })

    test("uses LLM score when provided and valid", () => {
      expect(evaluateSolution("short", "## Skor: 90")).toBe(90)
    })

    test("uses LLM score 0", () => {
      expect(evaluateSolution("anything", "## Skor: 0")).toBe(0)
    })

    test("uses JSON format LLM score", () => {
      expect(evaluateSolution("short", '{"score": 85}')).toBe(85)
    })

    test("falls back to keyword when LLM score is null", () => {
      const result = evaluateSolution("``` test performance", null)
      // 40 + 8 (```) + 3 (performance) + 3 (test) - 10 (length < 100) = 44
      expect(result).toBe(44)
    })

    test("falls back to keyword when LLM score text has no score", () => {
      const result = evaluateSolution("``` test", "no score here")
      // 40 + 8 (```) + 3 (test) - 10 (length < 100) = 41
      expect(result).toBe(41)
    })

    test("falls back when LLM score is out of range", () => {
      const result = evaluateSolution("``` test", "## Skor: 200")
      // 40 + 8 (```) + 3 (test) - 10 (length < 100) = 41
      expect(result).toBe(41)
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
      expect(prompt).toContain("SKOR")
      expect(prompt).toContain("JSON")
      expect(prompt).toContain("score")
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
      expect(ctx).toContain("En zayif cozum: c/worst (Skor: 50)")
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
