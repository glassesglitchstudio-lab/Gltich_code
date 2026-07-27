import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { homedir } from "os"

export interface Checkpoint {
  id: string
  timestamp: string
  taskId: string
  sessionId: string
  description: string
  gitHash: string
  filesChanged: string[]
  diff: string
  metadata: Record<string, any>
  parentCheckpointId?: string
}

const CHECKPOINT_DIR = path.join(homedir(), ".glitchcode", "checkpoints")

export class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map()
  private currentTaskId: string
  private currentSessionId: string

  constructor(sessionId: string, taskId: string) {
    this.currentSessionId = sessionId
    this.currentTaskId = taskId
    this.load()
  }

  private getFilePath(): string {
    return path.join(CHECKPOINT_DIR, `${this.currentSessionId}.json`)
  }

  private load() {
    try {
      const filePath = this.getFilePath()
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"))
        for (const cp of data) {
          this.checkpoints.set(cp.id, cp)
        }
      }
    } catch {}
  }

  private save() {
    try {
      fs.mkdirSync(CHECKPOINT_DIR, { recursive: true })
      fs.writeFileSync(this.getFilePath(), JSON.stringify(Array.from(this.checkpoints.values())), "utf8")
    } catch {}
  }

  private generateId(): string {
    const now = Date.now().toString(36)
    const rand = Math.random().toString(36).substring(2, 6)
    return `CP-${now}-${rand}`
  }

  private getGitDiff(): string {
    try {
      return execSync("git diff --no-color", { encoding: "utf-8", timeout: 5000, windowsHide: true })
    } catch { return "" }
  }

  private getGitHash(): string {
    try {
      return execSync("git rev-parse HEAD", { encoding: "utf-8", timeout: 5000, windowsHide: true }).trim()
    } catch { return "unknown" }
  }

  private getChangedFiles(): string[] {
    try {
      const diff = execSync("git diff --name-only", { encoding: "utf-8", timeout: 5000, windowsHide: true })
      const staged = execSync("git diff --cached --name-only", { encoding: "utf-8", timeout: 5000, windowsHide: true })
      return [...new Set([...diff.trim().split("\n"), ...staged.trim().split("\n")].filter(Boolean))]
    } catch { return [] }
  }

  create(description: string, metadata: Record<string, any> = {}): Checkpoint {
    const lastCheckpoint = this.getLatest()
    const checkpoint: Checkpoint = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      taskId: this.currentTaskId,
      sessionId: this.currentSessionId,
      description,
      gitHash: this.getGitHash(),
      filesChanged: this.getChangedFiles(),
      diff: this.getGitDiff(),
      metadata,
      parentCheckpointId: lastCheckpoint?.id,
    }
    this.checkpoints.set(checkpoint.id, checkpoint)
    this.save()

    try {
      execSync(`git add -A && git commit --allow-empty -m "checkpoint: ${description}" --no-verify`, {
        encoding: "utf-8", timeout: 10000, windowsHide: true, stdio: "ignore",
      })
    } catch {}

    return checkpoint
  }

  getLatest(taskId?: string): Checkpoint | undefined {
    const entries = Array.from(this.checkpoints.values())
      .filter(cp => !taskId || cp.taskId === taskId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return entries[0]
  }

  get(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id)
  }

  list(taskId?: string, limit = 20): Checkpoint[] {
    let entries = Array.from(this.checkpoints.values())
    if (taskId) entries = entries.filter(cp => cp.taskId === taskId)
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit)
  }

  getChain(checkpointId: string): Checkpoint[] {
    const chain: Checkpoint[] = []
    let current = this.checkpoints.get(checkpointId)
    while (current) {
      chain.unshift(current)
      current = current.parentCheckpointId ? this.checkpoints.get(current.parentCheckpointId) : undefined
    }
    return chain
  }

  rollback(checkpointId: string): { success: boolean; filesRestored: string[]; error?: string } {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) return { success: false, filesRestored: [], error: `Checkpoint ${checkpointId} not found` }

    try {
      const changes = checkpoint.diff
      if (!changes) return { success: true, filesRestored: [], error: "No changes to rollback" }

      execSync(`git checkout -- .`, { encoding: "utf-8", timeout: 15000, windowsHide: true })
      execSync(`git checkout ${checkpoint.gitHash} -- ${checkpoint.filesChanged.join(" ")}`, {
        encoding: "utf-8", timeout: 15000, windowsHide: true,
      })

      return { success: true, filesRestored: checkpoint.filesChanged }
    } catch (err: any) {
      return { success: false, filesRestored: [], error: err.message }
    }
  }

  getDiffBetween(fromId: string, toId: string): string {
    const from = this.checkpoints.get(fromId)
    const to = this.checkpoints.get(toId)
    if (!from || !to) return "Checkpoint not found"

    try {
      return execSync(`git diff ${from.gitHash}..${to.gitHash} --no-color`, {
        encoding: "utf-8", timeout: 10000, windowsHide: true,
      })
    } catch { return "" }
  }

  prune(maxCheckpoints = 100) {
    const all = Array.from(this.checkpoints.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    if (all.length > maxCheckpoints) {
      const toRemove = all.slice(maxCheckpoints)
      for (const cp of toRemove) {
        this.checkpoints.delete(cp.id)
      }
      this.save()
    }
  }

  clear(sessionId?: string) {
    if (sessionId) {
      const toDelete = Array.from(this.checkpoints.values()).filter(cp => cp.sessionId === sessionId)
      for (const cp of toDelete) this.checkpoints.delete(cp.id)
    } else {
      this.checkpoints.clear()
    }
    this.save()
  }

  exportToMarkdown(checkpointId: string): string {
    const cp = this.checkpoints.get(checkpointId)
    if (!cp) return `# Checkpoint ${checkpointId}\n\n*Not found*\n`

    let md = `# Checkpoint: ${cp.id}\n\n`
    md += `**Description:** ${cp.description}\n`
    md += `**Task:** ${cp.taskId}\n`
    md += `**Time:** ${cp.timestamp}\n`
    md += `**Git Hash:** \`${cp.gitHash}\`\n`
    md += `**Files Changed:** ${cp.filesChanged.length}\n\n`

    if (cp.filesChanged.length > 0) {
      md += `## Files\n\n`
      for (const file of cp.filesChanged) {
        md += `- \`${file}\`\n`
      }
      md += "\n"
    }

    if (cp.diff) {
      md += `## Diff\n\n\`\`\`diff\n${cp.diff.substring(0, 5000)}\n\`\`\`\n`
      if (cp.diff.length > 5000) md += "\n*(diff truncated)*\n"
    }

    return md
  }
}

let _instances: Map<string, CheckpointManager> = new Map()

export function getCheckpointManager(sessionId: string, taskId: string): CheckpointManager {
  const key = `${sessionId}:${taskId}`
  if (!_instances.has(key)) {
    _instances.set(key, new CheckpointManager(sessionId, taskId))
  }
  return _instances.get(key)!
}

export function getSessionCheckpoints(sessionId: string): Checkpoint[] {
  const manager = new CheckpointManager(sessionId, "")
  return manager.list()
}
