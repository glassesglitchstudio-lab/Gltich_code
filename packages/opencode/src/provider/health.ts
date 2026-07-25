/**
 * Provider Health Check & Connection Test System
 *
 * Provider-specific test methods for maximum compatibility.
 * Falls back to chat completion for OpenAI-compatible providers.
 */
import { Log } from "../util"

const log = Log.create({ service: "provider-health" })

export interface HealthResult {
  providerID: string
  status: "healthy" | "degraded" | "unhealthy" | "unknown" | "skipped"
  latencyMs: number
  error?: string
  testedAt: number
  modelCount: number
  hasValidKey: boolean
}

export interface LatencyRecord {
  providerID: string
  modelID: string
  latencyMs: number
  timestamp: number
  success: boolean
}

const latencyHistory = new Map<string, LatencyRecord[]>()
const MAX_HISTORY_PER_KEY = 50

function latencyKey(providerID: string, modelID: string) {
  return `${providerID}/${modelID}`
}

export function recordLatency(record: LatencyRecord) {
  const key = latencyKey(record.providerID, record.modelID)
  const history = latencyHistory.get(key) ?? []
  history.push(record)
  if (history.length > MAX_HISTORY_PER_KEY) history.shift()
  latencyHistory.set(key, history)
}

export function getAverageLatency(providerID: string, modelID: string): number | undefined {
  const key = latencyKey(providerID, modelID)
  const history = latencyHistory.get(key)
  if (!history || history.length === 0) return undefined
  const successful = history.filter((r) => r.success)
  if (successful.length === 0) return undefined
  return successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length
}

export function getSuccessRate(providerID: string, modelID: string): number {
  const key = latencyKey(providerID, modelID)
  const history = latencyHistory.get(key)
  if (!history || history.length === 0) return 1
  const successful = history.filter((r) => r.success).length
  return successful / history.length
}

const OAUTH_PROVIDERS = new Set(["opencode", "xiaomi", "github-copilot"])

/**
 * Test a provider's API key using provider-specific methods.
 */
export async function testProviderConnection(
  providerID: string,
  apiKey: string,
  options?: {
    baseURL?: string
    modelID?: string
    timeout?: number
  },
): Promise<HealthResult> {
  const startTime = Date.now()
  const result: HealthResult = {
    providerID,
    status: "unknown",
    latencyMs: 0,
    testedAt: Date.now(),
    modelCount: 0,
    hasValidKey: Boolean(apiKey && apiKey.length > 10),
  }

  if (OAUTH_PROVIDERS.has(providerID)) {
    result.status = "skipped"
    result.error = "OAuth provider — test via `glitch auth login`"
    return result
  }

  if (!apiKey || apiKey.length < 5) {
    result.status = "unhealthy"
    result.error = "API key eksik veya çok kısa"
    return result
  }

  try {
    const testFn = getTestFunction(providerID)
    const testResult = await testFn(apiKey, options?.baseURL, options?.timeout ?? 15000)
    result.latencyMs = Date.now() - startTime
    result.status = testResult.status
    result.error = testResult.error
    result.modelCount = testResult.modelCount ?? 0
  } catch (e: any) {
    result.latencyMs = Date.now() - startTime
    if (e.name === "AbortError") {
      result.status = "unhealthy"
      result.error = "Bağlantı zaman aşımı"
    } else if (e.cause?.code === "ECONNREFUSED") {
      result.status = "unhealthy"
      result.error = "Bağlantı reddedildi"
    } else if (e.cause?.code === "ENOTFOUND") {
      result.status = "unhealthy"
      result.error = "DNS çözümleme başarısız"
    } else {
      result.status = "unhealthy"
      result.error = e.message ?? "Bağlantı başarısız"
    }
  }

  return result
}

type TestResult = { status: HealthResult["status"]; error?: string; modelCount?: number }
type TestFn = (apiKey: string, baseURL?: string, timeout?: number) => Promise<TestResult>

function getTestFunction(providerID: string): TestFn {
  // Provider-specific test functions
  const specialTests: Record<string, TestFn> = {
    google: testGoogle,
    "google-vertex": testGoogleVertex,
    "amazon-bedrock": testAmazonBedrock,
    alibaba: testAlibaba,
    "alibaba-cn": testAlibaba,
    zhipuai: testZhipuAI,
    zai: testZhipuAI,
    ollama: testOllama,
    "ollama-cloud": testOllamaCloud,
    gitlab: testGitLab,
  }
  if (specialTests[providerID]) return specialTests[providerID]
  // For OpenAI-compatible providers, bind the providerID to use correct base URL + model
  return (apiKey, baseURL, timeout) => {
    const url = baseURL ?? getProviderBaseURL(providerID)
    const model = getTestModel(providerID)
    return testOpenAICompatible(apiKey, url, timeout, model)
  }
}

