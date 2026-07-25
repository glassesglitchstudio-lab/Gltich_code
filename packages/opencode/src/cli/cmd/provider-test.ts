/**
 * `glitch provider-test` — Test provider connections and API keys
 *
 * Tests API key validity, measures latency, and shows health status.
 */
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Auth } from "../../auth"
import { AppRuntime } from "../../effect/app-runtime"
import { Effect } from "effect"
import { testProviderConnection, testAllProviders } from "../../provider/health"
import type { HealthResult } from "../../provider/health"

export const ProviderTestCommand = cmd({
  command: "provider-test",
  aliases: ["test-provider", "health"],
  describe: "test provider connections and API keys",
  builder: (yargs) =>
    yargs
      .option("provider", {
        alias: ["p"],
        describe: "provider id to test (tests all if omitted)",
        type: "string",
      })
      .option("json", {
        describe: "output as JSON",
        type: "boolean",
        default: false,
      }),
  async handler(args) {
    UI.empty()
    prompts.intro("Provider Health Check")

    const credentials = await AppRuntime.runPromise(
      Effect.gen(function* () {
        const auth = yield* Auth.Service
        return Object.entries(yield* auth.all())
      }),
    )

    if (credentials.length === 0) {
      prompts.log.error("No credentials found. Run `glitch auth login` first.")
      return
    }

    const providersToTest = args.provider
      ? credentials.filter(([id]) => id === args.provider || id.includes(args.provider!))
      : credentials

    if (providersToTest.length === 0) {
      prompts.log.error(`No credentials found for "${args.provider}"`)
      return
    }

    const spinner = prompts.spinner()
    spinner.start(`Testing ${providersToTest.length} provider(s)...`)

    const results: HealthResult[] = []
    for (const [providerID, authInfo] of providersToTest) {
      const key = authInfo.type === "api" ? authInfo.key : ""
      if (!key) {
        results.push({
          providerID,
          status: "unknown",
          latencyMs: 0,
          error: "No API key (OAuth provider)",
          testedAt: Date.now(),
          modelCount: 0,
          hasValidKey: false,
        })
        continue
      }

      try {
        const result = await testProviderConnection(providerID, key)
        results.push(result)
      } catch (e: any) {
        results.push({
          providerID,
          status: "unhealthy",
          latencyMs: 0,
          error: e.message ?? "Test failed",
          testedAt: Date.now(),
          modelCount: 0,
          hasValidKey: false,
        })
      }
    }

    spinner.stop("Tests complete")

    if (args.json) {
      console.log(JSON.stringify(results, null, 2))
      return
    }

    // Display results
    UI.empty()
    prompts.intro("Results")

    const statusIcon = (status: string) => {
      switch (status) {
        case "healthy":
          return "✓"
        case "degraded":
          return "⚠"
        case "unhealthy":
          return "✗"
        case "skipped":
          return "○"
        default:
          return "?"
      }
    }

    const statusColor = (status: string) => {
      switch (status) {
        case "healthy":
          return UI.Style.TEXT_SUCCESS
        case "degraded":
          return UI.Style.TEXT_WARNING
        case "unhealthy":
          return UI.Style.TEXT_DANGER
        case "skipped":
          return UI.Style.TEXT_INFO
        default:
          return UI.Style.TEXT_DIM
      }
    }

    let healthyCount = 0
    let degradedCount = 0
    let unhealthyCount = 0
    let skippedCount = 0

    for (const result of results) {
      const icon = statusIcon(result.status)
      const color = statusColor(result.status)
      const latency = result.latencyMs > 0 ? `${result.latencyMs}ms` : "N/A"
      const models = result.modelCount > 0 ? `${result.modelCount} models` : ""

      const parts = [
        `${color}${icon} ${result.providerID}`,
        UI.Style.TEXT_DIM + latency,
        models ? UI.Style.TEXT_DIM + models : "",
      ].filter(Boolean)

      prompts.log.info(parts.join("  "))

      if (result.error) {
        prompts.log.warn(`  ${UI.Style.TEXT_DIM}${result.error}`)
      }

      switch (result.status) {
        case "healthy":
          healthyCount++
          break
        case "degraded":
          degradedCount++
          break
        case "unhealthy":
          unhealthyCount++
          break
        case "skipped":
          skippedCount++
          break
      }
    }

    prompts.outro(
      `${healthyCount} healthy, ${degradedCount} degraded, ${unhealthyCount} unhealthy, ${skippedCount} skipped`,
    )
  },
})
