export interface SubTask {
  id: string
  title: string
  description: string
  dependencies: string[]
  status: "pending" | "running" | "done" | "failed" | "skipped"
  result?: string
  error?: string
  filesChanged: string[]
  agentId?: string
}

export interface TaskPlan {
  goal: string
  subTasks: SubTask[]
  estimatedSteps: number
  complexity: "low" | "medium" | "high"
}

export interface SolveContext {
  task: string
  plan: TaskPlan
  completedTasks: SubTask[]
  allFilesChanged: string[]
  summary: string
  dryRun: boolean
  model?: string
  maxParallel: number
}

export interface SolveOptions {
  task: string
  model?: string
  dryRun: boolean
  maxParallel: number
  maxSteps: number
  verbose: boolean
}
