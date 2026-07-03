import { describe, expect, test } from "bun:test"
import { topologicalSort } from "../../../src/cli/cmd/solve"
import type { SubTask } from "../../../src/cli/cmd/solve/types"

function makeTask(overrides: Partial<SubTask> & { id: string; dependencies?: string[] }): SubTask {
  return {
    title: overrides.id,
    description: "",
    dependencies: [],
    status: "pending",
    filesChanged: [],
    ...overrides,
  }
}

describe("solve", () => {
  describe("topologicalSort", () => {
    test("returns empty array for empty input", () => {
      expect(topologicalSort([])).toEqual([])
    })

    test("returns single task with no dependencies", () => {
      const tasks = [makeTask({ id: "T1" })]
      expect(topologicalSort(tasks)).toEqual(["T1"])
    })

    test("sorts two independent tasks", () => {
      const tasks = [makeTask({ id: "T1" }), makeTask({ id: "T2" })]
      const result = topologicalSort(tasks)
      expect(result).toContain("T1")
      expect(result).toContain("T2")
      expect(result).toHaveLength(2)
    })

    test("respects dependency order", () => {
      const tasks = [
        makeTask({ id: "T2", dependencies: ["T1"] }),
        makeTask({ id: "T1" }),
      ]
      const result = topologicalSort(tasks)
      expect(result.indexOf("T1")).toBeLessThan(result.indexOf("T2"))
    })

    test("handles chain of dependencies", () => {
      const tasks = [
        makeTask({ id: "T3", dependencies: ["T2"] }),
        makeTask({ id: "T1" }),
        makeTask({ id: "T2", dependencies: ["T1"] }),
      ]
      const result = topologicalSort(tasks)
      expect(result.indexOf("T1")).toBeLessThan(result.indexOf("T2"))
      expect(result.indexOf("T2")).toBeLessThan(result.indexOf("T3"))
    })

    test("handles diamond dependency", () => {
      const tasks = [
        makeTask({ id: "D", dependencies: ["B", "C"] }),
        makeTask({ id: "B", dependencies: ["A"] }),
        makeTask({ id: "C", dependencies: ["A"] }),
        makeTask({ id: "A" }),
      ]
      const result = topologicalSort(tasks)
      expect(result.indexOf("A")).toBeLessThan(result.indexOf("B"))
      expect(result.indexOf("A")).toBeLessThan(result.indexOf("C"))
      expect(result.indexOf("B")).toBeLessThan(result.indexOf("D"))
      expect(result.indexOf("C")).toBeLessThan(result.indexOf("D"))
    })

    test("handles circular dependency gracefully", () => {
      const tasks = [
        makeTask({ id: "T1", dependencies: ["T2"] }),
        makeTask({ id: "T2", dependencies: ["T1"] }),
      ]
      const result = topologicalSort(tasks)
      // Should not hang, should return both tasks
      expect(result).toHaveLength(2)
      expect(result).toContain("T1")
      expect(result).toContain("T2")
    })

    test("handles missing dependency gracefully", () => {
      const tasks = [
        makeTask({ id: "T1", dependencies: ["T_NONEXISTENT"] }),
      ]
      const result = topologicalSort(tasks)
      // missing dep gets visited and added, T1 still appears
      expect(result).toContain("T1")
      expect(result).toContain("T_NONEXISTENT")
      expect(result.indexOf("T_NONEXISTENT")).toBeLessThan(result.indexOf("T1"))
    })

    test("sorts complex dependency graph", () => {
      const tasks = [
        makeTask({ id: "T5", dependencies: ["T3", "T4"] }),
        makeTask({ id: "T1" }),
        makeTask({ id: "T2", dependencies: ["T1"] }),
        makeTask({ id: "T3", dependencies: ["T2"] }),
        makeTask({ id: "T4", dependencies: ["T2"] }),
      ]
      const result = topologicalSort(tasks)
      expect(result).toHaveLength(5)
      expect(result.indexOf("T1")).toBeLessThan(result.indexOf("T2"))
      expect(result.indexOf("T2")).toBeLessThan(result.indexOf("T3"))
      expect(result.indexOf("T2")).toBeLessThan(result.indexOf("T4"))
      expect(result.indexOf("T3")).toBeLessThan(result.indexOf("T5"))
      expect(result.indexOf("T4")).toBeLessThan(result.indexOf("T5"))
    })

    test("preserves all task IDs", () => {
      const tasks = [
        makeTask({ id: "A" }),
        makeTask({ id: "B", dependencies: ["A"] }),
        makeTask({ id: "C" }),
        makeTask({ id: "D", dependencies: ["B", "C"] }),
      ]
      const result = topologicalSort(tasks)
      expect(result.sort()).toEqual(["A", "B", "C", "D"])
    })
  })
})
