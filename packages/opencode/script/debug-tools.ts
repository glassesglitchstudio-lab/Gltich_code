/**
 * Lightweight tool crash diagnostic — run: bun run script/debug-tools.ts
 * Does NOT start TUI or full test suite.
 */
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import path from "path"
import { Agent } from "../src/agent/agent"
import { Memory } from "../src/memory"
import { Instance } from "../src/project/instance"
import { MemoryTool } from "../src/tool/memory"
import { WebSearchTool } from "../src/tool/websearch"
import { Truncate } from "../src/tool"
import { SessionID, MessageID } from "../src/session/schema"
import { Config } from "../src/config"
import { Auth } from "../src/auth"
import * as CrossSpawnSpawner from "../src/effect/cross-spawn-spawner"

const projectRoot = path.join(import.meta.dir, "..")

const ctx = {
  sessionID: SessionID.make("ses_debug"),
  messageID: MessageID.make("msg_debug"),
  callID: "debug-call",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const layers = Layer.mergeAll(
  Memory.defaultLayer,
  Config.defaultLayer,
  Auth.defaultLayer,
  FetchHttpClient.layer,
  CrossSpawnSpawner.defaultLayer,
  Truncate.defaultLayer,
  Agent.defaultLayer,
)

async function runTool(name: string, fn: () => Promise<unknown>) {
  const start = performance.now()
  try {
    const result = await fn()
    const ms = Math.round(performance.now() - start)
    const out = result as { title?: string; output?: string }
    console.log(`[OK] ${name} (${ms}ms)`)
    console.log(`     title: ${out.title ?? "(none)"}`)
    console.log(`     output preview: ${(out.output ?? "").slice(0, 120).replace(/\n/g, " ")}`)
    return true
  } catch (e) {
    const ms = Math.round(performance.now() - start)
    console.error(`[CRASH/FAIL] ${name} (${ms}ms)`)
    if (e instanceof Error) {
      console.error(`     name: ${e.name}`)
      console.error(`     message: ${e.message}`)
      if (e.stack) console.error(`     stack:\n${e.stack.split("\n").slice(0, 8).join("\n")}`)
    } else {
      console.error(`     error:`, e)
    }
    return false
  }
}

await Instance.provide({
  directory: projectRoot,
  fn: async () => {
    console.log("=== Glitch Code tool diagnostic ===")
    console.log(`project: ${projectRoot}`)
    console.log(`data dir: ${process.env.LOCALAPPDATA}\\glitchcode (if xdg)`)

    const memoryOk = await runTool("memory.search", () =>
      MemoryTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "search", query: "test" }, ctx)),
        Effect.provide(layers),
        Effect.runPromise,
      ),
    )

    const webOk = await runTool("websearch", () =>
      WebSearchTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ query: "glitch code cli" }, ctx)),
        Effect.provide(layers),
        Effect.runPromise,
      ),
    )

    // Direct memory service (bypass tool wrap)
    await runTool("memory.service.search (direct)", () =>
      Effect.gen(function* () {
        const memory = yield* Memory.Service
        return yield* memory.search({ query: "test", limit: 3 })
      }).pipe(Effect.provide(layers), Effect.runPromise),
    )

    console.log("\n=== Summary ===")
    console.log(`memory tool: ${memoryOk ? "OK" : "FAILED"}`)
    console.log(`websearch tool: ${webOk ? "OK" : "FAILED"}`)
    process.exit(memoryOk && webOk ? 0 : 1)
  },
})
