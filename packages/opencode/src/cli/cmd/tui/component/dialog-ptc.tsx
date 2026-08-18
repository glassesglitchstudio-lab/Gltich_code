import { createSignal, createMemo, Show, onMount } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { Spinner } from "./spinner"
import { PartID } from "@/session/schema"
import { TextareaRenderable, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"

export function DialogPTC() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()
  let textarea: TextareaRenderable

  const [task, setTask] = createSignal("")
  const [status, setStatus] = createSignal<"idle" | "running" | "done" | "error">("idle")
  const [error, setError] = createSignal<string>("")

  const canStart = createMemo(() => task().trim().length > 0 && status() === "idle")

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
      const text = textarea?.plainText ?? task()
      if (text.trim().length > 0 && status() === "idle") {
        setTask(text)
        runPTC()
      }
    }
  })

  onMount(() => {
    dialog.setSize("medium")
    setTimeout(() => {
      if (!textarea || textarea.isDestroyed) return
      textarea.focus()
      textarea.gotoLineEnd()
    }, 1)
  })

  async function runPTC() {
    const taskText = textarea?.plainText?.trim() || task().trim()
    if (!taskText || status() !== "idle") return

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

GÖREV: ${taskText}

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
          ◆ PlusTwoCoder (PTC) — Çoklu Model Tartışması
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          ESC Kapat
        </text>
      </box>

      {/* Task Input */}
      <Show when={status() === "idle"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text}>
            Tartışılacak ve çözülecek görev / kod isteği:
          </text>
          <textarea
            onSubmit={() => {
              const text = textarea?.plainText?.trim()
              if (text) {
                setTask(text)
                runPTC()
              }
            }}
            height={4}
            keyBindings={[{ name: "return", action: "submit" }]}
            ref={(val: TextareaRenderable) => {
              textarea = val
            }}
            placeholder="Örn: JWT tabanlı kimlik doğrulama middleware'i ekle..."
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
                if (canStart()) runPTC()
              }}
            >
              {canStart() ? "▶ Tartışmayı Başlat (Enter)" : "○ Görev yazın..."}
            </text>
          </box>
        </box>
      </Show>

      {/* Running */}
      <Show when={status() === "running"}>
        <box flexDirection="column" gap={1} paddingTop={1} paddingBottom={1}>
          <Spinner color={theme.primary}>Modeller arası tartışma ve çözüm oturumu başlatılıyor...</Spinner>
          <text fg={theme.textMuted}>
            Yeni oturum oluşturuluyor ve modeller görevi analiz ediyor...
          </text>
        </box>
      </Show>

      {/* Done */}
      <Show when={status() === "done"}>
        <box flexDirection="column" gap={1} paddingTop={1}>
          <text fg={theme.success} attributes={TextAttributes.BOLD}>
            ✓ Tartışma oturumu başarıyla başlatıldı!
          </text>
          <text fg={theme.textMuted}>
            Sonuçlar oturum ekranına aktarılıyor.
          </text>
        </box>
      </Show>

      {/* Error */}
      <Show when={error()}>
        <box flexDirection="column" gap={1} paddingTop={1}>
          <text fg={theme.error}>
            ✗ Hata: {error()}
          </text>
          <text
            fg={theme.primary}
            onMouseUp={() => {
              setStatus("idle")
              setError("")
              setTimeout(() => textarea?.focus(), 1)
            }}
          >
            Tekrar dene
          </text>
        </box>
      </Show>
    </box>
  )
}
