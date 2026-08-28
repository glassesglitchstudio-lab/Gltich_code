import { createSignal, createMemo, Show, onMount } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useRoute } from "../context/route"
import { Spinner } from "./spinner"
import { PartID } from "@/session/schema"
import { TextareaRenderable, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"

export function DialogPlusThinking() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()
  const route = useRoute()
  let textarea: TextareaRenderable

  const [task, setTask] = createSignal("")
  const [status, setStatus] = createSignal<"idle" | "running" | "done" | "error">("idle")
  const [error, setError] = createSignal<string>("")

  const canStart = createMemo(() => {
    const txt = textarea?.plainText?.trim() || task().trim()
    return txt.length > 0 && status() === "idle"
  })

  useKeyboard((evt) => {
    if (status() === "running") {
      if (evt.name === "escape") return
      evt.preventDefault()
      evt.stopPropagation()
      return
    }
    if (evt.name === "escape") {
      dialog.clear()
      return
    }
    if (evt.name === "return") {
      const text = textarea?.plainText?.trim() || task().trim()
      if (text.length > 0 && status() === "idle") {
        setTask(text)
        runThinking()
      }
    }
  })

  onMount(() => {
    dialog.setSize("medium")
    setTimeout(() => {
      if (!textarea || textarea.isDestroyed) return
      textarea.focus()
      textarea.gotoLineEnd()
    }, 10)
  })

  async function runThinking() {
    const taskText = textarea?.plainText?.trim() || task().trim()
    if (!taskText || status() !== "idle") return

    setStatus("running")

    try {
      let sessionID: string
      if (route.data.type === "session" && route.data.sessionID) {
        sessionID = route.data.sessionID
      } else {
        const sessionResult = await sdk.client.session.create({})
        if (!sessionResult.data?.id) {
          throw new Error("Session oluşturulamadı")
        }
        sessionID = sessionResult.data.id
      }

      const thinkingPrompt = `Sen bir PlusThinking analiz moderatörüsün. 3 model derin düşünce süreçlerini karşılaştırarak kapsamlı bir analiz üretir.

KONU: ${taskText}

TALİMATLAR:
1. Her perspektif için <thinking> bloğu içinde adım adım düşün
2. Varsayımlarını ve kenar vakalarını belirt
3. Mantıksal zincirini kur ve değerlendir
4. Her analizi 0-100 arası skorla
5. Nihai sentezi oluştur

ÇIKTI FORMATI:
## Perspektif A — Derin Düşünce
<thinking>
[adım adım düşünceler, varsayım analizi, kenar vakaları]
</thinking>
**Analiz:** [detaylı analiz]
**Skor:** X/100

## Perspektif B — Kritik Düşünce
<thinking>
[karşıt görüş, risk analizi, alternatif yaklaşım]
</thinking>
**Analiz:** [detaylı analiz]
**Skor:** X/100

## Perspektif C — Yaratıcı Düşünce
<thinking>
[yenilikçi yaklaşım, beklenmedik açılar, sentez]
</thinking>
**Analiz:** [detaylı analiz]
**Skor:** X/100

## Nihai Sentez
[en iyi düşünce süreçlerini birleştir, nihai sonucu çıkar]

## Mantıksal Değerlendirme
[hangi yaklaşım en tutarlı ve neden]

## Kenar Vakaları
[iyi ele alınan ve atlanan kenar vakaları listesi]`

      await sdk.client.session.promptAsync({
        sessionID,
        parts: [
          {
            id: PartID.ascending(),
            type: "text",
            text: thinkingPrompt,
          },
        ],
      })

      route.navigate({ type: "session", sessionID })
      setStatus("done")
      dialog.clear()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata")
      setStatus("error")
    }
  }

  return (
    <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} gap={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          ◆ PlusThinking — Çoklu Model Düşünce Süreci Analizi
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          ESC Kapat
        </text>
      </box>

      {/* Task Input */}
      <Show when={status() === "idle"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text}>
            Analiz edilecek konu / soru:
          </text>
          <textarea
            onSubmit={() => {
              const text = textarea?.plainText?.trim() || task().trim()
              if (text) {
                setTask(text)
                runThinking()
              }
            }}
            height={4}
            keyBindings={[{ name: "return", action: "submit" }]}
            ref={(val: TextareaRenderable) => {
              textarea = val
            }}
            placeholder="Örn: Dağıtık sistemlerde CAP teoremi ve tutarlılık stratejileri..."
            placeholderColor={theme.textMuted}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.primary}
          />
          <box flexDirection="row" justifyContent="space-between" paddingTop={1}>
            <text fg={theme.textMuted}>
              [Enter] Başlat &bull; [Esc] İptal
            </text>
            <text
              fg={canStart() ? theme.primary : theme.textMuted}
              attributes={canStart() ? TextAttributes.BOLD : undefined}
              onMouseUp={() => {
                if (canStart()) runThinking()
              }}
            >
              {canStart() ? "▶ Analizi Başlat (Enter)" : "○ Konu yazın..."}
            </text>
          </box>
        </box>
      </Show>

      {/* Running */}
      <Show when={status() === "running"}>
        <box flexDirection="column" gap={1} paddingTop={1} paddingBottom={1}>
          <Spinner color={theme.primary}>Düşünce süreçleri analiz ediliyor ve sentezleniyor...</Spinner>
        </box>
      </Show>

      {/* Error */}
      <Show when={status() === "error"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.error}>Hata: {error()}</text>
          <box flexDirection="row" gap={2}>
            <text
              fg={theme.primary}
              onMouseUp={() => {
                setStatus("idle")
                setError("")
              }}
            >
              Tekrar Dene
            </text>
            <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
              Kapat
            </text>
          </box>
        </box>
      </Show>
    </box>
  )
}
