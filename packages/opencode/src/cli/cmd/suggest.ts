import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import fs from "fs"
import path from "path"

interface Suggestion {
  type: "command" | "file" | "skill" | "config"
  name: string
  description: string
  confidence: number
}

export const SuggestCommand = cmd({
  command: "suggest",
  describe: "Context-aware oneri sistemi",
  builder: (yargs: Argv) => {
    return yargs
      .option("context", {
        alias: "c",
        describe: "Oneri baglami",
        type: "string",
        choices: ["project", "recent", "all"],
        default: "all",
      })
      .option("count", {
        alias: "n",
        describe: "Gosterilecek oneri sayisi",
        type: "number",
        default: 10,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const suggestions = await generateSuggestions(args.context, args.count)

      if (suggestions.length === 0) {
        UI.println("Oneri bulunamadi.")
        return
      }

      console.log("\n💡 ONERI SISTEMI\n")

      const grouped = {
        command: suggestions.filter((s) => s.type === "command"),
        file: suggestions.filter((s) => s.type === "file"),
        skill: suggestions.filter((s) => s.type === "skill"),
        config: suggestions.filter((s) => s.type === "config"),
      }

      if (grouped.command.length > 0) {
        console.log("⌨️  Komutlar:")
        for (const s of grouped.command) {
          console.log(`   ${s.name}`)
          console.log(`      ${s.description}`)
          console.log(`      Guven: ${(s.confidence * 100).toFixed(0)}%`)
        }
        console.log()
      }

      if (grouped.file.length > 0) {
        console.log("📁 Dosyalar:")
        for (const s of grouped.file) {
          console.log(`   ${s.name}`)
          console.log(`      ${s.description}`)
          console.log(`      Guven: ${(s.confidence * 100).toFixed(0)}%`)
        }
        console.log()
      }

      if (grouped.skill.length > 0) {
        console.log("🎯 Skill'ler:")
        for (const s of grouped.skill) {
          console.log(`   ${s.name}`)
          console.log(`      ${s.description}`)
          console.log(`      Guven: ${(s.confidence * 100).toFixed(0)}%`)
        }
        console.log()
      }

      if (grouped.config.length > 0) {
        console.log("⚙️  Config:")
        for (const s of grouped.config) {
          console.log(`   ${s.name}`)
          console.log(`      ${s.description}`)
          console.log(`      Guven: ${(s.confidence * 100).toFixed(0)}%`)
        }
        console.log()
      }
    })
  },
})

async function generateSuggestions(context: string, count: number): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = []

  const recentFiles = getRecentFiles(5)
  for (const file of recentFiles) {
    suggestions.push({
      type: "file",
      name: file,
      description: "Son duzenlenen dosya",
      confidence: 0.9,
    })
  }

  const packageJson = readPackageJson()
  if (packageJson) {
    if (packageJson.scripts) {
      for (const [name, desc] of Object.entries(packageJson.scripts)) {
        suggestions.push({
          type: "command",
          name: `npm run ${name}`,
          description: desc as string,
          confidence: 0.8,
        })
      }
    }

    if (packageJson.dependencies) {
      const deps = Object.keys(packageJson.dependencies)
      if (deps.includes("next")) {
        suggestions.push({
          type: "skill",
          name: "nextjs",
          description: "Next.js projesi tespit edildi",
          confidence: 0.85,
        })
      }
      if (deps.includes("react")) {
        suggestions.push({
          type: "skill",
          name: "react",
          description: "React projesi tespit edildi",
          confidence: 0.85,
        })
      }
      if (deps.includes("express") || deps.includes("fastify")) {
        suggestions.push({
          type: "skill",
          name: "backend",
          description: "Backend projesi tespit edildi",
          confidence: 0.8,
        })
      }
    }
  }

  const gitStatus = getGitStatus()
  if (gitStatus.hasChanges) {
    suggestions.push({
      type: "command",
      name: "git status",
      description: `${gitStatus.modified} degisiklik, ${gitStatus.untracked} takip edilmeyen dosya`,
      confidence: 0.95,
    })
  }

  if (gitStatus.hasUncommitted) {
    suggestions.push({
      type: "command",
      name: "git commit",
      description: "Degisiklikleri isle",
      confidence: 0.9,
    })
  }

  const configFiles = [".eslintrc.js", ".prettierrc", "tsconfig.json", "jest.config.js"]
  for (const config of configFiles) {
    if (fs.existsSync(path.join(process.cwd(), config))) {
      suggestions.push({
        type: "config",
        name: config,
        description: "Proje config dosyasi mevcut",
        confidence: 0.7,
      })
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence)

  return suggestions.slice(0, count)
}

function getRecentFiles(count: number): string[] {
  try {
    const { execSync } = require("child_process")
    const output = execSync("git log --pretty=format: --name-only -n 50", {
      encoding: "utf-8",
      timeout: 5000,
    })
    const files = [...new Set(output.split("\n").filter((f: string) => f.length > 0))] as string[]
    return files.slice(0, count)
  } catch {
    return []
  }
}

function readPackageJson(): any {
  try {
    const pkgPath = path.join(process.cwd(), "package.json")
    if (fs.existsSync(pkgPath)) {
      return JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
    }
  } catch {}
  return null
}

function getGitStatus(): { hasChanges: boolean; modified: number; untracked: number; hasUncommitted: boolean } {
  try {
    const { execSync } = require("child_process")
    const output = execSync("git status --porcelain", { encoding: "utf-8", timeout: 5000 })
    const lines = output.trim().split("\n").filter(Boolean)
    const modified = lines.filter((l: string) => l.startsWith(" M") || l.startsWith("M")).length
    const untracked = lines.filter((l: string) => l.startsWith("??")).length
    return {
      hasChanges: lines.length > 0,
      modified,
      untracked,
      hasUncommitted: modified > 0,
    }
  } catch {
    return { hasChanges: false, modified: 0, untracked: 0, hasUncommitted: false }
  }
}
