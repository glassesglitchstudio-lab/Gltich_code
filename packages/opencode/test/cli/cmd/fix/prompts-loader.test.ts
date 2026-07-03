import { describe, expect, test } from "bun:test"
import { fillTemplate } from "../../../../src/cli/cmd/fix/prompts-loader"

describe("prompts-loader.ts", () => {
  describe("fillTemplate", () => {
    test("replaces single variable", () => {
      const result = fillTemplate("Hello {name}!", { name: "World" })
      expect(result).toBe("Hello World!")
    })

    test("replaces multiple variables", () => {
      const result = fillTemplate("{greet} {name}, you are {age}", {
        greet: "Hi",
        name: "Berkay",
        age: "25",
      })
      expect(result).toBe("Hi Berkay, you are 25")
    })

    test("replaces repeated variable", () => {
      const result = fillTemplate("{x} and {x} again", { x: "foo" })
      expect(result).toBe("foo and foo again")
    })

    test("handles missing variable (leaves placeholder)", () => {
      const result = fillTemplate("Hello {name}!", {})
      expect(result).toBe("Hello {name}!")
    })

    test("handles empty template", () => {
      expect(fillTemplate("", { x: "1" })).toBe("")
    })

    test("handles empty vars object", () => {
      expect(fillTemplate("no vars here", {})).toBe("no vars here")
    })

    test("replaces variables with special characters", () => {
      const result = fillTemplate("Code: {code}", { code: "const x = 1;" })
      expect(result).toBe("Code: const x = 1;")
    })

    test("replaces variables with newlines", () => {
      const result = fillTemplate("Body:\n{body}", { body: "line1\nline2" })
      expect(result).toBe("Body:\nline1\nline2")
    })

    test("handles template with no placeholders", () => {
      const result = fillTemplate("Just plain text", { x: "1" })
      expect(result).toBe("Just plain text")
    })

    test("handles variables with curly braces in value", () => {
      const result = fillTemplate("Code: {code}", { code: "if (x) { return; }" })
      expect(result).toBe("Code: if (x) { return; }")
    })
  })
})
