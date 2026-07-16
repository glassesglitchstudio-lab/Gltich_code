import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const BuildAssetActionSchema = z.enum([
  "list",
  "audit",
  "reference",
  "redirector",
  "fix",
  "migrate",
  "resize-textures",
])

const AssetTypeSchema = z.enum(["mesh", "texture", "material", "blueprint", "animation"]).optional()

export const ue5BuildAssetTool = tool({
  description:
    "Manage UE5 project assets across platforms. List, audit for issues, find references, detect orphaned redirectors, fix asset problems, migrate between platforms, or batch-resize textures. Uses the 'build asset' console command.",
  args: {
    action: BuildAssetActionSchema.describe("Asset management action to perform"),
    assetPath: z
      .string()
      .optional()
      .describe("Full asset path (e.g. '/Game/Textures/MyTexture') to operate on"),
    assetType: AssetTypeSchema.describe("Asset type filter (mesh, texture, material, blueprint, animation)"),
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

    const { action, assetPath, assetType } = args

    let command: string
    let description: string

    switch (action) {
      case "list":
        command = "build asset list"
        if (assetType) command += ` type=${assetType}`
        if (assetPath) command += ` path=${assetPath}`
        description = "Listed project assets"
        break

      case "audit":
        command = "build asset audit"
        if (assetType) command += ` type=${assetType}`
        if (assetPath) command += ` path=${assetPath}`
        description = "Audited assets for issues"
        break

      case "reference":
        if (!assetPath) {
          return {
            output: "Action 'reference' requires an 'assetPath' parameter.",
            metadata: { success: false },
          }
        }
        command = `build asset reference path=${assetPath}`
        description = `Found references for '${assetPath}'`
        break

      case "redirector":
        command = "build asset redirector"
        if (assetType) command += ` type=${assetType}`
        if (assetPath) command += ` path=${assetPath}`
        description = "Scanned for orphaned redirectors"
        break

      case "fix":
        command = "build asset fix"
        if (assetType) command += ` type=${assetType}`
        if (assetPath) command += ` path=${assetPath}`
        description = "Fixed asset issues"
        break

      case "migrate":
        if (!assetPath) {
          return {
            output: "Action 'migrate' requires an 'assetPath' parameter.",
            metadata: { success: false },
          }
        }
        command = `build asset migrate path=${assetPath}`
        description = `Migrating asset '${assetPath}'`
        break

      case "resize-textures":
        command = "build asset resize-textures"
        if (assetPath) command += ` path=${assetPath}`
        description = "Resizing textures for current platform"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      assetPath,
      assetType,
    })

    if (!result.success) {
      return {
        output: `Build asset command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        assetPath,
        assetType,
        rawResult: result.result,
      },
    }
  },
})
