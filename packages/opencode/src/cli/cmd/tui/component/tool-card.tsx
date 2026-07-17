import { Show, type JSX } from "solid-js"
import { useTheme } from "../context/theme"

type ToolCardProps = {
  title: string
  icon?: string
  duration?: string
  status?: "running" | "complete" | "error"
  children: JSX.Element
}

export function ToolCard(props: ToolCardProps) {
  const { theme } = useTheme()

  const statusColor = () => {
    switch (props.status) {
      case "running":
        return theme.primary
      case "complete":
        return theme.success
      case "error":
        return theme.error
      default:
        return theme.textMuted
    }
  }

  const statusIcon = () => {
    switch (props.status) {
      case "running":
        return "⟳"
      case "complete":
        return "✓"
      case "error":
        return "✗"
      default:
        return "○"
    }
  }

  return (
    <box
      border={["left"]}
      borderColor={statusColor()}
      paddingLeft={1}
      gap={0}
    >
      {/* Header */}
      <box flexDirection="row" gap={1}>
        <text fg={statusColor()} selectable={false}>
          {props.icon ?? "◆"}
        </text>
        <text fg={theme.text} selectable={false}>
          <b>{props.title}</b>
        </text>
        <Show when={props.duration}>
          <text fg={theme.textMuted} selectable={false}>
            ({props.duration})
          </text>
        </Show>
        <text fg={statusColor()} selectable={false}>
          {statusIcon()}
        </text>
      </box>

      {/* Content */}
      <box paddingLeft={2}>
        {props.children}
      </box>
    </box>
  )
}

export function InlineToolCard(props: { title: string; icon?: string; children: JSX.Element }) {
  const { theme } = useTheme()

  return (
    <box flexDirection="row" gap={1}>
      <text fg={theme.primary} selectable={false}>
        {props.icon ?? "→"}
      </text>
      <text fg={theme.textMuted} selectable={false}>
        {props.title}
      </text>
      <text fg={theme.text} selectable={false}>
        {props.children}
      </text>
    </box>
  )
}
