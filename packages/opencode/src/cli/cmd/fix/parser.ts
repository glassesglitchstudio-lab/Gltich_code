import type { CodeProposal } from "./types"

export function parseFileOperations(markdown: string): CodeProposal[] {
  if (!markdown) return []

  const operations: CodeProposal[] = []
  const modifyPattern = /(?:###?\s*)?Changes for `([^`]+\.[\w./-]+)`:\s*\n```\w*\n(.*?)\n```/g
  const deletePattern = /Delete file: `([^`]+\.[\w./-]+)`/g
  const noChangePattern = /No changes needed for `([^`]+\.[\w./-]+)`\./g

  const allMatches: Array<{ type: string; match: RegExpMatchArray; pos: number }> = []

  let m: RegExpMatchArray | null
  while ((m = modifyPattern.exec(markdown))) {
    allMatches.push({ type: "modify", match: m, pos: m.index ?? 0 })
  }
  while ((m = deletePattern.exec(markdown))) {
    allMatches.push({ type: "delete", match: m, pos: m.index ?? 0 })
  }
  while ((m = noChangePattern.exec(markdown))) {
    allMatches.push({ type: "no_change", match: m, pos: m.index ?? 0 })
  }

  allMatches.sort((a, b) => a.pos - b.pos)

  for (const item of allMatches) {
    if (item.type === "modify") {
      operations.push({
        file_path: item.match[1].trim(),
        action: "modify",
        code: item.match[2].trim(),
      })
    } else if (item.type === "delete") {
      operations.push({
        file_path: item.match[1].trim(),
        action: "delete",
      })
    } else {
      operations.push({
        file_path: item.match[1].trim(),
        action: "no_change",
      })
    }
  }

  return operations
}

export function extractJsonFromMarkdown(text: string): Record<string, any> | null {
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    } catch {
      return null
    }
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function extractFileList(text: string): string[] {
  const files: string[] = []
  const patterns = [
    /`([^`]+\.[\w.-]+)`/g,
    /^([\w./-]+\.[\w.-]+)$/gm,
  ]

  for (const pattern of patterns) {
    let m: RegExpMatchArray | null
    while ((m = pattern.exec(text))) {
      const path = m[1].trim()
      if (!files.includes(path) && !path.startsWith("http")) {
        files.push(path)
      }
    }
  }

  return [...new Set(files)]
}
