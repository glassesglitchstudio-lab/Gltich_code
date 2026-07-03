import { Cause, Effect, Layer, Context } from "effect"
import chokidar, { type FSWatcher } from "chokidar"
import fs from "fs"
import { readdir } from "fs/promises"
import path from "path"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { InstanceState } from "@/effect"
import { Flag } from "@/flag/flag"
import { Git } from "@/git"
import { Instance } from "@/project/instance"
import { Config } from "../config"
import { FileIgnore } from "./ignore"
import { Protected } from "./protected"
import { Log } from "../util"

const log = Log.create({ service: "file.watcher" })

export const Event = {
  Updated: BusEvent.define(
    "file.watcher.updated",
    z.object({
      file: z.string(),
      event: z.union([z.literal("add"), z.literal("change"), z.literal("unlink")]),
    }),
  ),
}

export type WatcherBackend = "chokidar" | "fs" | "noop"

export interface WatcherStatus {
  backend: WatcherBackend
  active: boolean
  directories: string[]
}

let currentBackend: WatcherBackend = "noop"
let activeWatchers: string[] = []

function protecteds(dir: string) {
  return Protected.paths().filter((item) => {
    const rel = path.relative(dir, item)
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
  })
}

function toChokidarIgnore(patterns: string[]): (string | RegExp)[] {
  return patterns.map((p) => {
    if (p.startsWith("/") || p.includes("*")) {
      return new RegExp(p.replace(/\*/g, ".*"))
    }
    return p
  })
}

export const hasNativeBinding = () => true

export function getWatcherStatus(): WatcherStatus {
  return {
    backend: currentBackend,
    active: activeWatchers.length > 0,
    directories: [...activeWatchers],
  }
}

function createFsWatcher(
  dir: string,
  ignore: (string | RegExp)[],
  onEvent: (eventType: string, filePath: string) => void,
): FSWatcher | null {
  try {
    const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename) return
      const fullPath = path.join(dir, filename)
      const isIgnored = ignore.some((pattern) => {
        if (typeof pattern === "string") return filename.includes(pattern)
        return pattern.test(filename)
      })
      if (isIgnored) return
      onEvent(eventType === "rename" ? "unlink" : "change", fullPath)
    })
    return watcher as unknown as FSWatcher
  } catch {
    return null
  }
}

function createNoopWatcher(): FSWatcher {
  return {
    close: () => Promise.resolve(),
    on: () => ({}) as any,
    unwatch: () => ({}) as any,
  } as unknown as FSWatcher
}

export interface Interface {
  readonly init: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FileWatcher") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const git = yield* Git.Service

    const state = yield* InstanceState.make(
      Effect.fn("FileWatcher.state")(
        function* () {
          if (yield* Flag.GLITCHCODE_EXPERIMENTAL_DISABLE_FILEWATCHER) return

          log.info("init", { directory: Instance.directory })

          const watchers: FSWatcher[] = []
          yield* Effect.addFinalizer(() =>
            Effect.promise(() => Promise.allSettled(watchers.map((w) => w.close()))),
          )

          const publishEvent = (eventType: string, filePath: string) => {
            const rel = path.relative(Instance.directory, filePath)
            if (rel.startsWith("..")) return
            if (eventType === "add" || eventType === "addDir") void Bus.publish(Event.Updated, { file: rel, event: "add" })
            if (eventType === "change") void Bus.publish(Event.Updated, { file: rel, event: "change" })
            if (eventType === "unlink" || eventType === "unlinkDir") void Bus.publish(Event.Updated, { file: rel, event: "unlink" })
          }

          const cfg = yield* config.get()
          const cfgIgnores = cfg.watcher?.ignore ?? []

          if (yield* Flag.GLITCHCODE_EXPERIMENTAL_FILEWATCHER) {
            const ignorePatterns = toChokidarIgnore([
              ...FileIgnore.PATTERNS,
              ...cfgIgnores,
              ...protecteds(Instance.directory),
            ])

            let w: FSWatcher | null = null
            let backend: WatcherBackend = "noop"

            try {
              w = chokidar.watch(Instance.directory, {
                ignored: ignorePatterns,
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
              })
              backend = "chokidar"
            } catch (error) {
              log.warn("chokidar failed, falling back to fs.watch", { error: (error as Error).message })
              w = createFsWatcher(Instance.directory, ignorePatterns, publishEvent)
              if (w) backend = "fs"
            }

            if (!w) {
              w = createNoopWatcher()
              backend = "noop"
            }

            if (backend === "chokidar") {
              w.on("all", (eventType: string, filePath: string) => {
                publishEvent(eventType, filePath)
              })
              w.on("error", (error: unknown) => {
                log.error("watcher error", { error: String(error) })
              })
            }

            watchers.push(w)
            currentBackend = backend
            activeWatchers.push(Instance.directory)
            log.info("watcher started", { directory: Instance.directory, backend })
          }

          if (Instance.project.vcs === "git") {
            const result = yield* git.run(["rev-parse", "--git-dir"], {
              cwd: Instance.project.worktree,
            })
            const vcsDir =
              result.exitCode === 0 ? path.resolve(Instance.project.worktree, result.text().trim()) : undefined
            if (vcsDir && !cfgIgnores.includes(".git") && !cfgIgnores.includes(vcsDir)) {
              const gitIgnore = (yield* Effect.promise(() => readdir(vcsDir).catch(() => []))).filter(
                (entry) => entry !== "HEAD",
              )

              try {
                const gitWatcher = chokidar.watch(vcsDir, {
                  ignored: gitIgnore as any,
                  persistent: true,
                  ignoreInitial: true,
                })

                gitWatcher.on("all", (eventType: string, filePath: string) => {
                  publishEvent(eventType, filePath)
                })

                watchers.push(gitWatcher)
                activeWatchers.push(vcsDir)
                log.info("git watcher started", { gitDir: vcsDir })
              } catch (error) {
                log.warn("git watcher failed", { error: (error as Error).message })
              }
            }
          }
        },
        Effect.catchCause((cause) => {
          log.error("failed to init watcher service", { cause: Cause.pretty(cause) })
          return Effect.void
        }),
      ),
    )

    return Service.of({
      init: Effect.fn("FileWatcher.init")(function* () {
        yield* InstanceState.get(state)
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Config.defaultLayer), Layer.provide(Git.defaultLayer))

export * as FileWatcher from "./watcher"
