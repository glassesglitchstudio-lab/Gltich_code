import * as vscode from "vscode"
import { GlitchClient } from "./sdk"
import { showDiff } from "./diff"

export function registerCommands(
  context: vscode.ExtensionContext,
  client: GlitchClient,
): void {
  // Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand("glitch.chat", async () => {
      await vscode.commands.executeCommand("glitch.chat.focus")
    }),
  )

  // Chat with selection
  context.subscriptions.push(
    vscode.commands.registerCommand("glitch.chat.selection", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showWarningMessage("No active editor")
        return
      }

      const selection = editor.document.getText(editor.selection)
      if (!selection) {
        vscode.window.showWarningMessage("No selection")
        return
      }

      // Open chat and send selection
      await vscode.commands.executeCommand("glitch.chat.focus")

      // Create session
      const session = await client.createSession()

      // Send message with selection
      const prompt = `Seçili kodu analiz et ve açıkla:\n\n\`\`\`\n${selection}\n\`\`\``
      for await (const chunk of client.sendMessage(session.id, prompt)) {
        // Streaming output will be handled by chat provider
      }
    }),
  )

  // Fix command
  context.subscriptions.push(
    vscode.commands.registerCommand("glitch.fix", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showWarningMessage("No active editor")
        return
      }

      const selection = editor.document.getText(editor.selection)
      const fileUri = editor.document.uri.fsPath

      if (!selection) {
        vscode.window.showWarningMessage("No selection to fix")
        return
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Glitch Fix",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Creating session..." })
          const session = await client.createSession()

          progress.report({ message: "Analyzing code..." })
          const prompt = `Bu dosyadaki hatayı düzelt: ${fileUri}\n\nKod:\n\`\`\`\n${selection}\n\`\`\`\n\nDüzeltilmiş kodu ver. Sadece düzeltilmiş kodu göster, açıklama yapma.`
          let response = ""
          for await (const chunk of client.sendMessage(session.id, prompt)) {
            response += chunk
          }

          // Extract code from response
          const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/)
          const fixedCode = codeMatch ? codeMatch[1].trim() : response

          // Apply fix
          await editor.edit((editBuilder) => {
            editBuilder.replace(editor.selection, fixedCode)
          })

          // Show diff
          await showDiff(client, session.id)

          vscode.window.showInformationMessage("Code fixed!")
        },
      )
    }),
  )

  // Solve command
  context.subscriptions.push(
    vscode.commands.registerCommand("glitch.solve", async () => {
      const task = await vscode.window.showInputBox({
        prompt: "Görevi tanımlayın",
        placeHolder: "Örn: Bu projede auth sistemi ekle",
      })

      if (!task) return

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Glitch Solve",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Creating session..." })
          const session = await client.createSession()

          progress.report({ message: "Planning solution..." })
          const prompt = `solve: ${task}`
          for await (const chunk of client.sendMessage(session.id, prompt)) {
            // Streaming output
          }

          vscode.window.showInformationMessage("Task completed!")
        },
      )
    }),
  )

  // Session commands
  context.subscriptions.push(
    vscode.commands.registerCommand("glitch.session.new", async () => {
      const session = await client.createSession()
      vscode.window.showInformationMessage(`New session: ${session.id}`)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("glitch.session.list", async () => {
      const sessions = await client.listSessions()
      const items = sessions.map((s) => ({
        label: s.title || s.id,
        description: s.time.created,
        sessionId: s.id,
      }))

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a session",
      })

      if (selected) {
        vscode.window.showInformationMessage(`Selected session: ${selected.sessionId}`)
      }
    }),
  )

  // Model selection
  context.subscriptions.push(
    vscode.commands.registerCommand("glitch.model.select", async () => {
      const models = await client.listModels()
      const items = models.map((m) => ({
        label: m.name,
        description: m.provider,
        modelId: m.id,
      }))

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a model",
      })

      if (selected) {
        await client.updateConfig({ model: selected.modelId })
        vscode.window.showInformationMessage(`Model changed to: ${selected.modelId}`)
      }
    }),
  )

  // Status command
  context.subscriptions.push(
    vscode.commands.registerCommand("glitch.status", async () => {
      const healthy = await client.health()
      vscode.window.showInformationMessage(
        `Glitch Code: ${healthy ? "Connected" : "Disconnected"}`,
      )
    }),
  )
}
