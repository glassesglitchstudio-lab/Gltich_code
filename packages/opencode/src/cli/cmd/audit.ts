import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"

interface AuditResult {
  package: string
  installed: string
  latest: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  url: string
}

interface DepInfo {
  name: string
  current: string
  wanted: string
  latest: string
  type: string
}

export const AuditCommand = cmd({
  command: "audit",
  describe: "Bagimlilik guvenlik denetimi ve guncellik kontrolu",
  builder: (yargs: Argv) => {
    return yargs
      .option("fix", {
        describe: "Otomatik duzeltme dene",
        type: "boolean",
        default: false,
      })
      .option("format", {
        alias: "f",
        describe: "Cikis formati",
        type: "string",
        choices: ["table", "json", "summary"],
        default: "table",
      })
      .option("ignore-dev", {
        describe: "DevDependencies'leri atla",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("Bagimliliklar denetleniyor...")

      const packageJsonPath = path.join(process.cwd(), "package.json")
      if (!fs.existsSync(packageJsonPath)) {
        s.stop("package.json bulunamadi.")
        return
      }

      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
      const deps: DepInfo[] = []

      for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
        deps.push({ name, current: version as string, wanted: "", latest: "", type: "dependencies" })
      }
      if (!args["ignore-dev"]) {
        for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
          deps.push({ name, current: version as string, wanted: "", latest: "", type: "devDependencies" })
        }
      }
      for (const [name, version] of Object.entries(pkg.optionalDependencies ?? {})) {
        deps.push({ name, current: version as string, wanted: "", latest: "", type: "optionalDependencies" })
      }

      // npm audit
      let auditResults: AuditResult[] = []
      try {
        const auditRaw = execSync("npm audit --json", { encoding: "utf-8", timeout: 30000 })
        const auditData = JSON.parse(auditRaw)
        if (auditData.vulnerabilities) {
          for (const [name, vuln] of Object.entries(auditData.vulnerabilities as Record<string, any>)) {
            auditResults.push({
              package: name,
              installed: vuln.version ?? "",
              latest: vuln.fixAvailable?.version ?? "",
              severity: vuln.severity ?? "low",
              title: vuln.via?.[0]?.title ?? "Bilinmeyen acik",
              url: vuln.via?.[0]?.url ?? "",
            })
          }
        }
      } catch {
        // npm audit hata verebilir
      }

      // Outdated check
      let outdatedCount = 0
      try {
        const outdatedRaw = execSync("npm outdated --json", { encoding: "utf-8", timeout: 30000 })
        const outdatedData = JSON.parse(outdatedRaw)
        for (const [name, info] of Object.entries(outdatedData as Record<string, any>)) {
          const dep = deps.find((d) => d.name === name)
          if (dep) {
            dep.wanted = info.wanted ?? ""
            dep.latest = info.latest ?? ""
            if (info.latest && info.current !== info.latest) outdatedCount++
          }
        }
      } catch {
        // npm outdated hata verebilir
      }

      s.stop(`Denetim tamamlandi: ${auditResults.length} acik, ${outdatedCount} guncelleme`)

      switch (args.format) {
        case "json":
          console.log(JSON.stringify({ vulnerabilities: auditResults, outdated: outdatedCount, totalDeps: deps.length }, null, 2))
          break
        case "summary":
          printSummary(auditResults, deps, outdatedCount)
          break
        default:
          printTable(auditResults, deps, outdatedCount)
      }

      if (args.fix && auditResults.length > 0) {
        console.log("\nOtomatik duzeltme deneniyor...")
        try {
          execSync("npm audit fix", { stdio: "inherit", timeout: 60000 })
        } catch {
          console.log("Otomatik duzeltme tamamlanamadi. Manuel kontrol gerekli.")
        }
      }
    })
  },
})

function printSummary(vulns: AuditResult[], deps: DepInfo[], outdated: number) {
  const critical = vulns.filter((v) => v.severity === "critical").length
  const high = vulns.filter((v) => v.severity === "high").length
  const medium = vulns.filter((v) => v.severity === "medium").length
  const low = vulns.filter((v) => v.severity === "low").length

  console.log("\n" + "═".repeat(50))
  console.log("  GLITCH AUDIT - GUVENLIK OZETI")
  console.log("═".repeat(50))
  console.log(`\nToplam Bagimlik: ${deps.length}`)
  console.log(`Guncelleme Bekleyen: ${outdated}`)
  console.log(`\nGuvenlik Aciklari:`)
  console.log(`  Kritik: ${critical}`)
  console.log(`  Yuksek: ${high}`)
  console.log(`  Orta:   ${medium}`)
  console.log(`  Dusuk:  ${low}`)
  console.log(`  Toplam: ${vulns.length}`)

  if (vulns.length === 0) {
    console.log("\nGuvenlik acigi bulunamadi!")
  } else {
    console.log("\nGuvenlik aciklari mevcut, npm audit fix ile duzeltmeyi deneyin.")
  }
  console.log("\n" + "═".repeat(50))
}

function printTable(vulns: AuditResult[], deps: DepInfo[], outdated: number) {
  console.log("\n" + "═".repeat(70))
  console.log("  GLITCH AUDIT - BAGIMLILIK DENETIMI")
  console.log("═".repeat(70))

  if (vulns.length > 0) {
    console.log(`\nGUVENLIK ACIKLARI (${vulns.length}):\n`)
    const severityIcon: Record<string, string> = {
      critical: "[KRITIK]",
      high: "[YUKSEK]",
      medium: "[ORTA]",
      low: "[DUSUK]",
    }

    for (const v of vulns) {
      const icon = severityIcon[v.severity] ?? "[?]"
      console.log(`  ${icon} ${v.package}@${v.installed} — ${v.severity.toUpperCase()}`)
      console.log(`    ${v.title}`)
      if (v.url) console.log(`    ${v.url}`)
      console.log()
    }
  } else {
    console.log("\nGuvenlik acigi bulunamadi.\n")
  }

  const outdatable = deps.filter((d) => d.latest && d.current !== d.latest)
  if (outdatable.length > 0) {
    console.log(`GUNCELLENEBILIR (${outdatable.length}):\n`)
    for (const d of outdatable.slice(0, 15)) {
      console.log(`  ${d.name.padEnd(30)} ${d.current.padEnd(12)} → ${d.latest}`)
    }
    if (outdatable.length > 15) {
      console.log(`  ... ve ${outdatable.length - 15} tane daha`)
    }
  }

  console.log("\n" + "═".repeat(70))
}
