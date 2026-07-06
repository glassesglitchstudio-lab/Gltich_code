import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { RepoMapParser, getRepoMapParser } from "./parser"
import { RepoMapCache, getRepoMapCache } from "./cache"
import type { FileEntry, RepoMap, RepoMapStats, Language, RepoMapBuildOptions } from "./types"

export class RepoMapAnalyzer {
  private parser: RepoMapParser
  private cache: RepoMapCache
  private root: string

  constructor(root?: string) {
    this.root = root || process.cwd()
    this.parser = new RepoMapParser()
    this.cache = new RepoMapCache(this.root)
  }

  async init(): Promise<void> {
    await this.parser.init()
    await this.cache.init()
  }

  async analyzeFile(filePath: string): Promise<FileEntry> {
    const content = await fs.readFile(filePath, "utf-8")
    const hash = crypto.createHash("md5").update(content).digest("hex")
    const stat = await fs.stat(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const language = this.getLanguage(ext)

    if (!language) {
      throw new Error(`Unsupported file type: ${ext}`)
    }

    // Check cache
    const cached = await this.cache.get(filePath)
    if (cached && cached.hash === hash) {
      return cached
    }

    // Parse
    const tree = this.parser.parse(content, language)
    const exports = this.parser.extractExports(tree, language)
    const imports = this.parser.extractImports(tree, language)

    const entry: FileEntry = {
      path: filePath,
      hash,
      size: stat.size,
      lastModified: stat.mtimeMs,
      language,
      exports,
      imports,
      classes: exports.filter(e => e.kind === "class"),
      functions: exports.filter(e => e.kind === "function"),
      interfaces: exports.filter(e => e.kind === "interface"),
      types: exports.filter(e => e.kind === "type"),
      enums: exports.filter(e => e.kind === "enum"),
    }

    // Cache
    await this.cache.set(entry)

    return entry
  }

  async analyzeDirectory(
    dirPath: string,
    onProgress?: (current: number, total: number, file: string) => void,
  ): Promise<FileEntry[]> {
    const files: string[] = []
    await this.walkDirectory(dirPath, files)

    const entries: FileEntry[] = []
    for (let i = 0; i < files.length; i++) {
      if (onProgress) {
        onProgress(i + 1, files.length, files[i])
      }

      try {
        const entry = await this.analyzeFile(files[i])
        entries.push(entry)
      } catch (error) {
        // Skip files that can't be parsed
      }
    }

    return entries
  }

  async buildIndex(
    files: FileEntry[],
    root?: string,
  ): Promise<RepoMap> {
    const repoRoot = root || this.root
    const fileMap = new Map<string, FileEntry>()
    const exportsIndex = new Map<string, FileEntry[]>()
    const importsGraph = new Map<string, Set<string>>()
    const reverseImportsGraph = new Map<string, Set<string>>()

    // Build file map
    for (const file of files) {
      fileMap.set(file.path, file)
    }

    // Build exports index
    for (const file of files) {
      for (const exp of file.exports) {
        const existing = exportsIndex.get(exp.name) || []
        existing.push(file)
        exportsIndex.set(exp.name, existing)
      }
    }

    // Build imports graph
    for (const file of files) {
      const imports = new Set<string>()

      for (const imp of file.imports) {
        // Resolve import source to file path
        const resolvedPath = this.resolveImport(imp.source, file.path, repoRoot)
        if (resolvedPath && fileMap.has(resolvedPath)) {
          imports.add(resolvedPath)

          // Reverse graph
          const reverseDeps = reverseImportsGraph.get(resolvedPath) || new Set()
          reverseDeps.add(file.path)
          reverseImportsGraph.set(resolvedPath, reverseDeps)
        }
      }

      importsGraph.set(file.path, imports)
    }

    // Calculate stats
    const stats = this.calculateStats(files)

    return {
      root: repoRoot,
      files: fileMap,
      exportsIndex,
      importsGraph,
      reverseImportsGraph,
      lastBuilt: Date.now(),
      stats,
    }
  }

  async updateIndex(
    index: RepoMap,
    changedFiles: string[],
  ): Promise<RepoMap> {
    for (const filePath of changedFiles) {
      try {
        const entry = await this.analyzeFile(filePath)

        // Update file map
        index.files.set(filePath, entry)

        // Update exports index
        // Remove old exports
        for (const [name, files] of index.exportsIndex) {
          const filtered = files.filter(f => f.path !== filePath)
          if (filtered.length === 0) {
            index.exportsIndex.delete(name)
          } else {
            index.exportsIndex.set(name, filtered)
          }
        }

        // Add new exports
        for (const exp of entry.exports) {
          const existing = index.exportsIndex.get(exp.name) || []
          existing.push(entry)
          index.exportsIndex.set(exp.name, existing)
        }

        // Update imports graph
        const imports = new Set<string>()
        for (const imp of entry.imports) {
          const resolvedPath = this.resolveImport(imp.source, filePath, index.root)
          if (resolvedPath && index.files.has(resolvedPath)) {
            imports.add(resolvedPath)
          }
        }
        index.importsGraph.set(filePath, imports)

        // Rebuild reverse graph (simple approach)
        index.reverseImportsGraph.clear()
        for (const [file, deps] of index.importsGraph) {
          for (const dep of deps) {
            const reverseDeps = index.reverseImportsGraph.get(dep) || new Set()
            reverseDeps.add(file)
            index.reverseImportsGraph.set(dep, reverseDeps)
          }
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    index.lastBuilt = Date.now()
    index.stats = this.calculateStats(Array.from(index.files.values()))

    return index
  }

  private resolveImport(source: string, fromFile: string, root: string): string | null {
    // Skip node_modules imports
    if (!source.startsWith(".") && !source.startsWith("/")) {
      return null
    }

    const fromDir = path.dirname(fromFile)
    let resolved: string

    if (source.startsWith("/")) {
      resolved = path.join(root, source.slice(1))
    } else {
      resolved = path.join(fromDir, source)
    }

    // Try different extensions
    const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]

    for (const ext of extensions) {
      const fullPath = resolved + ext
      try {
        // Check if file exists (sync for simplicity in build)
        const stat = require("fs").statSync(fullPath)
        if (stat.isFile()) {
          return fullPath
        }
      } catch {
        // Continue
      }
    }

    return null
  }

  private calculateStats(files: FileEntry[]): RepoMapStats {
    const languageDistribution: Record<Language, number> = {
      typescript: 0,
      javascript: 0,
      tsx: 0,
      jsx: 0,
    }

    let totalExports = 0
    let totalImports = 0
    let largestFile = { path: "", size: 0 }

    for (const file of files) {
      languageDistribution[file.language]++
      totalExports += file.exports.length
      totalImports += file.imports.length

      if (file.size > largestFile.size) {
        largestFile = { path: file.path, size: file.size }
      }
    }

    return {
      totalFiles: files.length,
      totalExports,
      totalImports,
      languageDistribution,
      averageExportsPerFile: files.length > 0 ? totalExports / files.length : 0,
      largestFile,
    }
  }

  private async walkDirectory(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") {
            await this.walkDirectory(fullPath, files)
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (this.getLanguage(ext)) {
            files.push(fullPath)
          }
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  private getLanguage(ext: string): Language | null {
    switch (ext.toLowerCase()) {
      case ".ts": return "typescript"
      case ".tsx": return "tsx"
      case ".js": return "javascript"
      case ".jsx": return "jsx"
      default: return null
    }
  }
}

let _instance: RepoMapAnalyzer | null = null

export async function getRepoMapAnalyzer(root?: string): Promise<RepoMapAnalyzer> {
  if (!_instance || root) {
    _instance = new RepoMapAnalyzer(root)
    await _instance.init()
  }
  return _instance
}
