import type { SymbolEntry, ImportEntry, ImportSpecifier, SymbolKind, Language } from "./types"

let Parser: any = null
let TypeScriptLang: any = null
let TypeScriptTSXLang: any = null

export class RepoMapParser {
  private parser: any = null
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return

    try {
      Parser = (await import("web-tree-sitter")).default
      await Parser.init()

      TypeScriptLang = await Parser.Language.load(
        "https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2.wasm",
      )
      TypeScriptTSXLang = await Parser.Language.load(
        "https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2.wasm?tsx",
      )

      this.parser = new Parser()
      this.initialized = true
    } catch (error) {
      console.warn("Tree-sitter init failed, falling back to regex parser:", error)
      this.initialized = true
    }
  }

  parse(content: string, language: Language): any {
    if (!this.parser) {
      return this.parseWithRegex(content, language)
    }

    if (language === "tsx" || language === "jsx") {
      this.parser.setLanguage(TypeScriptTSXLang)
    } else {
      this.parser.setLanguage(TypeScriptLang)
    }

    return this.parser.parse(content)
  }

  extractExports(tree: any, language: Language): SymbolEntry[] {
    if (!tree.rootNode) {
      return this.extractExportsRegex(tree as string, language)
    }

    const exports: SymbolEntry[] = []
    const visited = new Set<string>()

    const traverse = (node: any) => {
      if (!node) return

      // Export declaration
      if (node.type === "export_statement") {
        const declaration = node.childForFieldName("declaration")
        if (declaration) {
          const symbols = this.extractSymbolsFromDeclaration(declaration, true)
          for (const sym of symbols) {
            if (!visited.has(sym.name)) {
              visited.add(sym.name)
              exports.push(sym)
            }
          }
        }

        // export { name1, name2 }
        const specifiers = node.children?.filter((c: any) => c.type === "export_specifier") || []
        for (const spec of specifiers) {
          const name = spec.childForFieldName("name")?.text || spec.text
          if (!visited.has(name)) {
            visited.add(name)
            exports.push({
              name,
              kind: "variable",
              line: spec.startPosition.row + 1,
              column: spec.startPosition.column,
              isDefault: false,
              isExported: true,
              isAsync: false,
            })
          }
        }
      }

      // Export default
      if (node.type === "export_default_statement") {
        const declaration = node.childForFieldName("declaration")
        if (declaration) {
          const symbols = this.extractSymbolsFromDeclaration(declaration, true)
          for (const sym of symbols) {
            sym.isDefault = true
            if (!visited.has(sym.name)) {
              visited.add(sym.name)
              exports.push(sym)
            }
          }
        }
      }

      // Recurse
      if (node.children) {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }

    traverse(tree.rootNode)
    return exports
  }

  extractImports(tree: any, language: Language): ImportEntry[] {
    if (!tree.rootNode) {
      return this.extractImportsRegex(tree as string, language)
    }

    const imports: ImportEntry[] = []

    const traverse = (node: any) => {
      if (!node) return

      if (node.type === "import_statement") {
        const importEntry = this.parseImportStatement(node)
        if (importEntry) {
          imports.push(importEntry)
        }
      }

      // require() calls
      if (node.type === "variable_declarator") {
        const init = node.childForFieldName("value")
        if (init?.type === "call_expression") {
          const callee = init.childForFieldName("function")
          if (callee?.text === "require") {
            const args = init.children?.filter((c: any) => c.type === "arguments")?.[0]
            const stringArg = args?.children?.find((c: any) => c.type === "string")
            if (stringArg) {
              imports.push({
                source: stringArg.text.replace(/['"]/g, ""),
                specifiers: [{ name: node.childForFieldName("name")?.text || "*", kind: "namespace" }],
                isTypeOnly: false,
                line: node.startPosition.row + 1,
              })
            }
          }
        }
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }

    traverse(tree.rootNode)
    return imports
  }

  private extractSymbolsFromDeclaration(node: any, isExported: boolean): SymbolEntry[] {
    const symbols: SymbolEntry[] = []
    const kind = this.getSymbolKind(node)
    const name = this.getSymbolName(node)

    if (name) {
      symbols.push({
        name,
        kind,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        isDefault: false,
        isExported,
        isAsync: this.isAsync(node),
        parameters: this.getParameters(node),
        returnType: this.getReturnType(node),
      })
    }

    return symbols
  }

  private getSymbolKind(node: any): SymbolKind {
    switch (node.type) {
      case "function_declaration": return "function"
      case "class_declaration": return "class"
      case "interface_declaration": return "interface"
      case "type_alias_declaration": return "type"
      case "enum_declaration": return "enum"
      case "variable_declarator": return "variable"
      case "method_definition": return "method"
      default: return "variable"
    }
  }

  private getSymbolName(node: any): string | null {
    const name = node.childForFieldName("name")
    if (name) return name.text

    // For variable declarator
    if (node.type === "variable_declarator") {
      return node.childForFieldName("name")?.text || null
    }

    return null
  }

  private isAsync(node: any): boolean {
    return node.children?.some((c: any) => c.type === "async") || false
  }

  private getParameters(node: any): string | undefined {
    const params = node.childForFieldName("parameters")
    if (params) {
      return params.text
    }
    return undefined
  }

  private getReturnType(node: any): string | undefined {
    const returnType = node.childForFieldName("return_type")
    if (returnType) {
      return returnType.text
    }
    return undefined
  }

  private parseImportStatement(node: any): ImportEntry | null {
    const source = node.children?.find((c: any) => c.type === "string")?.text?.replace(/['"]/g, "")
    if (!source) return null

    const specifiers: ImportSpecifier[] = []
    let isTypeOnly = false

    // Check for type-only import
    if (node.children?.some((c: any) => c.type === "type")) {
      isTypeOnly = true
    }

    // Parse import clause
    const clause = node.children?.find((c: any) =>
      c.type === "import_clause" || c.type === "named_imports" || c.type === "identifier",
    )

    if (clause) {
      if (clause.type === "identifier") {
        // import React from 'react'
        specifiers.push({ name: clause.text, kind: "default" })
      } else if (clause.type === "import_clause") {
        // import React, { useState, useEffect } from 'react'
        const defaultImport = clause.childForFieldName("name")
        if (defaultImport) {
          specifiers.push({ name: defaultImport.text, kind: "default" })
        }

        const namedImports = clause.children?.find((c: any) => c.type === "named_imports")
        if (namedImports) {
          const importSpecs = namedImports.children?.filter((c: any) => c.type === "import_specifier") || []
          for (const spec of importSpecs) {
            const name = spec.childForFieldName("name")?.text || spec.text
            const alias = spec.childForFieldName("alias")?.text
            specifiers.push({
              name,
              kind: alias ? "named" : "named",
              alias,
            })
          }
        }
      } else if (clause.type === "named_imports") {
        // import { useState, useEffect } from 'react'
        const importSpecs = clause.children?.filter((c: any) => c.type === "import_specifier") || []
        for (const spec of importSpecs) {
          const name = spec.childForFieldName("name")?.text || spec.text
          const alias = spec.childForFieldName("alias")?.text
          specifiers.push({
            name,
            kind: "named",
            alias,
          })
        }
      }
    }

    // namespace import: import * as React from 'react'
    const namespaceImport = node.children?.find((c: any) => c.type === "namespace_import")
    if (namespaceImport) {
      const nsName = namespaceImport.childForFieldName("name")?.text || namespaceImport.text
      specifiers.push({ name: nsName, kind: "namespace" })
    }

    return {
      source,
      specifiers,
      isTypeOnly,
      line: node.startPosition.row + 1,
    }
  }

  // Fallback regex parser
  private parseWithRegex(content: string, language: Language): any {
    return { rootNode: null, content }
  }

  private extractExportsRegex(content: string, language: Language): SymbolEntry[] {
    const exports: SymbolEntry[] = []
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // export function/const/class/interface/type/enum
      const exportMatch = line.match(/export\s+(?:default\s+)?(?:async\s+)?(function|const|class|interface|type|enum)\s+(\w+)/)
      if (exportMatch) {
        exports.push({
          name: exportMatch[2],
          kind: exportMatch[1] as SymbolKind,
          line: i + 1,
          column: 0,
          isDefault: line.includes("export default"),
          isExported: true,
          isAsync: line.includes("async"),
        })
      }

      // export { name1, name2 }
      const exportSpecMatch = line.match(/export\s+\{([^}]+)\}/)
      if (exportSpecMatch) {
        const names = exportSpecMatch[1].split(",").map(n => n.trim().split(" as ")[0])
        for (const name of names) {
          if (name && !exports.find(e => e.name === name)) {
            exports.push({
              name,
              kind: "variable",
              line: i + 1,
              column: 0,
              isDefault: false,
              isExported: true,
              isAsync: false,
            })
          }
        }
      }
    }

    return exports
  }

  private extractImportsRegex(content: string, language: Language): ImportEntry[] {
    const imports: ImportEntry[] = []
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // import { name1, name2 } from 'source'
      const namedImportMatch = line.match(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/)
      if (namedImportMatch) {
        const names = namedImportMatch[1].split(",").map(n => {
          const parts = n.trim().split(" as ")
          return { name: parts[0].trim(), alias: parts[1]?.trim() }
        })
        imports.push({
          source: namedImportMatch[2],
          specifiers: names.map(n => ({ name: n.name, kind: "named" as const, alias: n.alias })),
          isTypeOnly: line.includes("import type"),
          line: i + 1,
        })
      }

      // import Default from 'source'
      const defaultImportMatch = line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/)
      if (defaultImportMatch && !namedImportMatch) {
        imports.push({
          source: defaultImportMatch[2],
          specifiers: [{ name: defaultImportMatch[1], kind: "default" }],
          isTypeOnly: line.includes("import type"),
          line: i + 1,
        })
      }

      // import * as Name from 'source'
      const namespaceImportMatch = line.match(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/)
      if (namespaceImportMatch) {
        imports.push({
          source: namespaceImportMatch[2],
          specifiers: [{ name: namespaceImportMatch[1], kind: "namespace" }],
          isTypeOnly: false,
          line: i + 1,
        })
      }

      // const x = require('source')
      const requireMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/)
      if (requireMatch) {
        imports.push({
          source: requireMatch[2],
          specifiers: [{ name: requireMatch[1], kind: "namespace" }],
          isTypeOnly: false,
          line: i + 1,
        })
      }
    }

    return imports
  }
}

let _instance: RepoMapParser | null = null

export async function getRepoMapParser(): Promise<RepoMapParser> {
  if (!_instance) {
    _instance = new RepoMapParser()
    await _instance.init()
  }
  return _instance
}
