import { createSignal, createMemo, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useLanguage } from "../context/language"
import { Spinner } from "./spinner"
import { PartID } from "@/session/schema"

export function DialogPTC() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()
  const lang = useLanguage()

  const [task, setTask] = createSignal("")
  const [status, setStatus] = createSignal<"idle" | "running" | "done" | "error">("idle")
  const [error, setError] = createSignal<string>("")

  const canStart = createMemo(() => task().trim().length > 0 && status() === "idle")

  async function runPTC() {
    if (!canStart()) return

    setStatus("running")

    try {
      // Create a new session for PTC debate
      const sessionResult = await sdk.client.session.create({})
      if (!sessionResult.data?.id) {
        throw new Error("Session olusturulamadi")
      }

      const sessionID = sessionResult.data.id

      // Send the PTC debate prompt
      const ptcPrompt = `Sen bir PlusTwoCoder (PTC) moderatörüsün. 3 model birbiriyle tartışarak en iyi kod çözümünü üretir.

GÖREV: ${task()}

TALİMATLAR:
1. 3 farklı perspektiften çözüm üret (Her biri ayrı paragrafta)
2. Her çözümü eleştir (güçlü ve zayıf yönler)
3. Her çözüme 0-100 arası skor ver
4. Nihai konsensusu oluştur

ÇIKTI FORMATI:
## Çözüm 1 (Perspektif A)
[kod çözümü]
**Eleştirisi:** [güçlü/zayıf yönler]
**Skor:** X/100

## Çözüm 2 (Perspektif B)
[kod çözümü]
**Eleştirisi:** [güçlü/zayıf yönler]
**Skor:** X/100

## Çözüm 3 (Perspektif C)
[kod çözümü]
**Eleştirisi:** [güçlü/zayıf yönler]
**Skor:** X/100

## Nihai Konsensus
[En iyi çözümü seç ve neden daha iyi olduğunu açıkla]

## Uygulama Adımları
[Adım adım talimatlar]`

      // Send the prompt to the session
      const promptResult = await sdk.client.session.promptAsync({
        sessionID,
        parts: [
          {
            id: PartID.ascending(),
            type: "text",
            text: ptcPrompt,
          },
        ],
      })

      if (promptResult.error) {
        throw new Error("Mesaj gonderilemedi")
      }

      setStatus("done")
      dialog.clear()

      // Navigate to the new session to show results
      // The user will see the debate results in the chat
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata")
      setStatus("error")
    }
  }

  return (
    <box flexDirection="column" padding={2} gap={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.primary} selectable={false}>
          ◆ <b>PlusTwoCoder</b> — Model Tartışma
        </text>
        <text fg={theme.textMuted} selectable={false} onMouseUp={() => dialog.clear()}>
          ESC
        </text>
      </box>

      {/* Task Input */}
      <Show when={status() === "idle"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} selectable={false}>
            Görev açıklaması:
          </text>
          <input
            value={task()}
            onInput={(e) => setTask(e)}
            placeholder="Örn: JWT authentication ekle..."
            placeholderColor={theme.textMuted}
            focusedBackgroundColor={theme.backgroundPanel}
            cursorColor={theme.primary}
            focusedTextColor={theme.text}
            width="100%"
          />
          <box flexDirection="row" gap={1}>
            <text
              fg={canStart() ? theme.primary : theme.textMuted}
              selectable={false}
              onMouseUp={canStart() ? runPTC : undefined}
            >
              {canStart() ? "▶ Başlat" : "○ Görev girin"}
            </text>
          </box>
        </box>
      </Show>

      {/* Running */}
      <Show when={status() === "running"}>
        <box flexDirection="column" gap={1}>
          <Spinner color={theme.primary}>Tartışma başlatılıyor...</Spinner>
          <text fg={theme.textMuted} selectable={false}>
            Yeni session oluşturulup debate gönderilecek...
          </text>
        </box>
      </Show>

      {/* Done */}
      <Show when={status() === "done"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.success} selectable={false}>
            ✓ Tartışma başlatıldı!
          </text>
          <text fg={theme.textMuted} selectable={false}>
            Sonuçları görmek için yeni session'a yönlendirileceksiniz.
          </text>
        </box>
      </Show>

      {/* Error */}
      <Show when={error()}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.error} selectable={false}>
            ✗ Hata: {error()}
          </text>
          <text
            fg={theme.primary}
            selectable={false}
            onMouseUp={() => { setStatus("idle"); setError("") }}
          >
            Tekrar dene
          </text>
        </box>
      </Show>
    </box>
  )
}