// ─── Google Generative AI (NOT OpenAI-compatible) ────────────────────────
async function testGoogle(apiKey: string, _baseURL?: string, timeout?: number): Promise<TestResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout ?? 15000)

  try {
    // Google uses API key as query parameter, not Bearer token
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      return { status: "healthy", modelCount: data?.models?.length ?? 0 }
    }
    if (res.status === 400 || res.status === 403) {
      return { status: "unhealthy", error: `API key geçersiz (HTTP ${res.status})` }
    }
    return { status: "degraded", error: `HTTP ${res.status}` }
  } catch (e: any) {
    clearTimeout(timer)
    throw e
  }
}

// ─── Google Vertex AI ────────────────────────────────────────────────────
async function testGoogleVertex(apiKey: string, _baseURL?: string, timeout?: number): Promise<TestResult> {
  // Vertex AI uses OAuth, can't test with simple API key
  return { status: "skipped", error: "Vertex AI OAuth gerektirir" }
}

// ─── Amazon Bedrock ──────────────────────────────────────────────────────
async function testAmazonBedrock(apiKey: string, _baseURL?: string, timeout?: number): Promise<TestResult> {
  // Bedrock uses AWS SigV4, can't test with simple fetch
  return { status: "skipped", error: "AWS credential chain gerektirir" }
}

// ─── Alibaba DashScope ───────────────────────────────────────────────────
async function testAlibaba(apiKey: string, _baseURL?: string, timeout?: number): Promise<TestResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout ?? 15000)

  try {
    // DashScope OpenAI-compatible endpoint
    const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "qwen-turbo",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    })
    clearTimeout(timer)

    if (res.ok) {
      return { status: "healthy", modelCount: 1 }
    }
    if (res.status === 401 || res.status === 403) {
      return { status: "unhealthy", error: `API key geçersiz (HTTP ${res.status})` }
    }
    if (res.status === 429) {
      return { status: "degraded", error: "Rate limited" }
    }
    // Read error body for more context
    const body = await res.text().catch(() => "")
    let msg = `HTTP ${res.status}`
    try {
      const json = JSON.parse(body)
      msg = json?.error?.message ?? json?.message ?? msg
    } catch {}
    return { status: "degraded", error: msg }
  } catch (e: any) {
    clearTimeout(timer)
    throw e
  }
}

// ─── ZhipuAI (GLM) ──────────────────────────────────────────────────────
async function testZhipuAI(apiKey: string, _baseURL?: string, timeout?: number): Promise<TestResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout ?? 15000)

  try {
    const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "glm-4-flash",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    })
    clearTimeout(timer)

    if (res.ok) {
      return { status: "healthy", modelCount: 1 }
    }
    if (res.status === 401 || res.status === 403) {
      return { status: "unhealthy", error: `API key geçersiz (HTTP ${res.status})` }
    }
    const body = await res.text().catch(() => "")
    let msg = `HTTP ${res.status}`
    try {
      const json = JSON.parse(body)
      msg = json?.error?.message ?? json?.message ?? msg
    } catch {}
    return { status: "degraded", error: msg }
  } catch (e: any) {
    clearTimeout(timer)
    throw e
  }
}

// ─── Ollama (local) ─────────────────────────────────────────────────────
async function testOllama(apiKey: string, _baseURL?: string, timeout?: number): Promise<TestResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout ?? 5000)

  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: controller.signal })
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      return { status: "healthy", modelCount: data?.models?.length ?? 0 }
    }
    return { status: "degraded", error: `HTTP ${res.status}` }
  } catch (e: any) {
    clearTimeout(timer)
    if (e.name === "AbortError") {
      return { status: "unhealthy", error: "Ollama çalışıyor mu? (localhost:11434)" }
    }
    if (e.cause?.code === "ECONNREFUSED") {
      return { status: "unhealthy", error: "Ollama çalışmıyor — `ollama serve` çalıştırın" }
    }
    throw e
  }
}

// ─── Ollama Cloud ────────────────────────────────────────────────────────
async function testOllamaCloud(apiKey: string, _baseURL?: string, timeout?: number): Promise<TestResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout ?? 10000)

  try {
    // Ollama Cloud doesn't have a standard API — skip
    return { status: "skipped", error: "Ollama Cloud henüz desteklenmiyor" }
  } finally {
    clearTimeout(timer)
  }
}

// ─── GitLab ──────────────────────────────────────────────────────────────
async function testGitLab(apiKey: string, _baseURL?: string, timeout?: number): Promise<TestResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout ?? 10000)

  try {
    const res = await fetch("https://gitlab.com/api/v4/user", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      return { status: "healthy", modelCount: 0, error: `Hoş geldin: ${data?.name ?? "user"}` }
    }
    if (res.status === 401) {
      return { status: "unhealthy", error: "Token geçersiz (HTTP 401)" }
    }
    return { status: "degraded", error: `HTTP ${res.status}` }
  } catch (e: any) {
    clearTimeout(timer)
    throw e
  }
}

