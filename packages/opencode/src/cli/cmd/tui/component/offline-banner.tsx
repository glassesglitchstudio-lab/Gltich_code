import { createMemo, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useConnected } from "./dialog-model"
import { useLocal } from "../context/local"

export function OfflineBanner() {
  const { theme } = useTheme()
  const connected = useConnected()
  const local = useLocal()

  const statusText = createMemo(() => {
    if (connected()) {
      const model = local.model.parsed()
      return `Connected: ${model.provider} / ${model.model}`
    }
    return "Offline Mode — Using local models"
  })

  const statusColor = createMemo(() => {
    return connected() ? theme.success : theme.warning
  })

  const statusIcon = createMemo(() => {
    return connected() ? "●" : "○"
  })

  return (
    <Show when={!connected()}>
      <box
        flexDirection="row"
        justifyContent="center"
        alignItems="center"
        gap={1}
        backgroundColor={theme.backgroundPanel}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={0}
        paddingBottom={0}
        flexShrink={0}
      >
        <text fg={statusColor()} selectable={false}>
          {statusIcon()}
        </text>
        <text fg={statusColor()} selectable={false}>
          <b>{statusText()}</b>
        </text>
      </box>
    </Show>
  )
}
