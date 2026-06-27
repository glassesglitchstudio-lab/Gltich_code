import type { Argv } from "yargs"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import path from "path"
import fs from "fs"
import os from "os"

interface TeamMember {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "member" | "viewer"
  joinedAt: string
}

interface TeamConfig {
  name: string
  id: string
  createdAt: string
  members: TeamMember[]
  sharedMemory: boolean
  sharedSkills: boolean
  sharedConfig: boolean
}

const TEAM_DIR = ".glitchcode/team"
const TEAM_CONFIG = "team.json"

export const TeamCommand = cmd({
  command: "team",
  describe: "Takim workspace yonetimi",
  builder: (yargs: Argv) => {
    return yargs
      .command(TeamInitCommand)
      .command(TeamJoinCommand)
      .command(TeamListCommand)
      .command(TeamInviteCommand)
      .command(TeamRemoveCommand)
      .command(TeamSyncCommand)
      .demandCommand()
  },
  handler: async () => {},
})

export const TeamInitCommand = cmd({
  command: "init",
  describe: "Yeni takim olustur",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    prompts.intro("👥 Takim Olusturma")

    const name = await prompts.text({
      message: "Takim adi ne olsun?",
      placeholder: "orn: glitch-devs",
    })
    if (prompts.isCancel(name)) throw new UI.CancelledError()

    const teamConfig: TeamConfig = {
      name,
      id: generateTeamId(),
      createdAt: new Date().toISOString(),
      members: [
        {
          id: generateMemberId(),
          name: os.userInfo().username,
          email: "",
          role: "owner",
          joinedAt: new Date().toISOString(),
        },
      ],
      sharedMemory: true,
      sharedSkills: true,
      sharedConfig: false,
    }

    const teamDir = path.join(process.cwd(), TEAM_DIR)
    if (!fs.existsSync(teamDir)) {
      fs.mkdirSync(teamDir, { recursive: true })
    }

    fs.writeFileSync(path.join(teamDir, TEAM_CONFIG), JSON.stringify(teamConfig, null, 2))

    prompts.log.success(`Takim olusturuldu: ${name}`)
    prompts.log.info(`Takim ID: ${teamConfig.id}`)
    prompts.outro("Diger uyeleri davet etmek icin: glitch team invite")
  },
})

