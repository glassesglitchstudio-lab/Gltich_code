import * as vscode from "vscode"

export class StatusBarManager {
  private statusItem: vscode.StatusBarItem
  private modelItem: vscode.StatusBarItem
  private sessionItem: vscode.StatusBarItem

  constructor() {
    this.statusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    )
    this.statusItem.command = "glitch.status"

    this.modelItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99,
    )
    this.modelItem.command = "glitch.model.select"

    this.sessionItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98,
    )
    this.sessionItem.command = "glitch.session.list"
  }

  updateStatus(running: boolean): void {
    if (running) {
      this.statusItem.text = "$(check) Glitch"
      this.statusItem.tooltip = "Glitch Code: Connected"
      this.statusItem.color = new vscode.ThemeColor("statusBarItem.warningForeground")
    } else {
      this.statusItem.text = "$(circle-slash) Glitch"
      this.statusItem.tooltip = "Glitch Code: Disconnected"
      this.statusItem.color = new vscode.ThemeColor("statusBarItem.errorForeground")
    }
    this.statusItem.show()
  }

  updateModel(model: string): void {
    // Shorten model name
    const parts = model.split("/")
    const shortName = parts.length > 1 ? parts[1] : model
    this.modelItem.text = `$(zap) ${shortName}`
    this.modelItem.tooltip = `Model: ${model}`
    this.modelItem.show()
  }

  updateSession(sessionId: string): void {
    const shortId = sessionId.slice(0, 8)
    this.sessionItem.text = `$(comment) #${shortId}`
    this.sessionItem.tooltip = `Session: ${sessionId}`
    this.sessionItem.show()
  }

  hideAll(): void {
    this.statusItem.hide()
    this.modelItem.hide()
    this.sessionItem.hide()
  }

  showAll(): void {
    this.statusItem.show()
    this.modelItem.show()
    this.sessionItem.show()
  }

  dispose(): void {
    this.statusItem.dispose()
    this.modelItem.dispose()
    this.sessionItem.dispose()
  }
}
