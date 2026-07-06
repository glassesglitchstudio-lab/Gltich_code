import fs from "fs/promises"
import path from "path"
import type { Language } from "./types"

const DEFAULT_PATTERNS = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.js",
  "**/*.jsx",
]

const DEFAULT_EXCLUDE = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".nuxt",
  "coverage",
  "*.test.ts",
  "*.test.tsx",
  "*.test.js",
  "*.test.jsx",
  "*.spec.ts",
  "*.spec.tsx",
  "*.spec.js",
  "*.spec.jsx",
  "*.d.ts",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "*.min.js",
  "*.min.css",
]

const MAX_FILE_SIZE = 1024 * 1024 // 1MB

export class RepoMapScanner {
  private root: string
  private patterns: string[]
  private exclude: string[]
  private maxFileSize: number

  constructor(options?: {
    root?: string
    patterns?: string[]
    exclude?: string[]
    maxFileSize?: number
  }) {
    this.root = options?.root || process.cwd()
    this.patterns = options?.patterns || DEFAULT_PATTERNS
    this.exclude = options?.exclude || DEFAULT_EXCLUDE
    this.maxFileSize = options?.maxFileSize || MAX_FILE_SIZE
  }

  async scan(): Promise<string[]> {
    const files: string[] = []

    for (const pattern of this.patterns) {
      const matchedFiles = await this.globPattern(pattern)
      files.push(...matchedFiles)
    }

    // Deduplicate
    const uniqueFiles = [...new Set(files)]

    // Filter
    const filteredFiles = uniqueFiles.filter(file => {
      // Exclude patterns
      if (this.shouldExclude(file)) return false

      return true
    })

    return filteredFiles
  }

  async scanWithStats(): Promise<{
    files: string[]
    stats: {
      total: number
      byLanguage: Record<Language, number>
      totalSize: number
      averageSize: number
    }
  }> {
    const files = await this.scan()
    const stats = {
      total: files.length,
      byLanguage: {
        typescript: 0,
        javascript: 0,
        tsx: 0,
        jsx: 0,
      } as Record<Language, number>,
      totalSize: 0,
      averageSize: 0,
    }

    for (const file of files) {
      const ext = path.extname(file).toLowerCase()
      const lang = this.getLanguage(ext)
      if (lang) {
        stats.byLanguage[lang]++
      }

      try {
        const stat = await fs.stat(file)
        stats.totalSize += stat.size
      } catch {
        // Ignore stat errors
      }
    }

    stats.averageSize = stats.total > 0 ? stats.totalSize / stats.total : 0

    return { files, stats }
  }

  private async globPattern(pattern: string): Promise<string[]> {
    const files: string[] = []
    const baseDir = this.root

    // Simple glob implementation
    const parts = pattern.split("/")
    const isRecursive = parts.includes("**")
    const ext = parts[parts.length - 1]

    if (isRecursive) {
      await this.walkDirectory(baseDir, files, ext)
    } else {
      // Non-recursive: just check current directory
      try {
        const entries = await fs.readdir(baseDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isFile() && this.matchesExt(entry.name, ext)) {
            files.push(path.join(baseDir, entry.name))
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return files
  }

  private async walkDirectory(dir: string, files: string[], ext: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (!this.shouldExcludeDir(entry.name)) {
            await this.walkDirectory(fullPath, files, ext)
          }
        } else if (entry.isFile()) {
          if (this.matchesExt(entry.name, ext)) {
            try {
              const stat = await fs.stat(fullPath)
              if (stat.size <= this.maxFileSize) {
                files.push(fullPath)
              }
            } catch {
              // Ignore stat errors
            }
          }
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  private matchesExt(filename: string, pattern: string): boolean {
    if (pattern === "**" || pattern === "*") return true
    if (pattern.startsWith("*.")) {
      return filename.endsWith(pattern.slice(1))
    }
    return filename.endsWith(pattern)
  }

  private shouldExclude(filePath: string): boolean {
    const relativePath = path.relative(this.root, filePath)

    for (const excludePattern of this.exclude) {
      if (excludePattern.includes("*")) {
        // Wildcard pattern
        const regex = new RegExp(
          "^" + excludePattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
        )
        if (regex.test(path.basename(filePath))) return true
      } else {
        // Directory or exact match
        if (relativePath.includes(excludePattern)) return true
      }
    }

    return false
  }

  private shouldExcludeDir(dirName: string): boolean {
    return this.exclude.some(pattern => {
      if (pattern.includes("*")) return false
      return dirName === pattern || dirName.startsWith(".")
    })
  }

  getLanguage(ext: string): Language | null {
    switch (ext.toLowerCase()) {
      case ".ts": return "typescript"
      case ".tsx": return "tsx"
      case ".js": return "javascript"
      case ".jsx": return "jsx"
      default: return null
    }
  }
}

let _instance: RepoMapScanner | null = null

export function getRepoMapScanner(options?: {
  root?: string
  patterns?: string[]
  exclude?: string[]
}): RepoMapScanner {
  if (!_instance || options?.root) {
    _instance = new RepoMapScanner(options)
  }
  return _instance
}
