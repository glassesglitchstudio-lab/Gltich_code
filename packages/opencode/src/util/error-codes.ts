/**
 * Error code registry for Glitch Code.
 *
 * Each error code has:
 * - message: Technical error message template
 * - userMessage: Human-readable message template for CLI display
 * - recoverable: Whether the error can be recovered from
 * - suggestion: Optional fix suggestion
 */

export interface ErrorDefinition {
  /** Technical error message template */
  message: string

  /** Human-readable message for CLI display */
  userMessage: string

  /** Whether the error can be recovered from */
  recoverable: boolean

  /** Optional suggestion for fixing the error */
  suggestion?: string
}

/**
 * Common error codes
 */
export const CommonErrors: Record<string, ErrorDefinition> = {
  // File system errors
  FILE_NOT_FOUND: {
    message: "File not found: {path}",
    userMessage: "Dosya bulunamadı: {path}",
    recoverable: true,
    suggestion: "Dosya yolunu kontrol edin veya dosyayı oluşturun.",
  },
  FILE_ACCESS_DENIED: {
    message: "Access denied to file: {path}",
    userMessage: "Dosya erişimi reddedildi: {path}",
    recoverable: false,
    suggestion: "Dosya izinlerini kontrol edin.",
  },
  FILE_ALREADY_EXISTS: {
    message: "File already exists: {path}",
    userMessage: "Dosya zaten mevcut: {path}",
    recoverable: true,
    suggestion: "Farklı bir dosya adı kullanın veya mevcut dosyayı silin.",
  },
  DIRECTORY_NOT_FOUND: {
    message: "Directory not found: {path}",
    userMessage: "Dizin bulunamadı: {path}",
    recoverable: true,
    suggestion: "Dizin yolunu kontrol edin veya dizini oluşturun.",
  },
  CANNOT_READ_BINARY: {
    message: "Cannot read binary file: {path}",
    userMessage: "İkili dosya okunamıyor: {path}",
    recoverable: false,
  },

  // Network errors
  NETWORK_ERROR: {
    message: "Network error: {details}",
    userMessage: "Ağ hatası: {details}",
    recoverable: true,
    suggestion: "İnternet bağlantınızı kontrol edin.",
  },
  REQUEST_TIMEOUT: {
    message: "Request timed out after {timeout}ms",
    userMessage: "İstek {timeout} ms sonra zaman aşımına uğradı",
    recoverable: true,
    suggestion: "Daha uzun bir timeout değeri deneyin veya daha sonra tekrar deneyin.",
  },
  RESPONSE_TOO_LARGE: {
    message: "Response too large (exceeds {limit} limit)",
    userMessage: "Yanıt çok büyük ({limit} limitini aşıyor)",
    recoverable: false,
  },
  URL_BLOCKED: {
    message: "URL blocked for security reasons: {url}",
    userMessage: "URL güvenlik nedeniyle engellendi: {url}",
    recoverable: false,
    suggestion: "Özel veya dahili ağ adreslerine erişim güvenlik nedeniyle engellenmiştir.",
  },
  INVALID_URL: {
    message: "Invalid URL: {url}",
    userMessage: "Geçersiz URL: {url}",
    recoverable: true,
    suggestion: "URL'nin http:// veya https:// ile başladığından emin olun.",
  },

  // Docker errors
  DOCKER_NOT_AVAILABLE: {
    message: "Docker is not available: {details}",
    userMessage: "Docker kurulu değil veya erişilemez: {details}",
    recoverable: true,
    suggestion: "Docker'ı kurun: winget install Docker",
  },
  DOCKER_CONTAINER_NOT_FOUND: {
    message: "Docker container not found: {name}",
    userMessage: "Docker konteyneri bulunamadı: {name}",
    recoverable: true,
    suggestion: "Konteyner adını veya ID'sini kontrol edin: docker ps",
  },
  DOCKER_OPERATION_FAILED: {
    message: "Docker operation failed: {operation} - {details}",
    userMessage: "Docker işlemi başarısız oldu: {operation} - {details}",
    recoverable: true,
  },

  // Git errors
  NOT_A_GIT_REPO: {
    message: "Not a git repository: {path}",
    userMessage: "Bu bir git deposu değil: {path}",
    recoverable: false,
    suggestion: "git init komutu ile yeni bir depo oluşturun.",
  },
  GIT_OPERATION_FAILED: {
    message: "Git operation failed: {operation} - {details}",
    userMessage: "Git işlemi başarısız oldu: {operation} - {details}",
    recoverable: true,
  },
  COMMIT_FAILED: {
    message: "Git commit failed: {details}",
    userMessage: "Git commit başarısız oldu: {details}",
    recoverable: true,
    suggestion: "Değişiklikleri kontrol edin ve tekrar deneyin.",
  },

  // Tool errors
  TOOL_EXECUTION_FAILED: {
    message: "Tool execution failed: {tool} - {details}",
    userMessage: "Araç çalıştırma hatası: {tool} - {details}",
    recoverable: true,
  },
  INVALID_PARAMETERS: {
    message: "Invalid parameters: {details}",
    userMessage: "Geçersiz parametreler: {details}",
    recoverable: true,
    suggestion: "Parametreleri kontrol edin.",
  },
  PERMISSION_DENIED: {
    message: "Permission denied: {action}",
    userMessage: "İzin reddedildi: {action}",
    recoverable: false,
    suggestion: "Gerekli izinleri verin.",
  },

  // Provider errors
  PROVIDER_NOT_AVAILABLE: {
    message: "Provider not available: {provider}",
    userMessage: "Sağlayıcı kullanılamıyor: {provider}",
    recoverable: true,
    suggestion: "Farklı bir sağlayıcı deneyin veya sağlayıcıyı yapılandırın.",
  },
  API_KEY_INVALID: {
    message: "Invalid API key for provider: {provider}",
    userMessage: "Geçersiz API anahtarı: {provider}",
    recoverable: false,
    suggestion: "API anahtarınızı kontrol edin ve yapılandırın.",
  },
  RATE_LIMIT_EXCEEDED: {
    message: "Rate limit exceeded for provider: {provider}",
    userMessage: "Hız limiti aşıldı: {provider}",
    recoverable: true,
    suggestion: "Biraz bekleyin ve tekrar deneyin.",
  },

  // Session errors
  SESSION_NOT_FOUND: {
    message: "Session not found: {id}",
    userMessage: "Oturum bulunamadı: {id}",
    recoverable: false,
  },
  SESSION_EXPIRED: {
    message: "Session expired: {id}",
    userMessage: "Oturum süresi doldu: {id}",
    recoverable: true,
    suggestion: "Yeni bir oturum başlatın.",
  },

  // Parser errors
  PARSE_ERROR: {
    message: "Parse error: {details}",
    userMessage: "Ayrıştırma hatası: {details}",
    recoverable: true,
    suggestion: "Girdiyi kontrol edin.",
  },

  // Timeout errors
  TIMEOUT: {
    message: "Operation timed out after {timeout}ms",
    userMessage: "İşlem {timeout} ms sonra zaman aşımına uğradı",
    recoverable: true,
    suggestion: "Daha uzun bir timeout değeri deneyin.",
  },

  // Unknown error
  UNKNOWN_ERROR: {
    message: "Unknown error: {details}",
    userMessage: "Bilinmeyen hata: {details}",
    recoverable: false,
  },
}

