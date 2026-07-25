import { createSignal, createMemo, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useLanguage } from "../context/language"
import { Spinner } from "./spinner"
import { PartID } from "@/session/schema"

export function DialogPlusThinking() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()
  const lang = useLanguage()

  const [task, setTask] = createSignal("")
  const [status, setStatus] = createSignal<"idle" | "running" | "done" | "error">("idle")
  const [error, setError] = createSignal<string>("")

  const canStart = createMemo(() => task().trim().length > 0 && status() === "idle")

  async function runThinking() {
    if (!canStart()) return

    setStatus("running")

    try {
      const sessionResult = await sdk.client.session.create({})
      if (!sessionResult.data?.id) {
        throw new Error("Session olusturulamadi")
      }

      const sessionID = sessionResult.data.id

      const thinkingPrompt = `Sen bir PlusThinking analiz moderatörüsun. 3 model derin dusunce sureclerini karsilastirarak kapsamli bir analiz uretir.

KONU: ${task()}

TALİMATLAR:
1. Her perspektif icin <thinking> blogu icinde adim adim dusun
2. Varsayimlarini ve kenar vakalarini belirt
3. Mantıksal zincirini kur ve degerlendir
4. Her analizi 0-100 arasi skorla
5. Nihai sentezi olustur

ÇIKTI FORMATI:
## Perspektif A — Derin Dusunce
<thinking>
[adim adim dusunceler, varsayim analizi, kenar vakalari]
</thinking>
**Analiz:** [detayli analiz]
**Skor:** X/100

## Perspektif B — Kritik Dusunce
<thinking>
[karsit gorus, risk analizi, alternatif yaklasim]
</thinking>
**Analiz:** [detayli analiz]
**Skor:** X/100

## Perspektif C — Yaratici Dusunce
<thinking>
[yenilikci yaklasim, beklenmedik acilar, sentez]
</thinking>
**Analiz:** [detayli analiz]
**Skor:** X/100

## Nihai Sentez
[en iyi dusunce sureclerini birlestir, nihai sonucu cikar]

## Mantıksal Degerlendirme
[hangi yaklasim en tutarli ve neden]

## Kenar vakalari
[iyi ele alinan ve atlanan kenar vakalari listesi]`

      const promptResult = await sdk.client.session.promptAsync({
        sessionID,
        parts: [
          {
            id: PartID.ascending(),
            type: "text",
            text: thinkingPrompt,
          },
        ],
      })

      if (promptResult.error) {
        throw new Error("Mesaj gonderilemedi")
      }

      setStatus("done")
      dialog.clear()
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
          ◆ <b>PlusThinking</b> — Derin Analiz
        </text>
        <text fg={theme.textMuted} selectable={false} onMouseUp={() => dialog.clear()}>
          ESC
        </text>
      </box>

      {/* Task Input */}
      <Show when={status() === "idle"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text} selectable={false}>
            Analiz konusu:
          </text>
          <input
            value={task()}
            onInput={(e) => setTask(e)}
            placeholder="Örn: Bu mimariye ne dersin?"
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
              onMouseUp={canStart() ? runThinking : undefined}
            >
              {canStart() ? "▶ Baslat" : "○ Konu girin"}
            </text>
          </box>
        </box>
      </Show>

      {/* Running */}
      <Show when={status() === "running"}>
        <box flexDirection="column" gap={1}>
          <Spinner color={theme.primary}>Derin analiz baslatiliyor...</Spinner>
          <text fg={theme.textMuted} selectable={false}>
            Modeller dusunce sureclerini karsilastiriyor...
          </text>
        </box>
      </Show>

      {/* Done */}
      <Show when={status() === "done"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.success} selectable={false}>
            ✓ Analiz tamamlandi!
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
