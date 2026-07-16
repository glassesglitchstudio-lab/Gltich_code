import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const BuildPackageActionSchema = z.enum([
  "package",
  "stage",
  "ship",
  "test-build",
  "debug-build",
  "development-build",
])

const PackagePlatformSchema = z.enum(["windows", "linux", "android", "ios"]).optional()

const PackageConfigSchema = z.enum(["development", "staging", "shipping"]).optional()

export const ue5BuildPackageTool = tool({
  description:
    "Package UE5 builds for cross-platform deployment. Create full packages, stage builds, ship final builds, or create test/debug/development configurations. Uses the 'build package' console command.",
  args: {
    action: BuildPackageActionSchema.describe("Package action to perform"),
    platform: PackagePlatformSchema.describe("Target platform for packaging"),
    config: PackageConfigSchema.describe("Build configuration (development, staging, shipping)"),
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

    const { action, platform, config } = args

    let command: string
    let description: string

    switch (action) {
      case "package":
        command = "build package"
        if (platform) command += ` platform=${platform}`
        if (config) command += ` config=${config}`
        description = `Initiated build package${platform ? ` for ${platform}` : ""}${config ? ` (${config})` : ""}`
        break

      case "stage":
        command = "build package stage"
        if (platform) command += ` platform=${platform}`
        if (config) command += ` config=${config}`
        description = `Staged build${platform ? ` for ${platform}` : ""}`
        break

      case "ship":
        command = "build package ship"
        if (platform) command += ` platform=${platform}`
        description = `Shipping build${platform ? ` for ${platform}` : ""}`
        break

      case "test-build":
        command = "build package test-build"
        if (platform) command += ` platform=${platform}`
        description = `Created test build${platform ? ` for ${platform}` : ""}`
        break

      case "debug-build":
        command = "build package debug-build"
        if (platform) command += ` platform=${platform}`
        description = `Created debug build${platform ? ` for ${platform}` : ""}`
        break

      case "development-build":
        command = "build package development-build"
        if (platform) command += ` platform=${platform}`
        description = `Created development build${platform ? ` for ${platform}` : ""}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      platform,
      config,
    })

    if (!result.success) {
      return {
        output: `Build package command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        platform,
        config,
        rawResult: result.result,
      },
    }
  },
})
