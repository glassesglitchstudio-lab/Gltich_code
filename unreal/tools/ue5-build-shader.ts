import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const BuildShaderActionSchema = z.enum([
  "compile",
  "recompile-all",
  "pipeline",
  "status",
  "cancel",
  "cache-clear",
])

const ShaderTypeSchema = z.enum(["material", "postprocess", "compute"]).optional()

const ShaderPlatformSchema = z.enum(["vulkan", "dx12", "opengl"]).optional()

export const ue5BuildShaderTool = tool({
  description:
    "Manage UE5 shader compilation for cross-platform rendering. Compile shaders for specific types, trigger full recompilation, manage the shader pipeline, check compilation status, cancel ongoing compilation, or clear the shader cache. Uses the 'build shader' console command.",
  args: {
    action: BuildShaderActionSchema.describe("Shader build action to perform"),
    shaderType: ShaderTypeSchema.describe("Shader type to compile (material, postprocess, compute)"),
    platform: ShaderPlatformSchema.describe("Rendering API platform (vulkan, dx12, opengl)"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output:
          "UE5 Editor is not connected. Make sure the editor is running with the Glitch Code plugin enabled.",
        metadata: { success: false },
      }
    }

    const { action, shaderType, platform } = args

    let command: string
    let description: string

    switch (action) {
      case "compile":
        command = "build shader compile"
        if (shaderType) command += ` type=${shaderType}`
        if (platform) command += ` platform=${platform}`
        description = `Compiling${shaderType ? ` ${shaderType}` : ""} shaders${platform ? ` for ${platform}` : ""}`
        break

      case "recompile-all":
        command = "build shader recompile-all"
        if (platform) command += ` platform=${platform}`
        description = `Recompiling all shaders${platform ? ` for ${platform}` : ""}`
        break

      case "pipeline":
        command = "build shader pipeline"
        if (shaderType) command += ` type=${shaderType}`
        if (platform) command += ` platform=${platform}`
        description = `Managing shader pipeline${shaderType ? ` for ${shaderType}` : ""}`
        break

      case "status":
        command = "build shader status"
        description = "Retrieved shader compilation status"
        break

      case "cancel":
        command = "build shader cancel"
        description = "Cancelled shader compilation"
        break

      case "cache-clear":
        command = "build shader cache-clear"
        if (platform) command += ` platform=${platform}`
        description = "Cleared shader cache"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      shaderType,
      platform,
    })

    if (!result.success) {
      return {
        output: `Build shader command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        shaderType,
        platform,
        rawResult: result.result,
      },
    }
  },
})
