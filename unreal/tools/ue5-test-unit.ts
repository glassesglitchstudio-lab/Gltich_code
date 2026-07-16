import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5TestUnitTool = tool({
  description:
    "Manage UE5 unit tests: run individual tests, run all tests, run by suite, list tests, filter tests, or generate reports. Sends test commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["run", "run-all", "run-suite", "list", "filter", "report"])
      .describe("Unit test action to perform"),
    testName: z
      .string()
      .optional()
      .describe("Name of the specific unit test to run (required for 'run')"),
    suite: z
      .string()
      .optional()
      .describe("Test suite name to run (required for 'run-suite')"),
    filter: z
      .string()
      .optional()
      .describe("Filter string to match test names (used with 'filter')"),
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

    const { action, testName, suite, filter } = args

    if (action === "run" && !testName) {
      return {
        output: "Action 'run' requires a testName. Provide the name of the unit test to run.",
        metadata: { success: false },
      }
    }

    if (action === "run-suite" && !suite) {
      return {
        output: "Action 'run-suite' requires a suite name.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "run":
        command = `test unit run ${testName}`
        description = `Running unit test '${testName}'`
        break
      case "run-all":
        command = `test unit run-all`
        description = "Running all unit tests"
        break
      case "run-suite":
        command = `test unit run-suite ${suite}`
        description = `Running unit test suite '${suite}'`
        break
      case "list":
        command = `test unit list`
        description = "Listing all registered unit tests"
        break
      case "filter":
        command = `test unit filter ${filter ?? "*"}`
        description = `Filtering unit tests by '${filter ?? "*"}'`
        break
      case "report":
        command = `test unit report`
        description = "Generating unit test report"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      testName,
      suite,
      filter,
    })

    if (!result.success) {
      return {
        output: `Unit test command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        testName,
        suite,
        filter,
      },
    }
  },
})
