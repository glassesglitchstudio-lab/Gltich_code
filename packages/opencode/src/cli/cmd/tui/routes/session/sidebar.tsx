import { useProject } from "@tui/context/project"
import { useSync } from "@tui/context/sync"
import { createMemo, createSignal, Show, For } from "solid-js"
import { useTheme } from "../../context/theme"
import { useTuiConfig } from "../../context/tui-config"
import { InstallationChannel, InstallationVersion } from "@/installation/version"
import { TuiPluginRuntime } from "../../plugin"
import { getScrollAcceleration } from "../../util/scroll"

const SIDEBAR_WIDTH_FULL = 44
const SIDEBAR_WIDTH_COLLAPSED = 6

export function Sidebar(props: { sessionID: string; overlay?: boolean; collapsed?: boolean; onToggleCollapse?: () => void }) {
  const project = useProject()
  const sync = useSync()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const session = createMemo(() => sync.session.get(props.sessionID))
  const [hovered, setHovered] = createSignal(false)
  const [toggleHovered, setToggleHovered] = createSignal(false)

  const isCollapsed = () => props.collapsed ?? false
  const sidebarWidth = () => (isCollapsed() ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_FULL)

  const workspaceStatus = () => {
    const workspaceID = session()?.workspaceID
    if (!workspaceID) return "error"
    return project.workspace.status(workspaceID) ?? "error"
  }
  const workspaceLabel = () => {
    const workspaceID = session()?.workspaceID
    if (!workspaceID) return "unknown"
    const info = project.workspace.get(workspaceID)
    if (!info) return "unknown"
    return `${info.type}: ${info.name}`
  }
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  const messageCount = createMemo(() => {
    return sync.data.message[props.sessionID]?.main?.length ?? 0
  })

  const tokenEstimate = createMemo(() => {
    const msgs = sync.data.message[props.sessionID]?.main ?? []
    let total = 0
    for (const m of msgs) {
      const parts = sync.data.part[m.id]
      if (parts) {
        for (const p of parts) {
          if (p.type === "text") total += p.text.length
        }
      }
    }
    return total
  })

  return (
    <Show when={session()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={sidebarWidth()}
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={isCollapsed() ? 1 : 2}
        paddingRight={isCollapsed() ? 0 : 2}
        position={props.overlay ? "absolute" : "relative"}
        border={["left"]}
        borderColor={hovered() || toggleHovered() ? theme.primary : theme.borderSubtle}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
      >
        {/* Collapse/Expand toggle */}
        <box
          flexShrink={0}
          flexDirection="row"
          justifyContent={isCollapsed() ? "center" : "flex-end"}
          paddingBottom={1}
          onMouseOver={() => setToggleHovered(true)}
          onMouseOut={() => setToggleHovered(false)}
          onMouseUp={() => props.onToggleCollapse?.()}
        >
          <text fg={toggleHovered() ? theme.primary : theme.textMuted} selectable={false}>
            {isCollapsed() ? "▶" : "◀"}
          </text>
        </box>

        <Show when={!isCollapsed()}>
          <scrollbox
            flexGrow={1}
            scrollAcceleration={scrollAcceleration()}
            verticalScrollbarOptions={{
              trackOptions: {
                backgroundColor: theme.background,
                foregroundColor: theme.borderActive,
              },
            }}
          >
            <box flexShrink={0} gap={2} paddingRight={1}>
              {/* Session Header */}
              <TuiPluginRuntime.Slot
                name="sidebar_title"
                mode="single_winner"
                session_id={props.sessionID}
                title={session()!.title}
                share_url={session()!.share?.url}
              >
                <box paddingRight={1} gap={1}>
                  <text fg={theme.primary} selectable={false}>
                    <b>◆ {session()!.title}</b>
                  </text>
                  <Show when={InstallationChannel !== "latest"}>
                    <text fg={theme.textMuted} selectable={false}>
                      {props.sessionID}
                    </text>
                  </Show>
                </box>
              </TuiPluginRuntime.Slot>

              {/* Workspace Status */}
              <Show when={session()!.workspaceID}>
                <box gap={1}>
                  <text fg={theme.textMuted} selectable={false}>
                    workspace
                  </text>
                  <text
                    fg={workspaceStatus() === "connected" ? theme.success : theme.error}
                    selectable={false}
                  >
                    ● {workspaceLabel()}
                  </text>
                </box>
              </Show>

              {/* Stats */}
              <box gap={1}>
                <text fg={theme.textMuted} selectable={false}>
                  stats
                </text>
                <box flexDirection="row" gap={2} paddingLeft={2}>
                  <text fg={theme.text} selectable={false}>
                    <span style={{ fg: theme.primary }}>{messageCount()}</span> msgs
                  </text>
                  <text fg={theme.text} selectable={false}>
                    ~<span style={{ fg: theme.accent }}>{(tokenEstimate() / 4).toFixed(0)}</span> tok
                  </text>
                </box>
              </box>

              {/* Version info */}
              <box gap={1}>
                <text fg={theme.textMuted} selectable={false}>
                  version
                </text>
                <text fg={theme.text} selectable={false}>
                  v{InstallationVersion}
                </text>
              </box>

              {/* Plugin slots */}
              <TuiPluginRuntime.Slot
                name="sidebar_content"
                session_id={props.sessionID}
              />

              {/* Bottom spacer */}
              <box flexGrow={1} />
            </box>
          </scrollbox>
        </Show>
      </box>
    </Show>
  )
}
