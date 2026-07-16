import type { NamedError } from "@glitchcode/shared/util/error"
import { Cause, Clock, Duration, Effect, Schedule } from "effect"
import { MessageV2 } from "./message-v2"
import { iife } from "@/util/iife"

export type Err = ReturnType<NamedError["toObject"]>

// This exported message is shared with the TUI upsell detector. Matching on a
// literal error string kind of sucks, but it is the simplest for now.
export const GO_UPSELL_MESSAGE = "Free usage exceeded. Upgrade your plan or switch provider."
export const QUOTA_EXCEEDED_MESSAGE = "Quota exceeded. Switch to a different provider or upgrade your plan."

export const RETRY_INITIAL_DELAY = 2000
export const RETRY_BACKOFF_FACTOR = 2
export const RETRY_MAX_DELAY_NO_HEADERS = 30_000 // 30 seconds
export const RETRY_MAX_DELAY = 2_147_483_647 // max 32-bit signed integer for setTimeout

const NETWORK_ERROR_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT"])
const SSE_TIMEOUT_MESSAGE = "SSE read timed out"
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504, 529])

/**
 * Single source of truth for "is this transient and retryable?".
 *
 * Used by:
 * - `retryable()` below (processor-level Effect.retry policy via SessionRetry.policy)
 * - `isTransientCapacityError()` in llm.ts (LLM-internal retry around streamText)
 *
 * Both call sites previously had divergent logic — this hung sessions on
 * SSE timeouts that one path retried but the other dropped. See Spec ③.
 */
export function isRetryableTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const status =
    (error as { status?: number }).status ??
    (error as { statusCode?: number }).statusCode ??
    (error as { response?: { status?: number } }).response?.status
  if (typeof status === "number" && RETRYABLE_HTTP_STATUS.has(status)) return true

  const code = (error as { code?: string }).code
  if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) return true

  if (error.message === SSE_TIMEOUT_MESSAGE) return true

  return false
}

/**
 * Check if an error is an authentication/authorization error.
 * Auth errors should NOT trigger fallback — the key itself is invalid.
 */
export function isAuthError(error: unknown): boolean {
  if (MessageV2.APIError.isInstance(error)) {
    const status = error.data.statusCode
    if (status === 401) return true
    if (status === 403) {
      const lower = error.data.message.toLowerCase()
      if (lower.includes("token") || lower.includes("api_key") || lower.includes("unauthorized") || lower.includes("invalid") || lower.includes("authentication") || lower.includes("credential")) return true
    }
    const lower = error.data.message.toLowerCase()
    if (lower.includes("invalid api key") || lower.includes("unauthorized") || lower.includes("authentication failed")) return true
  }
  return false
}

/**
 * Check if an error is a rate-limit (429) error that should trigger provider fallback
 * after retries are exhausted. Rate-limit errors on the same provider are
 * retryable, but after all retries fail, switching providers is the right move.
 */
export function isRateLimitError(error: unknown): boolean {
  if (MessageV2.APIError.isInstance(error)) {
    const status = error.data.statusCode
    if (status === 429) return true
  }
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) {
      const lower = data.message.toLowerCase()
      if (lower.includes("rate limit") || lower.includes("too many requests")) return true
    }
  }
  return false
}

/**
 * Check if an error is a quota/billing error that should trigger provider fallback.
 * Quota errors are NOT retryable on the same provider — they require switching.
 * Auth errors are excluded — they won't be fixed by switching providers.
 */
export function isQuotaError(error: unknown): boolean {
  if (isAuthError(error)) return false

  if (MessageV2.QuotaExceededError.isInstance(error)) return true

  if (MessageV2.APIError.isInstance(error)) {
    const status = error.data.statusCode
    if (status === 402) return true
    if (status === 403) {
      const lower = error.data.message.toLowerCase()
      if (lower.includes("quota") || lower.includes("billing") || lower.includes("payment")) return true
    }
    if (error.data.responseBody?.includes("insufficient_quota")) return true
    if (error.data.responseBody?.includes("billing_error")) return true
    const lower = error.data.message.toLowerCase()
    if (lower.includes("insufficient quota") || lower.includes("quota exceeded") || lower.includes("billing error")) return true
  }

  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) {
      const lower = data.message.toLowerCase()
      if (lower.includes("quota exceeded") || lower.includes("billing error") || lower.includes("insufficient quota")) return true
    }
  }

  return false
}

function cap(ms: number) {
  return Math.min(ms, RETRY_MAX_DELAY)
}

