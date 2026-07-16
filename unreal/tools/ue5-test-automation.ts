import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5TestAutomationTool = tool({
  description:
    "Manage UE5 test automation: run automated test suites, schedule tests, list past runs, stop execution, export results, or configure CI integration. Sends automation commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["run", "schedule", "list-runs", "stop", "export", "ci"])
      .describe("Test automation action to perform"),
    testSuite: z
      .string()
      .optional()
      .describe("Test suite name to run or schedule (used with 'run' or 'schedule')"),
    config: z
      .string()
      .optional()
      .describe("Configuration file or JSON string for automation settings (used with 'run' or 'ci')"),
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

    const { action, testSuite, config } = args

    let command: string
    let description: string

    switch (action) {
      case "run":
        command = `test automation run ${testSuite ?? "all"} ${config ?? ""}`
        description = `Running automated test suite '${testSuite ?? "all"}'`
        break
      case "schedule":
        if (!testSuite) {
          return {
            output: "Action 'schedule' requires a testSuite name.",
            metadata: { success: false },
          }
        }
        command = `test automation schedule ${testSuite}`
        description = `Scheduling automated test suite '${testSuite}'`
        break
      case "list-runs":
        command = `test automation list-runs`
        description = "Listing past automation runs"
        break
      case "stop":
        command = `test automation stop`
        description = "Stopping current automation execution"
        break
      case "export":
        command = `test automation export ${config ?? "json"}`
        description = `Exporting automation results as ${config ?? "json"}`
        break
      case "ci":
        command = `test automation ci ${config ?? ""}`
        description = `Running CI integration${config ? ` with config '${config}'` : ""}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      testSuite,
      config,
    })

    if (!result.success) {
      return {
        output: `Automation command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        testSuite,
        config,
      },
    }
  },
})
