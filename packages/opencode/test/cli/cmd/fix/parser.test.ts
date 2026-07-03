import { describe, expect, test } from "bun:test"
import { parseFileOperations, extractJsonFromMarkdown, extractFileList } from "../../../../src/cli/cmd/fix/parser"

describe("parser.ts", () => {
  describe("parseFileOperations", () => {
    test("parses single modify operation", () => {
      const md = '### Changes for `src/index.ts`:\n```typescript\nconst x = 1\n```'
      const result = parseFileOperations(md)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        file_path: "src/index.ts",
        action: "modify",
        code: "const x = 1",
      })
    })

    test("parses multiple modify operations", () => {
      const md = [
        '### Changes for `src/a.ts`:\n```typescript\nconst a = 1\n```',
        '### Changes for `src/b.ts`:\n```typescript\nconst b = 2\n```',
      ].join("\n\n")
      const result = parseFileOperations(md)
      expect(result).toHaveLength(2)
      expect(result[0].file_path).toBe("src/a.ts")
      expect(result[1].file_path).toBe("src/b.ts")
    })

    test("parses delete operation", () => {
      const md = "Delete file: `src/old.ts`"
      const result = parseFileOperations(md)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        file_path: "src/old.ts",
        action: "delete",
      })
    })

    test("parses no_change operation", () => {
      const md = "No changes needed for `src/utils.ts`."
      const result = parseFileOperations(md)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        file_path: "src/utils.ts",
        action: "no_change",
      })
    })

    test("parses mixed operations in order", () => {
      const md = [
        '### Changes for `src/a.ts`:\n```typescript\nconst a = 1\n```',
        "Delete file: `src/old.ts`",
        '### Changes for `src/b.ts`:\n```typescript\nconst b = 2\n```',
        "No changes needed for `src/skip.ts`.",
      ].join("\n\n")
      const result = parseFileOperations(md)
      expect(result).toHaveLength(4)
      expect(result[0].action).toBe("modify")
      expect(result[1].action).toBe("delete")
      expect(result[2].action).toBe("modify")
      expect(result[3].action).toBe("no_change")
    })

    test("returns empty array for empty input", () => {
      expect(parseFileOperations("")).toEqual([])
    })

    test("returns empty array for null input", () => {
      expect(parseFileOperations(null as any)).toEqual([])
    })

    test("returns empty array when no patterns match", () => {
      expect(parseFileOperations("Just some random text")).toEqual([])
    })
  })

  describe("extractJsonFromMarkdown", () => {
    test("extracts JSON from code block", () => {
      const md = '```json\n{"key": "value"}\n```'
      const result = extractJsonFromMarkdown(md)
      expect(result).toEqual({ key: "value" })
    })

    test("extracts bare JSON object", () => {
      const result = extractJsonFromMarkdown('{"key": "value"}')
      expect(result).toEqual({ key: "value" })
    })

    test("returns null for invalid JSON", () => {
      expect(extractJsonFromMarkdown("not json")).toBeNull()
    })

    test("returns null for invalid JSON in code block", () => {
      expect(extractJsonFromMarkdown("```json\n{invalid}\n```")).toBeNull()
    })

    test("extracts JSON with nested objects", () => {
      const md = '```json\n{"a": {"b": 1}}\n```'
      const result = extractJsonFromMarkdown(md)
      expect(result).toEqual({ a: { b: 1 } })
    })

    test("extracts JSON with arrays", () => {
      const md = '```json\n{"items": [1, 2, 3]}\n```'
      const result = extractJsonFromMarkdown(md)
      expect(result).toEqual({ items: [1, 2, 3] })
    })

    test("returns null for empty string", () => {
      expect(extractJsonFromMarkdown("")).toBeNull()
    })

    test("returns null for null input", () => {
      expect(extractJsonFromMarkdown(null as any)).toBeNull()
    })

    test("extracts JSON ignoring surrounding text", () => {
      const md = 'Here is the result:\n```json\n{"ok": true}\n```\nDone.'
      const result = extractJsonFromMarkdown(md)
      expect(result).toEqual({ ok: true })
    })
  })

  describe("extractFileList", () => {
    test("extracts single file from backtick path", () => {
      const text = "Modify `src/index.ts`"
      const result = extractFileList(text)
      expect(result).toEqual(["src/index.ts"])
    })

    test("extracts multiple files", () => {
      const text = "Files: `src/a.ts`, `src/b.ts`, `src/c.ts`"
      const result = extractFileList(text)
      expect(result).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"])
    })

    test("deduplicates files", () => {
      const text = "`src/a.ts` and `src/a.ts` again"
      const result = extractFileList(text)
      expect(result).toEqual(["src/a.ts"])
    })

    test("extracts bare file paths", () => {
      const text = "src/index.ts\nsrc/utils.ts"
      const result = extractFileList(text)
      expect(result).toEqual(["src/index.ts", "src/utils.ts"])
    })

    test("filters out URLs", () => {
      const text = "`src/a.ts` and https://example.com/file.ts"
      const result = extractFileList(text)
      expect(result).toEqual(["src/a.ts"])
    })

    test("returns empty array for no matches", () => {
      expect(extractFileList("No files mentioned")).toEqual([])
    })

    test("returns empty array for empty string", () => {
      expect(extractFileList("")).toEqual([])
    })

    test("extracts files with extensions", () => {
      const text = "`package.json`, `tsconfig.json`, `src/main.ts`"
      const result = extractFileList(text)
      expect(result).toEqual(["package.json", "tsconfig.json", "src/main.ts"])
    })
  })
})
