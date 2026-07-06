import type { RepoMap, FileEntry, SymbolEntry, RepoMapResult, RepoMapQuery } from "./types"

export class RepoMapGraph {
  private index: RepoMap

  constructor(index: RepoMap) {
    this.index = index
  }

  // Bu dosyayı import eden dosyalar
  getDependents(filePath: string, maxDepth: number = 1): FileEntry[] {
    const result = new Set<string>()
    this.traverseDependents(filePath, result, maxDepth, 0)
    return Array.from(result)
      .map(path => this.index.files.get(path))
      .filter((f): f is FileEntry => f !== undefined)
  }

  // Bu dosyanın import ettiği dosyalar
  getDependencies(filePath: string, maxDepth: number = 1): FileEntry[] {
    const result = new Set<string>()
    this.traverseDependencies(filePath, result, maxDepth, 0)
    return Array.from(result)
      .map(path => this.index.files.get(path))
      .filter((f): f is FileEntry => f !== undefined)
  }

  // Bu dosya değişirse etkilenen dosyalar (recursive)
  getImpact(filePath: string, maxDepth: number = 2): FileEntry[] {
    const dependents = this.getDependents(filePath, maxDepth)
    return dependents
  }

  // Belirli bir symbol'ü hangi dosyalar kullanıyor
  findUsages(symbolName: string): FileEntry[] {
    const files = new Set<FileEntry>()

    // Direct exports
    const exportingFiles = this.index.exportsIndex.get(symbolName) || []
    for (const file of exportingFiles) {
      files.add(file)
    }

    // Find files that import this symbol
    for (const [filePath, imports] of this.index.importsGraph) {
      const file = this.index.files.get(filePath)
      if (!file) continue

      for (const importPath of imports) {
        const importFile = this.index.files.get(importPath)
        if (!importFile) continue

        // Check if this file imports the symbol
        for (const imp of file.imports) {
          const resolvedPath = this.resolveImport(imp.source, filePath)
          if (resolvedPath === importPath) {
            for (const spec of imp.specifiers) {
              if (spec.name === symbolName || spec.alias === symbolName) {
                files.add(file)
              }
            }
          }
        }
      }
    }

    return Array.from(files)
  }

  // Route dosyalarını bul (API endpoint'ler)
  findRoutes(): FileEntry[] {
    const routes: FileEntry[] = []

    const routePatterns = [
      /\/api\//,
      /\/routes?\//,
      /\/pages?\//,
      /\/views?\//,
      /\/controllers?\//,
      /\/handlers?\//,
      /\/endpoints?\//,
    ]

    for (const [filePath, file] of this.index.files) {
      const relativePath = filePath.replace(this.index.root, "").replace(/\\/g, "/")

      for (const pattern of routePatterns) {
        if (pattern.test(relativePath)) {
          routes.push(file)
          break
        }
      }
    }

    return routes
  }

  // Query.execute
  execute(query: RepoMapQuery): RepoMapResult {
    const startTime = Date.now()
    let results: FileEntry[] = []
    let symbols: SymbolEntry[] = []

    switch (query.type) {
      case "dependents":
        results = this.getDependents(query.target, query.depth || 1)
        break

      case "dependencies":
        results = this.getDependencies(query.target, query.depth || 1)
        break

      case "impact":
        results = this.getImpact(query.target, query.depth || 2)
        break

      case "routes":
        results = this.findRoutes()
        break

      case "search":
        results = this.searchFiles(query.target)
        break

      case "symbol":
        results = this.findUsages(query.target)
        symbols = this.findSymbolDefinitions(query.target)
        break
    }

    if (query.maxResults && results.length > query.maxResults) {
      results = results.slice(0, query.maxResults)
    }

    return {
      query,
      results,
      symbols,
      depth: query.depth || 1,
      totalMatches: results.length,
      executionTime: Date.now() - startTime,
    }
  }

  private searchFiles(query: string): FileEntry[] {
    const results: FileEntry[] = []
    const lowerQuery = query.toLowerCase()

    for (const [filePath, file] of this.index.files) {
      // Search in file path
      if (filePath.toLowerCase().includes(lowerQuery)) {
        results.push(file)
        continue
      }

      // Search in exports
      for (const exp of file.exports) {
        if (exp.name.toLowerCase().includes(lowerQuery)) {
          results.push(file)
          break
        }
      }
    }

    return results
  }

  private findSymbolDefinitions(symbolName: string): SymbolEntry[] {
    const symbols: SymbolEntry[] = []

    for (const [filePath, file] of this.index.files) {
      for (const exp of file.exports) {
        if (exp.name === symbolName) {
          symbols.push({
            ...exp,
            // Add file context
          })
        }
      }
    }

    return symbols
  }

  private traverseDependents(
    filePath: string,
    result: Set<string>,
    maxDepth: number,
    currentDepth: number,
  ): void {
    if (currentDepth >= maxDepth) return
    if (result.has(filePath)) return

    const dependents = this.index.reverseImportsGraph.get(filePath)
    if (!dependents) return

    for (const dependent of dependents) {
      result.add(dependent)
      this.traverseDependents(dependent, result, maxDepth, currentDepth + 1)
    }
  }

  private traverseDependencies(
    filePath: string,
    result: Set<string>,
    maxDepth: number,
    currentDepth: number,
  ): void {
    if (currentDepth >= maxDepth) return
    if (result.has(filePath)) return

    const dependencies = this.index.importsGraph.get(filePath)
    if (!dependencies) return

    for (const dependency of dependencies) {
      result.add(dependency)
      this.traverseDependencies(dependency, result, maxDepth, currentDepth + 1)
    }
  }

  private resolveImport(source: string, fromFile: string): string | null {
    if (!source.startsWith(".") && !source.startsWith("/")) {
      return null
    }

    const fromDir = require("path").dirname(fromFile)
    let resolved: string

    if (source.startsWith("/")) {
      resolved = require("path").join(this.index.root, source.slice(1))
    } else {
      resolved = require("path").join(fromDir, source)
    }

    // Try different extensions
    const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]

    for (const ext of extensions) {
      const fullPath = resolved + ext
      if (this.index.files.has(fullPath)) {
        return fullPath
      }
    }

    return null
  }

  // Get summary statistics
  getSummary(): {
    totalFiles: number
    totalExports: number
    totalImports: number
    topExportedSymbols: Array<{ name: string; count: number }>
    mostImportedFiles: Array<{ path: string; count: number }>
  } {
    const topExportedSymbols: Map<string, number> = new Map()
    const mostImportedFiles: Map<string, number> = new Map()

    for (const [name, files] of this.index.exportsIndex) {
      topExportedSymbols.set(name, files.length)
    }

    for (const [filePath, dependencies] of this.index.importsGraph) {
      for (const dep of dependencies) {
        mostImportedFiles.set(dep, (mostImportedFiles.get(dep) || 0) + 1)
      }
    }

    return {
      totalFiles: this.index.files.size,
      totalExports: this.index.stats.totalExports,
      totalImports: this.index.stats.totalImports,
      topExportedSymbols: Array.from(topExportedSymbols.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      mostImportedFiles: Array.from(mostImportedFiles.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    }
  }
}

let _instance: RepoMapGraph | null = null

export function getRepoMapGraph(index: RepoMap): RepoMapGraph {
  if (!_instance) {
    _instance = new RepoMapGraph(index)
  }
  return _instance
}

export function resetRepoMapGraph(): void {
  _instance = null
}
