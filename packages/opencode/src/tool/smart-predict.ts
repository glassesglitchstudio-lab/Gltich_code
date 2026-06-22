import z from "zod"
import { Effect } from "effect"
import DESCRIPTION from "./smart-predict.txt"
import * as Tool from "./tool"

const RISK_FACTORS: Record<string, string[]> = {
  low: ["Minimal risk — well-understood domain", "Low chance of breaking changes"],
  medium: ["Moderate complexity — may require refactoring", "Potential dependency conflicts"],
  high: [
    "High risk — unfamiliar codebase or technology",
    "Significant refactoring likely",
    "Possible cascading failures across modules",
  ],
}

const TIME_ESTIMATES: Record<string, { min: number; max: number; unit: string }> = {
  low: { min: 5, max: 30, unit: "minutes" },
  medium: { min: 1, max: 4, unit: "hours" },
  high: { min: 1, max: 5, unit: "days" },
}

function generateTimeEstimate(complexity: "low" | "medium" | "high", filesAffected?: number): string {
  const base = TIME_ESTIMATES[complexity]
  const multiplier = filesAffected ? Math.max(1, Math.ceil(filesAffected / 3)) : 1
  const minEstimate = base.min * multiplier
  const maxEstimate = base.max * multiplier
  if (base.unit === "minutes") return `${minEstimate}–${maxEstimate} ${base.unit}`
  return `${minEstimate}–${maxEstimate} ${base.unit}`
}

function generatePlan(task: string, complexity: "low" | "medium" | "high"): string[] {
  const steps: string[] = [
    "1. Understand requirements and scope",
    `2. Review existing code related to: ${task}`,
    "3. Implement the changes incrementally",
  ]
  if (complexity === "medium" || complexity === "high") {
    steps.splice(1, 0, "1a. Document current behavior and expected outcomes")
    steps.push("4. Run existing tests to verify no regressions")
  }
  if (complexity === "high") {
    steps.push("5. Write new tests for the changes")
    steps.push("6. Perform code review with team members")
  }
  return steps
}

function generateRecommendations(complexity: "low" | "medium" | "high"): string[] {
  const recs: string[] = []
  if (complexity === "high") {
    recs.push("Break the task into smaller sub-tasks for incremental delivery")
    recs.push("Set up feature flags to safely roll back if needed")
    recs.push("Schedule a design review before implementation")
  }
  if (complexity === "medium") {
    recs.push("Consider writing unit tests for the affected modules")
    recs.push("Check for existing patterns in the codebase to follow")
  }
  if (complexity === "low") {
    recs.push("Proceed with standard implementation workflow")
  }
  return recs
}

function calculateConfidence(
  filesAffected: number | undefined,
  complexity: "low" | "medium" | "high",
): { level: string; score: number } {
  let score = 100
  if (filesAffected && filesAffected > 5) score -= 10
  if (filesAffected && filesAffected > 15) score -= 15
  if (complexity === "high") score -= 25
  if (complexity === "medium") score -= 10
  if (!filesAffected) score -= 5

  const level = score >= 80 ? "high" : score >= 50 ? "medium" : "low"
  return { level, score }
}

export const SmartPredictTool = Tool.define(
  "smart-predict",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: z.object({
        task: z.string().describe("The task description to analyze and predict"),
        files_affected: z.number().optional().describe("Estimated number of files that will be affected"),
        complexity: z
          .enum(["low", "medium", "high"])
          .optional()
          .default("medium")
          .describe("Estimated complexity of the task"),
      }),
      execute: (
        params: { task: string; files_affected?: number; complexity?: "low" | "medium" | "high" },
        _ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const task = params.task
          const filesAffected = params.files_affected
          const complexity = params.complexity ?? "medium"

          const timeEstimate = generateTimeEstimate(complexity, filesAffected)
          const riskFactors = RISK_FACTORS[complexity]
          const steps = generatePlan(task, complexity)
          const recommendations = generateRecommendations(complexity)
          const confidence = calculateConfidence(filesAffected, complexity)

          const output: string[] = []
          output.push(`# Smart Predict: ${task}`)
          output.push("")
          output.push("## Prediction Overview")
          output.push(`- **Time Estimate:** ${timeEstimate}`)
          output.push(`- **Confidence:** ${confidence.level} (${confidence.score}%)`)
          output.push(`- **Risk Level:** ${complexity}`)
          output.push("")
          output.push("## Risk Assessment")
          for (const factor of riskFactors) {
            output.push(`- ${factor}`)
          }
          if (filesAffected) {
            output.push(`- Files affected: ${filesAffected}`)
          }
          output.push("")
          output.push("## Step-by-Step Plan")
          output.push(...steps)
          output.push("")
          output.push("## Recommendations")
          for (const rec of recommendations) {
            output.push(`- ${rec}`)
          }

          return {
            title: `Smart Predict: ${task.substring(0, 60)}`,
            metadata: {
              task,
              timeEstimate,
              confidence: confidence.score,
              confidenceLevel: confidence.level,
              riskLevel: complexity,
              filesAffected: filesAffected ?? 0,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
