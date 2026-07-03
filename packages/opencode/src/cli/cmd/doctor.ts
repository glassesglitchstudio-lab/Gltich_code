import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"

interface HealthCheck {
  name: string
  status: "ok" | "warn" | "error"
  message: string
  details?: string
}

export const DoctorCommand = cmd({
  command: "doctor",
  describe: "System health check and diagnostics",
  builder: (yargs: Argv) => {
    return yargs
      .option("verbose", {
        alias: "v",
        describe: "Show detailed output",
        type: "boolean",
        default: false,
      })
      .option("fix", {
        describe: "Attempt automatic fixes",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("Running health checks...")

      const checks: HealthCheck[] = []

      checks.push(checkRuntime())
      checks.push(checkGit())
      checks.push(await checkFileWatcher())
      checks.push(await checkDatabase())
      checks.push(checkDiskSpace())
      checks.push(checkPermissions())

      s.stop("Health checks complete")

      displayResults(checks, args.verbose)

      if (args.fix) {
        await attemptFixes(checks)
      }
    })
  },
})

function checkRuntime(): HealthCheck {
  try {
    const bunVersion = execSync("bun --version", { encoding: "utf-8", timeout: 5000 }).trim()
    return {
      name: "Runtime (Bun)",
      status: "ok",
      message: `Bun ${bunVersion}`,
    }
  } catch {
    try {
      const nodeVersion = process.version
      return {
        name: "Runtime (Node)",
        status: "warn",
        message: `Node ${nodeVersion} (Bun recommended for optimal performance)`,
      }
    } catch {
      return {
        name: "Runtime",
        status: "error",
        message: "No compatible runtime found",
        details: "Install Bun: curl -fsSL https://bun.sh/install | bash",
      }
    }
  }
}

function checkGit(): HealthCheck {
  try {
    const version = execSync("git --version", { encoding: "utf-8", timeout: 5000 }).trim()
    return {
      name: "Git",
      status: "ok",
      message: version,
    }
  } catch {
    return {
      name: "Git",
      status: "warn",
      message: "Git not found (optional but recommended)",
      details: "Install git for version control features",
    }
  }
}

async function checkFileWatcher(): Promise<HealthCheck> {
  try {
    const { getWatcherStatus } = await import("../../file/watcher")
    const status = getWatcherStatus()

    if (status.backend === "noop") {
      return {
        name: "File Watcher",
        status: "warn",
        message: "Noop watcher (file changes won't be detected)",
        details: "This is expected in CI environments",
      }
    }

    return {
      name: "File Watcher",
      status: "ok",
      message: `Backend: ${status.backend}`,
      details: status.directories.length > 0 ? `Watching ${status.directories.length} directories` : undefined,
    }
  } catch {
    return {
      name: "File Watcher",
      status: "warn",
      message: "Could not check file watcher status",
    }
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    const { Global } = await import("../../global")
    const dbPath = path.join(Global.Path.data, "glitchcode.db")
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath)
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1)
      return {
        name: "Database",
        status: "ok",
        message: `SQLite database (${sizeMB} MB)`,
      }
    }
    return {
      name: "Database",
      status: "warn",
      message: "Database not found (will be created on first run)",
    }
  } catch {
    return {
      name: "Database",
      status: "warn",
      message: "Could not check database",
    }
  }
}

function checkDiskSpace(): HealthCheck {
  try {
    const stats = fs.statfsSync(process.cwd())
    const freeGB = ((stats.bavail * stats.bsize) / (1024 * 1024 * 1024)).toFixed(1)
    const totalGB = ((stats.blocks * stats.bsize) / (1024 * 1024 * 1024)).toFixed(1)
    const usedPercent = Math.round(((stats.blocks - stats.bavail) / stats.blocks) * 100)

    if (usedPercent > 90) {
      return {
        name: "Disk Space",
        status: "error",
        message: `${freeGB} GB free of ${totalGB} GB (${usedPercent}% used)`,
        details: "Low disk space may cause issues",
      }
    }

    return {
      name: "Disk Space",
      status: "ok",
      message: `${freeGB} GB free of ${totalGB} GB`,
    }
  } catch {
    return {
      name: "Disk Space",
      status: "warn",
      message: "Could not check disk space",
    }
  }
}

function checkPermissions(): HealthCheck {
  const testDir = path.join(process.cwd(), ".glitchcode-test")
  try {
    fs.mkdirSync(testDir, { recursive: true })
    fs.writeFileSync(path.join(testDir, "test.txt"), "test")
    fs.unlinkSync(path.join(testDir, "test.txt"))
    fs.rmdirSync(testDir)
    return {
      name: "Permissions",
      status: "ok",
      message: "Read/write access OK",
    }
  } catch {
    return {
      name: "Permissions",
      status: "error",
      message: "No write access to current directory",
      details: "Check file permissions",
    }
  }
}

function displayResults(checks: HealthCheck[], verbose: boolean) {
  const width = 60
  const okCount = checks.filter((c) => c.status === "ok").length
  const warnCount = checks.filter((c) => c.status === "warn").length
  const errorCount = checks.filter((c) => c.status === "error").length

  console.log("\n" + "═".repeat(width))
  console.log("  GLITCH DOCTOR — SYSTEM HEALTH")
  console.log("═".repeat(width))

  for (const check of checks) {
    const icon = check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗"
    const color = check.status === "ok" ? "\x1b[32m" : check.status === "warn" ? "\x1b[33m" : "\x1b[31m"
    const reset = "\x1b[0m"

    console.log(`\n  ${color}${icon}${reset} ${check.name}`)
    console.log(`    ${check.message}`)
    if (verbose && check.details) {
      console.log(`    \x1b[2m${check.details}\x1b[0m`)
    }
  }

  console.log("\n" + "─".repeat(width))
  console.log(`  Summary: ${okCount} passed, ${warnCount} warnings, ${errorCount} errors`)

  if (errorCount > 0) {
    console.log("\n  \x1b[31mSome checks failed. Run with --verbose for details.\x1b[0m")
  } else if (warnCount > 0) {
    console.log("\n  \x1b[33mAll critical checks passed with warnings.\x1b[0m")
  } else {
    console.log("\n  \x1b[32mAll checks passed!\x1b[0m")
  }
  console.log("═".repeat(width) + "\n")
}

async function attemptFixes(checks: HealthCheck[]) {
  const failures = checks.filter((c) => c.status === "error")
  if (failures.length === 0) {
    console.log("No issues to fix.")
    return
  }

  console.log("\nAttempting automatic fixes...\n")

  for (const check of failures) {
    if (check.name === "Permissions") {
      console.log(`  → ${check.name}: Cannot auto-fix. Please check directory permissions manually.`)
    } else if (check.name === "Disk Space") {
      console.log(`  → ${check.name}: Cannot auto-fix. Please free up disk space.`)
    } else {
      console.log(`  → ${check.name}: No automatic fix available.`)
    }
  }
}
