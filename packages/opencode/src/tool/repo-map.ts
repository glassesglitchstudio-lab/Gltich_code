import z from "zod"
import path from "path"
import { Effect } from "effect"
import * as Tool from "./tool"
import { RepoMapAnalyzer } from "../repo-map/analyzer"
import { RepoMapGraph } from "../repo-map/graph"
import { RepoMapScanner } from "../repo-map/scanner"
import type { RepoMap } from "../repo-map/types"

let cachedIndex: RepoMap | null = null

async function getIndex(root?: string): Promise<RepoMap> {
  if (cachedIndex && !root) {
    return cachedIndex
  }

  const analyzer = new RepoMapAnalyzer(root)
  await analyzer.init()

  const scanner = new RepoMapScanner({ root })
  const { files } = await scanner.scanWithStats()

  const entries = []
  for (const file of files) {
    try {
      const entry = await analyzer.analyzeFile(file)
      entries.push(entry)
    } catch {
      // Skip unparseable files
    }
  }

  cachedIndex = await analyzer.buildIndex(entries, root)
  return cachedIndex
}

export const RepoMapTool = Tool.define(
  "repo-map",
  Effect.gen(function* () {
    return {
      description: `Repo Map - Proje yapısını analiz et, bağımlılıkları bul, etki alanı hesapla.`,
      parameters: z.object({
        operation: z.enum(["build", "query", "dependents", "dependencies", "impact", "routes", "search", "summary"]),
        target: z.string().optional(),
        depth: z.number().optional().default(2),
        root: z.string().optional(),
      }),
      execute: (params: { operation: string; target?: string; depth?: number; root?: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const root = params.root || process.cwd()

          const index = yield* Effect.tryPromise({
            try: () => getIndex(root),
            catch: (e) => new Error(`Index build failed: ${e}`),
          })

          const graph = new RepoMapGraph(index)

          // Resolve a (possibly relative) target against the index. Keys are
          // absolute paths; users often pass bare file names ("helper.ts").
          const resolveTarget = (target: string): string | undefined => {
            if (index.files.has(target)) return target
            const abs = path.resolve(root, target)
            if (index.files.has(abs)) return abs
            const base = path.basename(target)
            for (const key of index.files.keys()) {
              if (path.basename(key) === base) return key
            }
            return undefined
          }

          const target = params.target ? resolveTarget(params.target) : undefined

          switch (params.operation) {
            case "build":
              return {
                title: "Repo Map Build",
                metadata: { success: true } as Tool.Metadata,
                output: `Index oluşturuldu: ${index.files.size} dosya, ${index.stats.totalExports} export`,
              }

            case "query": {
              if (!params.target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: "target gerekli" }
              if (!target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: `Bulunamadı: ${params.target}` }
              const file = index.files.get(target)!
              const langNames: Record<string, string> = {
                typescript: "TypeScript",
                javascript: "JavaScript",
                tsx: "TSX",
                jsx: "JSX",
              }
              return {
                title: file.path,
                metadata: { success: true } as Tool.Metadata,
                output: `Dil: ${langNames[file.language] || file.language}\nExport: ${file.exports.map(e => e.name).join(", ")}\nImport: ${file.imports.map(i => i.source).join(", ")}`,
              }
            }

            case "dependents": {
              if (!params.target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: "target gerekli" }
              if (!target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: `Bulunamadı: ${params.target}` }
              const deps = graph.getDependents(target, params.depth)
              return {
                title: "Dependents",
                metadata: { success: true } as Tool.Metadata,
                output: `${deps.length} dosya: ${deps.map(f => f.path).join("\n")}`,
              }
            }

            case "dependencies": {
              if (!params.target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: "target gerekli" }
              if (!target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: `Bulunamadı: ${params.target}` }
              const deps = graph.getDependencies(target, params.depth)
              return {
                title: "Dependencies",
                metadata: { success: true } as Tool.Metadata,
                output: `${deps.length} dosya: ${deps.map(f => f.path).join("\n")}`,
              }
            }

            case "impact": {
              if (!params.target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: "target gerekli" }
              if (!target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: `Bulunamadı: ${params.target}` }
              const impact = graph.getImpact(target, params.depth)
              return {
                title: "Impact",
                metadata: { success: true } as Tool.Metadata,
                output: `${impact.length} dosya etkilenir: ${impact.map(f => f.path).join("\n")}`,
              }
            }

            case "routes": {
              const routes = graph.findRoutes()
              return {
                title: "Routes",
                metadata: { success: true } as Tool.Metadata,
                output: `${routes.length} route: ${routes.map(f => f.path).join("\n")}`,
              }
            }

            case "search": {
              if (!params.target) return { title: "Error", metadata: { error: true } as Tool.Metadata, output: "target gerekli" }
              const result = graph.execute({ type: "search", target: params.target })
              return {
                title: "Search",
                metadata: { success: true } as Tool.Metadata,
                output: `${result.totalMatches} sonuç:\n${result.results.map(f => f.path).join("\n")}`,
              }
            }

            case "summary": {
              const summary = graph.getSummary()
              return {
                title: "Summary",
                metadata: { success: true } as Tool.Metadata,
                output: JSON.stringify(summary, null, 2),
              }
            }

            default:
              return { title: "Error", metadata: { error: true } as Tool.Metadata, output: "Bilinmeyen operasyon" }
          }
        }).pipe(Effect.orDie)
    }
  }),
)
