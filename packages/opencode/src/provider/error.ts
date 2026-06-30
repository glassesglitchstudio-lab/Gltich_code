import { APICallError } from "ai"
import { STATUS_CODES } from "http"
import { iife } from "@/util/iife"
import type { ProviderID } from "./schema"

// Adapted from overflow detection patterns in:
// https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/overflow.ts
const OVERFLOW_PATTERNS = [
  /prompt is too long/i, // Anthropic
  /input is too long for requested model/i, // Amazon Bedrock
  /exceeds the context window/i, // OpenAI (Completions + Responses API message text)
  /input token count.*exceeds the maximum/i, // Google (Gemini)
  /maximum prompt length is \d+/i, // xAI (Grok)
  /reduce the length of the messages/i, // Groq
  /maximum context length is \d+ tokens/i, // OpenRouter, DeepSeek, vLLM
  /exceeds the limit of \d+/i, // GitHub Copilot
  /exceeds the available context size/i, // llama.cpp server
  /greater than the context length/i, // LM Studio
  /context window exceeds limit/i, // MiniMax
  /exceeded model token limit/i, // Kimi For Coding, Moonshot
  /context[_ ]length[_ ]exceeded/i, // Generic fallback
  /request entity too large/i, // HTTP 413
  /context length is only \d+ tokens/i, // vLLM
  /input length.*exceeds.*context length/i, // vLLM
  /prompt too long; exceeded (?:max )?context length/i, // Ollama explicit overflow error
  /too large for model with \d+ maximum context length/i, // Mistral
  /model_context_window_exceeded/i, // z.ai non-standard finish_reason surfaced as error text
]

function isOpenAiErrorRetryable(e: APICallError) {
  const status = e.statusCode
  if (!status) return e.isRetryable
  // openai sometimes returns 404 for models that are actually available
  return status === 404 || e.isRetryable
}

// Providers not reliably handled in this function:
// - z.ai: can accept overflow silently (needs token-count/context-window checks)
function isOverflow(message: string) {
  if (OVERFLOW_PATTERNS.some((p) => p.test(message))) return true

  // Providers/status patterns handled outside of regex list:
  // - Cerebras: often returns "400 (no body)" / "413 (no body)"
  // - Mistral: often returns "400 (no body)" / "413 (no body)"
  return /^4(00|13)\s*(status code)?\s*\(no body\)/i.test(message)
}

// Provider IDs served by the MiMo model gateway. Its error bodies carry
// non-standard semantics (e.g. moderation/risk-control blocks under HTTP 400),
// so the gateway-specific handling below is scoped to these providers and leaves
// every other provider's error flow untouched.
const MIMO_GATEWAY_PROVIDERS = new Set(["xiaomi", "mimo"])

// MiMo gateway error.code values worth relabeling: moderation (421) and
// risk-control (441) blocks arrive under a generic HTTP 400.
const FRIENDLY_GATEWAY_CODES: Record<string, string> = {
  "421": "Request blocked by content moderation",
  "441": "Request blocked by risk control",
}

function message(providerID: ProviderID, e: APICallError) {
  return iife(() => {
    // MiMo gateway: relabel known block codes and surface error.param (the real
    // reason often lives there while error.message stays generic). json() returns
    // undefined for non-JSON, so HTML/proxy error pages fall through to the
    // original handling below.
    const gw = MIMO_GATEWAY_PROVIDERS.has(providerID) ? json(e.responseBody)?.error : undefined
    if (gw && typeof gw === "object") {
      const base = FRIENDLY_GATEWAY_CODES[String(gw.code)] ?? (typeof gw.message === "string" ? gw.message : "")
      if (base) return typeof gw.param === "string" && gw.param !== base ? `${base}: ${gw.param}` : base
    }

    const msg = e.message
    if (msg === "") {
      if (e.responseBody) return e.responseBody
      if (e.statusCode) {
        const err = STATUS_CODES[e.statusCode]
        if (err) return err
      }
      return "Unknown error"
    }

    if (!e.responseBody || (e.statusCode && msg !== STATUS_CODES[e.statusCode])) {
      return msg
    }

    try {
      const body = JSON.parse(e.responseBody)
      // try to extract common error message fields
      const errMsg = body.message || body.error || body.error?.message
      if (errMsg && typeof errMsg === "string") {
        return `${msg}: ${errMsg}`
      }
    } catch {}

    // If responseBody is HTML (e.g. from a gateway or proxy error page),
    // provide a human-readable message instead of dumping raw markup
    if (/^\s*<!doctype|^\s*<html/i.test(e.responseBody)) {
      if (e.statusCode === 401) {
        return "Unauthorized: request was blocked by a gateway or proxy. Your authentication token may be missing or expired — try running `opencode auth login <your provider URL>` to re-authenticate."
      }
      if (e.statusCode === 403) {
        return "Forbidden: request was blocked by a gateway or proxy. You may not have permission to access this resource — check your account and provider settings."
      }
      return msg
    }

    return `${msg}: ${e.responseBody}`
  }).trim()
}

