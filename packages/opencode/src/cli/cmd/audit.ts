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

interface SecurityIssue {
  file: string
  line: number
  type: "secret" | "owasp" | "dependency" | "misconfig"
  severity: "critical" | "high" | "medium" | "low"
  message: string
  recommendation: string
}

const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/i, severity: "high" as const, type: "secret" as const, msg: "API key hardcoded" },
  { pattern: /(?:sk-[a-zA-Z0-9]{20,}|pk-[a-zA-Z0-9]{20,})/, severity: "critical" as const, type: "secret" as const, msg: "OpenAI API key detected" },
  { pattern: /(?:ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{36}/, severity: "critical" as const, type: "secret" as const, msg: "GitHub token detected" },
  { pattern: /(?:-----BEGIN\s*(?:RSA\s*)?PRIVATE\s*KEY-----)/, severity: "critical" as const, type: "secret" as const, msg: "Private key detected" },
  { pattern: /(?:AKIA[0-9A-Z]{16})/, severity: "critical" as const, type: "secret" as const, msg: "AWS access key detected" },
  { pattern: /(?:password|şifre|parola)\s*[:=]\s*['"][^'"]+['"]/i, severity: "high" as const, type: "secret" as const, msg: "Password hardcoded" },
  { pattern: /(?:token|jwt|bearer)\s*[:=]\s*['"][^'"]{20,}['"]/i, severity: "high" as const, type: "secret" as const, msg: "Auth token hardcoded" },
  { pattern: /(?:connection\s*string|connstr)\s*[:=]\s*['"][^'"]+['"]/i, severity: "critical" as const, type: "secret" as const, msg: "Connection string detected" },
  { pattern: /(?:mongo(?:db)?\:\/\/|postgres(?:ql)?\:\/\/|mysql\:\/\/|redis\:\/\/)[^\s'"]+/i, severity: "high" as const, type: "secret" as const, msg: "Database URL with credentials" },
]

const OWASP_PATTERNS = [
  { pattern: /innerHTML\s*=/, severity: "high" as const, type: "owasp" as const, msg: "XSS vulnerability: innerHTML assignment" },
  { pattern: /dangerouslySetInnerHTML/, severity: "high" as const, type: "owasp" as const, msg: "XSS vulnerability: dangerouslySetInnerHTML" },
  { pattern: /eval\s*\(/, severity: "critical" as const, type: "owasp" as const, msg: "Code injection: eval() usage" },
  { pattern: /exec\s*\(/, severity: "high" as const, type: "owasp" as const, msg: "Code injection: exec() usage" },
  { pattern: /Function\s*\(/, severity: "medium" as const, type: "owasp" as const, msg: "Code injection: Function constructor" },
  { pattern: /setTimeout\s*\(\s*['"`]/, severity: "medium" as const, type: "owasp" as const, msg: "Code injection: string setTimeout" },
  { pattern: /document\.write\s*\(/, severity: "high" as const, type: "owasp" as const, msg: "XSS vulnerability: document.write" },
  { pattern: /sql\s*\+\s*['"`]/, severity: "critical" as const, type: "owasp" as const, msg: "SQL injection: string concatenation" },
  { pattern: /SELECT\s+.*\s+FROM\s+.*\s*\+/, severity: "critical" as const, type: "owasp" as const, msg: "SQL injection in SELECT" },
  { pattern: /\.exec\s*\(\s*['"`].*\$\{/, severity: "high" as const, type: "owasp" as const, msg: "Command injection: template in exec" },
]

function findPackageJson(dir: string): string | null {
  let current = path.resolve(dir)
  for (let i = 0; i < 10; i++) {
    const p = path.join(current, "package.json")
    if (fs.existsSync(p)) return p
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

function scanForSecrets(filePath: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  try {
    const ext = path.extname(filePath).toLowerCase()
    if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".zip", ".tar", ".gz"].includes(ext)) return issues
    if (filePath.includes("node_modules") || filePath.includes(".git")) return issues
    const content = fs.readFileSync(filePath, "utf8")
    const lines = content.split("\n")

    for (const sp of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (sp.pattern.test(lines[i])) {
          issues.push({
            file: filePath,
            line: i + 1,
            type: sp.type,
            severity: sp.severity,
            message: sp.msg,
            recommendation: getRecommendation(sp.type, sp.msg),
          })
        }
      }
    }
    for (const op of OWASP_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (op.pattern.test(lines[i])) {
          issues.push({
            file: filePath,
            line: i + 1,
            type: op.type,
            severity: op.severity,
            message: op.msg,
            recommendation: getRecommendation(op.type, op.msg),
          })
        }
      }
    }
  } catch {}
  return issues
}

function getRecommendation(type: string, msg: string): string {
  const recs: Record<string, string> = {
    "API key hardcoded": "Use environment variables (.env) or a secrets manager",
    "OpenAI API key detected": "Move to .env file and add .env to .gitignore",
    "GitHub token detected": "Use GitHub OAuth apps or fine-grained tokens with limited scopes",
    "Private key detected": "Use SSH agent or hardware security module (HSM)",
    "AWS access key detected": "Use IAM roles or AWS Secrets Manager",
    "Password hardcoded": "Use .env with dotenv or a vault service",
    "Auth token hardcoded": "Use short-lived tokens from a secure token service",
    "Connection string detected": "Use connection string from environment variables",
    "Database URL with credentials": "Use IAM authentication or connection pooling",
    "XSS vulnerability: innerHTML assignment": "Use textContent or DOMPurify sanitization",
    "XSS vulnerability: dangerouslySetInnerHTML": "Use a proper sanitization library like DOMPurify",
    "XSS vulnerability: document.write": "Use DOM manipulation methods instead",
    "Code injection: eval() usage": "Use JSON.parse for JSON or Function constructor safely",
    "Code injection: exec() usage": "Use child_process.execFile or spawn with array args",
    "Code injection: Function constructor": "Use predefined functions or switch statements",
    "Code injection: string setTimeout": "Use function references instead of strings",
    "SQL injection: string concatenation": "Use parameterized queries or prepared statements",
    "SQL injection in SELECT": "Use an ORM like Prisma, Drizzle, or TypeORM",
    "Command injection: template in exec": "Use execFile or spawn with arguments array",
  }
  return recs[msg] || "Review and fix this security issue"
}

export const AuditCommand = cmd({
  command: "audit",
  describe: "Guvenlik denetimi (npm audit + secret scan + OWASP)",
  builder: (yargs: Argv) => {
    return yargs
      .option("fix", {
        describe: "Otomatik duzeltme dene (npm audit fix)",
        type: "boolean",
        default: false,
      })
      .option("format", {
        alias: "f",
        describe: "Cikis formati",
        type: "string",
        choices: ["table", "json", "summary", "html"],
        default: "table",
      })
      .option("deep", {
        describe: "Projedeki tum dosyalari secret/OWASP icin tara",
        type: "boolean",
        default: false,
      })
      .option("ignore-dev", {
        describe: "devDependencies'i atla",
        type: "boolean",
        default: false,
      })
      .option("severity", {
        describe: "Minimum severity seviyesi",
        type: "string",
        choices: ["low", "medium", "high", "critical"],
        default: "low",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("Guvenlik denetimi baslatiliyor...")

      const vulns: AuditResult[] = []
      const deps: DepInfo[] = []
      let outdatedCount = 0
      const securityIssues: SecurityIssue[] = []

      const pkgPath = findPackageJson(process.cwd())
      if (pkgPath) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
        const depTypes: Array<{ key: string; type: string }> = [
          { key: "dependencies", type: "dependency" },
        ]
        if (!args.ignoreDev) {
          depTypes.push({ key: "devDependencies", type: "devDependency" })
        }
        depTypes.push({ key: "optionalDependencies", type: "optional" })

        for (const dt of depTypes) {
          if (pkg[dt.key]) {
            for (const [name, version] of Object.entries(pkg[dt.key])) {
              deps.push({ name, current: version as string, wanted: "", latest: "", type: dt.type })
            }
          }
        }
      }

      s.message("npm audit yapiliyor...")
      try {
        const auditOutput = execSync("npm audit --json", { timeout: 30000, encoding: "utf8", windowsHide: true })
        const audit = JSON.parse(auditOutput)
        if (audit.vulnerabilities) {
          for (const [pkgName, vuln] of Object.entries(audit.vulnerabilities)) {
            const v = vuln as any
            const severity = (v.severity || "low").toLowerCase()
            const sevLevel: AuditResult["severity"] = severity === "critical" || severity === "high" || severity === "medium" ? severity : "low"
            vulns.push({
              package: pkgName,
              installed: v.range || "?",
              latest: v.fixAvailable?.version || "?",
              severity: sevLevel,
              title: v.name || pkgName,
              url: `https://github.com/advisories/${pkgName}`,
            })
          }
        }
      } catch {}

      s.message("Guncellik kontrolu yapiliyor...")
      try {
        const outdatedOutput = execSync("npm outdated --json", { timeout: 30000, encoding: "utf8", windowsHide: true })
        const outdated = JSON.parse(outdatedOutput)
        for (const [name, info] of Object.entries(outdated)) {
          const i = info as any
          const dep = deps.find((d) => d.name === name)
          if (dep) {
            dep.wanted = i.wanted || ""
            dep.latest = i.latest || ""
          }
          outdatedCount++
        }
      } catch {}

      if (args.deep) {
        s.message("Proje dosyalari taranıyor (secret/OWASP)...")
        const scanDirs = [process.cwd()]
        for (const dir of scanDirs) {
          try {
            const files = fs.readdirSync(dir, { recursive: true }) as string[]
            let scanned = 0
            for (const file of files) {
              const fullPath = path.join(dir, file)
              try {
                if (fs.statSync(fullPath).isFile()) {
                  const fileIssues = scanForSecrets(fullPath)
                  securityIssues.push(...fileIssues)
                  scanned++
                  if (scanned % 100 === 0) s.message(`  Taranan dosya: ${scanned}`)
                }
              } catch {}
            }
          } catch {}
        }
      }

      const minSeverity = args.severity as string
      const severityOrder = ["low", "medium", "high", "critical"]
      const minLevel = severityOrder.indexOf(minSeverity)

      const filteredVulns = vulns.filter(v => severityOrder.indexOf(v.severity) >= minLevel)
      const filteredIssues = securityIssues.filter(i => severityOrder.indexOf(i.severity) >= minLevel)

      s.stop(`Denetim tamamlandi: ${filteredVulns.length} acik, ${outdatedCount} guncelleme, ${filteredIssues.length} guvenlik sorunu`)

      if (args.fix && filteredVulns.length > 0) {
        s.start("npm audit fix calistiriliyor...")
        try {
          execSync("npm audit fix", { stdio: "inherit", timeout: 60000, windowsHide: true })
          s.stop("npm audit fix tamamlandi")
        } catch {
          s.stop("npm audit fix basarisiz")
        }
      }

      switch (args.format) {
        case "json":
          console.log(JSON.stringify({ vulnerabilities: filteredVulns, dependencies: deps, outdatedCount, securityIssues: filteredIssues }, null, 2))
          break
        case "html":
          printAuditHTML(filteredVulns, deps, outdatedCount, filteredIssues)
          break
        case "summary":
          printAuditSummary(filteredVulns, deps, outdatedCount, filteredIssues)
          break
        default:
          printAuditTable(filteredVulns, deps, outdatedCount, filteredIssues)
      }
    })
  },
})

function printAuditTable(vulns: AuditResult[], deps: DepInfo[], outdatedCount: number, issues: SecurityIssue[]) {
  console.log("\n" + "=".repeat(70))
  console.log("  GLITCH AUDIT - GUVENLIK DENETIMI")
  console.log("=".repeat(70))

  if (vulns.length > 0) {
    console.log(`\n${"GUVENLIK ACIKLARI".padEnd(30)} (${vulns.length} adet)\n`)
    for (const v of vulns) {
      const sevIcon = v.severity === "critical" ? "🔴" : v.severity === "high" ? "🟠" : v.severity === "medium" ? "🟡" : "⚪"
      console.log(`  ${sevIcon} [${v.severity.toUpperCase().padEnd(8)}] ${v.package}@${v.installed}`)
      console.log(`       ${v.title}`)
      if (v.latest !== "?") console.log(`       Cozum: ${v.package}@${v.latest}`)
      if (v.url) console.log(`       ${v.url}`)
      console.log()
    }
  }

  if (issues.length > 0) {
    console.log(`\n${"STATIC ANALIZ SORUNLARI".padEnd(30)} (${issues.length} adet)\n`)
    const groupedByType: Record<string, SecurityIssue[]> = {}
    for (const iss of issues) {
      if (!groupedByType[iss.type]) groupedByType[iss.type] = []
      groupedByType[iss.type].push(iss)
    }

    for (const [type, typeIssues] of Object.entries(groupedByType)) {
      console.log(`  --- ${type.toUpperCase()} ---`)
      for (const iss of typeIssues.slice(0, 10)) {
        const sevIcon = iss.severity === "critical" ? "🔴" : iss.severity === "high" ? "🟠" : "🟡"
        console.log(`  ${sevIcon} ${iss.file}:${iss.line} — ${iss.message}`)
        console.log(`     → ${iss.recommendation}`)
      }
      if (typeIssues.length > 10) console.log(`     ... ve ${typeIssues.length - 10} tane daha`)
      console.log()
    }
  }

  if (outdatedCount > 0) {
    const outdatedDeps = deps.filter(d => d.latest && d.current !== d.latest)
    console.log(`\n${"GUNCELLENEBILIR PAKETLER".padEnd(30)} (${outdatedCount} adet)\n`)
    for (const dep of outdatedDeps.slice(0, 15)) {
      console.log(`  ${dep.name.padEnd(30)} ${dep.current} → ${dep.latest}`)
    }
    if (outdatedDeps.length > 15) console.log(`  ... ve ${outdatedDeps.length - 15} tane daha`)
  }

  if (vulns.length === 0 && issues.length === 0) {
    console.log(`\n  ✅ Guvenlik acigi bulunamadi.`)
  }

  console.log("\n" + "=".repeat(70) + "\n")
}

function printAuditSummary(vulns: AuditResult[], deps: DepInfo[], outdatedCount: number, issues: SecurityIssue[]) {
  const critical = vulns.filter(v => v.severity === "critical").length
  const high = vulns.filter(v => v.severity === "high").length
  const medium = vulns.filter(v => v.severity === "medium").length
  const low = vulns.filter(v => v.severity === "low").length

  const secCritical = issues.filter(i => i.severity === "critical").length
  const secHigh = issues.filter(i => i.severity === "high").length

  console.log("\n" + "=".repeat(50))
  console.log("  GLITCH AUDIT - GUVENLIK OZETI")
  console.log("=".repeat(50))
  console.log(`\n  Toplam Bagimlik: ${deps.length}`)
  console.log(`  Guncelleme Bekleyen: ${outdatedCount}`)
  console.log(`\n  Guvenlik Aciklari (npm):`)
  console.log(`    Kritik: ${critical}`)
  console.log(`    Yuksek: ${high}`)
  console.log(`    Orta:   ${medium}`)
  console.log(`    Dusuk:  ${low}`)
  console.log(`    Toplam: ${vulns.length}`)
  console.log(`\n  Statik Analiz:`)
  console.log(`    Secret: ${issues.filter(i => i.type === "secret").length}`)
  console.log(`    OWASP:  ${issues.filter(i => i.type === "owasp").length}`)
  console.log(`    Kritik: ${secCritical}`)
  console.log(`    Yuksek: ${secHigh}`)

  if (vulns.length === 0 && issues.length === 0) {
    console.log(`\n  ✅ Guvenlik acigi bulunamadi!`)
  }
  console.log("\n" + "=".repeat(50) + "\n")
}

function printAuditHTML(vulns: AuditResult[], deps: DepInfo[], outdatedCount: number, issues: SecurityIssue[]) {
  const vulnRows = vulns.map(v => `<tr>
    <td><span class="sev sev-${v.severity}">${v.severity.toUpperCase()}</span></td>
    <td>${escapeHtml(v.package)}</td>
    <td>${v.installed}</td>
    <td>${v.latest}</td>
    <td>${escapeHtml(v.title)}</td>
  </tr>`).join("\n")

  const issueRows = issues.slice(0, 30).map(i => `<tr>
    <td><span class="sev sev-${i.severity}">${i.severity.toUpperCase()}</span></td>
    <td>${escapeHtml(i.type)}</td>
    <td>${escapeHtml(i.file)}:${i.line}</td>
    <td>${escapeHtml(i.message)}</td>
    <td>${escapeHtml(i.recommendation)}</td>
  </tr>`).join("\n")

  const critical = vulns.filter(v => v.severity === "critical").length
  const high = vulns.filter(v => v.severity === "high").length

  console.log(`<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>Audit Report - Glitch Code</title>
<style>
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#121218; color:#e0e0e0; padding:2rem; }
h1 { color:#FF6B00; }
h2 { color:#FF8C40; margin-top:2rem; }
.stats { display:flex; gap:1rem; margin:1rem 0; }
.stat { background:#1a1a24; border-radius:8px; padding:1rem; flex:1; }
.stat-critical { border-left:3px solid #ff4444; }
.stat-high { border-left:3px solid #ff8800; }
.stat-ok { border-left:3px solid #4caf50; }
.stat-value { font-size:2rem; font-weight:bold; }
table { width:100%; border-collapse:collapse; margin-top:1rem; }
th { background:#1a1a24; color:#FF6B00; padding:0.8rem; text-align:left; border-bottom:2px solid #FF6B00; }
td { padding:0.6rem 0.8rem; border-bottom:1px solid #2a2a3a; }
tr:hover { background:#1e1e2a; }
.sev { padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold; }
.sev-critical { background:#ff444422; color:#ff4444; }
.sev-high { background:#ff880022; color:#ff8800; }
.sev-medium { background:#ffcc0022; color:#ffcc00; }
.sev-low { background:#66666622; color:#999; }
</style>
</head>
<body>
<h1>🛡️ Audit Raporu</h1>
<div class="stats">
  <div class="stat ${critical > 0 ? 'stat-critical' : 'stat-ok'}">
    <div class="stat-value">${vulns.length}</div>
    <div>Guvenlik Acigi (${critical} kritik, ${high} yuksek)</div>
  </div>
  <div class="stat">
    <div class="stat-value">${outdatedCount}</div>
    <div>Guncelleme Bekleyen</div>
  </div>
  <div class="stat ${issues.length > 0 ? 'stat-high' : 'stat-ok'}">
    <div class="stat-value">${issues.length}</div>
    <div>Statik Analiz Sorunu</div>
  </div>
</div>

<h2>Guvenlik Aciklari</h2>
<table><tr><th>Severity</th><th>Package</th><th>Installed</th><th>Latest</th><th>Title</th></tr>${vulnRows.length > 0 ? vulnRows : '<tr><td colspan="5" style="text-align:center;color:#4caf50;">✅ Guvenlik acigi bulunamadi</td></tr>'}</table>

<h2>Statik Analiz</h2>
<table><tr><th>Severity</th><th>Type</th><th>File</th><th>Message</th><th>Recommendation</th></tr>${issueRows.length > 0 ? issueRows : '<tr><td colspan="5" style="text-align:center;color:#4caf50;">✅ Sorun bulunamadi</td></tr>'}</table>

</body>
</html>`)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
