import { describe, test, expect } from "bun:test"
import { Effect, Layer, ManagedRuntime, Cause, Exit } from "effect"
import z from "zod"
import { Agent } from "../../src/agent/agent"
import { Tool } from "../../src/tool"
import { Truncate } from "../../src/tool"
import { isRecoverableError, RecoverableError } from "../../src/tool/recoverable"

const runtime = ManagedRuntime.make(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer))

const params = z.object({ input: z.string() })

function makeTool(id: string, executeFn?: () => void) {
  return {
    description: "test tool",
    parameters: params,
    execute() {
      executeFn?.()
      return Effect.succeed({ title: "test", output: "ok", metadata: {} })
    },
  }
}

describe("Tool.define", () => {
  test("object-defined tool does not mutate the original init object", async () => {
    const original = makeTool("test")
    const originalExecute = original.execute

    const info = await runtime.runPromise(Tool.define("test-tool", Effect.succeed(original)))

    await Effect.runPromise(info.init())
    await Effect.runPromise(info.init())
    await Effect.runPromise(info.init())

    expect(original.execute).toBe(originalExecute)
  })

  test("effect-defined tool returns fresh objects and is unaffected", async () => {
    const info = await runtime.runPromise(
      Tool.define(
        "test-fn-tool",
        Effect.succeed(() => Effect.succeed(makeTool("test"))),
      ),
    )

    const first = await Effect.runPromise(info.init())
    const second = await Effect.runPromise(info.init())

    expect(first).not.toBe(second)
  })

  test("object-defined tool returns distinct objects per init() call", async () => {
    const info = await runtime.runPromise(Tool.define("test-copy", Effect.succeed(makeTool("test"))))

    const first = await Effect.runPromise(info.init())
    const second = await Effect.runPromise(info.init())

    expect(first).not.toBe(second)
  })
})

// Tests for the Fix C crash-prevention pattern: Effect.exit catches both
// failures and defects so the tool execute promise never rejects, preventing
// TUI crash screens. Mirrors the wrap() in tool.ts (Effect.orDie) + the
// Effect.exit guard in prompt.ts.
describe("Tool execute crash prevention (Fix C)", () => {
  test("Effect.exit catches a defect from Effect.orDie (network/timeout-like error)", async () => {
    // Simulate the real flow: tool fails → tool.ts wrap() applies Effect.orDie
    // (turns failure into defect) → prompt.ts's Effect.exit catches it.
    // Without Effect.exit, Effect.runPromise would reject and crash the process.
    const failingEffect = Effect.fail(new Error("Network timeout simulated")).pipe(Effect.orDie)

    const exit = await Effect.runPromise(Effect.exit(failingEffect))

    expect(exit._tag).toBe("Failure")
    // Cause.squash extracts the original error from the defect
    const error = Cause.squash((exit as Exit.Failure<any, any>).cause)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe("Network timeout simulated")
  })

  test("Effect.exit catches a RecoverableError defect and isRecoverableError detects it", async () => {
    // Same pattern but with a RecoverableError — the orDie → defect hop must
    // preserve the recoverable marker so the TUI renders it muted.
    const failingEffect = Effect.fail(new RecoverableError("Bad arguments simulated")).pipe(Effect.orDie)

    const exit = await Effect.runPromise(Effect.exit(failingEffect))

    expect(exit._tag).toBe("Failure")
    const error = Cause.squash((exit as Exit.Failure<any, any>).cause)
    // isRecoverableError must detect it even after the orDie → defect hop
    expect(isRecoverableError(error)).toBe(true)
    expect((error as Error).message).toBe("Bad arguments simulated")
  })

  test("Effect.exit lets successful tool results pass through unchanged", async () => {
    // A successful tool (Effect.succeed) exits as Success — the prompt.ts
    // guard reads exit.value and continues normally.
    const okEffect = Effect.succeed({ title: "OK", output: "success", metadata: {} })

    const exit = await Effect.runPromise(Effect.exit(okEffect))

    expect(exit._tag).toBe("Success")
    const result = (exit as Exit.Success<any, any>).value
    expect(result.output).toBe("success")
  })
})
