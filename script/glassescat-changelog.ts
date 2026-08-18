#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import fs from "fs"

const root = path.resolve(import.meta.dir, "..")
const changelogPath = path.join(root, "docs", "changelog.json")

interface UpdateItem {
  id: string
  tag: string
  badge: string
  category: string
  version: string
  date: string
  title: string
  description: string
}

interface ChangelogData {
  latestVersion: string
  lastUpdated: string
  scanner: string
  updates: UpdateItem[]
}

// Translate and classify commit into human-crafted Turkish feature summary
function analyzeCommit(msg: string, hash: string, dateStr: string): UpdateItem | null {
  const cleanMsg = msg.trim().split("\n")[0]
  if (!cleanMsg || cleanMsg.startsWith("Merge ") || cleanMsg.startsWith("chore(deps)")) {
    return null
  }

  let category = "Glitch Code"
  let badge = "badge-orange"
  let tag = "NEW"
  let title = cleanMsg
  let description = cleanMsg

  const lower = cleanMsg.toLowerCase()

  // Category detection
  if (lower.includes("unreal") || lower.includes("horror") || lower.includes("ue5")) {
    category = "Unreal AI"
    badge = "badge-violet"
  } else if (lower.includes("glassescat") || lower.includes("niko") || lower.includes("nexus") || lower.includes("agent")) {
    category = "GlassesCat-AI"
    badge = "badge-cyan"
  } else {
    category = "Glitch Code"
    badge = "badge-orange"
  }

  // Feature vs Fix vs Update
  if (lower.startsWith("fix") || lower.includes("fix(")) {
    tag = "DÜZELTME"
  } else if (lower.startsWith("feat") || lower.includes("feat(")) {
    tag = "NEW"
  } else if (lower.startsWith("perf") || lower.includes("perf(")) {
    tag = "PERFORMANS"
  } else {
    tag = "GÜNCELLEME"
  }

  // Intelligent Turkish title & description synthesis
  if (lower.includes("ptc") || lower.includes("plustwocoder") || lower.includes("debate")) {
    title = "PlusTwoCoder (PTC) — Çoklu Model Tartışma & Çözüm Sistemi"
    description = "3 modelin eşzamanlı tartışarak en iyi kodu puanladığı ve konsensüs ürettiği TUI arayüzü güncellendi."
  } else if (lower.includes("thinking") || lower.includes("plusthinking")) {
    title = "PlusThinking — Çoklu Model Derin Analiz Modülü"
    description = "Modellerin adım adım derin mantık yürüterek mimari kararları tartıştığı PlusThinking arayüzü eklendi."
  } else if (lower.includes("doctor") || lower.includes("auto-doctor")) {
    title = "Glitch Auto-Doctor — Otonom Sistem Teşhisi"
    description = "SQLite veritabanı, Git, bellek ve disk izinlerini denetleyip onaran sağlık teşhis motoru geliştirildi."
  } else if (lower.includes("websearch") || lower.includes("searxng")) {
    title = "SearXNG & Gizlilik Odaklı Web Araması (WebSearch)"
    description = "Glitch Code için harici ve yerel arama motoru desteği resmi şemaya dahil edildi."
  } else if (lower.includes("showcase") || lower.includes("branding") || lower.includes("logo")) {
    title = "Elytra-ai & GlassesCat Canlı Ekosistem Portalı"
    description = "GitHub Pages üzerinde yeni tasarım dili, interaktif terminal ve gerçek logo entegrasyonu tamamlandı."
  } else if (lower.includes("version") || lower.includes("semver") || lower.includes("update loop")) {
    title = "Sürüm Senkronizasyonu & Güncelleme Kararlılığı"
    description = "Yerel binary ve GitHub release sürümleri tam senkronize hale getirilerek kararlılık artırıldı."
  } else {
    // General formatted summary
    title = cleanMsg.replace(/^(feat|fix|perf|chore|refactor|docs)(\([^)]+\))?:\s*/i, "").trim()
    title = title.charAt(0).toUpperCase() + title.slice(1)
    description = `Commit [${hash.slice(0, 7)}]: ${cleanMsg}`
  }

  return {
    id: `git-${hash.slice(0, 7)}`,
    tag,
    badge,
    category,
    version: "v2.1.0",
    date: dateStr || "Bugün",
    title,
    description,
  }
}

async function run() {
  console.log("🔍 GlassesCat AI: GitHub & Git commit geçmişi taranıyor...")

  let existingData: ChangelogData = {
    latestVersion: "2.1.0",
    lastUpdated: new Date().toISOString().slice(0, 10),
    scanner: "GlassesCat Autonomous AI Agent",
    updates: [],
  }

  if (fs.existsSync(changelogPath)) {
    try {
      existingData = JSON.parse(await Bun.file(changelogPath).text())
    } catch {}
  }

  // Scan last 30 commits
  const logOutput = await $`git log -n 30 --pretty=format:"%H|%s|%cd" --date=short`.text()
  const lines = logOutput.trim().split("\n")

  const scannedUpdates: UpdateItem[] = []
  const seenTitles = new Set<string>()

  for (const line of lines) {
    if (!line) continue
    const [hash, msg, date] = line.split("|")
    const analyzed = analyzeCommit(msg, hash, date)
    if (analyzed && !seenTitles.has(analyzed.title)) {
      seenTitles.add(analyzed.title)
      scannedUpdates.push(analyzed)
    }
  }

  // Merge with existing high-level updates
  const combinedMap = new Map<string, UpdateItem>()
  
  // Scanned git updates first
  for (const u of scannedUpdates) {
    combinedMap.set(u.title, u)
  }
  // Existing structured items
  for (const u of existingData.updates || []) {
    if (!combinedMap.has(u.title)) {
      combinedMap.set(u.title, u)
    }
  }

  const finalUpdates = Array.from(combinedMap.values()).slice(0, 12)

  const outputData: ChangelogData = {
    latestVersion: existingData.latestVersion || "2.1.0",
    lastUpdated: new Date().toISOString().slice(0, 10),
    scanner: "GlassesCat Autonomous AI Agent",
    updates: finalUpdates,
  }

  await Bun.file(changelogPath).write(JSON.stringify(outputData, null, 2))
  console.log(`✅ GlassesCat AI: ${finalUpdates.length} adet yenilik ve güncelleme Türkçe olarak analiz edilip docs/changelog.json içine yazıldı!`)
}

await run()
