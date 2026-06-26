import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveMimocodeHome } from "@glitchcode/shared/global"

describe("resolveMimocodeHome", () => {
  test("with GLITCHCODE_HOME set, resolves 4 subdirs under root", () => {
    const result = resolveMimocodeHome({
      GLITCHCODE_HOME: "/tmp/profile-a",
    })
    expect(result.mode).toBe("glitchcode_home")
    expect(result.root).toBe("/tmp/profile-a")
    expect(result.config).toBe(path.join("/tmp/profile-a", "config"))
    expect(result.data).toBe(path.join("/tmp/profile-a", "data"))
    expect(result.state).toBe(path.join("/tmp/profile-a", "state"))
    expect(result.cache).toBe(path.join("/tmp/profile-a", "cache"))
  })

  test("without GLITCHCODE_HOME, falls through to xdg mode", () => {
    const result = resolveMimocodeHome({})
    expect(result.mode).toBe("xdg")
    expect(result.root).toBeUndefined()
    // xdg paths end with "/mimocode"
    expect(result.config.endsWith(path.join("", "glitchcode"))).toBe(true)
    expect(result.data.endsWith(path.join("", "glitchcode"))).toBe(true)
    expect(result.state.endsWith(path.join("", "glitchcode"))).toBe(true)
    expect(result.cache.endsWith(path.join("", "glitchcode"))).toBe(true)
  })

  test("empty GLITCHCODE_HOME string is treated as unset (xdg mode)", () => {
    const result = resolveMimocodeHome({ GLITCHCODE_HOME: "" })
    expect(result.mode).toBe("xdg")
  })

  test("relative GLITCHCODE_HOME path throws with clear error", () => {
    expect(() => resolveMimocodeHome({ GLITCHCODE_HOME: "./foo" })).toThrow(
      /GLITCHCODE_HOME must be an absolute path/,
    )
    expect(() => resolveMimocodeHome({ GLITCHCODE_HOME: "foo/bar" })).toThrow(
      /GLITCHCODE_HOME must be an absolute path/,
    )
  })

  test("tilde-prefixed GLITCHCODE_HOME throws (not treated as absolute)", () => {
    expect(() => resolveMimocodeHome({ GLITCHCODE_HOME: "~/profiles/a" })).toThrow(
      /GLITCHCODE_HOME must be an absolute path/,
    )
  })

  test("error message includes the offending value", () => {
    expect(() => resolveMimocodeHome({ GLITCHCODE_HOME: "./relative" })).toThrow(
      /\.\/relative/,
    )
  })
})
