import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ListActorsTool = tool({
  description:
    "List all actors in the current UE5 level. Sends 'obj list' console command and parses the output into a structured list.",
  args: {
    filter: z.string().optional().describe("Optional class name filter (e.g. 'StaticMeshActor')"),
    verbose: z.boolean().default(false).describe("If true, include additional details for each actor"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    let command = "obj list"
    if (args.filter) {
      command += ` class=${args.filter}`
    }
    if (args.verbose) {
      command += " full"
    }

    const result = await connector.sendCommand(command)
    if (!result.success) {
      return { output: `Failed to list actors: ${result.error}`, metadata: { success: false } }
    }

    const raw = result.result ?? ""
    const actors = parseActorList(raw)

    if (actors.length === 0) {
      return {
        output: args.filter ? `No actors found matching class "${args.filter}".` : "No actors found in the current level.",
        metadata: { success: true, count: 0, actors: [] },
      }
    }

    const formatted = actors
      .map((a, i) => `${i + 1}. ${a.name} (${a.className}) [${a.address}]`)
      .join("\n")

    return {
      output: `Found ${actors.length} actor(s):\n${formatted}`,
      metadata: { success: true, count: actors.length, actors },
    }
  },
})

interface ActorEntry {
  name: string
  className: string
  address: string
}

function parseActorList(raw: string): ActorEntry[] {
  const actors: ActorEntry[] = []
  const lines = raw.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("Class") || trimmed.startsWith("---") || trimmed.startsWith("Object")) continue

    // UE5 'obj list' output format varies; try common patterns:
    // Pattern: "ClassName Address Name"
    // Pattern: "Address ClassName Object Name"
    const match =
      trimmed.match(/^(\w+)\s+(0x[0-9a-fA-F]+)\s+(.+)$/) ??
      trimmed.match(/^(.+?)\s+Actor\s+(.+?)\s+\((.+?)\)/)

    if (match) {
      actors.push({
        className: match[1],
        address: match[2],
        name: match[3].trim(),
      })
    }
  }

  return actors
}
