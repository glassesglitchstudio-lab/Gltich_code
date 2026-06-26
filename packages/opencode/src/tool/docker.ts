import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./docker.txt"

function exec(cmd: string, cwd?: string): Effect.Effect<{ stdout: string; stderr: string; code: number }> {
  return Effect.promise(async () => {
    const proc = Bun.spawn(["bash", "-c", cmd], { cwd, stdout: "pipe", stderr: "pipe" })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const code = await proc.exited
    return { stdout: stdout.trim(), stderr: stderr.trim(), code }
  })
}

export const DockerTool = Tool.define(
  "docker",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: z.object({
        operation: z
          .enum(["ps", "images", "logs", "stop", "start", "build", "run", "exec", "inspect"])
          .describe("Docker operation to perform"),
        target: z.string().optional().describe("Container ID/name or image name"),
        command: z.string().optional().describe("Command for run/exec operations"),
        tag: z.string().optional().describe("Image tag for build/run"),
        tail: z.number().optional().default(50).describe("Number of log lines to show"),
        follow: z.boolean().optional().default(false).describe("Follow log output"),
      }),
      execute: (
        params: {
          operation: string
          target?: string
          command?: string
          tag?: string
          tail?: number
          follow?: boolean
        },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const { operation, target, command, tag, tail, follow } = params

          if (operation === "ps") {
            const { stdout, stderr, code } = yield* exec("docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'")
            if (code !== 0) {
              return {
                title: "Docker PS",
                metadata: { error: true } as any,
                output: `Docker not available: ${stderr}`,
              }
            }
            return {
              title: "Docker Containers",
              metadata: {},
              output: `# Docker Containers\n\n\`\`\`\n${stdout || "No containers found."}\n\`\`\``,
            }
          }

          if (operation === "images") {
            const { stdout, stderr, code } = yield* exec("docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}'")
            if (code !== 0) {
              return {
                title: "Docker Images",
                metadata: { error: true } as any,
                output: `Docker not available: ${stderr}`,
              }
            }
            return {
              title: "Docker Images",
              metadata: {},
              output: `# Docker Images\n\n\`\`\`\n${stdout || "No images found."}\n\`\`\``,
            }
          }

          if (operation === "logs") {
            if (!target) {
              return {
                title: "Docker Logs",
                metadata: { error: true } as any,
                output: "Error: 'target' (container name/ID) is required for logs.",
              }
            }
            const followFlag = follow ? " -f" : ""
            const { stdout, stderr, code } = yield* exec(`docker logs --tail ${tail || 50}${followFlag} "${target}"`)
            if (code !== 0) {
              return {
                title: "Docker Logs",
                metadata: { error: true } as any,
                output: `Error: ${stderr}`,
              }
            }
            return {
              title: `Logs: ${target}`,
              metadata: { container: target },
              output: `# Logs: ${target}\n\n\`\`\`\n${stdout}\n\`\`\``,
            }
          }

          if (operation === "stop") {
            if (!target) {
              return {
                title: "Docker Stop",
                metadata: { error: true } as any,
                output: "Error: 'target' (container name/ID) is required.",
              }
            }
            yield* ctx.ask({
              permission: "docker-stop",
              patterns: [`docker stop "${target}"`],
              always: ["docker"],
              metadata: { container: target },
            })
            const { stdout, stderr, code } = yield* exec(`docker stop "${target}"`)
            if (code !== 0) {
              return {
                title: "Docker Stop",
                metadata: { error: true } as any,
                output: `Error: ${stderr}`,
              }
            }
            return {
              title: `Stopped: ${target}`,
              metadata: { container: target },
              output: `Container stopped: ${stdout}`,
            }
          }

          if (operation === "start") {
            if (!target) {
              return {
                title: "Docker Start",
                metadata: { error: true } as any,
                output: "Error: 'target' (container name/ID) is required.",
              }
            }
            yield* ctx.ask({
              permission: "docker-start",
              patterns: [`docker start "${target}"`],
              always: ["docker"],
              metadata: { container: target },
            })
            const { stdout, stderr, code } = yield* exec(`docker start "${target}"`)
            if (code !== 0) {
              return {
                title: "Docker Start",
                metadata: { error: true } as any,
                output: `Error: ${stderr}`,
              }
            }
            return {
              title: `Started: ${target}`,
              metadata: { container: target },
              output: `Container started: ${stdout}`,
            }
          }

          if (operation === "build") {
            if (!target) {
              return {
                title: "Docker Build",
                metadata: { error: true } as any,
                output: "Error: 'target' (Dockerfile path) is required.",
              }
            }
            yield* ctx.ask({
              permission: "docker-build",
              patterns: [`docker build -t ${tag || "app"} "${target}"`],
              always: ["docker"],
              metadata: { path: target, tag },
            })
            const tagArg = tag ? ` -t ${tag}` : ""
            const { stdout, stderr, code } = yield* exec(`docker build${tagArg} "${target}"`)
            if (code !== 0) {
              return {
                title: "Docker Build",
                metadata: { error: true } as any,
                output: `Build failed:\n${stderr}\n${stdout}`,
              }
            }
            return {
              title: `Built: ${tag || "image"}`,
              metadata: { tag },
              output: `Build successful:\n${stdout.slice(-500)}`,
            }
          }

          if (operation === "run") {
            if (!target) {
              return {
                title: "Docker Run",
                metadata: { error: true } as any,
                output: "Error: 'target' (image name) is required.",
              }
            }
            yield* ctx.ask({
              permission: "docker-run",
              patterns: [`docker run ${target}${command ? ` ${command}` : ""}`],
              always: ["docker"],
              metadata: { image: target, command },
            })
            const cmd = command ? ` ${command}` : ""
            const { stdout, stderr, code } = yield* exec(`docker run -d${cmd ? ` ${cmd}` : ""} "${target}"`)
            if (code !== 0) {
              return {
                title: "Docker Run",
                metadata: { error: true } as any,
                output: `Error: ${stderr}`,
              }
            }
            return {
              title: `Running: ${target}`,
              metadata: { image: target },
              output: `Container started:\n${stdout}`,
            }
          }

          if (operation === "exec") {
            if (!target || !command) {
              return {
                title: "Docker Exec",
                metadata: { error: true } as any,
                output: "Error: 'target' and 'command' are required for exec.",
              }
            }
            yield* ctx.ask({
              permission: "docker-exec",
              patterns: [`docker exec "${target}" ${command}`],
              always: ["docker"],
              metadata: { container: target, command },
            })
            const { stdout, stderr, code } = yield* exec(`docker exec "${target}" ${command}`)
            if (code !== 0) {
              return {
                title: "Docker Exec",
                metadata: { error: true } as any,
                output: `Error: ${stderr}`,
              }
            }
            return {
              title: `Exec: ${target}`,
              metadata: { container: target },
              output: `Output:\n\`\`\`\n${stdout}\n\`\`\``,
            }
          }

          if (operation === "inspect") {
            if (!target) {
              return {
                title: "Docker Inspect",
                metadata: { error: true } as any,
                output: "Error: 'target' (container/image) is required.",
              }
            }
            const { stdout, stderr, code } = yield* exec(`docker inspect "${target}"`)
            if (code !== 0) {
              return {
                title: "Docker Inspect",
                metadata: { error: true } as any,
                output: `Error: ${stderr}`,
              }
            }
            let pretty = stdout
            try { pretty = JSON.stringify(JSON.parse(stdout), null, 2) } catch {}
            const truncated = pretty.length > 3000 ? pretty.slice(0, 3000) + "\n..." : pretty
            return {
              title: `Inspect: ${target}`,
              metadata: { target },
              output: `# Inspect: ${target}\n\n\`\`\`json\n${truncated}\n\`\`\``,
            }
          }

          return {
            title: "Docker",
            metadata: { error: true } as any,
            output: `Unknown operation: ${operation}`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