/**
 * Tool-specific error codes
 */
export const ToolErrors: Record<string, ErrorDefinition> = {
  BASH_COMMAND_FAILED: {
    message: "Bash command failed with exit code {code}: {command}",
    userMessage: "Bash komutu başarısız oldu (çıkış kodu {code}): {command}",
    recoverable: true,
    suggestion: "Komutu kontrol edin ve tekrar deneyin.",
  },
  BASH_TIMEOUT: {
    message: "Bash command timed out after {timeout}ms: {command}",
    userMessage: "Bash komutu {timeout} ms sonra zaman aşımına uğradı",
    recoverable: true,
    suggestion: "Daha uzun bir timeout değeri deneyin.",
  },
  EDIT_NO_MATCH: {
    message: "Edit failed: old_string not found in {path}",
    userMessage: "Düzenleme başarısız: {path} dosyasında eshir_string bulunamadı",
    recoverable: true,
    suggestion: "Düzenlenecek metni kontrol edin.",
  },
  EDIT_MULTIPLE_MATCHES: {
    message: "Edit failed: multiple matches for old_string in {path}",
    userMessage: "Düzenleme başarısız: {path} dosyasında birden fazla eşleşme bulundu",
    recoverable: true,
    suggestion: "Daha belirli bir eshir_string kullanın.",
  },
  WRITE_FAILED: {
    message: "Write failed for {path}: {details}",
    userMessage: "Dosya yazma başarısız: {path} - {details}",
    recoverable: true,
  },
  GLOB_NO_RESULTS: {
    message: "No files found matching pattern: {pattern}",
    userMessage: "Desenle eşleşen dosya bulunamadı: {pattern}",
    recoverable: true,
    suggestion: "Deseni kontrol edin.",
  },
}

/**
 * Get error definition by code
 */
export function getErrorDefinition(code: string): ErrorDefinition | undefined {
  return CommonErrors[code] || ToolErrors[code]
}

/**
 * Format error message with template variables
 */
export function formatErrorMessage(
  template: string,
  variables: Record<string, string | number>,
): string {
  let message = template
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, "g"), String(value))
  }
  return message
}