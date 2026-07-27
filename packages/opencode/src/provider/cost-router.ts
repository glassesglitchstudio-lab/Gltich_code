import fs from "fs"
import path from "path"
import { homedir } from "os"

export interface CostRecord {
  provider: string
  model: string
  taskType: TaskType
  tokens: number
  cost: number
  duration: number
  success: boolean
  timestamp: string
  score?: number
}

export type TaskType = "code" | "reasoning" | "planning" | "review" | "debug" | "explore" | "chat" | "other"

export interface RouterRecommendation {
  provider: string
  model: string
  reason: string
  estimatedCost: number
  estimatedDuration: number
  confidence: number
}

const COST_HISTORY_FILE = path.join(homedir(), ".glitchcode", "cost-history.json")
const RATES_CACHE_FILE = path.join(homedir(), ".glitchcode", "model-rates.json")

const DEFAULT_RATES: Record<string, number> = {
  "openai/gpt-4o": 0.00001,
  "openai/gpt-4o-mini": 0.0000015,
  "openai/o1": 0.000015,
  "openai/o3-mini": 0.000004,
  "anthropic/claude-sonnet-4-20250514": 0.000015,
  "anthropic/claude-haiku": 0.0000025,
  "anthropic/claude-opus": 0.00003,
  "google/gemini-2.0-flash": 0.0000005,
  "google/gemini-2.0-pro": 0.00001,
  "google/gemini-2.5-pro": 0.000015,
  "deepseek/deepseek-chat": 0.000002,
  "deepseek/deepseek-reasoner": 0.000004,
  "mistral/mistral-large": 0.000008,
  "mistral/mistral-small": 0.000002,
  "groq/llama-3.3-70b": 0.000001,
  "groq/llama-3.1-8b": 0.0000002,
  "groq/mixtral-8x7b": 0.0000005,
  "cohere/command-r-plus": 0.00001,
  "together/llama-3.3-70b": 0.000001,
}

const TASK_TYPE_RECOMMENDATIONS: Record<TaskType, Array<{ provider: string; model: string; weight: number }>> = {
  code: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514", weight: 10 },
    { provider: "openai", model: "gpt-4o", weight: 9 },
    { provider: "deepseek", model: "deepseek-chat", weight: 8 },
    { provider: "google", model: "gemini-2.0-pro", weight: 7 },
    { provider: "mistral", model: "mistral-large", weight: 6 },
    { provider: "groq", model: "llama-3.3-70b", weight: 5 },
  ],
  reasoning: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514", weight: 10 },
    { provider: "openai", model: "o1", weight: 9 },
    { provider: "google", model: "gemini-2.5-pro", weight: 8 },
    { provider: "deepseek", model: "deepseek-reasoner", weight: 8 },
    { provider: "openai", model: "o3-mini", weight: 7 },
  ],
  planning: [
    { provider: "openai", model: "gpt-4o", weight: 10 },
    { provider: "anthropic", model: "claude-sonnet-4-20250514", weight: 9 },
    { provider: "google", model: "gemini-2.0-pro", weight: 8 },
    { provider: "deepseek", model: "deepseek-chat", weight: 7 },
  ],
  review: [
    { provider: "anthropic", model: "claude-haiku", weight: 10 },
    { provider: "groq", model: "llama-3.3-70b", weight: 9 },
    { provider: "openai", model: "gpt-4o-mini", weight: 8 },
    { provider: "google", model: "gemini-2.0-flash", weight: 7 },
  ],
  debug: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514", weight: 10 },
    { provider: "openai", model: "o1", weight: 9 },
    { provider: "google", model: "gemini-2.5-pro", weight: 8 },
    { provider: "deepseek", model: "deepseek-reasoner", weight: 7 },
  ],
  explore: [
    { provider: "groq", model: "llama-3.3-70b", weight: 10 },
    { provider: "google", model: "gemini-2.0-flash", weight: 9 },
    { provider: "openai", model: "gpt-4o-mini", weight: 8 },
    { provider: "deepseek", model: "deepseek-chat", weight: 7 },
  ],
  chat: [
    { provider: "groq", model: "llama-3.1-8b", weight: 10 },
    { provider: "google", model: "gemini-2.0-flash", weight: 9 },
    { provider: "openai", model: "gpt-4o-mini", weight: 8 },
    { provider: "anthropic", model: "claude-haiku", weight: 7 },
  ],
  other: [
    { provider: "openai", model: "gpt-4o-mini", weight: 10 },
    { provider: "google", model: "gemini-2.0-flash", weight: 9 },
    { provider: "deepseek", model: "deepseek-chat", weight: 8 },
    { provider: "groq", model: "llama-3.3-70b", weight: 7 },
  ],
}

export class CostRouter {
  private history: CostRecord[] = []
  private rates: Record<string, number>

  constructor() {
    this.rates = { ...DEFAULT_RATES }
    this.load()
  }

