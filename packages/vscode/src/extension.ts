import * as vscode from "vscode"
import { ServerManager } from "./manager"
import { GlitchClient } from "./sdk"
import { getServerPassword } from "./auth"
import { ChatProvider } from "./chat/provider"
import { registerCommands } from "./commands"
import { StatusBarManager } from "./status"

let serverManager: ServerManager
let client: GlitchClient
let chatProvider: ChatProvider
let statusBar: StatusBarManager

export async function activate(context: vscode.ExtensionContext) {
  console.log("Glitch Code extension activating...")

  // Create output channel
  const outputChannel = vscode.window.createOutputChannel("Glitch Code")
  context.subscriptions.push(outputChannel)

  // Create server manager
  serverManager = new ServerManager(outputChannel)

  // Create client
  const password = getServerPassword()
  client = new GlitchClient("http://127.0.0.1:4096", password)

  // Auto-start server
  const config = vscode.workspace.getConfiguration("glitch")
  if (config.get<boolean>("autoStart", true)) {
    try {
      outputChannel.appendLine("Starting Glitch server...")
      await serverManager.start()
      client = new GlitchClient(serverManager.getBaseUrl(), password)
      outputChannel.appendLine(`Server started on ${serverManager.getBaseUrl()}`)
    } catch (error) {
      outputChannel.appendLine(`Failed to start server: ${error}`)
      vscode.window.showErrorMessage(`Glitch server failed to start: ${error}`)
    }
  }

  // Create status bar
  statusBar = new StatusBarManager()
  statusBar.updateStatus(serverManager.isRunning())
  context.subscriptions.push(statusBar)

  // Create chat provider
  chatProvider = new ChatProvider(context.extensionUri, client)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatProvider.viewType, chatProvider),
  )

  // Register commands
  registerCommands(context, client)

  // Update status periodically
  const statusInterval = setInterval(async () => {
    const running = await client.health()
    statusBar.updateStatus(running)
  }, 30000)

  context.subscriptions.push({
    dispose: () => clearInterval(statusInterval),
  })

  console.log("Glitch Code extension activated")
}

export function deactivate() {
  console.log("Glitch Code extension deactivating...")

  // Stop server
  serverManager?.stop()

  // Dispose resources
  statusBar?.dispose()

  console.log("Glitch Code extension deactivated")
}
