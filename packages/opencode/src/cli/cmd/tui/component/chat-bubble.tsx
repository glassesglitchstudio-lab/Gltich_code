import { Show, type JSX, createMemo } from "solid-js"
import { useTheme } from "../context/theme"
import { Locale } from "@/util"

type ChatBubbleProps = {
  role: "user" | "assistant" | "system"
  timestamp?: number
  isStreaming?: boolean
  model?: string
  agent?: string
  children: JSX.Element
}

export function ChatBubble(props: ChatBubbleProps) {
  const { theme } = useTheme()

  const roleColor = createMemo(() => {
    switch (props.role) {
      case "user": return theme.info
      case "assistant": return theme.primary
      case "system": return theme.warning
      default: return theme.textMuted
    }
  })

  const roleLabel = createMemo(() => {
    switch (props.role) {
      case "user": return "You"
      case "assistant": return "Glitch"
      case "system": return "System"
      default: return ""
    }
  })

  const roleIcon = createMemo(() => {
    switch (props.role) {
      case "user": return "▸"
      case "assistant": return "◆"
      case "system": return "△"
      default: return "○"
    }
  })

  const avatarBg = createMemo(() => {
    switch (props.role) {
      case "user": return theme.info
      case "assistant": return theme.primary
      case "system": return theme.warning
      default: return theme.textMuted
    }
  })

  const timeStr = createMemo(() => {
    if (!props.timestamp) return ""
    return Locale.todayTimeOrDateTime(props.timestamp)
  })

  return (
    <box
      border={["left"]}
      borderColor={roleColor()}
      paddingLeft={1}
      gap={0}
    >
      {/* Header with avatar and timestamp */}
      <box flexDirection="row" gap={1} alignItems="center">
        {/* Avatar */}
        <text
          fg={theme.background}
          selectable={false}
        >
          <span style={{ bg: avatarBg(), fg: theme.background }}> {roleIcon()} </span>
        </text>

        {/* Role label */}
        <text fg={roleColor()} selectable={false}>
          <b>{roleLabel()}</b>
        </text>

        {/* Model info for assistant */}
        <Show when={props.role === "assistant" && props.model}>
          <text fg={theme.textMuted} selectable={false}>
            · {props.model}
          </text>
        </Show>

        {/* Agent info */}
        <Show when={props.agent && props.agent !== "build"}>
          <text fg={theme.textMuted} selectable={false}>
            · {props.agent}
          </text>
        </Show>

        {/* Timestamp */}
        <Show when={timeStr()}>
          <text fg={theme.textMuted} selectable={false}>
            {timeStr()}
          </text>
        </Show>

        {/* Streaming indicator */}
        <Show when={props.isStreaming}>
          <text fg={theme.primary} selectable={false}>
            ◌
          </text>
        </Show>
      </box>

      {/* Content */}
      <box paddingLeft={2}>
        {props.children}
      </box>
    </box>
  )
}

export function TypingIndicator() {
  const { theme } = useTheme()

  return (
    <box flexDirection="row" gap={1} paddingLeft={3}>
      <text fg={theme.primary} selectable={false}>
        ◆
      </text>
      <text fg={theme.textMuted} selectable={false}>
        Glitch is thinking
      </text>
      <text fg={theme.primary} selectable={false}>
        ⠋
      </text>
    </box>
  )
}
