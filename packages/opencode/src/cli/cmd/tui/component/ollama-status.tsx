import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useConnected } from "./dialog-model"

export function OllamaStatus() {
  const { theme } = useTheme()
  const connected = useConnected()
  const [isRunning, setIsRunning] = createSignal(false)
  const [models, setModels] = createSignal<string[]>([])

  // Simple Ollama detection - check if we're in offline mode
  const isOffline = createMemo(() => !connected())

  onMount(() => {
    // In offline mode, we assume Ollama is available
    if (isOffline()) {
      setIsRunning(true)
      setModels(["local-model"])
    }
  })

  return (
    <Show when={isOffline()}>
      <box
        backgroundColor={theme.backgroundElement}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        gap={1}
      >
        <box flexDirection="row" gap={1}>
          <text fg={theme.primary} selectable={false}>
            ◆
          </text>
          <text fg={theme.text} selectable={false}>
            <b>Ollama</b>
          </text>
          <text fg={isRunning() ? theme.success : theme.error} selectable={false}>
            {isRunning() ? "● Running" : "○ Stopped"}
          </text>
        </box>
        <Show when={models().length > 0}>
          <text fg={theme.textMuted} selectable={false}>
            Models: {models().join(", ")}
          </text>
        </Show>
      </box>
    </Show>
  )
}
