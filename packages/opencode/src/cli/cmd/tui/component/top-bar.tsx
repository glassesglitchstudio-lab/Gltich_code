import { createMemo, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useSync } from "../context/sync"
import { useLocal } from "../context/local"
import { InstallationVersion } from "@/installation/version"

export function TopBar(props: { sessionID?: string }) {
  const { theme } = useTheme()
  const sync = useSync()
  const local = useLocal()

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

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      backgroundColor={theme.backgroundPanel}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={0}
      paddingBottom={0}
      flexShrink={0}
    >
      {/* Left: Logo */}
      <box flexDirection="row" gap={1}>
        <text fg={theme.primary} selectable={false}>
          <b>GLITCH</b>
        </text>
        <text fg={theme.textMuted} selectable={false}>
          Code
        </text>
      </box>

      {/* Center: Model & Agent */}
      <box flexDirection="row" gap={2}>
        <text fg={theme.textMuted} selectable={false}>
          <span style={{ fg: theme.primary }}>●</span> {modelName()}
        </text>
        <text fg={theme.textMuted} selectable={false}>
          <span style={{ fg: theme.secondary }}>◆</span> {agentName()}
        </text>
      </box>

      {/* Right: Status */}
      <box flexDirection="row" gap={2}>
        <Show when={lspCount() > 0}>
          <text fg={theme.textMuted} selectable={false}>
            <span style={{ fg: theme.success }}>•</span> {lspCount()} LSP
          </text>
        </Show>
        <Show when={mcpCount() > 0}>
          <text fg={theme.textMuted} selectable={false}>
            <span style={{ fg: theme.success }}>⊙</span> {mcpCount()} MCP
          </text>
        </Show>
        <text fg={theme.textMuted} selectable={false}>
          v{InstallationVersion}
        </text>
      </box>
    </box>
  )
}
