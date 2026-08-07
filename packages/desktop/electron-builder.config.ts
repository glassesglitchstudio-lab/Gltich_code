import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.GLITCHCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const getBase = (): Configuration => ({
  artifactName: "glitchcode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: ["out/**/*", "resources/**/*"],
  extraResources: [
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
  },
  protocols: {
    name: "Glitch Code",
    schemes: ["glitchcode"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const base = getBase()

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId: "studio.glitchcode.desktop.dev",
        productName: "Glitch Code Dev",
        rpm: { packageName: "glitchcode-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId: "studio.glitchcode.desktop.beta",
        productName: "Glitch Code Beta",
        protocols: { name: "Glitch Code Beta", schemes: ["glitchcode"] },
        publish: { provider: "github", owner: "glassesglitchstudio-lab", repo: "Glitch-Code-beta", channel: "latest" },
        rpm: { packageName: "glitchcode-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId: "studio.glitchcode.desktop",
        productName: "Glitch Code",
        protocols: { name: "Glitch Code", schemes: ["glitchcode"] },
        publish: { provider: "github", owner: "glassesglitchstudio-lab", repo: "Glitch-Code", channel: "latest" },
        rpm: { packageName: "glitchcode" },
      }
    }
  }
}

export default getConfig()
