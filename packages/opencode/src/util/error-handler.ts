/**
 * Central error handler for Glitch Code.
 *
 * Provides formatted error output for CLI and API,
 * error logging, and error statistics tracking.
 */

import { GlitchError } from "./glitch-error"
import { getErrorDefinition, formatErrorMessage } from "./error-codes"
import * as Log from "./log"

const log = Log.create({ service: "error-handler" })

/**
 * Error statistics tracking
 */
interface ErrorStats {
  total: number
  byCode: Record<string, number>
  byRecoverable: { recoverable: number; nonRecoverable: number }
}

const stats: ErrorStats = {
  total: 0,
  byCode: {},
  byRecoverable: { recoverable: 0, nonRecoverable: 0 },
}

/**
 * Track error statistics
 */
function trackError(error: GlitchError): void {
  stats.total++
  stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1
  if (error.recoverable) {
    stats.byRecoverable.recoverable++
  } else {
    stats.byRecoverable.nonRecoverable++
  }
}

/**
 * Format error for CLI display with colors and icons
 */
export function formatErrorForCLI(error: unknown): string {
  const glitchError = GlitchError.isGlitchError(error) ? error : GlitchError.from(error)

  // Track statistics
  trackError(glitchError)

  const lines: string[] = []

  // Error icon and code
  const icon = glitchError.recoverable ? "⚠️" : "❌"
  lines.push(`${icon} Error [${glitchError.code}]`)

  // User-friendly message
  if (glitchError.userMessage) {
    lines.push(`   ${glitchError.userMessage}`)
  }

  // Technical message (for debugging)
  if (glitchError.message && glitchError.message !== glitchError.userMessage) {
    lines.push(`   Technical: ${glitchError.message}`)
  }

  // Suggestion
  if (glitchError.suggestion) {
    lines.push(`   💡 ${glitchError.suggestion}`)
  }

  // Stack trace (only in debug mode)
  if (process.env.DEBUG && glitchError.stack) {
    lines.push("")
    lines.push("Stack trace:")
    lines.push(glitchError.stack)
  }

  return lines.join("\n")
}

/**
 * Format error as JSON for API responses
 */
export function formatErrorForAPI(error: unknown): Record<string, unknown> {
  const glitchError = GlitchError.isGlitchError(error) ? error : GlitchError.from(error)

  // Track statistics
  trackError(glitchError)

  return {
    error: {
      code: glitchError.code,
      message: glitchError.message,
      userMessage: glitchError.userMessage,
      recoverable: glitchError.recoverable,
      suggestion: glitchError.suggestion,
      ...(process.env.DEBUG ? { stack: glitchError.stack } : {}),
    },
  }
}

/**
 * Main error handler that formats errors for display
 */
export function handleError(error: unknown): string {
  log.error("Error occurred", {
    code: GlitchError.isGlitchError(error) ? error.code : "UNKNOWN",
    message: error instanceof Error ? error.message : String(error),
  })

  return formatErrorForCLI(error)
}

/**
 * Get error statistics
 */
export function getErrorStats(): ErrorStats {
  return { ...stats }
}

/**
 * Reset error statistics
 */
export function resetErrorStats(): void {
  stats.total = 0
  stats.byCode = {}
  stats.byRecoverable = { recoverable: 0, nonRecoverable: 0 }
}

/**
 * Create a GlitchError from error code with template variables
 */
export function createError(
  code: string,
  variables: Record<string, string | number> = {},
  cause?: unknown,
): GlitchError {
  const definition = getErrorDefinition(code)

  if (definition) {
    return new GlitchError(
      code,
      formatErrorMessage(definition.message, variables),
      formatErrorMessage(definition.userMessage, variables),
      definition.recoverable,
      definition.suggestion,
      cause,
    )
  }

  // Fallback for unknown error codes
  return new GlitchError(
    code,
    variables["details"] ? String(variables["details"]) : `Error: ${code}`,
    variables["details"] ? String(variables["details"]) : `Hata: ${code}`,
    false,
    undefined,
    cause,
  )
}