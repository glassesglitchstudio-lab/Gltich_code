export type Language = "typescript" | "javascript" | "tsx" | "jsx"

export type SymbolKind = "function" | "class" | "interface" | "type" | "enum" | "variable" | "const" | "method"

export type SymbolEntry = {
  name: string
  kind: SymbolKind
  line: number
  column: number
  isDefault: boolean
  isExported: boolean
  isAsync: boolean
  parameters?: string
  returnType?: string
}

export type ImportSpecifier = {
  name: string
  kind: "named" | "default" | "namespace"
  alias?: string
}

export type ImportEntry = {
  source: string
  specifiers: ImportSpecifier[]
  isTypeOnly: boolean
  line: number
}

export type FileEntry = {
  path: string
  hash: string
  size: number
  lastModified: number
  language: Language
  exports: SymbolEntry[]
  imports: ImportEntry[]
  classes: SymbolEntry[]
  functions: SymbolEntry[]
  interfaces: SymbolEntry[]
  types: SymbolEntry[]
  enums: SymbolEntry[]
}

export type RepoMap = {
  root: string
  files: Map<string, FileEntry>
  exportsIndex: Map<string, FileEntry[]>
  importsGraph: Map<string, Set<string>>
  reverseImportsGraph: Map<string, Set<string>>
  lastBuilt: number
  stats: RepoMapStats
}

export type RepoMapStats = {
  totalFiles: number
  totalExports: number
  totalImports: number
  languageDistribution: Record<Language, number>
  averageExportsPerFile: number
  largestFile: { path: string; size: number }
}

export type RepoMapQuery = {
  type: "dependents" | "dependencies" | "impact" | "routes" | "search" | "symbol"
  target: string
  depth?: number
  maxResults?: number
}

export type RepoMapResult = {
  query: RepoMapQuery
  results: FileEntry[]
  symbols: SymbolEntry[]
  depth: number
  totalMatches: number
  executionTime: number
}

export type RepoMapBuildOptions = {
  root: string
  patterns?: string[]
  exclude?: string[]
  includeTests?: boolean
  maxFileSize?: number
  incremental?: boolean
}
