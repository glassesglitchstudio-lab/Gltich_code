import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const buildShaderWorker: WorkerDefinition = {
  id: "build-shader",
  name: "Build Shader Worker",
  description: "Shader compilation and management. Compile, recompile, pipeline, manage shader cache.",
  category: "build",
  keywords: ["shader", "shader", "gölgelendirici", "compile", "derle", "material"],
  schema: z.object({
    action: z.enum(["compile", "recompile-all", "pipeline", "status", "cancel", "cache-clear"]).describe("Shader action"),
    shaderType: z.enum(["material", "postprocess", "compute"]).optional().describe("Shader type"),
    platform: z.enum(["vulkan", "dx12", "opengl"]).optional().describe("Rendering API"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, shaderType, platform } = args
    let command = "build shader"
    if (action === "recompile-all") command += " recompile-all"
    else if (action === "cache-clear") command += " cache-clear"
    else command += ` ${action}`
    if (shaderType) command += ` type=${shaderType}`
    if (platform) command += ` platform=${platform}`
    const result = await connector.sendCommand(command, { action, shaderType, platform })
    return {
      success: result.success,
      output: result.success ? `Shader ${action} completed` : `Shader failed: ${result.error}`,
      metadata: result,
    }
  },
}