// ─── OpenAI-Compatible (default fallback) ────────────────────────────────
async function testOpenAICompatible(apiKey: string, baseURL?: string, timeout?: number, model?: string): Promise<TestResult> {
  const url = baseURL ?? getProviderBaseURL("openai")
  if (!url) {
    return { status: "unknown", error: "Base URL tanımlı değil" }
  }

  const testModel = model ?? "gpt-3.5-turbo"
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout ?? 15000)

  try {
    const res = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    })
    clearTimeout(timer)

    if (res.ok) {
      return { status: "healthy", modelCount: 1 }
    }
    if (res.status === 401 || res.status === 403) {
      return { status: "unhealthy", error: `API key geçersiz (HTTP ${res.status})` }
    }
    if (res.status === 429) {
      return { status: "degraded", error: "Rate limited" }
    }
    const body = await res.text().catch(() => "")
    let msg = `HTTP ${res.status}`
    try {
      const json = JSON.parse(body)
      msg = json?.error?.message ?? json?.message ?? msg
    } catch {}
    return { status: "degraded", error: msg }
  } catch (e: any) {
    clearTimeout(timer)
    throw e
  }
}

function getTestModel(providerID: string): string {
  const models: Record<string, string> = {
    openai: "gpt-3.5-turbo",
    anthropic: "claude-3-haiku-20240307",
    groq: "llama-3.1-8b-instant",
    deepseek: "deepseek-chat",
    mistral: "mistral-tiny",
    openrouter: "meta-llama/llama-3.1-8b-instruct:free",
    xai: "grok-2-latest",
    cerebras: "llama-3.1-8b",
    togetherai: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    deepinfra: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    perplexity: "llama-3.1-8b-instruct",
    novita: "meta-llama/llama-3.1-8b-instruct",
    chutes: "meta-llama/llama-3.1-8b-instruct",
    sambanova: "Meta-Llama-3.1-8B-Instruct",
    nvidia: "meta/llama-3.1-8b-instruct",
    moonshot: "moonshot-v1-8k",
    venice: "llama-3.3-70b",
    kilo: "meta-llama/llama-3.1-8b-instruct",
    zenmux: "meta-llama/llama-3.1-8b-instruct",
    llmgateway: "meta-llama/llama-3.1-8b-instruct",
    fireworks: "accounts/fireworks/models/llama-v3p1-8b-instruct",
    baseten: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  }
  return models[providerID] ?? "gpt-3.5-turbo"
}

function getProviderBaseURL(providerID: string): string | undefined {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com",
    anthropic: "https://api.anthropic.com",
    groq: "https://api.groq.com/openai",
    deepseek: "https://api.deepseek.com",
    mistral: "https://api.mistral.ai",
    openrouter: "https://openrouter.ai/api",
    xai: "https://api.x.ai",
    cerebras: "https://api.cerebras.ai",
    togetherai: "https://api.together.xyz",
    deepinfra: "https://api.deepinfra.com/v1/openai",
    perplexity: "https://api.perplexity.ai",
    novita: "https://api.novita.ai/v3/openai",
    chutes: "https://api.chutes.ai/v1",
    sambanova: "https://api.sambanova.ai/v1",
    moonshot: "https://api.moonshot.cn/v1",
    nvidia: "https://integrate.api.nvidia.com/v1",
    fireworks: "https://api.fireworks.ai/inference/v1",
    baseten: "https://api.baseten.co/v1",
    venice: "https://api.venice.ai/api/v1",
    kilo: "https://api.kilo.ai/v1",
    zenmux: "https://api.zenmux.ai/v1",
    llmgateway: "https://api.llmgateway.ai/v1",
  }
  return urls[providerID]
}

export async function testAllProviders(
  providers: Array<{ id: string; key?: string; baseURL?: string }>,
): Promise<HealthResult[]> {
  const results = await Promise.allSettled(
    providers.map((p) => testProviderConnection(p.id, p.key ?? "", { baseURL: p.baseURL })),
  )
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value
    return {
      providerID: providers[i].id,
      status: "unhealthy" as const,
      latencyMs: 0,
      error: r.reason?.message ?? "Test başarısız",
      testedAt: Date.now(),
      modelCount: 0,
      hasValidKey: false,
    }
  })
}

export function sortByLatency(
  providers: Array<{ providerID: string; modelID: string }>,
): Array<{ providerID: string; modelID: string; avgLatency: number }> {
  return providers
    .map((p) => ({
      ...p,
      avgLatency: getAverageLatency(p.providerID, p.modelID) ?? Infinity,
    }))
    .sort((a, b) => a.avgLatency - b.avgLatency)
}

export function getBestProvider(
  providers: Array<{ providerID: string; modelID: string }>,
): { providerID: string; modelID: string } | undefined {
  if (providers.length === 0) return undefined
  if (providers.length === 1) return providers[0]

  const scored = providers.map((p) => {
    const avgLatency = getAverageLatency(p.providerID, p.modelID)
    const successRate = getSuccessRate(p.providerID, p.modelID)
    const latencyScore = avgLatency !== undefined ? Math.max(0, 1 - avgLatency / 10000) : 0.5
    const score = successRate * 0.7 + latencyScore * 0.3
    return { ...p, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]
}
