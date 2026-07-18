import { useProject } from "@tui/context/project"
import { useSync } from "@tui/context/sync"
import { createMemo, createSignal, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { useTuiConfig } from "../../context/tui-config"
import { InstallationChannel, InstallationVersion } from "@/installation/version"
import { TuiPluginRuntime } from "../../plugin"

import { getScrollAcceleration } from "../../util/scroll"

const SIDEBAR_WIDTH_FULL = 42
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
            <box flexShrink={0} gap={1} paddingRight={1}>
              {/* Session Title */}
              <TuiPluginRuntime.Slot
                name="sidebar_title"
                mode="single_winner"
                session_id={props.sessionID}
                title={session()!.title}
                share_url={session()!.share?.url}
              >
                <box paddingRight={1}>
                  <text fg={theme.primary} selectable={false}>
                    <b>{session()!.title}</b>
                  </text>
                  <Show when={InstallationChannel !== "latest"}>
                    <text fg={theme.textMuted}>{props.sessionID}</text>
                  </Show>
                  <Show when={session()!.workspaceID}>
                    <text fg={theme.textMuted}>
                      <span style={{ fg: workspaceStatus() === "connected" ? theme.success : theme.error }}>●</span>{" "}
                      {workspaceLabel()}
                    </text>
                  </Show>
                  <Show when={session()!.share?.url}>
                    <text fg={theme.textMuted}>{session()!.share!.url}</text>
                  </Show>
                </box>
              </TuiPluginRuntime.Slot>

              {/* Divider with glow */}
              <box flexDirection="row" gap={0}>
                {Array.from({ length: 36 }).map((_, i) => (
                  <text fg={i === 18 ? theme.primary : theme.borderSubtle} selectable={false}>
                    {i === 18 ? "◆" : "─"}
                  </text>
                ))}
              </box>

              {/* Plugin Content */}
              <TuiPluginRuntime.Slot name="sidebar_content" session_id={props.sessionID} />
            </box>
          </scrollbox>

          {/* Footer */}
          <box flexShrink={0} gap={1} paddingTop={1}>
            <TuiPluginRuntime.Slot name="sidebar_footer" mode="single_winner" session_id={props.sessionID}>
              <text fg={theme.textMuted}>
                <span style={{ fg: theme.primary }}>●</span> <b>Glitch</b>
                <span style={{ fg: theme.text }}>
                  <b>Code</b>
                </span>{" "}
                <span>{InstallationVersion}</span>
              </text>
            </TuiPluginRuntime.Slot>
          </box>
        </Show>

        {/* Collapsed mode: show version */}
        <Show when={isCollapsed()}>
          <box flexShrink={0} alignItems="center">
            <text fg={theme.textMuted} selectable={false}>
              <span style={{ fg: theme.primary }}>G</span>
            </text>
          </box>
        </Show>
      </box>
    </Show>
  )
}
