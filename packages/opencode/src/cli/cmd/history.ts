import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { Session } from "../../session"
import { bootstrap } from "../bootstrap"
import { Database } from "../../storage"
import { SessionTable } from "../../session/session.sql"
import { UI } from "../ui"
import { Locale } from "../../util"
import { AppRuntime } from "@/effect/app-runtime"
import { EOL } from "os"

interface HistoryEntry {
  sessionID: string
  title: string
  timestamp: number
  role: "user" | "assistant"
  content: string
  preview: string
}

export const HistoryCommand = cmd({
  command: "history",
  describe: "Gelismis session gecmisi arama",
  builder: (yargs: Argv) => {
    return yargs
      .option("search", {
        alias: "s",
        describe: "Arama sorgusu",
        type: "string",
      })
      .option("days", {
        describe: "Son N gun",
        type: "number",
      })
      .option("session", {
        alias: "id",
        describe: "Belirli bir session",
        type: "string",
      })
      .option("limit", {
        alias: "n",
        describe: "Gosterilecek sonuc sayisi",
        type: "number",
        default: 20,
      })
      .option("format", {
        alias: "f",
        describe: "Cikis formati",
        type: "string",
        choices: ["table", "json", "verbose"],
        default: "table",
      })
      .option("role", {
        describe: "Rol filtresi",
        type: "string",
        choices: ["user", "assistant"],
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const entries = await searchHistory(args)

      if (entries.length === 0) {
        UI.println("Sonuc bulunamadi.")
        return
      }

      switch (args.format) {
        case "json":
          console.log(JSON.stringify(entries, null, 2))
          break
        case "verbose":
          printVerbose(entries)
          break
        default:
          printTable(entries)
      }
    })
  },
})

async function searchHistory(args: any): Promise<HistoryEntry[]> {
  const MS_IN_DAY = 24 * 60 * 60 * 1000
  const cutoff = args.days ? Date.now() - args.days * MS_IN_DAY : 0

  const rows = Database.use((db) => db.select().from(SessionTable).all())
  let sessions = rows.map((row) => Session.fromRow(row))

  if (args.session) {
    sessions = sessions.filter((s) => s.id === args.session)
  }

  if (cutoff > 0) {
    sessions = sessions.filter((s) => s.time.updated >= cutoff)
  }

  const entries: HistoryEntry[] = []

  for (const session of sessions.slice(0, 10)) {
    const messages = await AppRuntime.runPromise(
      Session.Service.use((svc) => svc.messages({ sessionID: session.id, agentID: "*" })),
    )

    for (const msg of messages) {
      const role = msg.info.role as string
      if (role === "system") continue
      if (args.role && role !== args.role) continue

      const content = msg.parts
        .filter((p) => p.type === "text")
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("\n")

      if (!content) continue

      const preview = content.length > 100 ? content.substring(0, 97) + "..." : content

      entries.push({
        sessionID: session.id,
        title: session.title,
        timestamp: (msg as { time?: { created?: number } }).time?.created || Date.now(),
        role: msg.info.role as "user" | "assistant",
        content,
        preview,
      })
    }
  }

  if (args.search) {
    const query = args.search.toLowerCase()
    return entries.filter(
      (e) =>
        e.preview.toLowerCase().includes(query) ||
        e.title.toLowerCase().includes(query) ||
        e.content.toLowerCase().includes(query),
    )
  }

  entries.sort((a, b) => b.timestamp - a.timestamp)

  return entries.slice(0, args.limit)
}

function printTable(entries: HistoryEntry[]) {
  console.log("\n📜 SESSION GECMISI\n")
  console.log("─".repeat(80))

  for (const entry of entries) {
    const time = Locale.todayTimeOrDateTime(entry.timestamp)
    const role = entry.role === "user" ? "👤" : "🤖"
    const title =
      entry.title.length > 25 ? entry.title.substring(0, 22) + "..." : entry.title

    console.log(`${role} ${time} [${title}]`)
    console.log(`   ${entry.preview}`)
    console.log()
  }

  console.log("─".repeat(80))
  console.log(`Toplam: ${entries.length} sonuc`)
}

function printVerbose(entries: HistoryEntry[]) {
  console.log("\n📜 SESSION GECMISI (AYRINTILI)\n")

  let currentSession = ""

  for (const entry of entries) {
    if (entry.sessionID !== currentSession) {
      currentSession = entry.sessionID
      console.log("═".repeat(80))
      console.log(`📁 ${entry.title} (${entry.sessionID})`)
      console.log("═".repeat(80))
    }

    const time = new Date(entry.timestamp).toLocaleString("tr-TR")
    const role = entry.role === "user" ? "👤 KULLANICI" : "🤖 ASISTAN"

    console.log(`\n${role} - ${time}`)
    console.log("─".repeat(40))
    console.log(entry.content)
    console.log()
  }
}
