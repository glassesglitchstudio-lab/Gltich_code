import { tool } from "../../packages/plugin/src/tool.js"
import { getWorkerRouter, ALL_WORKERS } from "./index.js"

export function createWorkerTools() {
  return ALL_WORKERS.map(w => {
    const workerTool = tool({
      description: `[WORKER ${w.category.toUpperCase()}] ${w.name}: ${w.description}`,
      args: {
        ...w.schema.shape,
      },
      async execute(args) {
        const router = getWorkerRouter()
        const result = await router.route(w.id, args)
        return {
          output: result.output,
          metadata: { ...result.metadata, workerId: w.id, workerName: w.name, success: result.success },
        }
      },
    })
    return { name: `worker-${w.id}`, tool: workerTool }
  })
}
