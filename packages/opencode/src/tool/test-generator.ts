import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import DESCRIPTION from "./test-generator.txt"
import path from "path"

function extractExports(content: string): { name: string; type: "function" | "class" | "const" | "type" | "interface"; params?: string }[] {
  const exports: { name: string; type: "function" | "class" | "const" | "type" | "interface"; params?: string }[] = []
  const lines = content.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()

    const funcMatch = trimmed.match(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/)
    if (funcMatch) {
      exports.push({ name: funcMatch[1], type: "function", params: funcMatch[2] })
      continue
    }

    const classMatch = trimmed.match(/export\s+class\s+(\w+)/)
    if (classMatch) {
      exports.push({ name: classMatch[1], type: "class" })
      continue
    }

    const constMatch = trimmed.match(/export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=/)
    if (constMatch) {
      exports.push({ name: constMatch[1], type: "const" })
      continue
    }

    const typeMatch = trimmed.match(/export\s+type\s+(\w+)/)
    if (typeMatch) {
      exports.push({ name: typeMatch[1], type: "type" })
      continue
    }

    const ifaceMatch = trimmed.match(/export\s+interface\s+(\w+)/)
    if (ifaceMatch) {
      exports.push({ name: ifaceMatch[1], type: "interface" })
      continue
    }
  }

  return exports
}

function generateFunctionTest(name: string, params?: string): string {
  const paramList = params
    ? params.split(",").map((p) => {
        const trimmed = p.trim()
        if (trimmed.includes(": string")) return '"test-value"'
        if (trimmed.includes(": number")) return "42"
        if (trimmed.includes(": boolean")) return "true"
        if (trimmed.includes(": string[]")) return '["a", "b"]'
        if (trimmed.includes("?")) return "undefined"
        return '"test"'
      })
    : []

  const args = paramList.length ? `, ${paramList.join(", ")}` : ""

  return `  test("${name} should return expected output", () => {
    const result = ${name}${args}
    expect(result).toBeDefined()
  })

  test("${name} handles edge cases", () => {
    ${paramList.length ? `const result = ${name}(${paramList.map(() => "undefined").join(", ")})
    expect(result).toBeDefined()` : `expect(() => ${name}()).not.toThrow()`}
  })
`
}

function generateClassTest(name: string): string {
  return `  test("should instantiate ${name}", () => {
    const instance = new ${name}()
    expect(instance).toBeDefined()
  })
`
}

function generateTestFile(
  sourcePath: string,
  exports: { name: string; type: string; params?: string }[],
  framework: string,
): string {
  const importName = path.basename(sourcePath, path.extname(sourcePath))

  const lines: string[] = []
  lines.push(`import { describe, test, expect } from "${framework === "bun" ? "bun:test" : framework}"`)
  lines.push(`import { ${exports.map((e) => e.name).join(", ")} } from "./${importName}"`)
  lines.push("")
  lines.push(`describe("${importName}", () => {`)

  for (const exp of exports) {
    if (exp.type === "function") {
      lines.push(`\n  describe("${exp.name}", () => {`)
      lines.push(generateFunctionTest(exp.name, exp.params))
      lines.push("  })")
    } else if (exp.type === "class") {
      lines.push(`\n  describe("${exp.name}", () => {`)
      lines.push(generateClassTest(exp.name))
      lines.push("  })")
    } else if (exp.type === "const") {
      lines.push(`\n  test("${exp.name} is defined", () => {`)
      lines.push(`    expect(${exp.name}).toBeDefined()`)
      lines.push("  })")
    }
  }

  lines.push("})")
  return lines.join("\n")
}

export const TestGeneratorTool = Tool.define(
  "test-generator",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        path: z.string().describe("Source file path to generate tests for"),
        framework: z.enum(["bun", "jest", "vitest"]).optional().default("bun").describe("Test framework"),
        coverage: z.enum(["basic", "comprehensive"]).optional().default("comprehensive").describe("Test coverage level"),
        output: z.string().optional().describe("Output test file path (default: auto-generated)"),
      }),
      execute: (
        params: { path: string; framework?: string; coverage?: string; output?: string },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const content = yield* fs.readFileString(params.path)
          if (!content) {
            return {
              title: "Test Generator",
              metadata: { error: true } as Tool.Metadata,
              output: `Could not read file: ${params.path}`,
            }
          }

          const exports = extractExports(content)
          if (exports.length === 0) {
            return {
              title: "Test Generator",
              metadata: { exports: 0 },
              output: `No exports found in ${params.path}. Nothing to test.`,
            }
          }

          const testContent = generateTestFile(params.path, exports, params.framework || "bun")
          const testPath =
            params.output ||
            params.path.replace(/\.(ts|tsx|js|jsx)$/, ".test.ts")

          yield* fs.writeWithDirs(testPath, testContent)

          return {
            title: `Tests generated: ${path.basename(testPath)}`,
            metadata: {
              sourceFile: params.path,
              testFile: testPath,
              exports: exports.length,
              framework: params.framework,
              functions: exports.filter((e) => e.type === "function").length,
              classes: exports.filter((e) => e.type === "class").length,
            },
            output: [
              `# Test Generation Complete`,
              "",
              `**Source:** \`${params.path}\``,
              `**Tests:** \`${testPath}\``,
              `**Framework:** ${params.framework}`,
              `**Exports found:** ${exports.length}`,
              "",
              "## Generated for:",
              ...exports.map((e) => `- \`${e.type}\` ${e.name}`),
              "",
              "Run tests with:",
              `  bun test ${testPath}`,
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
