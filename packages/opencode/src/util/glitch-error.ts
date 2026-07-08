/**
 * Custom error class for Glitch Code with structured error information.
 *
 * Provides error codes, user-friendly messages, and recovery suggestions
 * for better error handling and debugging experience.
 */
export class GlitchError extends Error {
  /** Error code for programmatic handling (e.g., "DOCKER_NOT_AVAILABLE") */
  readonly code: string

  /** Human-readable message for CLI display */
  readonly userMessage: string

  /** Whether the error can be recovered from */
  readonly recoverable: boolean

  /** Optional suggestion for fixing the error */
  readonly suggestion?: string

  /** Original error that caused this error */
  override readonly cause?: unknown

  constructor(
    code: string,
    message: string,
    userMessage: string,
    recoverable: boolean = false,
    suggestion?: string,
    cause?: unknown,
  ) {
    super(message)
    this.name = "GlitchError"
    this.code = code
    this.userMessage = userMessage
    this.recoverable = recoverable
    this.suggestion = suggestion
    this.cause = cause

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GlitchError)
    }
  }

  /**
   * Check if an error is a GlitchError
   */
  static isGlitchError(error: unknown): error is GlitchError {
    return error instanceof GlitchError
  }

  /**
   * Convert any error to a GlitchError
   */
  static from(error: unknown, code: string = "UNKNOWN_ERROR"): GlitchError {
    if (error instanceof GlitchError) {
      return error
    }

    if (error instanceof Error) {
      return new GlitchError(
        code,
        error.message,
        error.message,
        false,
        undefined,
        error,
      )
    }

    const message = String(error)
    return new GlitchError(
      code,
      message,
      message,
      false,
      undefined,
      error,
    )
  }
}