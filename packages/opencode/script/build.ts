#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

await import("./generate.ts")

import { Script } from "@glitchcode/script"
import pkg from "../package.json"

const BINARY_PREFIX = "glitchcode"

// Load migrations from migration directories
const migrationDirs = (
  await fs.promises.readdir(path.join(dir, "migration"), {
    withFileTypes: true,
  })
)
  .filter((entry) => entry.isDirectory() && /^\d{4}\d{2}\d{2}\d{2}\d{2}\d{2}/.test(entry.name))
  .map((entry) => entry.name)
  .sort()

const migrations = await Promise.all(
  migrationDirs.map(async (name) => {
    const file = path.join(dir, "migration", name, "migration.sql")
    const sql = await Bun.file(file).text()
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(name)
    const timestamp = match
      ? Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6]),
        )
      : 0
    return { sql, timestamp, name }
  }),
)
console.log(`Loaded ${migrations.length} migrations`)

const singleFlag = process.argv.includes("--single")
const baselineFlag = process.argv.includes("--baseline")
let skipInstall = process.argv.includes("--skip-install")

// Windows'da native binding'ler (node-gyp/tree-sitter) compile edilemez
// Otomatik olarak --skip-install aktif et
if (process.platform === "win32" && !skipInstall) {
  console.log("Windows detected: auto-enabling --skip-install (native bindings unavailable)")
  skipInstall = true
}
const targetFlag = process.argv.find((arg, i) => process.argv[i - 1] === "--target")
const plugin = createSolidTransformPlugin()
// const skipEmbedWebUi = process.argv.includes("--skip-embed-web-ui")
// Web UI temporarily disabled
const skipEmbedWebUi = true

const createEmbeddedWebUIBundle = async () => {
  console.log(`Building Web UI to embed in the binary`)
  const appDir = path.join(import.meta.dirname, "../../app")
  const dist = path.join(appDir, "dist")
  await $`bun run --cwd ${appDir} build`
  const files = (await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dist })))
    .map((file) => file.replaceAll("\\", "/"))
    .sort()
  const imports = files.map((file, i) => {
    const spec = path.relative(dir, path.join(dist, file)).replaceAll("\\", "/")
    return `import file_${i} from ${JSON.stringify(spec.startsWith(".") ? spec : `./${spec}`)} with { type: "file" };`
  })
  const entries = files.map((file, i) => `  ${JSON.stringify(file)}: file_${i},`)
  return [
    `// Import all files as file_$i with type: "file"`,
    ...imports,
    `// Export with original mappings`,
    `export default {`,
    ...entries,
    `}`,
  ].join("\n")
}

const embeddedFileMap = skipEmbedWebUi ? null : await createEmbeddedWebUIBundle()

const allTargets: {
  os: string
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}[] = [
  {
    os: "linux",
    arch: "arm64",
  },
  {
    os: "linux",
    arch: "x64",
  },
  {
    os: "linux",
    arch: "x64",
    avx2: false,
  },
  {
    os: "linux",
    arch: "arm64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
    avx2: false,
  },
  {
    os: "darwin",
    arch: "arm64",
  },
  {
    os: "darwin",
    arch: "x64",
  },
  {
    os: "darwin",
    arch: "x64",
    avx2: false,
  },
  {
    os: "win32",
    arch: "arm64",
  },
  {
    os: "win32",
    arch: "x64",
  },
  {
    os: "win32",
    arch: "x64",
    avx2: false,
  },
]

const targets = targetFlag
  ? allTargets.filter((item) => {
      const name = [
        BINARY_PREFIX,
        item.os === "win32" ? "windows" : item.os,
        item.arch,
        item.avx2 === false ? "baseline" : undefined,
        item.abi === undefined ? undefined : item.abi,
      ]
        .filter(Boolean)
        .join("-")
      return name === targetFlag
    })
  : singleFlag
    ? allTargets.filter((item) => {
        if (item.os !== process.platform || item.arch !== process.arch) {
          return false
        }

        // When building for the current platform, prefer a single native binary by default.
        // Baseline binaries require additional Bun artifacts and can be flaky to download.
        if (item.avx2 === false) {
          return baselineFlag
        }

        // also skip abi-specific builds for the same reason
        if (item.abi !== undefined) {
          return false
        }

        return true
      })
    : allTargets

fs.rmSync("dist", { recursive: true, force: true })

