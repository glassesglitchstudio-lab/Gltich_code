export interface UE5CommandResponse {
  success: boolean
  result?: string
  error?: string
}

export interface UE5Event {
  type: string
  data: any
}

type EventHandler = (event: UE5Event) => void

export class UE5Connector {
  private baseUrl: string
  private abortController: AbortController | null = null
  private handlers: Map<string, EventHandler[]> = new Map()
  private connected = false
  private polling = false

  constructor(host = "localhost", port = 9877) {
    this.baseUrl = `http://${host}:${port}`
  }

  async sendCommand(command: string, params?: Record<string, any>): Promise<UE5CommandResponse> {
    try {
      const body = { command, ...(params ?? {}) }
      const response = await fetch(`${this.baseUrl}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      return {
        success: data.success ?? true,
        result: data.result ?? JSON.stringify(data),
        error: data.error,
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message ?? String(err),
      }
    }
  }

  async getStatus(): Promise<{
    connected: boolean
    editorVersion?: string
    projectName?: string
    playInEditor?: boolean
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/status`)
      if (!response.ok) {
        return { connected: false }
      }
      const data = await response.json()
      return {
        connected: true,
        editorVersion: data.editorVersion,
        projectName: data.projectName,
        playInEditor: data.playInEditor,
      }
    } catch (err) {
      console.warn('[ue5-connector] getStatus error:', err)
      return { connected: false }
    }
  }

  onEvent(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, [])
    }
    this.handlers.get(eventType)!.push(handler)

    this.startPolling()

    return () => {
      const list = this.handlers.get(eventType)
      if (list) {
        const idx = list.indexOf(handler)
        if (idx >= 0) list.splice(idx, 1)
      }
    }
  }

  private startPolling() {
    if (this.polling) return
    this.polling = true
    this.abortController = new AbortController()
    this.pollEvents(this.abortController.signal)
  }

  private async pollEvents(signal: AbortSignal) {
    while (!signal.aborted) {
      try {
        const response = await fetch(`${this.baseUrl}/events`, { signal })
        if (response.ok) {
          this.connected = true
          const data = await response.json()
          const events: UE5Event[] = Array.isArray(data) ? data : [data]
          for (const event of events) {
            const typeHandlers = this.handlers.get(event.type) ?? []
            const allHandlers = this.handlers.get("*") ?? []
            for (const handler of [...typeHandlers, ...allHandlers]) {
              handler(event)
            }
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") break
        this.connected = false
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  disconnect() {
    this.abortController?.abort()
    this.abortController = null
    this.polling = false
    this.connected = false
  }
}

let instance: UE5Connector | null = null

export function getUE5Connector(host?: string, port?: number): UE5Connector {
  if (!instance) {
    instance = new UE5Connector(host, port)
  }
  return instance
}
