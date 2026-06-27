import { BusEvent } from "@/bus/bus-event"
import { InstanceState } from "@/effect"
import { EffectBridge } from "@/effect"
import { Flag } from "@/flag/flag"
import type { InstanceContext } from "@/project/instance"
import { SessionID, MessageID } from "@/session/schema"
import { Effect, Layer, Context } from "effect"
import z from "zod"
import { Config } from "../config"
import { MCP } from "../mcp"
import { Skill } from "../skill"
import PROMPT_INITIALIZE from "./template/initialize.txt"
import PROMPT_REVIEW from "./template/review.txt"

type State = {
  commands: Record<string, Info>
}

export const Event = {
  Executed: BusEvent.define(
    "command.executed",
    z.object({
      name: z.string(),
      sessionID: SessionID.zod,
      arguments: z.string(),
      messageID: MessageID.zod,
    }),
  ),
}

export const Info = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    source: z.enum(["command", "mcp", "skill"]).optional(),
    // workaround for zod not supporting async functions natively so we use getters
    // https://zod.dev/v4/changelog?id=zfunction
    template: z.promise(z.string()).or(z.string()),
    subtask: z.boolean().optional(),
    hints: z.array(z.string()),
  })
  .meta({
    ref: "Command",
  })

// for some reason zod is inferring `string` for z.promise(z.string()).or(z.string()) so we have to manually override it
export type Info = Omit<z.infer<typeof Info>, "template"> & { template: Promise<string> | string }

export function hints(template: string) {
  const result: string[] = []
  const numbered = template.match(/\$\d+/g)
  if (numbered) {
    for (const match of [...new Set(numbered)].sort()) result.push(match)
  }
  if (template.includes("$ARGUMENTS")) result.push("$ARGUMENTS")
  return result
}

export const Default = {
  INIT: "init",
  REVIEW: "review",
  DREAM: "dream",
  DISTILL: "distill",
  GOAL: "goal",
  DEEP_RESEARCH: "deep-research",
  ONBOARD: "onboard",
  SHARE: "share",
  BENCHMARK: "benchmark",
  PLUGINS: "plugins",
  TEAM: "team",
  SUGGEST: "suggest",
  THEME: "theme",
  OFFLINE: "offline",
  HISTORY: "history",
} as const

export function deepResearchTemplate(): string {
  return [
    "The user wants a deep, multi-source, fact-checked research report.",
    "",
    "Research request:",
    "$ARGUMENTS",
    "",
    "If the request is underspecified (missing scope, constraints, region, time range, etc.),",
    "ask 2-3 brief clarifying questions FIRST, then weave the answers into a refined question.",
    "",
    "When the request is specific enough, run the built-in deep-research workflow:",
    '  workflow({ operation: "run", name: "deep-research", args: "<the refined research question>" })',
    "",
    "Pass the full refined question as `args`. The workflow fans out web searches, fetches sources,",
    "adversarially verifies claims, and returns a cited report; relay its result to the user.",
  ].join("\n")
}

