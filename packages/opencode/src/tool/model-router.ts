import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./model-router.txt"

export const ModelRouterTool = Tool.define(
  "model-router",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: z.object({
        task: z.string().describe("The task description to analyze and route"),
        context_size: z.string().optional().describe("Estimated context size: small/medium/large"),
        mode: z.enum(["auto", "manual", "swarm"]).optional().default("auto").describe("Routing mode"),
        failed_model: z.string().optional().describe("If a previous model failed, specify which one"),
      }),
      execute: (params: { task: string; context_size?: string; mode?: string; failed_model?: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const taskLower = params.task.toLowerCase()
          const ctxSize = params.context_size || "small"

          const modelHierarchy = [
            { id: "glassesglitchstudio/gulmzcetiner:X_FABLE_CODER_V1", name: "X_FABLE_CODER_V1", priority: 1, desc: "Default — Berkay's personal model", bestFor: ["general", "code", "chat", "quick"] },
            { id: "glassesglitchstudio/gulmzcetiner:V7_HYBRID_TITAN", name: "V7_HYBRID_TITAN", priority: 2, desc: "Deep reasoning + security", bestFor: ["reasoning", "security", "debug", "complex"] },
            { id: "glassesglitchstudio/gulmzcetiner:V6_OMNI_OVERLORD", name: "V6_OMNI_OVERLORD", priority: 3, desc: "128K context — large files", bestFor: ["large", "long context", "analysis", "review"] },
            { id: "glassesglitchstudio/gulmzcetiner:V5_NEXUS_CORE", name: "V5_NEXUS_CORE", priority: 4, desc: "Fast executor — simple tasks", bestFor: ["fast", "simple", "refactor"] },
          ]

          const failedIdx = params.failed_model ? modelHierarchy.findIndex(m => m.name.toLowerCase().includes(params.failed_model.toLowerCase())) : -1

          const excluded = failedIdx >= 0 ? modelHierarchy.slice(0, failedIdx + 1) : []

          let recommended = modelHierarchy[0]

          if (params.failed_model) {
            const nextIdx = failedIdx + 1
            if (nextIdx < modelHierarchy.length) {
              recommended = modelHierarchy[nextIdx]
            }
          } else {
            for (const m of modelHierarchy) {
              if (m.bestFor.some(b => taskLower.includes(b))) {
                recommended = m
                break
              }
            }
          }

          const lines: string[] = []
          lines.push(`# Model Router Analysis`)
          lines.push("")
          lines.push(`Task: ${params.task}`)
          lines.push(`Context size: ${ctxSize}`)
          lines.push(`Mode: ${params.mode}`)
          if (params.failed_model) lines.push(`Previous failed model: ${params.failed_model}`)
          lines.push("")
          lines.push("## Model Hierarchy")
          for (const m of modelHierarchy) {
            const isRec = m.id === recommended.id
            const isExcluded = excluded.some(e => e.id === m.id)
            const prefix = isRec ? "👉" : isExcluded ? "❌" : "  "
            lines.push(`${prefix} ${m.name} — ${m.desc}`)
          }
          lines.push("")
          lines.push("## Recommended")
          lines.push(`Model: ${recommended.name} (${recommended.id})`)
          lines.push(`Reason: ${params.failed_model ? `Fallback after ${params.failed_model} failure` : "Best match for task type"}`)
          lines.push("")
          lines.push("## Fallback Chain")
          lines.push("If this fails, the next model in the hierarchy will be tried automatically.")
          lines.push("For MiMo Auto (1M context), use: provider=ollama/model=mimo-auto")

          return {
            title: `Model Router: ${recommended.name}`,
            metadata: {
              recommendedModel: recommended.id,
              recommendedName: recommended.name,
              mode: params.mode || "auto",
              modelCount: modelHierarchy.length,
            },
            output: lines.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
