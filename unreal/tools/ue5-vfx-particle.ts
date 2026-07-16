import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxParticleActionSchema = z.enum([
  "spawn",
  "stop",
  "pause",
  "resume",
  "set-rate",
  "set-color",
  "set-lifetime",
])

const ParticleTypeSchema = z.enum([
  "fire",
  "smoke",
  "dust",
  "spark",
  "blood",
  "ghost",
])

export const ue5VfxParticleTool = tool({
  description:
    "Control UE5 particle effects. Spawn, stop, pause, or resume particle systems. Adjust spawn rate, color, and lifetime. Supports fire, smoke, dust, spark, blood, and ghost particle types.",
  args: {
    action: VfxParticleActionSchema.describe("Particle action to perform"),
    particleType: ParticleTypeSchema.optional().describe(
      "Particle type: fire, smoke, dust, spark, blood, or ghost"
    ),
    location: z
      .string()
      .optional()
      .describe("World location as 'X,Y,Z' for particle spawn"),
    rate: z.number().optional().describe("Spawn rate (particles per second)"),
    color: z
      .string()
      .optional()
      .describe("Color as 'R,G,B,A' (0-1 range)"),
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

    const { action, particleType, location, rate, color } = args

    let command: string
    let description: string

    switch (action) {
      case "spawn":
        command = `vfx particle spawn`
        if (particleType) command += ` type=${particleType}`
        if (location) command += ` location=${location}`
        description = `Spawned ${particleType ?? "default"} particle system`
        break

      case "stop":
        command = `vfx particle stop`
        if (particleType) command += ` type=${particleType}`
        description = `Stopped ${particleType ?? "all"} particle system(s)`
        break

      case "pause":
        command = `vfx particle pause`
        if (particleType) command += ` type=${particleType}`
        description = `Paused ${particleType ?? "all"} particle system(s)`
        break

      case "resume":
        command = `vfx particle resume`
        if (particleType) command += ` type=${particleType}`
        description = `Resumed ${particleType ?? "all"} particle system(s)`
        break

      case "set-rate":
        if (rate === undefined) {
          return {
            output: "Action 'set-rate' requires a rate parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx particle rate=${rate}`
        if (particleType) command += ` type=${particleType}`
        description = `Set particle spawn rate to ${rate}`
        break

      case "set-color":
        if (!color) {
          return {
            output: "Action 'set-color' requires a color parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx particle color=${color}`
        if (particleType) command += ` type=${particleType}`
        description = `Set particle color to ${color}`
        break

      case "set-lifetime":
        if (rate === undefined) {
          return {
            output: "Action 'set-lifetime' requires a rate parameter (lifetime in seconds).",
            metadata: { success: false },
          }
        }
        command = `vfx particle lifetime=${rate}`
        if (particleType) command += ` type=${particleType}`
        description = `Set particle lifetime to ${rate}s`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      particleType,
      location,
      rate,
      color,
    })

    if (!result.success) {
      return {
        output: `Particle command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        particleType,
        location,
        rate,
        color,
        rawResult: result.result,
      },
    }
  },
})
