import { z } from "zod"

export type WorkerCategory = "build" | "schema"

export interface WorkerDefinition {
  id: string
  name: string
  description: string
  category: WorkerCategory
  keywords: string[]
  schema: z.ZodObject<any>
  handler: (args: any) => Promise<WorkerResult>
}

export interface WorkerResult {
  success: boolean
  output: string
  metadata?: Record<string, any>
}

export const WorkerResultSchema = z.object({
  success: z.boolean(),
  output: z.string(),
  metadata: z.record(z.any()).optional(),
})
