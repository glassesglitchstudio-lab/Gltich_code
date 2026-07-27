import type { WorkerDefinition, WorkerResult } from "./worker.types.js"
import { buildCookWorker } from "./workers/build-cook.js"
import { buildPackageWorker } from "./workers/build-package.js"
import { buildShaderWorker } from "./workers/build-shader.js"
import { buildAssetWorker } from "./workers/build-asset.js"
import { buildOptimizeWorker } from "./workers/build-optimize.js"
import { schemaLevelWorker } from "./workers/schema-level.js"
import { schemaBlueprintWorker } from "./workers/schema-blueprint.js"
import { schemaMaterialWorker } from "./workers/schema-material.js"
import { schemaAnimationWorker } from "./workers/schema-animation.js"
import { schemaVfxWorker } from "./workers/schema-vfx.js"
import { schemaAudioWorker } from "./workers/schema-audio.js"
import { schemaUiWorker } from "./workers/schema-ui.js"
import { schemaAiWorker } from "./workers/schema-ai.js"

export const ALL_WORKERS: WorkerDefinition[] = [
  /* BUILD (5) */
  buildCookWorker,      // #1
  buildPackageWorker,   // #2
  buildShaderWorker,    // #3
  buildAssetWorker,     // #4
  buildOptimizeWorker,  // #5
  /* SCHEMA (8) */
  schemaLevelWorker,      // #6
  schemaBlueprintWorker,  // #7
  schemaMaterialWorker,   // #8  ← "kanlı duvar yap" bu worker'a gider
  schemaAnimationWorker,  // #9
  schemaVfxWorker,        // #10
  schemaAudioWorker,      // #11
  schemaUiWorker,         // #12
  schemaAiWorker,         // #13
]

export class WorkerRouter {
  private workers: Map<string, WorkerDefinition> = new Map()

  constructor() {
    for (const w of ALL_WORKERS) {
      this.workers.set(w.id, w)
    }
  }

  getAllWorkers(): WorkerDefinition[] {
    return ALL_WORKERS
  }

  getWorker(id: string): WorkerDefinition | undefined {
    return this.workers.get(id)
  }

  async route(workerId: string, args: any): Promise<WorkerResult> {
    const worker = this.workers.get(workerId)
    if (!worker) {
      return { success: false, output: `Worker '${workerId}' not found. Available: ${ALL_WORKERS.map(w => w.id).join(", ")}` }
    }
    try {
      const parsed = worker.schema.parse(args)
      return await worker.handler(parsed)
    } catch (err: any) {
      return { success: false, output: `Worker ${workerId} error: ${err.message}` }
    }
  }

  /** Natural language routing: match input to best worker by keywords */
  matchWorker(userInput: string): { worker: WorkerDefinition; confidence: number } | null {
    const input = userInput.toLowerCase()
    let best: { worker: WorkerDefinition; score: number } | null = null
    for (const w of ALL_WORKERS) {
      let score = 0
      for (const kw of w.keywords) {
        if (input.includes(kw.toLowerCase())) score++
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { worker: w, score }
      }
    }
    return best ? { worker: best.worker, confidence: best.score / Math.max(...best.worker.keywords.length, 1) } : null
  }
}

let _router: WorkerRouter | null = null

export function getWorkerRouter(): WorkerRouter {
  if (!_router) _router = new WorkerRouter()
  return _router
}

export * from "./worker.types.js"