const extDir = path.join(dir, "src", "ext")
if (!fs.existsSync(extDir)) {
  const overlaySrc = path.resolve(dir, "../../mimoapi/packages/opencode/src/ext")
  if (fs.existsSync(overlaySrc)) {
    console.log(`Staging overlay entrypoints from ${overlaySrc}`)
    fs.cpSync(overlaySrc, extDir, { recursive: true })
    process.on("exit", () => {
      try {
        fs.rmSync(extDir, { recursive: true, force: true })
      } catch {}
    })
  }
}
const extEntrypoints = fs.existsSync(extDir)
  ? fs.readdirSync(extDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
      .map((f) => `./src/ext/${f}`)
  : []
if (extEntrypoints.length) {
  console.log(`Including overlay entrypoints: ${extEntrypoints.join(", ")}`)
}

const binaries: Record<string, string> = {}
if (!skipInstall) {
  const deps = pkg.dependencies as Record<string, string>
  const optDeps = (pkg as any).optionalDependencies as Record<string, string> | undefined
  await $`bun install --os="*" --cpu="*" @opentui/core@${deps["@opentui/core"]}`
  const parcelVersion = deps["@parcel/watcher"] ?? optDeps?.["@parcel/watcher"]
  if (parcelVersion) {
    await $`bun install --os="*" --cpu="*" @parcel/watcher@${parcelVersion}`
  }
}
for (const item of targets) {
  const name = [
    BINARY_PREFIX,
    // changing to win32 flags npm for some reason
    item.os === "win32" ? "windows" : item.os,
    item.arch,
    item.avx2 === false ? "baseline" : undefined,
    item.abi === undefined ? undefined : item.abi,
  ]
    .filter(Boolean)
    .join("-")
  console.log(`building ${name}`)
  fs.mkdirSync(path.join(dir, "dist", name, "bin"), { recursive: true })

  const localPath = path.resolve(dir, "node_modules/@opentui/core/parser.worker.js")
  const rootPath = path.resolve(dir, "../../node_modules/@opentui/core/parser.worker.js")
  const parserWorkerExists = fs.existsSync(localPath) || fs.existsSync(rootPath)
  if (!parserWorkerExists && skipInstall) {
    console.log(`  Warning: parser.worker.js not found (--skip-install mode). Build will include worker placeholder.`)
  }
  const parserWorker = parserWorkerExists
    ? fs.realpathSync(fs.existsSync(localPath) ? localPath : rootPath)
    : null
  const workerPath = "./src/cli/cmd/tui/worker.ts"

  // Use platform-specific bunfs root path based on target OS
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = parserWorker ? path.relative(dir, parserWorker).replaceAll("\\", "/") : ""

  await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [plugin],
    external: ["node-gyp"],
    format: "esm",
    minify: true,
    splitting: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: name.replace(BINARY_PREFIX, "bun") as any,
      outfile: `dist/${name}/bin/glitch`,
      execArgv: [`--user-agent=glitchcode/${Script.version}`, "--use-system-ca", "--"],
      windows: {},
    },
    files: embeddedFileMap ? { "opencode-web-ui.gen.ts": embeddedFileMap } : {},
    entrypoints: ["./src/index.ts", ...(parserWorker ? [parserWorker] : []), workerPath, ...(embeddedFileMap ? ["opencode-web-ui.gen.ts"] : []), ...extEntrypoints],
    define: {
      GLITCH_VERSION: `'${Script.version}'`,
      OPENCODE_MIGRATIONS: JSON.stringify(migrations),
      OTUI_TREE_SITTER_WORKER_PATH: workerRelativePath ? bunfsRoot + workerRelativePath : "",
      OPENCODE_WORKER_PATH: workerPath,
      GLITCH_CHANNEL: `'${Script.channel}'`,
      OPENCODE_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "",
    },
  })

  // Smoke test: only run if binary is for current platform
  if (item.os === process.platform && item.arch === process.arch && !item.abi) {
    const binaryName = process.platform === "win32" ? "glitch.exe" : "glitch"
    const binaryPath = `dist/${name}/bin/${binaryName}`
    console.log(`Running smoke test: ${binaryPath} --version`)
    try {
      const versionOutput = await $`${binaryPath} --version`.text()
      console.log(`Smoke test passed: ${versionOutput.trim()}`)
    } catch (e) {
      console.error(`Smoke test failed for ${name}:`, e)
      process.exit(1)
    }
  }

  fs.rmSync(path.join(dir, "dist", name, "bin", "tui"), { recursive: true, force: true })
  await Bun.file(`dist/${name}/README.md`).write(
    `This is the ${item.os}-${item.arch} binary for [glitchcode-cli](https://www.npmjs.com/package/glitchcode-cli). Install that package directly.\n`,
  )
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name: `@glitchcode/${name}`,
        version: Script.version,
        description: "Platform-specific binary for glitchcode-cli.",
        license: "MIT",
        author: "GlassesCat AI",
        homepage: "https://github.com/glassesglitchstudio-lab/Gltich_code",
        repository: {
          type: "git",
          url: "git+https://github.com/glassesglitchstudio-lab/Gltich_code.git",
        },
        keywords: ["ai", "coding", "agent", "cli", "glitch", "glitchcode"],
        os: [item.os],
        cpu: [item.arch],
      },
      null,
      2,
    ),
  )
  binaries[name] = Script.version
}

if (Script.release) {
  for (const key of Object.keys(binaries)) {
    if (key.includes("linux")) {
      await $`tar -czf ../../${key}.tar.gz *`.cwd(`dist/${key}/bin`)
    } else {
      await $`zip -r ../../${key}.zip *`.cwd(`dist/${key}/bin`)
    }
  }
  await $`gh release upload v${Script.version} ./dist/*.zip ./dist/*.tar.gz --clobber --repo ${process.env.GH_REPO}`
}

export { binaries }
