import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { Session } from "../../session"
import { Database } from "../../storage"
import { SessionTable } from "../../session/session.sql"
import { AppRuntime } from "@/effect/app-runtime"

interface ReplayMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp: number
  toolName?: string
}

export const ReplayCommand = cmd({
  command: "replay",
  describe: "Eski bir oturumu interaktif olarak tekrar oynat",
  builder: (yargs: Argv) => {
    return yargs
      .option("session", {
        alias: "s",
        describe: "Oturum ID (son 5 gosterilir)",
        type: "string",
      })
      .option("last", {
        alias: "l",
        describe: "Son N oturumu listele",
        type: "number",
        default: 5,
      })
      .option("format", {
        alias: "f",
        describe: "Cikis formati",
        type: "string",
        choices: ["terminal", "json", "markdown"],
        default: "terminal",
      })
      .option("skip-tools", {
        describe: "Tool ciktilarini atla",
        type: "boolean",
        default: false,
      })
      .option("search", {
        describe: "Mesajlarda ara",
        type: "string",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const rows = Database.use((db) => db.select().from(SessionTable).all())
      const sessions = rows.map((row) => Session.fromRow(row))

      if (!args.session) {
        const recent = sessions
          .sort((a, b) => b.time.updated - a.time.updated)
          .slice(0, args.last as number)

        if (recent.length === 0) {
          console.log("Hicbir oturum bulunamadi.")
          return
        }

        console.log("\nSon Oturumlar:\n")
        for (const s of recent) {
          const date = new Date(s.time.created).toLocaleDateString("tr-TR")
          const title = (s.title || "Basliksiz").substring(0, 40)
          console.log(`  ${s.id.substring(0, 8)}  ${date}  ${title}`)
        }
        console.log(`\nKullanim: glitch replay --session <oturum-id>`)
        return
      }

      const session = sessions.find((s) => s.id === args.session || s.id.startsWith(args.session as string))
      if (!session) {
        console.log(`"${args.session}" oturumu bulunamadi.`)
        return
      }

      const messages = await AppRuntime.runPromise(
        Session.Service.use((svc: any) => svc.messages({ sessionID: session.id, agentID: "*" })),
      )

      const replayMessages: ReplayMessage[] = (messages as Array<{ info?: { role?: string }; parts?: Array<{ type: string; text?: string; tool?: string }>; time?: { created?: number } }>)
        .filter((m) => {
          if (args["skip-tools"]) {
            const role = m.info?.role as string
            if (role === "tool") return false
          }
          return true
        })
        .map((m) => {
          const info = m.info
          const content = m.parts
            ?.filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join("") ?? ""
          return {
            role: (info?.role ?? "system") as ReplayMessage["role"],
            content,
            timestamp: m.time?.created ?? Date.now(),
            toolName: m.parts?.find((p) => p.type === "tool")?.tool,
          }
        })

      let filtered = replayMessages
      if (args.search) {
        const q = (args.search as string).toLowerCase()
        filtered = replayMessages.filter((m) => m.content.toLowerCase().includes(q))
        if (filtered.length === 0) {
          console.log(`"${args.search}" icin sonuc bulunamadi.`)
          return
        }
      }

      switch (args.format) {
        case "json":
          console.log(JSON.stringify(filtered, null, 2))
          break
        case "markdown":
          printMarkdown(filtered, session.id)
          break
        default:
          printTerminal(filtered, session.id)
      }
    })
  },
})

function printTerminal(messages: ReplayMessage[], sessionId: string) {
  console.log("\n" + "═".repeat(60))
  console.log(`  OTURUM REPLAY — ${sessionId.substring(0, 8)}`)
  console.log("═".repeat(60))

  for (const m of messages) {
    const roleIcon = m.role === "user" ? "👤" : m.role === "assistant" ? "🤖" : m.role === "tool" ? "🔧" : "⚙️"
    const roleLabel = m.role.toUpperCase()

    console.log(`\n${"─".repeat(60)}`)
    console.log(`${roleIcon} [${roleLabel}]${m.toolName ? ` (${m.toolName})` : ""}`)

    const lines = m.content.split("\n")
    for (const line of lines) {
      console.log(`  ${line}`)
    }
  }

  console.log(`\n${"═".repeat(60)}`)
  console.log(`  TOPLAM: ${messages.length} mesaj`)
  console.log("═".repeat(60) + "\n")
}

function printMarkdown(messages: ReplayMessage[], sessionId: string) {
  console.log(`# Oturum Replay — ${sessionId.substring(0, 8)}\n`)

  for (const m of messages) {
    const label = m.role === "user" ? "Kullanici" : m.role === "assistant" ? "Asistan" : m.role === "tool" ? `Tool (${m.toolName})` : "Sistem"
    console.log(`### ${label}\n`)
    console.log(`${m.content}\n`)
  }

  console.log(`---\n*Toplam: ${messages.length} mesaj*`)
}
