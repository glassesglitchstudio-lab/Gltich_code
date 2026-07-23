import { createMemo, createSignal, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { useSync } from "../../context/sync"
import { useLocal } from "../../context/local"
import { useSDK } from "../../context/sdk"
import * as Model from "../../util/model"

export function StatusDashboard(props: { session_id: string }) {
  const { theme } = useTheme()
  const sync = useSync()
  const local = useLocal()
  const sdk = useSDK()
  const [tokenUsage, setTokenUsage] = createSignal({ input: 0, output: 0 })

  const session = createMemo(() => sync.session.get(props.session_id))
  const currentModel = createMemo(() => local.model.current())
  const currentAgent = createMemo(() => local.agent.current())
  const providers = createMemo(() => Model.index(sync.data.provider))

  const modelName = createMemo(() => {
    const model = currentModel()
    if (!model) return "No model"
    return Model.name(providers(), model.providerID, model.modelID)
  })

  const agentColor = createMemo(() => {
    const agent = currentAgent()
    if (!agent) return theme.textMuted
    return local.agent.color(agent.name)
  })

  const sessionStatus = createMemo(() => {
    const status = sync.data.session_status?.[props.session_id]
    if (!status) return "idle"
    return status.type
  })

  const statusIcon = createMemo(() => {
    switch (sessionStatus()) {
      case "busy": return "▶"
      case "idle": return "●"
      case "retry": return "⟳"
      default: return "○"
    }
  })

  const statusColor = createMemo(() => {
    switch (sessionStatus()) {
      case "busy": return theme.primary
      case "idle": return theme.success
      case "retry": return theme.warning
      default: return theme.textMuted
    }
  })

  return (
    <box flexDirection="column" gap={1}>
      {/* Model Status */}
      <box flexDirection="column" gap={0}>
        <text fg={theme.textMuted} selectable={false}>
          Model
        </text>
        <box flexDirection="row" gap={1}>
          <text fg={statusColor()} selectable={false}>
            {statusIcon()}
          </text>
          <text fg={theme.text} selectable={false}>
            {modelName()}
          </text>
        </box>
      </box>

      {/* Active Agent */}
      <box flexDirection="column" gap={0}>
        <text fg={theme.textMuted} selectable={false}>
          Agent
        </text>
        <box flexDirection="row" gap={1}>
          <text fg={agentColor()} selectable={false}>
            ◆
          </text>
          <text fg={theme.text} selectable={false}>
            {currentAgent()?.name ?? "build"}
          </text>
        </box>
      </box>

      {/* Session Info */}
      <box flexDirection="column" gap={0}>
        <text fg={theme.textMuted} selectable={false}>
          Session
        </text>
        <text fg={theme.text} selectable={false}>
          {session()?.title ?? "Untitled"}
        </text>
      </box>

      {/* Divider */}
      <box flexDirection="row" gap={0}>
        {Array.from({ length: 36 }).map((_, i) => (
          <text fg={theme.borderSubtle} selectable={false}>
            {i === 18 ? "◆" : "─"}
          </text>
        ))}
      </box>

      {/* Quick Stats */}
      <box flexDirection="column" gap={0}>
        <text fg={theme.textMuted} selectable={false}>
          Messages
        </text>
        <text fg={theme.text} selectable={false}>
          {sync.data.message[props.session_id]?.["main"]?.length ?? 0}
        </text>
      </box>
    </box>
  )
}