function json(input: unknown) {
  if (typeof input === "string") {
    try {
      const result = JSON.parse(input)
      if (result && typeof result === "object") return result
      return undefined
    } catch {
      return undefined
    }
  }
  if (typeof input === "object" && input !== null) {
    return input
  }
  return undefined
}

export type ParsedStreamError =
  | {
      type: "context_overflow"
      message: string
      responseBody: string
    }
  | {
      type: "quota_exceeded"
      message: string
      isRetryable: false
      responseBody: string
    }
  | {
      type: "api_error"
      message: string
      isRetryable: false
      responseBody: string
    }

export function parseStreamError(input: unknown): ParsedStreamError | undefined {
  const body = json(input)
  if (!body) return

  const responseBody = JSON.stringify(body)
  if (body.type !== "error") return

  switch (body?.error?.code) {
    case "context_length_exceeded":
      return {
        type: "context_overflow",
        message: "Input exceeds context window of this model",
        responseBody,
      }
    case "insufficient_quota":
      return {
        type: "quota_exceeded",
        message: "Quota exceeded. Check your plan and billing details.",
        isRetryable: false,
        responseBody,
      }
    case "usage_not_included":
      return {
        type: "quota_exceeded",
        message: "To use Codex with your ChatGPT plan, upgrade to Plus: https://chatgpt.com/explore/plus.",
        isRetryable: false,
        responseBody,
      }
    case "invalid_prompt":
      return {
        type: "api_error",
        message: typeof body?.error?.message === "string" ? body?.error?.message : "Invalid prompt.",
        isRetryable: false,
        responseBody,
      }
  }

  // Detect billing/quota errors from HTTP status codes and error messages
  if (body?.error?.type === "billing_error" || body?.error?.type === "payment_required") {
    return {
      type: "quota_exceeded",
      message: typeof body?.error?.message === "string" ? body.error.message : "Billing error. Check your payment method.",
      isRetryable: false,
      responseBody,
    }
  }
}

export type ParsedAPICallError =
  | {
      type: "context_overflow"
      message: string
      responseBody?: string
    }
  | {
      type: "quota_exceeded"
      message: string
      statusCode?: number
      responseHeaders?: Record<string, string>
      responseBody?: string
      metadata?: Record<string, string>
    }
  | {
      type: "api_error"
      message: string
      statusCode?: number
      isRetryable: boolean
      responseHeaders?: Record<string, string>
      responseBody?: string
      metadata?: Record<string, string>
    }

export function isAuthError(input: { statusCode?: number; responseBody?: string; message: string }): boolean {
  if (input.statusCode === 401) return true
  if (input.statusCode === 403) {
    const lower = input.message.toLowerCase()
    if (lower.includes("token") || lower.includes("api_key") || lower.includes("unauthorized") || lower.includes("invalid") || lower.includes("authentication") || lower.includes("credential")) return true
  }
  if (input.responseBody) {
    const body = json(input.responseBody)
    if (body?.error?.code === "invalid_api_key") return true
    if (body?.error?.type === "authentication_error") return true
  }
  const lower = input.message.toLowerCase()
  if (lower.includes("invalid api key") || lower.includes("unauthorized") || lower.includes("authentication failed")) return true
  return false
}

export function isQuotaError(input: { statusCode?: number; responseBody?: string; message: string }): boolean {
  // Auth hatalarını quota'dan ayır — bunlar fallback ile çözülmez
  if (isAuthError(input)) return false

  if (input.statusCode === 402) return true
  if (input.statusCode === 403) {
    const lower = input.message.toLowerCase()
    if (lower.includes("quota") || lower.includes("billing") || lower.includes("payment")) return true
  }
  if (input.responseBody) {
    const body = json(input.responseBody)
    if (body?.error?.code === "insufficient_quota") return true
    if (body?.error?.type === "billing_error" || body?.error?.type === "payment_required") return true
  }
  const lower = input.message.toLowerCase()
  if (lower.includes("insufficient quota") || lower.includes("quota exceeded") || lower.includes("billing error")) return true
  return false
}

export function parseAPICallError(input: { providerID: ProviderID; error: APICallError }): ParsedAPICallError {
  const m = message(input.providerID, input.error)
  const body = json(input.error.responseBody)
  if (isOverflow(m) || input.error.statusCode === 413 || body?.error?.code === "context_length_exceeded") {
    return {
      type: "context_overflow",
      message: m,
      responseBody: input.error.responseBody,
    }
  }

  if (isQuotaError({ statusCode: input.error.statusCode, responseBody: input.error.responseBody, message: m })) {
    return {
      type: "quota_exceeded",
      message: m,
      statusCode: input.error.statusCode,
      responseHeaders: input.error.responseHeaders,
      responseBody: input.error.responseBody,
      metadata: input.error.url ? { url: input.error.url } : undefined,
    }
  }

  const metadata = input.error.url ? { url: input.error.url } : undefined
  return {
    type: "api_error",
    message: m,
    statusCode: input.error.statusCode,
    isRetryable: input.providerID.startsWith("openai") ? isOpenAiErrorRetryable(input.error) : input.error.isRetryable,
    responseHeaders: input.error.responseHeaders,
    responseBody: input.error.responseBody,
    metadata,
  }
}
