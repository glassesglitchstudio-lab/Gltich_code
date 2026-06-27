import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"

export const OnboardCommand = cmd({
  command: "onboard",
  describe: "Interaktif baslangic turu - Glitch Code'u kesfet",
  builder: (yargs) => yargs,
  handler: async () => {
    prompts.intro("⚡ Glitch Code'a Hos Geldin!")

    await prompts.note(
      `Glitch Code, terminal-tabanli bir AI kodlama asistani.
Sana kod yazdirir, komut calistirir, Git yonetir ve kalici hafiza kullanir.`,
      "Ne Yapar?",
    )

    const steps = [
      {
        title: "1. Baslangic",
        content: ` ilk calistirmada "glitch init" ile proje kurulumunu tamamla.
Provider (OpenAI, Anthropic, Ollama vb.) sec ve API anahtarini gir.`,
      },
      {
        title: "2. Calistirma",
        content: ` "glitch run 'bir API yaz'" ile gorevini tanimla.
Agent senin icin kod yazar, dosyalari duzenler ve test eder.`,
      },
      {
        title: "3. Agent Secimi",
        content: ` Tab tusuyla agent degistir:
  • build: Tam yetkili gelistirme modu
  • plan: Salt okuma analiz modu
  • compose: Spec-driven orkestrasyon`,
      },
      {
        title: "4. Hafiza",
        content: ` Glitch Code proje baglamsini hatirlar:
  • MEMORY.md - Proje bilgisi
  • checkpoint.md - Oturum durumu
  • tasks/ - Gorev takibi`,
      },
      {
        title: "5. Ozel Komutlar",
        content: ` /voice  - Sesli giris
  /dream  - Otomatik ogrenme
  /distill - Tekrarlanan isleri skill'e donustur
  /goal   - Durma kosulu belirle`,
      },
    ]

    for (const step of steps) {
      await prompts.note(step.content, step.title)
    }

    const showShortcuts = await prompts.confirm({
      message: "Kisayol tuslarini goster mi?",
      initialValue: true,
    })

    if (showShortcuts && !prompts.isCancel(showShortcuts)) {
      await prompts.note(
        `Tab       → Agent degistir
Esc        → Iptal / Geri don
Ctrl+C     → Cikis
Ctrl+L     → Terminali temizle
/          → Komut modu`,
        "Kisayollar",
      )
    }

    const quickStart = await prompts.confirm({
      message: "Hemen baslamak ister misin?",
      initialValue: true,
    })

    if (quickStart && !prompts.isCancel(quickStart)) {
      prompts.log.success(`Hazir! Su komutu calistir:
  
  glitch run "Merhaba dunya API'si yaz"`)

      prompts.outro("Basarilar! 🚀")
    } else {
      prompts.outro(`Iyi sanslar! Daha fazla bilgi icin:
  
  glitch --help
  glitch run --help`)
    }
  },
})
