#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function detectPlatformAndArch() {
  // Map platform names
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin"
      break
    case "linux":
      platform = "linux"
      break
    case "win32":
      platform = "windows"
      break
    default:
      platform = os.platform()
      break
  }

  // Map architecture names
  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64"
      break
    case "arm64":
      arch = "arm64"
      break
    case "arm":
      arch = "arm"
      break
    default:
      arch = os.arch()
      break
  }

  return { platform, arch }
}

function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const packageName = `@glitchcode/glitchcode-${platform}-${arch}`
  const binaryName = platform === "windows" ? "glitch.exe" : "glitch"

  try {
    // Use require.resolve to find the package
    const packageJsonPath = require.resolve(`${packageName}/package.json`)
    const packageDir = path.dirname(packageJsonPath)
    const binaryPath = path.join(packageDir, "bin", binaryName)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found at ${binaryPath}`)
    }

    return { binaryPath, binaryName }
  } catch (error) {
    throw new Error(`Could not find package ${packageName}: ${error.message}`, { cause: error })
  }
}

function ensureProjectConfig() {
  const cwd = process.cwd()
  const glitchDir = path.join(cwd, ".glitchcode")
  const mimoDir = path.join(cwd, ".mimocode")

  if (!fs.existsSync(glitchDir)) {
    fs.mkdirSync(path.join(glitchDir, "command"), { recursive: true })
    fs.mkdirSync(path.join(glitchDir, "skills"), { recursive: true })
    fs.writeFileSync(path.join(glitchDir, "command", "README.md"), "# Glitch Code - Commands\n")
    fs.writeFileSync(path.join(glitchDir, "skills", "README.md"), "# Glitch Code - Skills\n")
    console.log("Created .glitchcode/ config directory")
  }

  if (!fs.existsSync(mimoDir)) {
    fs.mkdirSync(path.join(mimoDir, "command"), { recursive: true })
    fs.mkdirSync(path.join(mimoDir, "skills"), { recursive: true })
    fs.writeFileSync(path.join(mimoDir, "command", "README.md"), "# MiMo Code - Commands\n")
    fs.writeFileSync(path.join(mimoDir, "skills", "README.md"), "# MiMo Code - Skills\n")
    console.log("Created .mimocode/ config directory")
  }
}

async function main() {
  try {
    ensureProjectConfig()

    if (os.platform() === "win32") {
      console.log("Windows detected: binary setup not needed (using packaged .exe)")
      return
    }

    const { binaryPath } = findBinary()
    const target = path.join(__dirname, "bin", ".mimocode")
    if (fs.existsSync(target)) fs.unlinkSync(target)
    try {
      fs.linkSync(binaryPath, target)
    } catch {
      fs.copyFileSync(binaryPath, target)
    }
    fs.chmodSync(target, 0o755)
  } catch (error) {
    console.error("Failed to setup mimocode binary:", error.message)
    process.exit(1)
  }
}

try {
  void main()
} catch (error) {
  console.error("Postinstall script error:", error.message)
  process.exit(0)
}
