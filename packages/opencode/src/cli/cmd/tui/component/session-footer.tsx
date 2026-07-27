import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useSync } from "@tui/context/sync"
import { useLocal } from "@tui/context/local"
import { NeonPulse } from "./neon-pulse"
import * as Model from "../util/model"
import { Global } from "@/global"

const DIR_FRAMES = ["◧", "◨", "◧", "◨"]

type SessionFooterProps = {
  sessionID: string
}

export function SessionFooter(props: SessionFooterProps) {
  const { theme } = useTheme()
  const sync = useSync()
  const local = useLocal()
  const [dirAnim, setDirAnim] = createSignal(0)

  onMount(() => {
    const interval = setInterval(() => setDirAnim((f) => (f + 1) % DIR_FRAMES.length), 500)
    onCleanup(() => clearInterval(interval))
  })

  const session = createMemo(() => sync.session.get(props.sessionID))
  const providers = createMemo(() => Model.index(sync.data.provider))

  const directory = createMemo(() => {
    const dir = sync.path.directory
    if (!dir) return "~"
    const home = Global.Path.home
    if (home && dir.startsWith(home)) {
      return dir.replace(home, "~")
    }
    return dir
  })

  const status = createMemo(() => {
    const sessionData = session()
    if (!sessionData) return "idle" as const
    const messages = sync.data.message[props.sessionID]?.main ?? []
    const lastAssistant = messages.findLast((m) => m.role === "assistant")
    if (!lastAssistant) return "idle" as const
    if (!lastAssistant.time.completed) return "running" as const
    return "idle" as const
  })

  const statusColor = createMemo(() => {
    switch (status()) {
      case "running":
        return theme.primary
      default:
        return theme.success
    }
  })

  const statusLabel = createMemo(() => {
    switch (status()) {
      case "running":
        return "thinking"
      default:
        return "ready"
    }
  })

  const modelName = createMemo(() => {
    const msgs = sync.data.message[props.sessionID]?.main ?? []
    const lastAssistant = msgs.findLast((m) => m.role === "assistant")
    if (!lastAssistant || lastAssistant.role !== "assistant") return null
    if (!lastAssistant.providerID || !lastAssistant.modelID) return null
    return Model.name(providers(), lastAssistant.providerID, lastAssistant.modelID)
  })

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      paddingLeft={3}
      paddingRight={3}
      paddingTop={1}
      paddingBottom={1}
      flexShrink={0}
      backgroundColor={theme.backgroundPanel}
    >
      {/* Directory */}
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={theme.primary} selectable={false}>
          {DIR_FRAMES[dirAnim()]}
        </text>
        <text fg={theme.textMuted} selectable={false}>
          {directory()}
        </text>
      </box>

      {/* Divider */}
      <text fg={theme.borderSubtle} selectable={false}>│</text>

      {/* Status */}
      <box flexDirection="row" gap={1} alignItems="center">
        <NeonPulse active={status() === "running"} color={theme.primary} />
        <text fg={statusColor()} selectable={false}>
          {statusLabel()}
        </text>
      </box>

      {/* Divider */}
      <text fg={theme.borderSubtle} selectable={false}>│</text>

      {/* Model */}
      <Show when={modelName()}>
        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={theme.accent} selectable={false}>
            ◆
          </text>
          <text fg={theme.textMuted} selectable={false}>
            {modelName()}
          </text>
        </box>
      </Show>
    </box>
  )
}
