import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { Session } from "../../session"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import path from "path"
import fs from "fs"
import { AppRuntime } from "@/effect/app-runtime"

export const ShareCommand = cmd({
  command: "share",
  describe: "Session'lari paylasim icin export et",
  builder: (yargs: Argv) => {
    return yargs
      .option("session", {
        alias: "s",
        describe: "Session ID (bos birakirsan son session)",
        type: "string",
      })
      .option("format", {
        alias: "f",
        describe: "Export formati",
        type: "string",
        choices: ["markdown", "json", "html"],
        default: "markdown",
      })
      .option("output", {
        alias: "o",
        describe: "Cikis dosyasi (bos birakirsan stdout)",
        type: "string",
      })
      .option("include-tools", {
        describe: "Araclarin ciktilarini da dahil et",
        type: "boolean",
        default: false,
      })
      .option("anonymize", {
        describe: "Hassas bilgileri anonimlestir",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const sessions = [...Session.list({ roots: true, limit: args.session ? 1 : 5 })]

      if (sessions.length === 0) {
        UI.error("Session bulunamadi")
        process.exit(1)
      }

      let session = sessions[0]
      if (args.session) {
        const found = sessions.find((s) => s.id === args.session)
        if (!found) {
          UI.error(`Session bulunamadi: ${args.session}`)
          process.exit(1)
        }
        session = found
      }

      const messages = await AppRuntime.runPromise(
        Session.Service.use((svc) => svc.messages({ sessionID: session.id, agentID: "*" })),
      )

      let output: string

      switch (args.format) {
        case "json":
          output = formatAsJSON(session, messages, args.includeTools, args.anonymize)
          break
        case "html":
          output = formatAsHTML(session, messages, args.includeTools, args.anonymize)
          break
        default:
          output = formatAsMarkdown(session, messages, args.includeTools, args.anonymize)
      }

      if (args.output) {
        const dir = path.dirname(args.output)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(args.output, output)
        UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Session ${args.output} dosyasina export edildi` + UI.Style.TEXT_NORMAL)
      } else {
        console.log(output)
      }
    })
  },
})

function anonymizeText(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    .replace(/sk-[a-zA-Z0-9]{20,}/g, "[API_KEY]")
    .replace(/ghp_[a-zA-Z0-9]{36}/g, "[GITHUB_TOKEN]")
    .replace(/(?:password|sifre|parola)\s*[:=]\s*\S+/gi, "[REDACTED]")
}

function formatAsMarkdown(
  session: Session.Info,
  messages: any[],
  includeTools: boolean,
  anonymize: boolean,
): string {
  const lines: string[] = []
  lines.push(`# ${session.title}`)
  lines.push("")
  lines.push(`**Session ID:** ${session.id}`)
  lines.push(`**Olusturuldu:** ${new Date(session.time.created).toLocaleString("tr-TR")}`)
  lines.push(`**Guncellendi:** ${new Date(session.time.updated).toLocaleString("tr-TR")}`)
  lines.push("")
  lines.push("---")
  lines.push("")

  for (const msg of messages) {
    if (msg.info.role === "system") continue

    const role = msg.info.role === "user" ? "👤 Kullanıcı" : "🤖 Asistan"
    const content = msg.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => (p.type === "text" ? p.text : ""))
      .join("\n")

    if (!content) continue

    lines.push(`### ${role}`)
    lines.push("")

    let processedContent = content
    if (anonymize) processedContent = anonymizeText(processedContent)
    lines.push(processedContent)
    lines.push("")

    if (includeTools) {
      const toolParts = msg.parts.filter((p: any) => p.type === "tool")
      for (const tool of toolParts) {
        if (tool.type === "tool") {
          lines.push(`**Araç:** ${tool.tool}`)
          lines.push("```")
          lines.push(JSON.stringify(tool.args, null, 2))
          lines.push("```")
          lines.push("")
        }
      }
    }
  }

  return lines.join("\n")
}

function formatAsJSON(
  session: Session.Info,
  messages: any[],
  includeTools: boolean,
  anonymize: boolean,
): string {
  const data = {
    session: {
      id: session.id,
      title: session.title,
      created: session.time.created,
      updated: session.time.updated,
    },
    messages: messages
      .filter((m: any) => m.info.role !== "system")
      .map((msg: any) => {
        const content = msg.parts
          .filter((p: any) => p.type === "text")
          .map((p: any) => (p.type === "text" ? p.text : ""))
          .join("\n")

        let processedContent = content
        if (anonymize) processedContent = anonymizeText(processedContent)

        const result: any = {
          role: msg.info.role,
          content: processedContent,
        }

        if (includeTools) {
          const toolParts = msg.parts.filter((p: any) => p.type === "tool")
          if (toolParts.length > 0) {
            result.tools = toolParts.map((t: any) =>
              t.type === "tool" ? { name: t.tool, args: t.args } : null,
            ).filter(Boolean)
          }
        }

        return result
      }),
  }

  return JSON.stringify(data, null, 2)
}

function formatAsHTML(
  session: Session.Info,
  messages: any[],
  includeTools: boolean,
  anonymize: boolean,
): string {
  const lines: string[] = []
  lines.push(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #FF6B00; }
    .message { margin: 20px 0; padding: 15px; border-radius: 8px; background: #16213e; }
    .user { border-left: 4px solid #4CAF50; }
    .assistant { border-left: 4px solid #FF6B00; }
    .role { font-weight: bold; margin-bottom: 10px; }
    pre { background: #0f0f23; padding: 10px; border-radius: 4px; overflow-x: auto; }
    code { font-family: 'Fira Code', monospace; }
    .tool { margin-top: 10px; padding: 10px; background: #1a1a3e; border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${session.title}</h1>
  <p><strong>Session:</strong> ${session.id}</p>
  <p><strong>Tarih:</strong> ${new Date(session.time.created).toLocaleString("tr-TR")}</p>
  <hr>`)

  for (const msg of messages) {
    if (msg.info.role === "system") continue

    const roleClass = msg.info.role === "user" ? "user" : "assistant"
    const roleIcon = msg.info.role === "user" ? "👤" : "🤖"
    const content = msg.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => (p.type === "text" ? p.text : ""))
      .join("\n")

    if (!content) continue

    let processedContent = content
    if (anonymize) processedContent = anonymizeText(processedContent)

    lines.push(`<div class="message ${roleClass}">`)
    lines.push(`<div class="role">${roleIcon} ${msg.info.role === "user" ? "Kullanıcı" : "Asistan"}</div>`)
    lines.push(`<pre><code>${escapeHtml(processedContent)}</code></pre>`)

    if (includeTools) {
      const toolParts = msg.parts.filter((p: any) => p.type === "tool")
      for (const tool of toolParts) {
        if (tool.type === "tool") {
          lines.push(`<div class="tool"><strong>Araç:</strong> ${tool.tool}`)
          lines.push(`<pre><code>${escapeHtml(JSON.stringify(tool.args, null, 2))}</code></pre></div>`)
        }
      }
    }

    lines.push("</div>")
  }

  lines.push("</body></html>")
  return lines.join("\n")
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
