import * as vscode from "vscode"
import { GlitchClient } from "./sdk"

export class GlitchTerminal {
  private ws: WebSocket | null = null
  private onDataCallback?: (data: string) => void

  constructor(private client: GlitchClient) {}

  async connect(ptyId: string, ticket: string): Promise<void> {
    const baseUrl = (this.client as any).baseUrl
    const wsUrl = baseUrl.replace("http", "ws")

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${wsUrl}/pty/${ptyId}/connect?ticket=${ticket}`)

      this.ws.onopen = () => {
        resolve()
      }

      this.ws.onmessage = (event) => {
        if (this.onDataCallback) {
          this.onDataCallback(event.data)
        }
      }

      this.ws.onerror = (error) => {
        reject(error)
      }

      this.ws.onclose = () => {
        this.ws = null
      }
    })
  }

  write(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
  }

  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback
  }

  resize(cols: number, rows: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "resize", cols, rows }))
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export function createTerminal(client: GlitchClient): vscode.Terminal {
  const writeEmitter = new vscode.EventEmitter<string>()
  let pty: GlitchTerminal | null = null

  const pseudoterminal: vscode.Pseudoterminal = {
    onDidWrite: writeEmitter.event,

    open: async () => {
      // Create PTY session
      try {
        const response = await fetch(`${(client as any).baseUrl}/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        const data = await response.json()
        const { ptyId, ticket } = data

        // Connect via WebSocket
        pty = new GlitchTerminal(client)
        await pty.connect(ptyId, ticket)

        pty.onData((data) => {
          writeEmitter.fire(data)
        })

        writeEmitter.fire("Connected to Glitch terminal\r\n")
      } catch (error) {
        writeEmitter.fire(`Error: ${error}\r\n`)
      }
    },

    close: () => {
      pty?.disconnect()
    },

    handleInput: (data: string) => {
      pty?.write(data)
    },

    setDimensions: (dimensions: vscode.TerminalDimensions) => {
      pty?.resize(dimensions.columns, dimensions.rows)
    },
  }

  return vscode.window.createTerminal({
    name: "Glitch Terminal",
    pty: pseudoterminal,
  })
}
