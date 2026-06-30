import { describe, expect, test } from "bun:test"
import { topologicalSort } from "../../../src/cli/cmd/solve"
import type { SubTask } from "../../../src/cli/cmd/solve/types"

function makeTask(id: string, deps: string[] = []): SubTask {
  return {
    id,
    title: `Task ${id}`,
    description: `Description for ${id}`,
    dependencies: deps,
    status: "pending",
    filesChanged: [],
  }
}

describe("topologicalSort", () => {
  test("sorts independent tasks", () => {
    const tasks = [makeTask("A"), makeTask("B"), makeTask("C")]
    const result = topologicalSort(tasks)
    expect(result).toEqual(["A", "B", "C"])
  })

  test("respects single dependency", () => {
    const tasks = [makeTask("B", ["A"]), makeTask("A"), makeTask("C")]
    const result = topologicalSort(tasks)
    expect(result.indexOf("A")).toBeLessThan(result.indexOf("B"))
  })

  test("respects chain dependencies", () => {
    const tasks = [makeTask("C", ["B"]), makeTask("B", ["A"]), makeTask("A")]
    const result = topologicalSort(tasks)
    expect(result).toEqual(["A", "B", "C"])
  })

  test("respects diamond dependencies", () => {
    const tasks = [
      makeTask("D", ["B", "C"]),
      makeTask("B", ["A"]),
      makeTask("C", ["A"]),
      makeTask("A"),
    ]
    const result = topologicalSort(tasks)
    expect(result.indexOf("A")).toBeLessThan(result.indexOf("B"))
    expect(result.indexOf("A")).toBeLessThan(result.indexOf("C"))
    expect(result.indexOf("B")).toBeLessThan(result.indexOf("D"))
    expect(result.indexOf("C")).toBeLessThan(result.indexOf("D"))
  })

  test("handles empty list", () => {
    expect(topologicalSort([])).toEqual([])
  })

  test("handles single task", () => {
    expect(topologicalSort([makeTask("A")])).toEqual(["A"])
  })

  test("handles cycle gracefully (skips visiting)", () => {
    const tasks = [
      makeTask("A", ["C"]),
      makeTask("B", ["A"]),
      makeTask("C", ["B"]),
    ]
    const result = topologicalSort(tasks)
    expect(result.length).toBe(3)
  })

  test("handles missing dependency gracefully", () => {
    const tasks = [makeTask("B", ["A"])]
    const result = topologicalSort(tasks)
    expect(result).toContain("B")
  })

  test("handles multiple roots", () => {
    const tasks = [
      makeTask("C", ["A", "B"]),
      makeTask("A"),
      makeTask("B"),
    ]
    const result = topologicalSort(tasks)
    expect(result.indexOf("A")).toBeLessThan(result.indexOf("C"))
    expect(result.indexOf("B")).toBeLessThan(result.indexOf("C"))
  })

  test("preserves order for same-level tasks", () => {
    const tasks = [makeTask("A"), makeTask("B"), makeTask("C")]
    const result = topologicalSort(tasks)
    expect(result).toEqual(["A", "B", "C"])
  })
})
