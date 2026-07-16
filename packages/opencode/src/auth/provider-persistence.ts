/**
 * Provider Connection Persistence
 *
 * Saves the last successfully connected provider and model to disk.
 * On startup, auto-reconnects if credentials are still valid.
 * Prevents the login dialog from appearing when user already has valid credentials.
 */
import path from "path"
import fs from "fs"
import { Global } from "../global"

export interface ProviderState {
  providerID: string
  modelID: string
  timestamp: number
}

const stateDir = Global.Path.state
const file = path.join(stateDir, "last-provider.json")

function ensureDir() {
  try {
    fs.mkdirSync(stateDir, { recursive: true })
  } catch (err) { console.warn('[provider-persistence] ensureDir error:', err) }
}

export function getLastProvider(): ProviderState | undefined {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"))
    if (data && typeof data === "object" && "providerID" in data && "modelID" in data) {
      return data as ProviderState
    }
    return undefined
  } catch (err) { console.warn('[provider-persistence] getLastProvider error:', err); return undefined }
}

export function saveLastProvider(providerID: string, modelID: string): void {
  try {
    ensureDir()
    const state: ProviderState = {
      providerID,
      modelID,
      timestamp: Date.now(),
    }
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 })
  } catch (err) { console.warn('[provider-persistence] saveLastProvider error:', err) }
}

export function clearLastProvider(): void {
  try {
    ensureDir()
    fs.writeFileSync(file, "{}", { mode: 0o600 })
  } catch (err) { console.warn('[provider-persistence] clearLastProvider error:', err) }
}
