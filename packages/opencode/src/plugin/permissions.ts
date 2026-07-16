import path from "path"
import { Filesystem } from "@/util"

// ---------------------------------------------------------------------------
// Permission types
// ---------------------------------------------------------------------------

type Permission = string

export type PluginPermissions = {
  required: Permission[]
  optional?: Permission[]
}

// ---------------------------------------------------------------------------
// Permission categories
// ---------------------------------------------------------------------------

export const PermissionCategory = {
  Filesystem: {
    Read: "filesystem:read" as Permission,
    Write: "filesystem:write" as Permission,
    Execute: "filesystem:execute" as Permission,
  },
  Network: {
    Http: "network:http" as Permission,
    Https: "network:https" as Permission,
    WebSocket: "network:websocket" as Permission,
  },
  Shell: {
    Exec: "shell:exec" as Permission,
    Spawn: "shell:spawn" as Permission,
  },
  Process: {
    Env: "process:env" as Permission,
    Args: "process:args" as Permission,
  },
  Session: {
    Read: "session:read" as Permission,
    Write: "session:write" as Permission,
  },
  Tool: {
    Register: "tool:register" as Permission,
    Execute: "tool:execute" as Permission,
  },
  Auth: {
    Read: "auth:read" as Permission,
    Write: "auth:write" as Permission,
  },
} as const

// ---------------------------------------------------------------------------
// Human-readable descriptions
// ---------------------------------------------------------------------------

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  "filesystem:read": "Read files from the filesystem",
  "filesystem:write": "Write files to the filesystem",
  "filesystem:execute": "Execute files or scripts on the filesystem",
  "network:http": "Make HTTP requests",
  "network:https": "Make HTTPS requests",
  "network:websocket": "Open WebSocket connections",
  "shell:exec": "Execute shell commands",
  "shell:spawn": "Spawn child processes",
  "process:env": "Access environment variables",
  "process:args": "Access process arguments",
  "session:read": "Read session data",
  "session:write": "Write session data",
  "tool:register": "Register new tools",
  "tool:execute": "Execute registered tools",
  "auth:read": "Read authentication credentials",
  "auth:write": "Write authentication credentials",
}

/**
 * Return a human-readable description for a permission string.
 * Falls back to the raw permission string if no description is registered.
 */
export function permissionDescription(permission: Permission): string {
  return PERMISSION_DESCRIPTIONS[permission] ?? permission
}

// ---------------------------------------------------------------------------
// parsePermissions — read from plugin's package.json
// ---------------------------------------------------------------------------

/**
 * Read permissions declared in a plugin's package.json under the
 * `"glitchcode"` field:
 *
 * ```json
 * {
 *   "glitchcode": {
 *     "permissions": ["filesystem:read", "network:http"]
 *   }
 * }
 * ```
 *
 * Returns an empty `required` array if no permissions are declared.
 */
export async function parsePermissions(pluginPath: string): Promise<PluginPermissions> {
  const stat = await Filesystem.statAsync(pluginPath)
  const dir = stat?.isDirectory() ? pluginPath : path.dirname(pluginPath)
  const pkgFile = path.join(dir, "package.json")

  try {
    const pkg = await Filesystem.readJson<Record<string, unknown>>(pkgFile)
    const glitchcode = pkg["glitchcode"]
    if (!glitchcode || typeof glitchcode !== "object") {
      return { required: [] }
    }

    const perms = (glitchcode as Record<string, unknown>)["permissions"]
    if (!Array.isArray(perms)) {
      return { required: [] }
    }

    const required: Permission[] = []
    const optional: Permission[] = []

    for (const entry of perms) {
      if (typeof entry === "string" && entry.trim()) {
        if (entry.endsWith("?")) {
          optional.push(entry.slice(0, -1))
        } else {
          required.push(entry)
        }
      }
    }

    return {
      required,
      optional: optional.length > 0 ? optional : undefined,
    }
  } catch {
    return { required: [] }
  }
}

// ---------------------------------------------------------------------------
// checkPermission — compare granted vs required
// ---------------------------------------------------------------------------

/**
 * Check which of the `required` permissions are present in `granted`.
 *
 * Returns `{ allowed, denied }` lists.
 */
export function checkPermission(
  granted: Permission[],
  required: Permission[],
): { allowed: Permission[]; denied: Permission[] } {
  const grantedSet = new Set(granted)
  const allowed: Permission[] = []
  const denied: Permission[] = []

  for (const perm of required) {
    if (grantedSet.has(perm)) {
      allowed.push(perm)
    } else {
      denied.push(perm)
    }
  }

  return { allowed, denied }
}

// ---------------------------------------------------------------------------
// requestPermissions — interactive approval
// ---------------------------------------------------------------------------

/**
 * Present each permission to the user for interactive approval.
 *
 * For each permission the user is shown the raw permission string and its
 * human-readable description, then asked to approve or deny it.
 *
 * Returns the list of permissions the user approved.
 */
export async function requestPermissions(permissions: Permission[]): Promise<Permission[]> {
  const readline = await import("readline")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve))

  const approved: Permission[] = []

  console.log("\nPlugin requests the following permissions:\n")

  for (const perm of permissions) {
    const desc = permissionDescription(perm)
    const answer = await question(`  [y/N] ${perm} — ${desc}\n  Approve? `)
    if (answer.trim().toLowerCase() === "y") {
      approved.push(perm)
    }
  }

  rl.close()

  const denied = permissions.filter((p) => !approved.includes(p))
  if (denied.length > 0) {
    console.log(`\nDenied permissions: ${denied.join(", ")}`)
  }

  return approved
}

// ---------------------------------------------------------------------------
// Permission store — ~/.glitchcode/plugin-permissions.json
// ---------------------------------------------------------------------------

const PERMISSIONS_FILE = "plugin-permissions.json"

function permissionsFilePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || ""
  return path.join(home, ".glitchcode", PERMISSIONS_FILE)
}

type PermissionStore = Record<string, Permission[]>

async function readStore(): Promise<PermissionStore> {
  try {
    return await Filesystem.readJson<PermissionStore>(permissionsFilePath())
  } catch {
    return {}
  }
}

async function writeStore(store: PermissionStore): Promise<void> {
  await Filesystem.writeJson(permissionsFilePath(), store)
}

/**
 * Persist the list of granted permissions for a plugin.
 */
export async function savePluginPermissions(
  pluginId: string,
  permissions: Permission[],
): Promise<void> {
  const store = await readStore()
  store[pluginId] = permissions
  await writeStore(store)
}

/**
 * Load the list of previously granted permissions for a plugin.
 * Returns an empty array if no entry exists.
 */
export async function loadPluginPermissions(pluginId: string): Promise<Permission[]> {
  const store = await readStore()
  return store[pluginId] ?? []
}
