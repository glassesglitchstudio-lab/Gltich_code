import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./auto-doctor.txt"

export interface DiagnosticIssue {
  category: "syntax" | "type" | "reference" | "runtime" | "dependency" | "permission" | "performance" | "unknown"
  rootCause: string
  suggestedFix: string
  confidence: number // 0-100
  affectedFiles: string[]
  diffPreview?: string
}

export interface DoctorMenuOption {
  key: string
  label: string
  action: string
  description: string
}

export function detectRootCause(issue: string, filePath?: string): DiagnosticIssue {
  const patterns: Array<{
    pattern: RegExp
    category: DiagnosticIssue["category"]
    rootCause: string
    fix: string
    baseConfidence: number
  }> = [
    {
      pattern: /(TypeError:.*cannot read propert|is not a function|unsupported operand)/i,
      category: "type",
      rootCause: "Tip uyuşmazlığı veya tanımsız değişken erişimi (Null/Undefined guard eksikliği)",
      fix: "Defansif null kontrolü veya varsayılan değer dönüşümü ekleme",
      baseConfidence: 94,
    },
    {
      pattern: /(SyntaxError|Unexpected token|Parsing error|invalid syntax)/i,
      category: "syntax",
      rootCause: "Sözdizimi hatası veya eksik kapanış parantezi/blok karakteri",
      fix: "Hatalı satırdaki sözdizimini standart dil kurallarına göre yeniden yapılandırma",
      baseConfidence: 98,
    },
    {
      pattern: /(Cannot find module|ModuleNotFoundError|No module named|import.*failed)/i,
      category: "dependency",
      rootCause: "Eksik paket veya hatalı göreceli dosya import yolu",
      fix: "Modül yolunu düzeltme veya eksik paketi çalışma ortamına ekleme",
      baseConfidence: 92,
    },
    {
      pattern: /(ReferenceError|is not defined|NameError)/i,
      category: "reference",
      rootCause: "Tanımlanmamış değişken veya kapsam dışı tanımlayıcı referansı",
      fix: "Eksik değişken tanımını ekleme veya doğru modülden içe aktarma",
      baseConfidence: 90,
    },
    {
      pattern: /(EACCES|EPERM|Permission denied|Access is denied)/i,
      category: "permission",
      rootCause: "Dosya sistemi veya soket erişim izinleri yetersizliği",
      fix: "Dosya erişim izinlerini ayarlama veya güvenli çalışma dizinine yönlendirme",
      baseConfidence: 88,
    },
    {
      pattern: /(TimeoutError|timed? out|ETIMEDOUT|ECONNREFUSED)/i,
      category: "performance",
      rootCause: "Ağ bağlantı zaman aşımı veya yanıt vermeyen servis uç noktası",
      fix: "Zaman aşımı sınırını artırma ve yeniden deneme mekanizması uygulama",
      baseConfidence: 85,
    },
  ]

  for (const item of patterns) {
    if (item.pattern.test(issue)) {
      return {
        category: item.category,
        rootCause: item.rootCause,
        suggestedFix: item.fix,
        confidence: item.baseConfidence,
        affectedFiles: filePath ? [filePath] : [],
      }
    }
  }

  return {
    category: "unknown",
    rootCause: "Genel çalışma zamanı veya mantıksal sistem uyarısı",
    suggestedFix: "Kapsamlı log incelemesi ve adım adım teşhis yürütme",
    confidence: 72,
    affectedFiles: filePath ? [filePath] : [],
  }
}

export function renderCraftedMenu(diag: DiagnosticIssue, issue: string): string[] {
  const lines: string[] = []
  const confDots = "●".repeat(Math.round(diag.confidence / 20)) + "○".repeat(5 - Math.round(diag.confidence / 20))

  lines.push("╭─ 🩺 GLITCH AUTO-DOCTOR ────────────────────────────────────────── v2.1 ──╮")
  lines.push("│                                                                          │")
  lines.push(`│  [HATA TESPİTİ]  ${issue.substring(0, 64).padEnd(64)} │`)
  lines.push(`│  [KÖK NEDEN]     ${diag.rootCause.substring(0, 64).padEnd(64)} │`)
  lines.push(`│  [GÜVEN ORANI]   ${confDots} ${diag.confidence}% (${diag.category.toUpperCase()})`.padEnd(75) + "│")
  lines.push("│                                                                          │")
  lines.push("├─ 📄 HEDEF DOSYA & STRATEJİ ───────────────────────────────────────────────┤")
  lines.push("│                                                                          │")
  lines.push(`│  Hedef: ${diag.affectedFiles[0] || "Otomatik tespit edilen kaynak dosya"}`.padEnd(75) + "│")
  lines.push(`│  Öneri: ${diag.suggestedFix}`.padEnd(75) + "│")
  lines.push("│                                                                          │")
  lines.push("├─ ⚡ İŞLEM MENÜSÜ ─────────────────────────────────────────────────────────┤")
  lines.push("│                                                                          │")
  lines.push("│  [1]  ⚡ Çözümü Doğrudan Uygula & Doğrula                                 │")
  lines.push("│  [2]  🔍 Detaylı Diff İncele (Side-by-Side & Line Numbers)               │")
  lines.push("│  [3]  💬 Doktorun Mantık ve Mimari Açıklamasını Gör                      │")
  lines.push("│  [4]  ✏️  Editörde Aç (VS Code / Zed Entegrasyonu)                        │")
  lines.push("│  [5]  🧪 Sandbox Ortamında Test Et (Kodu bozmadan simüle et)             │")
  lines.push("│  [q]  ✕ Yoksay ve Kapat                                                  │")
  lines.push("│                                                                          │")
  lines.push("╰────────────────────────────── [↑/↓ Seçim | 1-5 Hızlı Tuş | Enter Onayla] ╯")

  return lines
}

export const AutoDoctorTool = Tool.define(
  "auto-doctor",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: z.object({
        issue: z.string().describe("The error message or symptom to analyze"),
        file_path: z.string().optional().describe("Affected file path"),
        interactive: z.boolean().optional().default(true).describe("Render interactive formatted menu"),
        sandbox: z.boolean().optional().default(true).describe("Simulate fix in memory before applying"),
      }),
      execute: (params: { issue: string; file_path?: string; interactive?: boolean; sandbox?: boolean }) =>
        Effect.gen(function* () {
          const diag = detectRootCause(params.issue, params.file_path)
          const menuLines = renderCraftedMenu(diag, params.issue)

          return {
            title: `Auto-Doctor: [${diag.category.toUpperCase()}] ${params.issue.substring(0, 45)}`,
            metadata: {
              category: diag.category,
              confidence: diag.confidence,
              rootCause: diag.rootCause,
              suggestedFix: diag.suggestedFix,
              affectedFiles: diag.affectedFiles,
              interactive: params.interactive ?? true,
              sandbox: params.sandbox ?? true,
            },
            output: menuLines.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
