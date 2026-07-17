import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { Spinner } from "./spinner"
import { isPlainTerminal } from "../util/terminal"

const GLITCH_LOGO = [
  "  ██████╗ ██╗  ██╗ ██████╗ ███████╗",
  " ██╔════╝ ██║  ██║ ██╔══██╗ ██╔════╝",
  " ██║      ███████║ ██║  ██║ █████╗  ",
  " ██║      ██╔══██║ ██║  ██║ ██╔══╝  ",
  " ╚██████╗ ██║  ██║ ██████╔╝ ███████╗",
  "  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══════╝",
]

export function StartupLoading(props: { ready: () => boolean }) {
  const theme = useTheme().theme
  const plainTerminal = isPlainTerminal()
  const [show, setShow] = createSignal(false)
  const [step, setStep] = createSignal(0)
  const text = createMemo(() => {
    const s = step()
    if (props.ready()) return "Ready!"
    if (s === 0) return "Initializing Glitch Code..."
    if (s === 1) return "Loading plugins..."
    if (s === 2) return "Connecting to provider..."
    return "Finishing startup..."
  })
  let wait: NodeJS.Timeout | undefined
  let hold: NodeJS.Timeout | undefined
  let stepTimer: NodeJS.Timeout | undefined
  let stamp = 0

  createEffect(() => {
    if (props.ready()) {
      if (wait) {
        clearTimeout(wait)
        wait = undefined
      }
      if (!show()) return
      if (hold) return

      const left = 2000 - (Date.now() - stamp)
      if (left <= 0) {
        setShow(false)
        return
      }

      hold = setTimeout(() => {
        hold = undefined
        setShow(false)
      }, left).unref()
      return
    }

    if (hold) {
      clearTimeout(hold)
      hold = undefined
    }
    if (show()) return
    if (wait) return

    wait = setTimeout(() => {
      wait = undefined
      stamp = Date.now()
      setShow(true)
    }, 500).unref()
  })

  // Step through loading messages
  createEffect(() => {
    if (show() && !props.ready()) {
      stepTimer = setInterval(() => {
        setStep((s) => Math.min(s + 1, 3))
      }, 800).unref()
    }
  })

  onCleanup(() => {
    if (wait) clearTimeout(wait)
    if (hold) clearTimeout(hold)
    if (stepTimer) clearInterval(stepTimer)
  })

  return (
    <Show when={show()}>
      <box
        position="absolute"
        zIndex={5000}
        left={0}
        right={0}
        top={0}
        bottom={0}
        justifyContent="center"
        alignItems="center"
        flexDirection="column"
      >
        <box
          backgroundColor={plainTerminal ? undefined : theme.backgroundPanel}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          alignItems="center"
          gap={0}
        >
          {/* Glitch Code ASCII Logo */}
          <Show when={!plainTerminal}>
            {GLITCH_LOGO.map((line) => (
              <text fg={theme.primary} selectable={false}>
                {line}
              </text>
            ))}
          </Show>

          {/* Loading status */}
          <box marginTop={1}>
            <Show
              when={plainTerminal}
              fallback={
                <box flexDirection="row" gap={1}>
                  <Spinner color={theme.primary}>{text()}</Spinner>
                </box>
              }
            >
              <text fg={theme.textMuted}>{text()}</text>
            </Show>
          </box>
        </box>
      </box>
    </Show>
  )
}
