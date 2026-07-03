import { describe, expect, test } from "bun:test"
import { parseFileOperations, extractJsonFromMarkdown, extractFileList } from "../../../src/cli/cmd/fix/parser"

describe("parseFileOperations", () => {
  test("parses modify operations", () => {
    const md = '### Changes for `src/index.ts`:\n```typescript\nconst x = 1\n```'
    const result = parseFileOperations(md)
    expect(result).toHaveLength(1)
    expect(result[0].file_path).toBe("src/index.ts")
    expect(result[0].action).toBe("modify")
    expect(result[0].code).toBe("const x = 1")
  })

  test("parses delete operations", () => {
    const md = "Delete file: `src/old.ts`."
    const result = parseFileOperations(md)
    expect(result).toHaveLength(1)
    expect(result[0].file_path).toBe("src/old.ts")
    expect(result[0].action).toBe("delete")
  })

  test("parses no_change operations", () => {
    const md = "No changes needed for `src/utils.ts`."
    const result = parseFileOperations(md)
    expect(result).toHaveLength(1)
    expect(result[0].file_path).toBe("src/utils.ts")
    expect(result[0].action).toBe("no_change")
  })

  test("parses multiple operations in order", () => {
    const md = [
      '### Changes for `a.ts`:\n```js\nconst a = 1\n```',
      "Delete file: `b.ts`.",
      "No changes needed for `c.ts`.",
    ].join("\n\n")
    const result = parseFileOperations(md)
    expect(result).toHaveLength(3)
    expect(result[0].file_path).toBe("a.ts")
    expect(result[1].file_path).toBe("b.ts")
    expect(result[2].file_path).toBe("c.ts")
  })

  test("returns empty for empty input", () => {
    expect(parseFileOperations("")).toEqual([])
    expect(parseFileOperations(null as any)).toEqual([])
  })

  test("returns empty for no matches", () => {
    expect(parseFileOperations("just some random text")).toEqual([])
  })

  test("handles nested paths", () => {
    const md = '### Changes for `src/cli/cmd/index.ts`:\n```ts\ncode\n```'
    const result = parseFileOperations(md)
    expect(result[0].file_path).toBe("src/cli/cmd/index.ts")
  })
})

describe("extractJsonFromMarkdown", () => {
  test("extracts JSON from code block", () => {
    const text = 'Some text\n```json\n{"key": "value"}\n```\nMore text'
    const result = extractJsonFromMarkdown(text)
    expect(result).toEqual({ key: "value" })
  })

  test("extracts bare JSON", () => {
    const result = extractJsonFromMarkdown('{"key": "value"}')
    expect(result).toEqual({ key: "value" })
  })

  test("returns null for invalid JSON", () => {
    expect(extractJsonFromMarkdown("not json")).toBeNull()
  })

  test("returns null for malformed code block", () => {
    expect(extractJsonFromMarkdown('```json\n{broken}\n```')).toBeNull()
  })

  test("extracts first JSON block when multiple exist", () => {
    const text = '```json\n{"a": 1}\n```\n```json\n{"b": 2}\n```'
    const result = extractJsonFromMarkdown(text)
    expect(result).toEqual({ a: 1 })
  })
})

describe("extractFileList", () => {
  test("extracts backtick paths", () => {
    const text = "Modify `src/index.ts` and `src/util.ts`"
    const result = extractFileList(text)
    expect(result).toEqual(["src/index.ts", "src/util.ts"])
  })

  test("extracts bare paths", () => {
    const text = "src/index.ts\nsrc/util.ts"
    const result = extractFileList(text)
    expect(result).toEqual(["src/index.ts", "src/util.ts"])
  })

  test("deduplicates files", () => {
    const text = "`src/index.ts` and again `src/index.ts`"
    const result = extractFileList(text)
    expect(result).toEqual(["src/index.ts"])
  })

  test("excludes HTTP URLs", () => {
    const text = "`src/index.ts` and https://example.com/file.ts"
    const result = extractFileList(text)
    expect(result).toEqual(["src/index.ts"])
  })

  test("returns empty for no matches", () => {
    expect(extractFileList("no files here")).toEqual([])
  })
})
