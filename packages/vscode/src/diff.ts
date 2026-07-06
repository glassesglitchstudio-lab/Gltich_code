import * as vscode from "vscode"
import { GlitchClient } from "./sdk"

export async function showDiff(client: GlitchClient, sessionId: string): Promise<void> {
  try {
    const diffs = await client.getDiff(sessionId)

    if (diffs.length === 0) {
      vscode.window.showInformationMessage("No changes detected")
      return
    }

    for (const diff of diffs) {
      const leftUri = vscode.Uri.file(diff.originalPath)
      const rightUri = vscode.Uri.file(diff.modifiedPath)

      await vscode.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `${diff.originalPath} → ${diff.modifiedPath}`,
      )
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to show diff: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

export async function showDiffWithContent(
  originalPath: string,
  originalContent: string,
  modifiedContent: string,
  title?: string,
): Promise<void> {
  const leftUri = vscode.Uri.parse(`untitled:${originalPath} (original)`)
  const rightUri = vscode.Uri.parse(`untitled:${originalPath} (modified)`)

  // Create temporary documents
  const leftDoc = await vscode.workspace.openTextDocument({
    content: originalContent,
    language: "plaintext",
  })
  const rightDoc = await vscode.workspace.openTextDocument({
    content: modifiedContent,
    language: "plaintext",
  })

  await vscode.commands.executeCommand(
    "vscode.diff",
    leftDoc.uri,
    rightDoc.uri,
    title || `${originalPath} changes`,
  )
}
