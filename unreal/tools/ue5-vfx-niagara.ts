import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxNiagaraActionSchema = z.enum([
  "spawn",
  "stop",
  "set-param",
  "reset",
  "clone",
])

export const ue5VfxNiagaraTool = tool({
  description:
    "Control UE5 Niagara particle systems. Spawn or stop Niagara systems, set dynamic parameters, reset state, or clone existing systems. Uses the 'vfx niagara' console command.",
  args: {
    action: VfxNiagaraActionSchema.describe("Niagara action to perform"),
    systemName: z
      .string()
      .optional()
      .describe("Name of the Niagara system to operate on"),
    paramName: z
      .string()
      .optional()
      .describe("Parameter name for set-param action"),
    paramValue: z
      .string()
      .optional()
      .describe("Parameter value (string, will be parsed by UE5)"),
    location: z
      .string()
      .optional()
      .describe("World location as 'X,Y,Z' for spawn or clone"),
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

    const { action, systemName, paramName, paramValue, location } = args

    if (!systemName) {
      return {
        output: "A systemName parameter is required for all Niagara actions.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "spawn":
        command = `vfx niagara spawn ${systemName}`
        if (location) command += ` location=${location}`
        description = `Spawned Niagara system '${systemName}'`
        break

      case "stop":
        command = `vfx niagara stop ${systemName}`
        description = `Stopped Niagara system '${systemName}'`
        break

      case "set-param":
        if (!paramName || !paramValue) {
          return {
            output: "Action 'set-param' requires both paramName and paramValue parameters.",
            metadata: { success: false },
          }
        }
        command = `vfx niagara set ${systemName} ${paramName}=${paramValue}`
        description = `Set parameter '${paramName}' to '${paramValue}' on '${systemName}'`
        break

      case "reset":
        command = `vfx niagara reset ${systemName}`
        description = `Reset Niagara system '${systemName}'`
        break

      case "clone":
        command = `vfx niagara clone ${systemName}`
        if (location) command += ` location=${location}`
        description = `Cloned Niagara system '${systemName}'`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      systemName,
      paramName,
      paramValue,
      location,
    })

    if (!result.success) {
      return {
        output: `Niagara command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        systemName,
        paramName,
        paramValue,
        location,
        rawResult: result.result,
      },
    }
  },
})
