import { Show, type JSX } from "solid-js"
import { useTheme } from "../context/theme"

type MessageCardProps = {
  role: "user" | "assistant" | "system"
  timestamp?: string
  children: JSX.Element
}

export function MessageCard(props: MessageCardProps) {
  const { theme } = useTheme()

  const roleColor = () => {
    switch (props.role) {
      case "user":
        return theme.info
      case "assistant":
        return theme.primary
      case "system":
        return theme.warning
      default:
        return theme.textMuted
    }
  }

  const roleLabel = () => {
    switch (props.role) {
      case "user":
        return "You"
      case "assistant":
        return "Glitch"
      case "system":
        return "System"
      default:
        return ""
    }
  }

  const roleIcon = () => {
    switch (props.role) {
      case "user":
        return "▸"
      case "assistant":
        return "◆"
      case "system":
        return "△"
      default:
        return "○"
    }
  }

  return (
    <box
      border={["left"]}
      borderColor={roleColor()}
      paddingLeft={1}
      gap={0}
    >
      {/* Header */}
      <box flexDirection="row" gap={1}>
        <text fg={roleColor()} selectable={false}>
          {roleIcon()}
        </text>
        <text fg={roleColor()} selectable={false}>
          <b>{roleLabel()}</b>
        </text>
        <Show when={props.timestamp}>
          <text fg={theme.textMuted} selectable={false}>
            {props.timestamp}
          </text>
        </Show>
      </box>

      {/* Content */}
      <box paddingLeft={1}>
        {props.children}
      </box>
    </box>
  )
}
