import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useSync } from "../context/sync"
import { useLocal } from "../context/local"
import { InstallationVersion } from "@/installation/version"
import { RGBA } from "@opentui/core"

const STATUS_FRAMES = ["◴", "◷", "◶", "◵"]

export function TopBar(props: { sessionID?: string }) {
  const { theme } = useTheme()
  const sync = useSync()
  const local = useLocal()
  const [statusFrame, setStatusFrame] = createSignal(0)

  onMount(() => {
    const interval = setInterval(() => setStatusFrame((f) => (f + 1) % STATUS_FRAMES.length), 400)
    onCleanup(() => clearInterval(interval))
  })

  const modelName = createMemo(() => {
    const parsed = local.model.parsed()
    return parsed.model
  })

  const agentName = createMemo(() => {
    const agent = local.agent.current()
    return agent?.name ?? "build"
  })

  const mcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

  const lspCount = createMemo(() => {
    return Object.keys(sync.data.lsp).length
  })

  const isConnected = createMemo(() => {
    return local.model.ready && !!local.model.parsed()
  })

  const connectionColor = createMemo(() => {
    return isConnected() ? theme.success : theme.error
  })

  return (
    <box
      flexDirection="column"
      flexShrink={0}
    >
      {/* Neon accent line */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexShrink={0} />

      {/* Main topbar */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        backgroundColor={theme.backgroundPanel}
        paddingLeft={3}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        flexShrink={0}
      >
        {/* Left: Logo */}
        <box flexDirection="row" gap={2} alignItems="center">
          <text fg={theme.primary} selectable={false}>
            ◆
          </text>
          <box flexDirection="row" gap={0}>
            <text fg={theme.primary} selectable={false}>
              <b>GLITCH</b>
            </text>
            <text fg={theme.textMuted} selectable={false}>
              Code
            </text>
          </box>
          <text fg={theme.borderSubtle} selectable={false}>
            ─
          </text>
        </box>

        {/* Center: Model & Agent */}
        <box flexDirection="row" gap={3} alignItems="center">
          <box flexDirection="row" gap={1} alignItems="center">
            <text fg={connectionColor()} selectable={false}>
              ●
            </text>
            <text fg={theme.text} selectable={false}>
              {modelName()}
            </text>
          </box>
          <box flexDirection="row" gap={1} alignItems="center">
            <text fg={theme.accent} selectable={false}>
              ◆
            </text>
            <text fg={theme.textMuted} selectable={false}>
              {agentName()}
            </text>
          </box>
        </box>

        {/* Right: Status */}
        <box flexDirection="row" gap={3} alignItems="center">
          <Show when={lspCount() > 0}>
            <text fg={theme.textMuted} selectable={false}>
              <span style={{ fg: theme.success }}>●</span> {lspCount()} LSP
            </text>
          </Show>
          <Show when={mcpCount() > 0}>
            <text fg={theme.textMuted} selectable={false}>
              <span style={{ fg: theme.info }}>◎</span> {mcpCount()} MCP
            </text>
          </Show>
          <text fg={theme.textMuted} selectable={false}>
            <span style={{ fg: theme.primary }}>{STATUS_FRAMES[statusFrame()]}</span> v{InstallationVersion}
          </text>
        </box>
      </box>
    </box>
  )
}