export function delay(attempt: number, error?: MessageV2.APIError) {
  if (error) {
    const headers = error.data.responseHeaders
    if (headers) {
      const retryAfterMs = headers["retry-after-ms"]
      if (retryAfterMs) {
        const parsedMs = Number.parseFloat(retryAfterMs)
        if (!Number.isNaN(parsedMs)) {
          return cap(parsedMs)
        }
      }

      const retryAfter = headers["retry-after"]
      if (retryAfter) {
        const parsedSeconds = Number.parseFloat(retryAfter)
        if (!Number.isNaN(parsedSeconds)) {
          // convert seconds to milliseconds
          return cap(Math.ceil(parsedSeconds * 1000))
        }
        // Try parsing as HTTP date format
        const parsed = Date.parse(retryAfter) - Date.now()
        if (!Number.isNaN(parsed) && parsed > 0) {
          return cap(Math.ceil(parsed))
        }
      }

      return cap(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1))
    }
  }

  return cap(Math.min(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1), RETRY_MAX_DELAY_NO_HEADERS))
}

export function retryable(error: Err) {
  // context overflow errors should not be retried
  if (MessageV2.ContextOverflowError.isInstance(error)) return undefined

  // auth errors should not be retried — the API key itself is invalid
  if (isAuthError(error)) {
    return "API key is invalid or expired. Check your provider configuration."
  }

  // quota/billing errors should not be retried on the same provider
  // they require switching to a different provider
  if (MessageV2.QuotaExceededError.isInstance(error)) {
    return QUOTA_EXCEEDED_MESSAGE
  }

  // Catch raw Error / network / SSE-timeout BEFORE APIError narrowing.
  // SessionRetry.policy unwraps Cause<unknown> via opts.parse, but raw
  // Error instances slip past the APIError check below. Adding this
  // branch closes that gap. See Spec ③ P2.
  if (isRetryableTransientError(error as unknown)) {
    const msg = (error as unknown as Error).message
    return msg || "Transient network error"
  }

  if (MessageV2.APIError.isInstance(error)) {
    const status = error.data.statusCode
    // 5xx errors are transient server failures and should always be retried,
    // even when the provider SDK doesn't explicitly mark them as retryable.
    if (!error.data.isRetryable && !(status !== undefined && status >= 500)) return undefined
    if (error.data.responseBody?.includes("FreeUsageLimitError")) return GO_UPSELL_MESSAGE
    return error.data.message.includes("Overloaded") ? "Provider is overloaded" : error.data.message
  }

  // Check for rate limit patterns in plain text error messages
  const msg = error.data?.message
  if (typeof msg === "string") {
    const lower = msg.toLowerCase()
    if (
      lower.includes("rate increased too quickly") ||
      lower.includes("rate limit") ||
      lower.includes("too many requests")
    ) {
      return msg
    }
    // Quota patterns in plain text
    if (lower.includes("quota exceeded") || lower.includes("billing error") || lower.includes("insufficient quota")) {
      return QUOTA_EXCEEDED_MESSAGE
    }
  }

  const json = iife(() => {
    try {
      if (typeof error.data?.message === "string") {
        const parsed = JSON.parse(error.data.message)
        return parsed
      }

      return JSON.parse(error.data.message)
    } catch {
      return undefined
    }
  })
  if (!json || typeof json !== "object") return undefined
  const code = typeof json.code === "string" ? json.code : ""

  if (json.type === "error" && json.error?.type === "too_many_requests") {
    return "Too Many Requests"
  }
  if (code.includes("exhausted") || code.includes("unavailable")) {
    return "Provider is overloaded"
  }
  if (json.type === "error" && typeof json.error?.code === "string" && json.error.code.includes("rate_limit")) {
    return "Rate Limited"
  }
  if (json.error?.code === "insufficient_quota" || json.error?.type === "billing_error") {
    return QUOTA_EXCEEDED_MESSAGE
  }
  return undefined
}

export function policy(opts: {
  parse: (error: unknown) => Err
  set: (input: { attempt: number; message: string; next: number }) => Effect.Effect<void>
}) {
  return Schedule.fromStepWithMetadata(
    Effect.succeed((meta: Schedule.InputMetadata<unknown>) => {
      const error = opts.parse(meta.input)
      const message = retryable(error)
      if (!message) return Cause.done(meta.attempt)
      return Effect.gen(function* () {
        const wait = delay(meta.attempt, MessageV2.APIError.isInstance(error) ? error : undefined)
        const now = yield* Clock.currentTimeMillis
        yield* opts.set({ attempt: meta.attempt, message, next: now + wait })
        return [meta.attempt, Duration.millis(wait)] as [number, Duration.Duration]
      })
    }),
  )
}

export * as SessionRetry from "./retry"