export interface Interface {
  readonly get: (name: string) => Effect.Effect<Info | undefined>
  readonly list: () => Effect.Effect<Info[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Command") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const mcp = yield* MCP.Service
    const skill = yield* Skill.Service

    const init = Effect.fn("Command.state")(function* (ctx: InstanceContext) {
      const cfg = yield* config.get()
      const bridge = yield* EffectBridge.make()
      const commands: Record<string, Info> = {}

      commands[Default.INIT] = {
        name: Default.INIT,
        description: "guided AGENTS.md setup",
        source: "command",
        get template() {
          return PROMPT_INITIALIZE.replace("${path}", ctx.worktree)
        },
        hints: hints(PROMPT_INITIALIZE),
      }
      commands[Default.REVIEW] = {
        name: Default.REVIEW,
        description: "review changes [commit|branch|pr], defaults to uncommitted",
        source: "command",
        get template() {
          return PROMPT_REVIEW.replace("${path}", ctx.worktree)
        },
        subtask: true,
        hints: hints(PROMPT_REVIEW),
      }
      commands[Default.DREAM] = {
        name: Default.DREAM,
        description: "manually consolidate project memory from memory files and raw trajectory",
        agent: "dream",
        source: "command",
        subtask: false,
        get template() {
          return [
            "Run one manual dream memory consolidation pass for the current project.",
            "",
            "User focus or constraints:",
            "$ARGUMENTS",
            "",
            "Use the memory files as the working index and the raw glitchcode trajectory database as the source of truth.",
            "Use bash for read-only SQLite and filesystem inspection. Do not modify the database.",
            "Consolidate only durable, verified information into project memory.",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }
      commands[Default.DISTILL] = {
        name: Default.DISTILL,
        description: "find repeated workflows in recent work and package them into skills, subagents, or commands",
        agent: "distill",
        source: "command",
        subtask: false,
        get template() {
          return [
            "Run one manual distill pass for the current project.",
            "",
            "User focus or constraints:",
            "$ARGUMENTS",
            "",
            "Look back over recent work and identify repeated manual workflows worth packaging.",
            "Use the raw glitchcode trajectory database as the source of truth and memory files to spot cross-session patterns.",
            "Inventory existing skills, agents, and commands first so you reuse or extend instead of duplicating.",
            "Use bash for read-only SQLite and filesystem inspection. Do not modify the database.",
            "Produce a compact shortlist, then create only the high-confidence missing assets.",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }
      commands[Default.GOAL] = {
        name: Default.GOAL,
        description: "set a stop-condition goal; runs until a judge says it's met. /goal clear to abort",
        source: "command",
        subtask: false,
        get template() {
          return "$ARGUMENTS"
        },
        hints: ["$ARGUMENTS"],
      }

      if (Flag.GLITCHCODE_EXPERIMENTAL_WORKFLOW_TOOL) {
        commands[Default.DEEP_RESEARCH] = {
          name: Default.DEEP_RESEARCH,
          description: "deep multi-source, fact-checked research report (runs the deep-research workflow)",
          source: "command",
          subtask: false,
          get template() {
            return deepResearchTemplate()
          },
          hints: ["$ARGUMENTS"],
        }
      }

      // --- Glitch Code Custom Commands ---
      commands[Default.ONBOARD] = {
        name: Default.ONBOARD,
        description: "interactive onboarding tour - explore Glitch Code features",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Run an interactive onboarding tour for the user.",
            "",
            "Show the user how to use Glitch Code:",
            "1. How to run commands (glitch run)",
            "2. Agent switching (Tab key)",
            "3. Memory system (MEMORY.md, checkpoint.md)",
            "4. Special commands (/voice, /dream, /distill, /goal)",
            "5. Keyboard shortcuts",
            "",
            "Use a friendly, helpful tone. Ask if they want to try anything specific.",
          ].join("\n")
        },
        hints: [],
      }

      commands[Default.SHARE] = {
        name: Default.SHARE,
        description: "export current session for sharing (markdown/json/html)",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Export the current session for sharing.",
            "",
            "Format: $ARGUMENTS (default: markdown)",
            "",
            "Export options:",
            "- markdown: Clean markdown format",
            "- json: Structured JSON data",
            "- html: Styled HTML page",
            "",
            "If no format specified, ask the user which format they prefer.",
            "Offer to anonymize sensitive data (emails, API keys, passwords).",
            "Show a preview before exporting.",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }

      commands[Default.BENCHMARK] = {
        name: Default.BENCHMARK,
        description: "show token usage and performance metrics",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Show benchmark and performance metrics for the current session.",
            "",
            "Display:",
            "- Total tokens used (input/output)",
            "- Estimated cost",
            "- Response time per message",
            "- Tool usage statistics",
            "- Model performance comparison",
            "",
            "Compare with previous sessions if available.",
            "Suggest optimizations for reducing token usage.",
          ].join("\n")
        },
        hints: [],
      }

      commands[Default.PLUGINS] = {
        name: Default.PLUGINS,
        description: "manage plugins and MCP servers",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Help the user manage plugins and MCP servers.",
            "",
            "Available actions:",
            "- list: Show installed plugins",
            "- add <name>: Install a new plugin",
            "- remove <name>: Uninstall a plugin",
            "- enable <name>: Enable a disabled plugin",
            "- disable <name>: Disable a plugin",
            "",
            "Available plugins:",
            "- github: GitHub API integration",
            "- filesystem: Advanced file system access",
            "- postgres: PostgreSQL queries",
            "- sqlite: SQLite management",
            "- brave-search: Web search via Brave API",
            "- puppeteer: Web scraping and browser automation",
            "",
            "Action: $ARGUMENTS",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }

      commands[Default.TEAM] = {
        name: Default.TEAM,
        description: "team workspace management",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Help the user manage their team workspace.",
            "",
            "Available actions:",
            "- init: Create a new team",
            "- join <teamId>: Join an existing team",
            "- list: Show team members",
            "- invite: Invite a new member",
            "- remove <memberId>: Remove a member",
            "- sync: Sync shared files",
            "",
            "Shared resources:",
            "- Memory: Cross-team project knowledge",
            "- Skills: Shared automation workflows",
            "- Config: Team-wide settings",
            "",
            "Action: $ARGUMENTS",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }

      commands[Default.SUGGEST] = {
        name: Default.SUGGEST,
        description: "get context-aware suggestions",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Provide context-aware suggestions to the user.",
            "",
            "Analyze the current project and suggest:",
            "- Relevant commands to run",
            "- Files that might need attention",
            "- Skills that could help",
            "- Config improvements",
            "- Git workflow optimizations",
            "",
            "Consider:",
            "- Recent file changes",
            "- Project type (React, Next.js, Python, etc.)",
            "- Current git status",
            "- Installed dependencies",
            "",
            "Context: $ARGUMENTS",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }

      commands[Default.THEME] = {
        name: Default.THEME,
        description: "change UI theme",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Help the user change the UI theme.",
            "",
            "Available themes:",
            "- neon-orange: Default neon orange theme",
            "- cyber-blue: Cyber blue/neon theme",
            "- matrix-green: Matrix green terminal theme",
            "- sunset: Sunset colors",
            "- ocean: Ocean blue-green theme",
            "- dracula: Dracula theme",
            "- monokai: Monokai theme",
            "",
            "Actions:",
            "- list: Show all available themes",
            "- set <name>: Change to a specific theme",
            "- preview <name>: Preview a theme",
            "- create: Create a custom theme",
            "",
            "Theme: $ARGUMENTS",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }

      commands[Default.OFFLINE] = {
        name: Default.OFFLINE,
        description: "configure offline/local model support",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Help the user configure offline/local model support.",
            "",
            "Supported providers:",
            "- ollama: Local models via Ollama (free, wide model support)",
            "- lmstudio: LM Studio (GUI-based, easy setup)",
            "- local: Custom local API (OpenAI-compatible)",
            "",
            "Actions:",
            "- setup: Configure offline model",
            "- status: Check if model server is running",
            "- models: List available models",
            "- test: Test connection to model server",
            "",
            "Action: $ARGUMENTS",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }

      commands[Default.HISTORY] = {
        name: Default.HISTORY,
        description: "search through session history",
        source: "command",
        subtask: true,
        get template() {
          return [
            "Search through session history and find relevant conversations.",
            "",
            "Search query: $ARGUMENTS",
            "",
            "Search options:",
            "- by keyword: Find messages containing specific text",
            "- by date: Filter by time range",
            "- by session: Search within a specific session",
            "- by role: Filter by user/assistant messages",
            "",
            "Display results with:",
            "- Session title and date",
            "- Message preview",
            "- Relevance score",
            "",
            "If no query provided, show recent session history.",
          ].join("\n")
        },
        hints: ["$ARGUMENTS"],
      }
      // --- End Glitch Code Custom Commands ---

      for (const [name, command] of Object.entries(cfg.command ?? {})) {
        commands[name] = {
          name,
          agent: command.agent,
          model: command.model,
          description: command.description,
          source: "command",
          get template() {
            return command.template
          },
          subtask: command.subtask,
          hints: hints(command.template),
        }
      }

      for (const [name, prompt] of Object.entries(yield* mcp.prompts())) {
        commands[name] = {
          name,
          source: "mcp",
          description: prompt.description,
          get template() {
            return bridge.promise(
              mcp
                .getPrompt(
                  prompt.client,
                  prompt.name,
                  prompt.arguments
                    ? Object.fromEntries(prompt.arguments.map((argument, i) => [argument.name, `$${i + 1}`]))
                    : {},
                )
                .pipe(
                  Effect.map(
                    (template) =>
                      template?.messages
                        .map((message) => (message.content.type === "text" ? message.content.text : ""))
                        .join("\n") || "",
                  ),
                ),
            )
          },
          hints: prompt.arguments?.map((_, i) => `$${i + 1}`) ?? [],
        }
      }

      for (const item of yield* skill.all()) {
        if (commands[item.name]) continue
        commands[item.name] = {
          name: item.name,
          description: item.description,
          source: "skill",
          get template() {
            return item.content
          },
          hints: [],
        }
      }

      return {
        commands,
      }
    })

    const state = yield* InstanceState.make<State>((ctx) => init(ctx))

    const get = Effect.fn("Command.get")(function* (name: string) {
      const s = yield* InstanceState.get(state)
      return s.commands[name]
    })

    const list = Effect.fn("Command.list")(function* () {
      const s = yield* InstanceState.get(state)
      return Object.values(s.commands)
    })

    return Service.of({ get, list })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Config.defaultLayer),
  Layer.provide(MCP.defaultLayer),
  Layer.provide(Skill.defaultLayer),
)

export * as Command from "."
