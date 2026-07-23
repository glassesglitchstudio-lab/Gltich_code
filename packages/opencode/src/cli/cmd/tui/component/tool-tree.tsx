import { createMemo, createSignal, For, Show, type JSX } from "solid-js"
import { useTheme } from "../context/theme"

type ToolTreeNode = {
  id: string
  label: string
  icon?: string
  status?: "running" | "complete" | "error" | "pending"
  children?: ToolTreeNode[]
  metadata?: Record<string, any>
}

type ToolTreeProps = {
  nodes: ToolTreeNode[]
  maxDepth?: number
}

export function ToolTree(props: ToolTreeProps) {
  const { theme } = useTheme()
  const maxDepth = () => props.maxDepth ?? 3

  return (
    <box flexDirection="column" gap={0}>
      <For each={props.nodes}>
        {(node) => (
          <ToolTreeNodeComponent
            node={node}
            depth={0}
            maxDepth={maxDepth()}
            isLast={false}
          />
        )}
      </For>
    </box>
  )
}

function ToolTreeNodeComponent(props: {
  node: ToolTreeNode
  depth: number
  maxDepth: number
  isLast: boolean
}) {
  const { theme } = useTheme()
  const [expanded, setExpanded] = createSignal(props.depth < 2)
  const hasChildren = createMemo(() => props.node.children && props.node.children.length > 0)

  const statusColor = createMemo(() => {
    switch (props.node.status) {
      case "running": return theme.primary
      case "complete": return theme.success
      case "error": return theme.error
      case "pending": return theme.warning
      default: return theme.textMuted
    }
  })

  const statusIcon = createMemo(() => {
    switch (props.node.status) {
      case "running": return "⟳"
      case "complete": return "✓"
      case "error": return "✗"
      case "pending": return "○"
      default: return "·"
    }
  })

  const prefix = createMemo(() => {
    if (props.depth === 0) return ""
    return props.isLast ? "└─ " : "├─ "
  })

  const indent = createMemo(() => {
    return "  ".repeat(props.depth)
  })

  return (
    <box flexDirection="column" gap={0}>
      {/* Node content */}
      <box
        flexDirection="row"
        gap={1}
        paddingLeft={props.depth * 2}
        onMouseUp={hasChildren() ? () => setExpanded((prev) => !prev) : undefined}
      >
        {/* Expand/collapse indicator */}
        <Show when={hasChildren()}>
          <text fg={theme.textMuted} selectable={false}>
            {expanded() ? "▼" : "▶"}
          </text>
        </Show>
        <Show when={!hasChildren()}>
          <text fg={theme.textMuted} selectable={false}>
            {prefix()}
          </text>
        </Show>

        {/* Status icon */}
        <text fg={statusColor()} selectable={false}>
          {props.node.icon ?? statusIcon()}
        </text>

        {/* Label */}
        <text fg={theme.text} selectable={false}>
          {props.node.label}
        </text>

        {/* Metadata badge */}
        <Show when={props.node.metadata?.badge}>
          <text fg={theme.textMuted} selectable={false}>
            [{props.node.metadata!.badge}]
          </text>
        </Show>
      </box>

      {/* Children */}
      <Show when={expanded() && hasChildren()}>
        <For each={props.node.children!}>
          {(child, index) => (
            <ToolTreeNodeComponent
              node={child}
              depth={props.depth + 1}
              maxDepth={props.maxDepth}
              isLast={index() === props.node.children!.length - 1}
            />
          )}
        </For>
      </Show>
    </box>
  )
}

export function ToolTreeFromParts(props: {
  parts: Array<{
    tool: string
    status: string
    input?: Record<string, any>
    output?: string
  }>
}) {
  const { theme } = useTheme()

  const nodes = createMemo(() => {
    return props.parts.map((part, index) => ({
      id: `tool-${index}`,
      label: `${part.tool} ${formatInput(part.input)}`,
      icon: getToolIcon(part.tool),
      status: part.status as ToolTreeNode["status"],
      metadata: part.output ? { badge: "output" } : undefined,
    }))
  })

  return <ToolTree nodes={nodes()} />
}

function formatInput(input?: Record<string, any>): string {
  if (!input) return ""
  const entries = Object.entries(input)
    .filter(([_, value]) => typeof value === "string" || typeof value === "number")
    .slice(0, 2)
  if (entries.length === 0) return ""
  return entries.map(([key, value]) => `${key}=${value}`).join(" ")
}

function getToolIcon(tool: string): string {
  const icons: Record<string, string> = {
    bash: "$",
    read: "→",
    write: "←",
    edit: "✎",
    glob: "✱",
    grep: "⌕",
    webfetch: "%",
    actor: "│",
    task: "#",
    skill: "→",
  }
  return icons[tool] ?? "⚙"
}
