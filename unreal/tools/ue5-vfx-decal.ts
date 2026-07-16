import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxDecalActionSchema = z.enum([
  "place",
  "remove",
  "list",
  "blood",
  "crack",
  "graffiti",
])

const DecalTypeSchema = z.enum([
  "blood",
  "crack",
  "graffiti",
  "bullet",
  "burn",
])

export const ue5VfxDecalTool = tool({
  description:
    "Control UE5 decal effects. Place or remove decals at world locations. Quick commands for blood splatter, cracks, graffiti, bullet holes, or burn marks. Set decal size and rotation. Uses the 'vfx decal' console command.",
  args: {
    action: VfxDecalActionSchema.describe("Decal action to perform"),
    decalType: DecalTypeSchema.optional().describe(
      "Decal type: blood, crack, graffiti, bullet, or burn"
    ),
    location: z
      .string()
      .optional()
      .describe("World location as 'X,Y,Z' for decal placement"),
    size: z.number().optional().describe("Decal size scale factor"),
    rotation: z
      .number()
      .optional()
      .describe("Decal rotation in degrees (0-360)"),
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

    const { action, decalType, location, size, rotation } = args

    let command: string
    let description: string

    switch (action) {
      case "place":
        command = `vfx decal place`
        if (decalType) command += ` type=${decalType}`
        if (location) command += ` location=${location}`
        if (size !== undefined) command += ` size=${size}`
        if (rotation !== undefined) command += ` rotation=${rotation}`
        description = `Placed ${decalType ?? "default"} decal${location ? ` at ${location}` : ""}`
        break

      case "remove":
        command = `vfx decal remove`
        if (location) command += ` location=${location}`
        description = `Removed decal(s)${location ? ` at ${location}` : ""}`
        break

      case "list":
        command = `vfx decal list`
        description = "Listed all active decals"
        break

      case "blood":
        command = `vfx decal blood`
        if (location) command += ` location=${location}`
        if (size !== undefined) command += ` size=${size}`
        description = `Placed blood decal${location ? ` at ${location}` : ""}`
        break

      case "crack":
        command = `vfx decal crack`
        if (location) command += ` location=${location}`
        if (size !== undefined) command += ` size=${size}`
        description = `Placed crack decal${location ? ` at ${location}` : ""}`
        break

      case "graffiti":
        command = `vfx decal graffiti`
        if (location) command += ` location=${location}`
        if (size !== undefined) command += ` size=${size}`
        if (rotation !== undefined) command += ` rotation=${rotation}`
        description = `Placed graffiti decal${location ? ` at ${location}` : ""}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      decalType,
      location,
      size,
      rotation,
    })

    if (!result.success) {
      return {
        output: `Decal command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        decalType,
        location,
        size,
        rotation,
        rawResult: result.result,
      },
    }
  },
})
