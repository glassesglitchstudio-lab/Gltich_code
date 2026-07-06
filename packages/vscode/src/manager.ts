import * as vscode from "vscode"
import { spawn, ChildProcess } from "child_process"
import * as path from "path"

export class ServerManager {
  private process: ChildProcess | null = null
  private port: number = 0
  private baseUrl: string = ""
  private ready: boolean = false
  private outputChannel: vscode.OutputChannel

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel
  }

  async start(): Promise<void> {
    if (this.process) {
      this.outputChannel.appendLine("[Server] Already running")
      return
    }

    this.outputChannel.appendLine("[Server] Starting glitch serve...")

    // Find glitch binary
    const glitchPath = await this.findGlitchBinary()
    if (!glitchPath) {
      throw new Error("Glitch binary not found. Install with: npm install -g glitchcode-cli")
    }

    // Start server
    this.process = spawn(glitchPath, ["serve", "--port", "0", "--hostname", "127.0.0.1"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    })

    // Parse stdout for port
    this.process.stdout?.on("data", (data: Buffer) => {
      const output = data.toString()
      this.outputChannel.appendLine(`[Server] ${output}`)

      // Parse port from output
      const portMatch = output.match(/(?:listening on|port[:\s]+)(\d+)/i)
      if (portMatch) {
        this.port = parseInt(portMatch[1], 10)
        this.baseUrl = `http://127.0.0.1:${this.port}`
        this.outputChannel.appendLine(`[Server] Port: ${this.port}`)
      }
    })

    this.process.stderr?.on("data", (data: Buffer) => {
      this.outputChannel.appendLine(`[Server STDERR] ${data.toString()}`)
    })

    this.process.on("exit", (code) => {
      this.outputChannel.appendLine(`[Server] Exited with code ${code}`)
      this.process = null
      this.ready = false
    })

    this.process.on("error", (err) => {
      this.outputChannel.appendLine(`[Server] Error: ${err.message}`)
      this.process = null
      this.ready = false
    })

    // Wait for server to be ready
    await this.waitForReady()
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.outputChannel.appendLine("[Server] Stopping...")
      this.process.kill("SIGTERM")
      this.process = null
      this.ready = false
    }
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  isRunning(): boolean {
    return this.process !== null && this.ready
  }

  getPort(): number {
    return this.port
  }

  async waitForReady(timeout: number = 10000): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`${this.baseUrl}/global/health`)
        if (response.ok) {
          this.ready = true
          this.outputChannel.appendLine("[Server] Ready!")
          return
        }
      } catch {
        // Not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error(`Server not ready after ${timeout}ms`)
  }

  private async findGlitchBinary(): Promise<string | null> {
    // Try common locations
    const locations = [
      "glitch", // In PATH
      path.join(process.env.APPDATA || "", "npm", "glitch.cmd"), // Windows npm global
      path.join(process.env.HOME || "", ".local", "bin", "glitch"), // Unix
    ]

    for (const loc of locations) {
      try {
        const { execSync } = require("child_process")
        execSync(`${loc} --version`, { stdio: "pipe" })
        return loc
      } catch {
        // Not found
      }
    }

    return null
  }
}
