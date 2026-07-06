import * as vscode from "vscode"

export function getServerPassword(): string | undefined {
  return process.env.GLITCHCODE_SERVER_PASSWORD
}

export function encodeAuth(password: string): string {
  return `Basic ${Buffer.from(`glitchcode:${password}`).toString("base64")}`
}

export async function promptForPassword(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: "Glitch Code server password",
    password: true,
    placeHolder: "Enter server password",
  })
}
