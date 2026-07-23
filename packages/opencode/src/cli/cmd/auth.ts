import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { AppRuntime } from "@/effect/app-runtime"
import { Instance } from "../../project/instance"
import { Auth } from "../../auth"
import { Effect } from "effect"

export const AuthCommand = cmd({
  command: "auth",
  describe: "Auth yonetimi (API key temizleme, listeleme)",
  builder: (yargs: Argv) => {
    return yargs
      .command(
        "clean",
        "Tum API key'leri temizle (gecersiz/expired key'leri kaldir)",
        () => {},
        async () => {
          await bootstrap(process.cwd(), async () => {
            const s = require("@clack/prompts").spinner()
            s.start("Auth dosyasi temizleniyor...")

            await Instance.provide({
              directory: process.cwd(),
              async fn() {
                await AppRuntime.runPromise(
                  Effect.gen(function* () {
                    const auth = yield* Auth.Service
                    const all = yield* auth.all()

                    const entries = Object.entries(all)
                    if (entries.length === 0) {
                      s.stop("Auth dosyasi zaten temiz.")
                      return
                    }

                    s.message(`${entries.length} auth entry bulundu.`)

                    // Tum entry'leri temizle
                    for (const [key] of entries) {
                      yield* auth.remove(key)
                      s.message(`${key} kaldirildi.`)
                    }

                    s.stop(`Basariyla ${entries.length} auth entry temizlendi!`)
                  }),
                )
              },
            })
          })
        },
      )
      .command(
        "list",
        "Mevcut API key'leri listele",
        () => {},
        async () => {
          await bootstrap(process.cwd(), async () => {
            await Instance.provide({
              directory: process.cwd(),
              async fn() {
                await AppRuntime.runPromise(
                  Effect.gen(function* () {
                    const auth = yield* Auth.Service
                    const all = yield* auth.all()

                    const entries = Object.entries(all)
                    if (entries.length === 0) {
                      console.log("Auth dosyasi bos — API key yok.")
                      return
                    }

                    console.log("\nMevcut API Key'ler:")
                    console.log("─".repeat(40))
                    for (const [key, info] of entries) {
                      const type = info.type
                      const masked = type === "api"
                        ? info.key.slice(0, 8) + "..." + info.key.slice(-4)
                        : type === "oauth"
                          ? "OAuth token"
                          : "WellKnown"
                      console.log(`  ${key}: ${masked}`)
                    }
                    console.log("─".repeat(40))
                    console.log(`Toplam: ${entries.length} provider`)
                  }),
                )
              },
            })
          })
        },
      )
      .command(
        "remove <provider>",
        "Belirli bir provider'in API key'ini kaldir",
        (yargs) => {
          return yargs.positional("provider", {
            describe: "Provider ID (orn: openai, anthropic)",
            type: "string",
            demandOption: true,
          })
        },
        async (args) => {
          await bootstrap(process.cwd(), async () => {
            const s = require("@clack/prompts").spinner()
            s.start(`${args.provider} kaldiriliyor...`)

            await Instance.provide({
              directory: process.cwd(),
              async fn() {
                await AppRuntime.runPromise(
                  Effect.gen(function* () {
                    const auth = yield* Auth.Service
                    const existing = yield* auth.get(args.provider)

                    if (!existing) {
                      s.stop(`${args.provider} bulunamadi.`)
                      return
                    }

                    yield* auth.remove(args.provider)
                    s.stop(`${args.provider} basariyla kaldirildi!`)
                  }),
                )
              },
            })
          })
        },
      )
  },
  handler: () => {},
})
