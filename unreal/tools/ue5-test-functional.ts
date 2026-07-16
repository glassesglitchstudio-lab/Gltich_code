import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5TestFunctionalTool = tool({
  description:
    "Manage UE5 functional tests: run tests, run all, setup/teardown, list tests, or assert conditions. Sends functional test commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["run", "run-all", "setup", "teardown", "list", "assert"])
      .describe("Functional test action to perform"),
    testName: z
      .string()
      .optional()
      .describe("Name of the functional test to run or assert on"),
    assertType: z
      .enum(["equal", "contains", "true", "false", "null"])
      .optional()
      .describe("Assertion type to use with 'assert' action"),
    expected: z
      .string()
      .optional()
      .describe("Expected value for assertion (used with assertType 'equal' or 'contains')"),
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

    const { action, testName, assertType, expected } = args

    if (action === "run" && !testName) {
      return {
        output: "Action 'run' requires a testName. Provide the name of the functional test to run.",
        metadata: { success: false },
      }
    }

    if (action === "assert" && !assertType) {
      return {
        output: "Action 'assert' requires an assertType (equal, contains, true, false, null).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "run":
        command = `test functional run ${testName}`
        description = `Running functional test '${testName}'`
        break
      case "run-all":
        command = `test functional run-all`
        description = "Running all functional tests"
        break
      case "setup":
        command = `test functional setup ${testName ?? ""}`
        description = `Setting up functional test environment${testName ? ` for '${testName}'` : ""}`
        break
      case "teardown":
        command = `test functional teardown ${testName ?? ""}`
        description = `Tearing down functional test environment${testName ? ` for '${testName}'` : ""}`
        break
      case "list":
        command = `test functional list`
        description = "Listing all registered functional tests"
        break
      case "assert":
        command = `test functional assert ${assertType} ${expected ?? ""}`
        description = `Asserting ${assertType}${expected ? ` with expected value '${expected}'` : ""}`
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
      assertType,
      expected,
    })

    if (!result.success) {
      return {
        output: `Functional test command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        testName,
        assertType,
        expected,
      },
    }
  },
})