export const TeamJoinCommand = cmd({
  command: "join <teamId>",
  describe: "Mevcut bir takima katil",
  builder: (yargs: Argv) => {
    return yargs.positional("teamId", {
      describe: "Takim ID",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    prompts.intro("👥 Takima Katilma")

    const name = await prompts.text({
      message: "Adin ne?",
      initialValue: os.userInfo().username,
    })
    if (prompts.isCancel(name)) throw new UI.CancelledError()

    const email = await prompts.text({
      message: "E-posta adresin (opsiyonel):",
      placeholder: "ornek@email.com",
    })
    if (prompts.isCancel(email)) throw new UI.CancelledError()

    const teamConfig: TeamConfig = {
      name: `team-${args.teamId}`,
      id: args.teamId,
      createdAt: new Date().toISOString(),
      members: [
        {
          id: generateMemberId(),
          name,
          email,
          role: "member",
          joinedAt: new Date().toISOString(),
        },
      ],
      sharedMemory: true,
      sharedSkills: true,
      sharedConfig: false,
    }

    const teamDir = path.join(process.cwd(), TEAM_DIR)
    if (!fs.existsSync(teamDir)) {
      fs.mkdirSync(teamDir, { recursive: true })
    }

    fs.writeFileSync(path.join(teamDir, TEAM_CONFIG), JSON.stringify(teamConfig, null, 2))

    prompts.log.success(`Takima katildin: ${teamConfig.name}`)
    prompts.outro("Takim dosyalari .glitchcode/team/ dizininde.")
  },
})

export const TeamListCommand = cmd({
  command: "list",
  describe: "Takim uyelerini listele",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const config = loadTeamConfig()
    if (!config) {
      UI.error("Takim bulunamadi. 'glitch team init' ile olustur.")
      process.exit(1)
    }

    console.log(`\n👥 Takim: ${config.name}\n`)
    console.log("─".repeat(50))

    for (const member of config.members) {
      const roleIcon = member.role === "owner" ? "👑" : member.role === "admin" ? "⭐" : "👤"
      console.log(`${roleIcon} ${member.name} (${member.role})`)
      if (member.email) console.log(`   📧 ${member.email}`)
    }

    console.log("─".repeat(50))
    console.log(`\nPaylasim ayarlari:`)
    console.log(`  Hafıza: ${config.sharedMemory ? "✅" : "❌"}`)
    console.log(`  Skill'ler: ${config.sharedSkills ? "✅" : "❌"}`)
    console.log(`  Config: ${config.sharedConfig ? "✅" : "❌"}`)
  },
})

export const TeamInviteCommand = cmd({
  command: "invite",
  describe: "Yeni uye davet et",
  builder: (yargs: Argv) => {
    return yargs.option("role", {
      describe: "Uye rolu",
      type: "string",
      choices: ["admin", "member", "viewer"],
      default: "member",
    })
  },
  handler: async (args) => {
    const config = loadTeamConfig()
    if (!config) {
      UI.error("Takim bulunamadi. 'glitch team init' ile olustur.")
      process.exit(1)
    }

    prompts.intro("👥 Uye Davet Etme")

    const name = await prompts.text({
      message: "Davet edilecek kisinin adi:",
    })
    if (prompts.isCancel(name)) throw new UI.CancelledError()

    const email = await prompts.text({
      message: "E-posta adresi:",
    })
    if (prompts.isCancel(email)) throw new UI.CancelledError()

    const newMember: TeamMember = {
      id: generateMemberId(),
      name,
      email,
      role: args.role as TeamMember["role"],
      joinedAt: new Date().toISOString(),
    }

    config.members.push(newMember)
    saveTeamConfig(config)

    prompts.log.success(`${name} takima eklendi (${args.role})`)
    prompts.outro(`Davet linki: glitch team join ${config.id}`)
  },
})

export const TeamRemoveCommand = cmd({
  command: "remove <memberId>",
  describe: "Uyeyi takimdan cikar",
  builder: (yargs: Argv) => {
    return yargs.positional("memberId", {
      describe: "Uye ID",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    const config = loadTeamConfig()
    if (!config) {
      UI.error("Takim bulunamadi.")
      process.exit(1)
    }

    const index = config.members.findIndex((m) => m.id === args.memberId)
    if (index === -1) {
      UI.error(`Uye bulunamadi: ${args.memberId}`)
      process.exit(1)
    }

    if (config.members[index].role === "owner") {
      UI.error("Takim sahibi cikarilamaz.")
      process.exit(1)
    }

    const removed = config.members.splice(index, 1)[0]
    saveTeamConfig(config)

    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `${removed.name} takimdan cikarildi` + UI.Style.TEXT_NORMAL)
  },
})

export const TeamSyncCommand = cmd({
  command: "sync",
  describe: "Takim paylasim dosyalarini senkronize et",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const config = loadTeamConfig()
    if (!config) {
      UI.error("Takim bulunamadi.")
      process.exit(1)
    }

    const s = prompts.spinner()
    s.start("Senkronizasyon yapiliyor...")

    const syncDir = path.join(process.cwd(), TEAM_DIR, "shared")
    if (!fs.existsSync(syncDir)) {
      fs.mkdirSync(syncDir, { recursive: true })
    }

    if (config.sharedMemory) {
      const memorySrc = path.join(process.cwd(), ".glitchcode", "memory")
      const memoryDest = path.join(syncDir, "memory")
      if (fs.existsSync(memorySrc)) {
        copyDirSync(memorySrc, memoryDest)
      }
    }

    if (config.sharedSkills) {
      const skillsSrc = path.join(process.cwd(), ".glitchcode", "skills")
      const skillsDest = path.join(syncDir, "skills")
      if (fs.existsSync(skillsSrc)) {
        copyDirSync(skillsSrc, skillsDest)
      }
    }

    s.stop("Senkronizasyon tamamlandi!")
    prompts.log.success(`Paylasim dosyalari: ${syncDir}`)
  },
})

function loadTeamConfig(): TeamConfig | null {
  const configPath = path.join(process.cwd(), TEAM_DIR, TEAM_CONFIG)
  if (!fs.existsSync(configPath)) return null
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"))
  } catch {
    return null
  }
}

function saveTeamConfig(config: TeamConfig) {
  const teamDir = path.join(process.cwd(), TEAM_DIR)
  if (!fs.existsSync(teamDir)) {
    fs.mkdirSync(teamDir, { recursive: true })
  }
  fs.writeFileSync(path.join(teamDir, TEAM_CONFIG), JSON.stringify(config, null, 2))
}

function generateTeamId(): string {
  return "team_" + Math.random().toString(36).substring(2, 10)
}

function generateMemberId(): string {
  return "mem_" + Math.random().toString(36).substring(2, 10)
}

function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}
