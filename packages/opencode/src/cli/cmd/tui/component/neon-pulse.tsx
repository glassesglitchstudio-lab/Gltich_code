import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import type { RGBA } from "@opentui/core"

const PULSE_CHARS = ["◐", "◑", "◒", "◓", "◔", "◕", "●"]
const PULSE_INTERVAL = 100

export function NeonPulse(props: { active: boolean; color?: RGBA }) {
  const { theme } = useTheme()
  const [frame, setFrame] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined

  const color = () => props.color ?? theme.primary

  onMount(() => {
    if (props.active) {
      interval = setInterval(() => {
        setFrame((f) => (f + 1) % PULSE_CHARS.length)
      }, PULSE_INTERVAL)
    }
  })

  createEffect(() => {
    if (props.active && !interval) {
      interval = setInterval(() => {
        setFrame((f) => (f + 1) % PULSE_CHARS.length)
      }, PULSE_INTERVAL)
    } else if (!props.active && interval) {
      clearInterval(interval)
      interval = undefined
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
  })

  return (
    <Show when={props.active}>
      <text fg={color()} selectable={false}>
        {PULSE_CHARS[frame()]}
      </text>
    </Show>
  )
}

export function NeonDots(props: { active: boolean; count?: number }) {
  const { theme } = useTheme()
  const [frame, setFrame] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined

  const count = () => props.count ?? 3

  createEffect(() => {
    if (props.active && !interval) {
      interval = setInterval(() => {
        setFrame((f) => (f + 1) % (count() + 1))
      }, PULSE_INTERVAL)
    } else if (!props.active && interval) {
      clearInterval(interval)
      interval = undefined
      setFrame(0)
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
  })

  return (
    <Show when={props.active}>
      <text fg={theme.primary} selectable={false}>
        {".".repeat(frame())}
      </text>
    </Show>
  )
}
