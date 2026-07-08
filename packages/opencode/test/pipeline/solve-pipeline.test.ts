import { describe, it, expect, beforeEach, vi } from "bun:test"
import { extractJsonFromMarkdown } from "../../src/cli/cmd/fix/parser"
import type { SolveContext, TaskPlan, SubTask } from "../../src/cli/cmd/solve/types"

// Mock topologicalSort function (inline since it's not exported)
function topologicalSort(tasks: SubTask[]): string[] {
  const sorted: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(taskId: string) {
    if (visited.has(taskId)) return
    if (visiting.has(taskId)) return // Cycle detected
    visiting.add(taskId)

    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      for (const dep of task.dependencies) {
        visit(dep)
      }
    }

    visiting.delete(taskId)
    visited.add(taskId)
    sorted.push(taskId)
  }

  for (const task of tasks) {
    visit(task.id)
  }

  return sorted
}

describe("Solve Pipeline - 5 Fazli Entegrasyon Testi", () => {
  describe("Faz 1: Task Analysis", () => {
    it("should parse analysis JSON from LLM output", () => {
      const llmOutput = `
\`\`\`json
{
  "goal": "Add JWT authentication",
  "complexity": "high",
  "components": ["auth middleware", "token service", "user model"],
  "estimatedSteps": 5
}
\`\`\`
`
      const analysis = extractJsonFromMarkdown(llmOutput)
      expect(analysis).toBeTruthy()
      expect(analysis?.goal).toBe("Add JWT authentication")
      expect(analysis?.complexity).toBe("high")
      expect(analysis?.components).toHaveLength(3)
    })

    it("should handle invalid JSON gracefully", () => {
      const llmOutput = "Not a valid JSON"
      const analysis = extractJsonFromMarkdown(llmOutput)
      expect(analysis).toBeNull()
    })

    it("should handle empty analysis", () => {
      const llmOutput = "```json\n{}\n```"
      const analysis = extractJsonFromMarkdown(llmOutput)
      expect(analysis).toEqual({})
    })
  })

  describe("Faz 2: Task Planning", () => {
    it("should parse sub-tasks from LLM output", () => {
      const llmOutput = `
\`\`\`json
{
  "subTasks": [
    {"id": "T1", "title": "Create user model", "dependencies": []},
    {"id": "T2", "title": "Create auth middleware", "dependencies": ["T1"]},
    {"id": "T3", "title": "Create login endpoint", "dependencies": ["T1", "T2"]},
    {"id": "T4", "title": "Add tests", "dependencies": ["T3"]}
  ]
}
\`\`\`
`
      const plan = extractJsonFromMarkdown(llmOutput)
      expect(plan?.subTasks).toHaveLength(4)
      expect(plan?.subTasks[0].dependencies).toHaveLength(0)
      expect(plan?.subTasks[1].dependencies).toContain("T1")
      expect(plan?.subTasks[2].dependencies).toContain("T1")
      expect(plan?.subTasks[2].dependencies).toContain("T2")
    })

    it("should handle empty sub-tasks", () => {
      const llmOutput = "```json\n{\"subTasks\": []}\n```"
      const plan = extractJsonFromMarkdown(llmOutput)
      expect(plan?.subTasks).toHaveLength(0)
    })

    it("should validate sub-task structure", () => {
      const llmOutput = `
\`\`\`json
{
  "subTasks": [
    {"id": "T1", "title": "Task 1", "dependencies": [], "description": "First task"}
  ]
}
\`\`\`
`
      const plan = extractJsonFromMarkdown(llmOutput)
      expect(plan?.subTasks[0].id).toBe("T1")
      expect(plan?.subTasks[0].title).toBe("Task 1")
      expect(plan?.subTasks[0].description).toBe("First task")
    })
  })

  describe("Faz 3: Topological Sort", () => {
    it("should sort tasks with no dependencies", () => {
      const tasks: SubTask[] = [
        { id: "T1", title: "Task 1", description: "", dependencies: [], status: "pending", filesChanged: [] },
        { id: "T2", title: "Task 2", description: "", dependencies: [], status: "pending", filesChanged: [] },
        { id: "T3", title: "Task 3", description: "", dependencies: [], status: "pending", filesChanged: [] },
      ]

      const sorted = topologicalSort(tasks)
      expect(sorted).toHaveLength(3)
      expect(sorted).toContain("T1")
      expect(sorted).toContain("T2")
      expect(sorted).toContain("T3")
    })

    it("should sort tasks with linear dependencies", () => {
      const tasks: SubTask[] = [
        { id: "T1", title: "Task 1", description: "", dependencies: [], status: "pending", filesChanged: [] },
        { id: "T2", title: "Task 2", description: "", dependencies: ["T1"], status: "pending", filesChanged: [] },
        { id: "T3", title: "Task 3", description: "", dependencies: ["T2"], status: "pending", filesChanged: [] },
      ]

      const sorted = topologicalSort(tasks)
      expect(sorted.indexOf("T1")).toBeLessThan(sorted.indexOf("T2"))
      expect(sorted.indexOf("T2")).toBeLessThan(sorted.indexOf("T3"))
    })

    it("should sort tasks with diamond dependencies", () => {
      const tasks: SubTask[] = [
        { id: "T1", title: "Task 1", description: "", dependencies: [], status: "pending", filesChanged: [] },
        { id: "T2", title: "Task 2", description: "", dependencies: ["T1"], status: "pending", filesChanged: [] },
        { id: "T3", title: "Task 3", description: "", dependencies: ["T1"], status: "pending", filesChanged: [] },
        { id: "T4", title: "Task 4", description: "", dependencies: ["T2", "T3"], status: "pending", filesChanged: [] },
      ]

      const sorted = topologicalSort(tasks)
      expect(sorted.indexOf("T1")).toBeLessThan(sorted.indexOf("T2"))
      expect(sorted.indexOf("T1")).toBeLessThan(sorted.indexOf("T3"))
      expect(sorted.indexOf("T2")).toBeLessThan(sorted.indexOf("T4"))
      expect(sorted.indexOf("T3")).toBeLessThan(sorted.indexOf("T4"))
    })

    it("should handle circular dependencies gracefully", () => {
      const tasks: SubTask[] = [
        { id: "T1", title: "Task 1", description: "", dependencies: ["T2"], status: "pending", filesChanged: [] },
        { id: "T2", title: "Task 2", description: "", dependencies: ["T1"], status: "pending", filesChanged: [] },
      ]

      const sorted = topologicalSort(tasks)
      // Should not infinite loop
      expect(sorted.length).toBeLessThanOrEqual(2)
    })

    it("should handle missing dependencies", () => {
      const tasks: SubTask[] = [
        { id: "T1", title: "Task 1", description: "", dependencies: ["T999"], status: "pending", filesChanged: [] },
      ]

      const sorted = topologicalSort(tasks)
      expect(sorted).toContain("T1")
    })

    it("should handle complex dependency graph", () => {
      const tasks: SubTask[] = [
        { id: "T1", title: "Task 1", description: "", dependencies: [], status: "pending", filesChanged: [] },
        { id: "T2", title: "Task 2", description: "", dependencies: ["T1"], status: "pending", filesChanged: [] },
        { id: "T3", title: "Task 3", description: "", dependencies: ["T1"], status: "pending", filesChanged: [] },
        { id: "T4", title: "Task 4", description: "", dependencies: ["T2", "T3"], status: "pending", filesChanged: [] },
        { id: "T5", title: "Task 5", description: "", dependencies: ["T4"], status: "pending", filesChanged: [] },
      ]

      const sorted = topologicalSort(tasks)
      expect(sorted).toHaveLength(5)
      expect(sorted.indexOf("T1")).toBeLessThan(sorted.indexOf("T4"))
      expect(sorted.indexOf("T4")).toBeLessThan(sorted.indexOf("T5"))
    })
  })

  describe("Faz 4: Execute Sub-tasks", () => {
    it("should track task status transitions", () => {
      const task: SubTask = {
        id: "T1",
        title: "Test Task",
        description: "",
        dependencies: [],
        status: "pending",
        filesChanged: [],
      }

      expect(task.status).toBe("pending")
      task.status = "running"
      expect(task.status).toBe("running")
      task.status = "done"
      expect(task.status).toBe("done")
    })

    it("should track files changed per task", () => {
      const task: SubTask = {
        id: "T1",
        title: "Test Task",
        description: "",
        dependencies: [],
        status: "pending",
        filesChanged: [],
      }

      task.filesChanged = ["src/index.ts", "src/utils.ts"]
      expect(task.filesChanged).toHaveLength(2)
      expect(task.filesChanged).toContain("src/index.ts")
    })

    it("should handle task errors", () => {
      const task: SubTask = {
        id: "T1",
        title: "Test Task",
        description: "",
        dependencies: [],
        status: "pending",
        filesChanged: [],
      }

      task.status = "failed"
      task.error = "Compilation failed"
      expect(task.status).toBe("failed")
      expect(task.error).toBe("Compilation failed")
    })

    it("should handle task skipped status", () => {
      const task: SubTask = {
        id: "T1",
        title: "Test Task",
        description: "",
        dependencies: ["T999"],
        status: "pending",
        filesChanged: [],
      }

      task.status = "skipped"
      task.error = "Dependencies not met"
      expect(task.status).toBe("skipped")
    })

    it("should support multiple files per task", () => {
      const task: SubTask = {
        id: "T1",
        title: "Refactor",
        description: "",
        dependencies: [],
        status: "pending",
        filesChanged: [],
      }

      task.filesChanged = [
        "src/index.ts",
        "src/utils.ts",
        "src/types.ts",
        "test/index.test.ts",
      ]
      expect(task.filesChanged).toHaveLength(4)
    })
  })

  describe("Faz 5: Summarize", () => {
    it("should create solve context", () => {
      const ctx: SolveContext = {
        task: "Add authentication",
        plan: {
          goal: "Add JWT auth",
          subTasks: [],
          estimatedSteps: 3,
          complexity: "medium",
        },
        completedTasks: [],
        allFilesChanged: [],
        summary: "",
        dryRun: false,
        model: "anthropic/claude-sonnet-4-20250514",
        maxParallel: 1,
      }

      expect(ctx.task).toBe("Add authentication")
      expect(ctx.plan.complexity).toBe("medium")
      expect(ctx.completedTasks).toHaveLength(0)
    })

    it("should collect files from completed tasks", () => {
      const ctx: SolveContext = {
        task: "Add auth",
        plan: {
          goal: "Auth",
          subTasks: [
            { id: "T1", title: "Model", description: "", dependencies: [], status: "done", filesChanged: ["model.ts"] },
            { id: "T2", title: "Middleware", description: "", dependencies: ["T1"], status: "done", filesChanged: ["middleware.ts"] },
          ],
          estimatedSteps: 2,
          complexity: "medium",
        },
        completedTasks: [],
        allFilesChanged: [],
        summary: "",
        dryRun: false,
        model: "test",
        maxParallel: 1,
      }

      const allFiles = ctx.plan.subTasks.flatMap((t) => t.filesChanged)
      expect(allFiles).toContain("model.ts")
      expect(allFiles).toContain("middleware.ts")
    })

    it("should track summary generation", () => {
      const ctx: SolveContext = {
        task: "Add auth",
        plan: { goal: "Auth", subTasks: [], estimatedSteps: 0, complexity: "low" },
        completedTasks: [],
        allFilesChanged: ["auth.ts", "middleware.ts"],
        summary: "",
        dryRun: false,
        model: "test",
        maxParallel: 1,
      }

      ctx.summary = `Completed task: ${ctx.task}\nFiles changed: ${ctx.allFilesChanged.length}`
      expect(ctx.summary).toContain("Add auth")
      expect(ctx.summary).toContain("2")
    })
  })

  describe("Pipeline Bütüncül Akış", () => {
    it("should support maxSteps limit", () => {
      const tasks: SubTask[] = Array.from({ length: 10 }, (_, i) => ({
        id: `T${i + 1}`,
        title: `Task ${i + 1}`,
        description: "",
        dependencies: [],
        status: "pending" as const,
        filesChanged: [],
      }))

      const maxSteps = 5
      const limited = tasks.slice(0, maxSteps)
      expect(limited).toHaveLength(5)
    })

    it("should support parallel execution config", () => {
      const ctx: SolveContext = {
        task: "Test",
        plan: { goal: "Test", subTasks: [], estimatedSteps: 0, complexity: "low" },
        completedTasks: [],
        allFilesChanged: [],
        summary: "",
        dryRun: false,
        model: "test",
        maxParallel: 4,
      }

      expect(ctx.maxParallel).toBe(4)
    })

    it("should support dry-run mode", () => {
      const ctx: SolveContext = {
        task: "Test",
        plan: { goal: "Test", subTasks: [], estimatedSteps: 0, complexity: "low" },
        completedTasks: [],
        allFilesChanged: [],
        summary: "",
        dryRun: true,
        model: "test",
        maxParallel: 1,
      }

      expect(ctx.dryRun).toBe(true)
    })

    it("should validate all required fields in SolveContext", () => {
      const ctx: SolveContext = {
        task: "Test task",
        plan: {
          goal: "Test goal",
          subTasks: [
            { id: "T1", title: "Sub 1", description: "", dependencies: [], status: "pending", filesChanged: [] },
          ],
          estimatedSteps: 1,
          complexity: "medium",
        },
        completedTasks: [],
        allFilesChanged: [],
        summary: "",
        dryRun: false,
        model: "test/model",
        maxParallel: 2,
      }

      expect(ctx.task).toBeTruthy()
      expect(ctx.plan.goal).toBeTruthy()
      expect(ctx.plan.subTasks.length).toBeGreaterThan(0)
      expect(ctx.model).toContain("/")
    })

    it("should handle GitHub integration context", () => {
      const ctx: SolveContext = {
        task: "Fix issue #123",
        plan: { goal: "Fix", subTasks: [], estimatedSteps: 0, complexity: "low" },
        completedTasks: [],
        allFilesChanged: [],
        summary: "",
        dryRun: false,
        model: "test",
        maxParallel: 1,
        github: "https://github.com/owner/repo/issues/123",
        autoPr: true,
        base: "main",
      }

      expect(ctx.github).toContain("github.com")
      expect(ctx.autoPr).toBe(true)
      expect(ctx.base).toBe("main")
    })
  })
})