  private load() {
    try {
      if (fs.existsSync(COST_HISTORY_FILE)) {
        this.history = JSON.parse(fs.readFileSync(COST_HISTORY_FILE, "utf8"))
      }
    } catch { this.history = [] }
    try {
      if (fs.existsSync(RATES_CACHE_FILE)) {
        const custom = JSON.parse(fs.readFileSync(RATES_CACHE_FILE, "utf8"))
        Object.assign(this.rates, custom)
      }
    } catch {}
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(COST_HISTORY_FILE), { recursive: true })
      const recent = this.history.slice(-10000)
      fs.writeFileSync(COST_HISTORY_FILE, JSON.stringify(recent), "utf8")
    } catch {}
  }

  record(record: Omit<CostRecord, "timestamp">) {
    this.history.push({ ...record, timestamp: new Date().toISOString() })
    if (this.history.length > 10000) this.history = this.history.slice(-10000)
    this.save()
  }

  getHistory(taskType?: TaskType, limit = 100): CostRecord[] {
    let filtered = this.history
    if (taskType) filtered = filtered.filter(r => r.taskType === taskType)
    return filtered.slice(-limit)
  }

  getStats(): { totalCost: number; totalTokens: number; averageSpeed: number; byProvider: Record<string, { cost: number; tokens: number; calls: number }> } {
    const byProvider: Record<string, { cost: number; tokens: number; calls: number }> = {}
    let totalCost = 0, totalTokens = 0, totalDuration = 0, totalCalls = 0

    for (const r of this.history) {
      totalCost += r.cost
      totalTokens += r.tokens
      totalDuration += r.duration
      totalCalls++
      if (!byProvider[r.provider]) byProvider[r.provider] = { cost: 0, tokens: 0, calls: 0 }
      byProvider[r.provider].cost += r.cost
      byProvider[r.provider].tokens += r.tokens
      byProvider[r.provider].calls++
    }

    return {
      totalCost,
      totalTokens,
      averageSpeed: totalCalls > 0 ? totalTokens / (totalDuration / 1000) : 0,
      byProvider,
    }
  }

  estimateCost(provider: string, model: string, tokens: number): number {
    const key = `${provider}/${model}`
    return (this.rates[key] || 0.000005) * tokens
  }

  recommend(taskType: TaskType, availableModels: Array<{ provider: string; model: string }>): RouterRecommendation[] {
    const recommendations = TASK_TYPE_RECOMMENDATIONS[taskType] || TASK_TYPE_RECOMMENDATIONS.other
    const historical = this.history.filter(r => r.taskType === taskType && r.success)

    const scored: RouterRecommendation[] = []

    for (const rec of recommendations) {
      const available = availableModels.find(m =>
        m.provider.toLowerCase().includes(rec.provider) &&
        m.model.toLowerCase().includes(rec.model)
      )
      if (!available) continue

      const key = `${available.provider}/${available.model}`
      const rate = this.rates[key] || 0.000005
      const avgTokens = 500
      const estimatedCost = rate * avgTokens

      const modelHistory = historical.filter(r =>
        r.provider === available.provider && r.model === available.model
      )
      const avgDuration = modelHistory.length > 0
        ? modelHistory.reduce((a, r) => a + r.duration, 0) / modelHistory.length
        : 5000
      const successRate = modelHistory.length > 0
        ? modelHistory.filter(r => r.success).length / modelHistory.length
        : 0.8

      const confidence = modelHistory.length > 10 ? 0.9 : modelHistory.length > 5 ? 0.7 : modelHistory.length > 0 ? 0.5 : 0.3
      const reason = modelHistory.length > 0
        ? `${modelHistory.length} previous ${taskType} tasks, ${(successRate * 100).toFixed(0)}% success rate`
        : `Recommended for ${taskType} tasks`

      scored.push({
        provider: available.provider,
        model: available.model,
        reason,
        estimatedCost,
        estimatedDuration: avgDuration,
        confidence,
      })
    }

    return scored.sort((a, b) => (b.confidence * 10 + (10 - b.estimatedCost / 0.00001)) - (a.confidence * 10 + (10 - a.estimatedCost / 0.00001)))
  }

  getBestForTask(taskType: TaskType, availableModels: Array<{ provider: string; model: string }>): RouterRecommendation | null {
    const recs = this.recommend(taskType, availableModels)
    return recs[0] || null
  }

  clearHistory() {
    this.history = []
    this.save()
  }

  setRate(provider: string, model: string, rate: number) {
    const key = `${provider}/${model}`
    this.rates[key] = rate
    try {
      fs.mkdirSync(path.dirname(RATES_CACHE_FILE), { recursive: true })
      fs.writeFileSync(RATES_CACHE_FILE, JSON.stringify(this.rates, null, 2), "utf8")
    } catch {}
  }

  static detectTaskType(prompt: string): TaskType {
    const lower = prompt.toLowerCase()
    if (lower.includes("bug") || lower.includes("hata") || lower.includes("error") || lower.includes("fix") || lower.includes("düzelt")) return "debug"
    if (lower.includes("plan") || lower.includes("tasarım") || lower.includes("design") || lower.includes("architecture") || lower.includes("mimari")) return "planning"
    if (lower.includes("review") || lower.includes("incele") || lower.includes("code review") || lower.includes("kalite")) return "review"
    if (lower.includes("explore") || lower.includes("keşif") || lower.includes("ara") || lower.includes("search") || lower.includes("find")) return "explore"
    if (lower.includes("reason") || lower.includes("düşün") || lower.includes("analiz") || lower.includes("think") || lower.includes("analiz") || lower.includes("compare")) return "reasoning"
    if (lower.includes("chat") || lower.includes("merhaba") || lower.includes("hello") || lower.includes("nasılsın") || lower.includes("sohbet")) return "chat"
    if (lower.includes("kod") || lower.includes("code") || lower.includes("yaz") || lower.includes("write") || lower.includes("implement") || lower.includes("function") || lower.includes("class") || lower.includes("component")) return "code"
    return "other"
  }
}

let _instance: CostRouter | null = null

export function getCostRouter(): CostRouter {
  if (!_instance) _instance = new CostRouter()
  return _instance
}
