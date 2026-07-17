import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@glitchcode/plugin/tui"
import { createMemo, Show } from "solid-js"

const id = "internal:ollama-status"

function View(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current

  const isOffline = createMemo(() => {
    return !props.api.state.provider.some(
      (item) => item.id !== "opencode" || Object.values(item.models).some((model) => model.cost?.input !== 0),
    )
  })

  return (
    <Show when={isOffline()}>
      <box
        backgroundColor={theme().backgroundElement}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        gap={1}
      >
        <box flexDirection="row" gap={1}>
          <text fg={theme().primary} selectable={false}>
            ◆
          </text>
          <text fg={theme().text} selectable={false}>
            <b>Ollama</b>
          </text>
          <text fg={theme().success} selectable={false}>
            ● Ready
          </text>
        </box>
        <text fg={theme().textMuted} selectable={false}>
          Local models available
        </text>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 50,
    slots: {
      sidebar_content() {
        return <View api={api} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
