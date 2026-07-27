import fs from "fs"
import path from "path"
import { homedir } from "os"

export interface JSONLEntry {
  timestamp: string
  type: "session_start" | "session_end" | "message" | "tool_call" | "tool_result" | "error" | "checkpoint" | "agent_switch" | "model_switch"
  sessionId: string
  data: Record<string, any>
}

const JSONL_DIR = path.join(homedir(), ".glitchcode", "sessions-jsonl")

export class SessionJSONL {
  private stream: fs.WriteStream | null = null
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  private getStream(): fs.WriteStream {
    if (!this.stream) {
      fs.mkdirSync(JSONL_DIR, { recursive: true })
      const date = new Date().toISOString().split("T")[0]
      const filePath = path.join(JSONL_DIR, `${date}.jsonl`)
      this.stream = fs.createWriteStream(filePath, { flags: "a" })
    }
    return this.stream
  }

  private write(entry: JSONLEntry) {
    try {
      this.getStream().write(JSON.stringify(entry) + "\n")
    } catch {}
  }

  start() {
    this.write({
      timestamp: new Date().toISOString(),
      type: "session_start",
      sessionId: this.sessionId,
      data: { pid: process.pid, cwd: process.cwd(), node: process.version, platform: process.platform },
    })
  }

  end() {
    this.write({
      timestamp: new Date().toISOString(),
      type: "session_end",
      sessionId: this.sessionId,
      data: {},
    })
    this.close()
  }

  logMessage(role: string, content: string, tokens?: number, cost?: number) {
    this.write({
      timestamp: new Date().toISOString(),
      type: "message",
      sessionId: this.sessionId,
      data: { role, contentLength: content.length, tokens, cost },
    })
  }

  logToolCall(tool: string, args: any) {
    this.write({
      timestamp: new Date().toISOString(),
      type: "tool_call",
      sessionId: this.sessionId,
      data: { tool, args },
    })
  }

  logToolResult(tool: string, success: boolean, output: string) {
    this.write({
      timestamp: new Date().toISOString(),
      type: "tool_result",
      sessionId: this.sessionId,
      data: { tool, success, outputLength: output.length },
    })
  }

  logError(error: string, stack?: string) {
    this.write({
      timestamp: new Date().toISOString(),
      type: "error",
      sessionId: this.sessionId,
      data: { error, stack: stack?.substring(0, 500) },
    })
  }

  logCheckpoint(description: string, filesChanged: string[]) {
    this.write({
      timestamp: new Date().toISOString(),
      type: "checkpoint",
      sessionId: this.sessionId,
      data: { description, filesChanged, gitDiff: "" },
    })
  }

  logAgentSwitch(from: string, to: string) {
    this.write({
      timestamp: new Date().toISOString(),
      type: "agent_switch",
      sessionId: this.sessionId,
      data: { from, to },
    })
  }

  logModelSwitch(from: string, to: string) {
    this.write({
      timestamp: new Date().toISOString(),
      type: "model_switch",
      sessionId: this.sessionId,
      data: { from, to },
    })
  }

  close() {
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }
  }

  static getSessionFiles(): string[] {
    try {
      if (!fs.existsSync(JSONL_DIR)) return []
      return fs.readdirSync(JSONL_DIR)
        .filter(f => f.endsWith(".jsonl"))
        .sort()
        .map(f => path.join(JSONL_DIR, f))
    } catch { return [] }
  }

  static replaySession(sessionId: string): JSONLEntry[] {
    const entries: JSONLEntry[] = []
    for (const file of SessionJSONL.getSessionFiles()) {
      try {
        const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean)
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as JSONLEntry
            if (entry.sessionId === sessionId) entries.push(entry)
          } catch {}
        }
      } catch {}
    }
    return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  static getAllSessions(): { sessionId: string; startTime: string; endTime?: string; messageCount: number }[] {
    const sessions: Record<string, { startTime: string; endTime?: string; messageCount: number }> = {}
    for (const file of SessionJSONL.getSessionFiles()) {
      try {
        const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean)
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as JSONLEntry
            if (!sessions[entry.sessionId]) {
              sessions[entry.sessionId] = { startTime: entry.timestamp, messageCount: 0 }
            }
            if (entry.type === "session_end") sessions[entry.sessionId].endTime = entry.timestamp
            if (entry.type === "message") sessions[entry.sessionId].messageCount++
          } catch {}
        }
      } catch {}
    }
    return Object.entries(sessions)
      .map(([sessionId, info]) => ({ sessionId, ...info }))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  }

  static exportToMarkdown(sessionId: string): string {
    const entries = SessionJSONL.replaySession(sessionId)
    if (entries.length === 0) return `# Session ${sessionId}\n\n*No entries found*\n`

    let md = `# Session Replay: ${sessionId}\n\n`
    md += `**Export Date:** ${new Date().toISOString()}\n`
    md += `**Total Entries:** ${entries.length}\n\n`
    md += `---\n\n`

    for (const entry of entries) {
      const time = new Date(entry.timestamp).toLocaleTimeString()
      const icon = entry.type === "session_start" ? "🚀" : entry.type === "session_end" ? "🏁" : entry.type === "message" ? "💬" : entry.type === "tool_call" ? "🔧" : entry.type === "tool_result" ? "✅" : entry.type === "error" ? "❌" : entry.type === "checkpoint" ? "📌" : "•"
      md += `### ${icon} ${entry.type} (${time})\n\n`

      if (entry.type === "message") {
        md += `**Role:** ${entry.data.role}\n`
        md += `**Content:** ${(entry.data.contentLength || 0).toLocaleString()} chars\n`
        if (entry.data.tokens) md += `**Tokens:** ${entry.data.tokens}\n`
        if (entry.data.cost) md += `**Cost:** $${entry.data.cost}\n`
      } else if (entry.type === "tool_call") {
        md += `**Tool:** \`${entry.data.tool}\`\n`
        md += `**Args:** \`\`\`json\n${JSON.stringify(entry.data.args, null, 2)}\n\`\`\`\n`
      } else if (entry.type === "tool_result") {
        md += `**Tool:** \`${entry.data.tool}\`\n`
        md += `**Success:** ${entry.data.success}\n`
        md += `**Output:** ${(entry.data.outputLength || 0).toLocaleString()} chars\n`
      } else if (entry.type === "error") {
        md += `**Error:** ${entry.data.error}\n`
      } else if (entry.type === "checkpoint") {
        md += `**Description:** ${entry.data.description}\n`
        md += `**Files:** ${(entry.data.filesChanged || []).join(", ")}\n`
      } else if (entry.type === "agent_switch" || entry.type === "model_switch") {
        md += `**From:** ${entry.data.from} → **To:** ${entry.data.to}\n`
      }

      md += "\n"
    }

    return md
  }

  static exportToJSON(sessionId: string, pretty = true): string {
    const entries = SessionJSONL.replaySession(sessionId)
    const session = {
      sessionId,
      exportedAt: new Date().toISOString(),
      entries: entries.map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        ...e.data,
      })),
    }
    return JSON.stringify(session, null, pretty ? 2 : undefined)
  }
}
