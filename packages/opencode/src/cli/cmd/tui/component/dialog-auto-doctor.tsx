import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show } from "solid-js"
import { Dialog } from "../ui/dialog"
import { CraftedTheme } from "../ui/crafted-theme"
import { RGBA, TextAttributes } from "@opentui/core"

export interface AutoDoctorIssueProps {
  issue: string
  rootCause: string
  category: string
  confidence: number
  filePath?: string
  diffPreview?: string
  explanation?: string
  onApplyFix?: () => void
  onSandboxTest?: () => void
  onOpenEditor?: () => void
  onClose: () => void
}

export function DialogAutoDoctor(props: AutoDoctorIssueProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [activeTab, setActiveTab] = createSignal<"menu" | "diff" | "explanation">("menu")
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null)

  const menuItems = [
    { key: "1", label: "⚡ Çözümü Doğrudan Uygula & Test Et", action: "apply" },
    { key: "2", label: "🔍 Detaylı Diff İncele (Side-by-Side)", action: "diff" },
    { key: "3", label: "💬 Doktor Mantık Açıklamasını Gör", action: "explain" },
    { key: "4", label: "✏️  Editörde Aç (VS Code / Zed)", action: "editor" },
    { key: "5", label: "🧪 Sandbox Ortamında Simüle Et", action: "sandbox" },
    { key: "q", label: "✕ Yoksay ve Kapat", action: "close" },
  ]

  const handleAction = (action: string) => {
    switch (action) {
      case "apply":
        setStatusMessage("Çözüm uygulanıyor ve testler doğrulanıyor...")
        props.onApplyFix?.()
        break
      case "diff":
        setActiveTab("diff")
        break
      case "explain":
        setActiveTab("explanation")
        break
      case "editor":
        setStatusMessage("Dosya editörde açılıyor...")
        props.onOpenEditor?.()
        break
      case "sandbox":
        setStatusMessage("Sandbox simülasyonu başlatıldı...")
        props.onSandboxTest?.()
        break
      case "close":
        props.onClose()
        break
    }
  }

  useKeyboard((e) => {
    if (e.name === "escape" || e.name === "q") {
      if (activeTab() !== "menu") {
        setActiveTab("menu")
      } else {
        props.onClose()
      }
      return
    }

    if (e.name === "up" || e.name === "k") {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1))
      return
    }

    if (e.name === "down" || e.name === "j") {
      setSelectedIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0))
      return
    }

    if (e.name === "return") {
      handleAction(menuItems[selectedIndex()].action)
      return
    }

    const num = parseInt(e.name ?? "", 10)
    if (num >= 1 && num <= 5) {
      setSelectedIndex(num - 1)
      handleAction(menuItems[num - 1].action)
    }
  })

  const confidenceStars = () => {
    const dotsCount = Math.min(5, Math.max(1, Math.round(props.confidence / 20)))
    return "●".repeat(dotsCount) + "○".repeat(5 - dotsCount)
  }

  return (
    <Dialog size="large" onClose={props.onClose}>
      <box
        flexDirection="column"
        backgroundColor={CraftedTheme.bg}
        borderStyle="single"
        borderColor={CraftedTheme.borderFocused}
        padding={1}
        width="100%"
      >
        {/* Header bar */}
        <box
          flexDirection="row"
          justifyContent="space-between"
          backgroundColor={CraftedTheme.bgElevated}
          paddingLeft={1}
          paddingRight={1}
          marginBottom={1}
        >
          <text fg={CraftedTheme.success}>🩺 GLITCH AUTO-DOCTOR v2.1</text>
          <text fg={CraftedTheme.textDim}>[Crafted Minimal TUI]</text>
        </box>

        {/* Diagnostics Info */}
        <box flexDirection="column" paddingLeft={1} paddingRight={1} marginBottom={1}>
          <box flexDirection="row">
            <text attributes={TextAttributes.BOLD} fg={CraftedTheme.danger}>[HATA] </text>
            <text fg={CraftedTheme.text}>{props.issue.substring(0, 65)}</text>
          </box>
          <box flexDirection="row">
            <text attributes={TextAttributes.BOLD} fg={CraftedTheme.warning}>[KÖK NEDEN] </text>
            <text fg={CraftedTheme.textMuted}>{props.rootCause.substring(0, 60)}</text>
          </box>
          <box flexDirection="row">
            <text attributes={TextAttributes.BOLD} fg={CraftedTheme.info}>[GÜVEN] </text>
            <text fg={CraftedTheme.success}>{confidenceStars()} </text>
            <text fg={CraftedTheme.textDim}>
              {`${props.confidence}% (${props.category.toUpperCase()})`}
            </text>
          </box>
        </box>

        {/* Active Tab: Menu */}
        <Show when={activeTab() === "menu"}>
          <box flexDirection="column" backgroundColor={CraftedTheme.bgSubtle} padding={1} marginBottom={1}>
            <text attributes={TextAttributes.BOLD} fg={CraftedTheme.textMuted}>
              ⚡ EYLEM MENÜSÜ:
            </text>
            <For each={menuItems}>
              {(item, i) => {
                const isSelected = () => selectedIndex() === i()
                return (
                  <box
                    flexDirection="row"
                    backgroundColor={isSelected() ? CraftedTheme.borderFocused : RGBA.fromInts(0, 0, 0, 0)}
                    paddingLeft={1}
                  >
                    <text attributes={isSelected() ? TextAttributes.BOLD : undefined} fg={isSelected() ? CraftedTheme.success : CraftedTheme.textDim}>
                      {`[${item.key}] `}
                    </text>
                    <text fg={isSelected() ? CraftedTheme.text : CraftedTheme.textMuted}>{item.label}</text>
                  </box>
                )
              }}
            </For>
          </box>
        </Show>

        {/* Active Tab: Diff View */}
        <Show when={activeTab() === "diff"}>
          <box flexDirection="column" backgroundColor={CraftedTheme.diff.gutterBg} padding={1} marginBottom={1}>
            <text attributes={TextAttributes.BOLD} fg={CraftedTheme.info}>
              {`📄 DIFF İNCELEME (${props.filePath || "Değiştirilen Dosya"}):`}
            </text>
            <box flexDirection="column" marginTop={1}>
              <text fg={CraftedTheme.diff.removedFg}>{`- ${props.diffPreview || "Eski hatalı kod bloğu"}`}</text>
              <text fg={CraftedTheme.diff.addedFg}>{`+ ${(props.diffPreview || "").replace("-", "+") || "Düzeltilmiş optimize kod bloğu"}`}</text>
            </box>
            <box marginTop={1}>
              <text fg={CraftedTheme.textDim}>[Esc/q ile menüye dön]</text>
            </box>
          </box>
        </Show>

        {/* Active Tab: Explanation */}
        <Show when={activeTab() === "explanation"}>
          <box flexDirection="column" backgroundColor={CraftedTheme.bgSubtle} padding={1} marginBottom={1}>
            <text attributes={TextAttributes.BOLD} fg={CraftedTheme.warning}>
              💬 DOKTOR AÇIKLAMASI:
            </text>
            <box marginTop={1}>
              <text fg={CraftedTheme.text}>
                {props.explanation ||
                  "Hata, değişkenin çalışma zamanında beklenmeyen bir tip veya null değer almasından kaynaklandı. Önerilen düzeltme defansif kontroller ekleyerek olası çökmeleri önler."}
              </text>
            </box>
            <box marginTop={1}>
              <text fg={CraftedTheme.textDim}>[Esc/q ile menüye dön]</text>
            </box>
          </box>
        </Show>

        {/* Footer info & Status message */}
        <Show when={statusMessage()}>
          <box backgroundColor={CraftedTheme.bgElevated} paddingLeft={1} marginBottom={1}>
            <text fg={CraftedTheme.warning}>{statusMessage()}</text>
          </box>
        </Show>

        <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
          <text fg={CraftedTheme.textDim}>[↑/↓ Gezin | 1-5 Hızlı Tuş | Enter Onayla]</text>
          <text fg={CraftedTheme.textDim}>[Esc: Çıkış]</text>
        </box>
      </box>
    </Dialog>
  )
}
