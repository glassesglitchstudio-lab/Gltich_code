import * as vscode from "vscode"

export interface Session {
  id: string
  title: string
  time: {
    created: string
    updated: string
  }
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  time: string
}

export interface Provider {
  id: string
  name: string
  models: Model[]
}

export interface Model {
  id: string
  name: string
  provider: string
}

export interface Diff {
  originalPath: string
  modifiedPath: string
  additions: number
  deletions: number
}

export class GlitchClient {
  private baseUrl: string
  private auth: string | null

  constructor(baseUrl: string, password?: string) {
    this.baseUrl = baseUrl
    this.auth = password ? `Basic ${Buffer.from(`glitchcode:${password}`).toString("base64")}` : null
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (this.auth) {
      headers["Authorization"] = this.auth
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // Session methods
  async listSessions(): Promise<Session[]> {
    const result = await this.request<any>("GET", "/session")
    return result.sessions || []
  }

  async createSession(): Promise<Session> {
    const result = await this.request<any>("POST", "/session")
    return result.session || result
  }

  async getSession(id: string): Promise<Session> {
    const result = await this.request<any>("GET", `/session/${id}`)
    return result.session || result
  }

  async deleteSession(id: string): Promise<void> {
    await this.request<void>("DELETE", `/session/${id}`)
  }

  // Message methods
  async *sendMessage(sessionId: string, content: string): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/session/${sessionId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.auth ? { Authorization: this.auth } : {}),
      },
      body: JSON.stringify({ content }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === "text") {
              yield data.content
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  // Event subscription
  subscribeEvents(): EventSource {
    const headers: Record<string, string> = {}
    if (this.auth) {
      headers["Authorization"] = this.auth
    }

    return new EventSource(`${this.baseUrl}/event`)
  }

  // Provider methods
  async listProviders(): Promise<Provider[]> {
    const result = await this.request<any>("GET", "/provider")
    return result.providers || []
  }

  async listModels(): Promise<Model[]> {
    const result = await this.request<any>("GET", "/provider")
    const models: Model[] = []
    for (const provider of result.providers || []) {
      for (const model of provider.models || []) {
        models.push({
          id: model.id,
          name: model.name,
          provider: provider.id,
        })
      }
    }
    return models
  }

  // Config methods
  async getConfig(): Promise<any> {
    return this.request<any>("GET", "/config")
  }

  async updateConfig(patch: any): Promise<void> {
    await this.request<void>("PATCH", "/config", patch)
  }

  // Diff methods
  async getDiff(sessionId: string): Promise<Diff[]> {
    const result = await this.request<any>("GET", `/session/${sessionId}/diff`)
    return result.diffs || []
  }

  // Health check
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/global/health`)
      return response.ok
    } catch {
      return false
    }
  }
}
