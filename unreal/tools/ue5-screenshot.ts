import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ScreenshotTool = tool({
  description:
    "Take a screenshot of the current UE5 Editor viewport. Saves the image to the specified filename at the given resolution.",
  args: {
    filename: z.string().default("screenshot.png").describe("Output filename for the screenshot (e.g. 'screenshot.png', 'level_overview.jpg')"),
    resolution: z
      .object({
        width: z.number().int().min(64).max(7680).default(1920),
        height: z.number().int().min(64).max(4320).default(1080),
      })
      .default({ width: 1920, height: 1080 })
      .describe("Screenshot resolution in pixels"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const { width, height } = args.resolution
    const command = `highresshot ${width}x${height} filename=${args.filename}`

    const result = await connector.sendCommand(command, {
      filename: args.filename,
      resolution: args.resolution,
    })

    if (!result.success) {
      return {
        output: `Screenshot failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Screenshot saved: ${args.filename} (${width}x${height})`,
      metadata: {
        success: true,
        filename: args.filename,
        resolution: args.resolution,
      },
    }
  },
})
