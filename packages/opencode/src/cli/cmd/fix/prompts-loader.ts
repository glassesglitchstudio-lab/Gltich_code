import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = path.join(__dirname, "prompts")

const cache = new Map<string, string>()

export function loadPrompt(name: string): string {
  if (cache.has(name)) return cache.get(name)!
  const filePath = path.join(PROMPTS_DIR, `${name}.md`)
  const content = fs.readFileSync(filePath, "utf-8").trim()
  cache.set(name, content)
  return content
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value)
  }
  return result
}
