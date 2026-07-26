import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { RGBA } from "@opentui/core"

const PULSE_CHARS = ["◐", "◑", "◒", "◓", "◔", "◕", "●"]
const PULSE_INTERVAL = 80

export function NeonPulse(props: { active: boolean; color?: RGBA }) {
  const { theme } = useTheme()
  const [frame, setFrame] = createSignal(0)
  const [colorFrame, setColorFrame] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined
  let colorInterval: ReturnType<typeof setInterval> | undefined

  const color = () => props.color ?? theme.primary

  onMount(() => {
    if (props.active) {
      interval = setInterval(() => {
        setFrame((f) => (f + 1) % PULSE_CHARS.length)
      }, PULSE_INTERVAL)
      colorInterval = setInterval(() => {
        setColorFrame((f) => (f + 1) % 4)
      }, 400)
    }
  })

  createEffect(() => {
    if (props.active && !interval) {
      interval = setInterval(() => {
        setFrame((f) => (f + 1) % PULSE_CHARS.length)
      }, PULSE_INTERVAL)
      colorInterval = setInterval(() => {
        setColorFrame((f) => (f + 1) % 4)
      }, 400)
    } else if (!props.active && interval) {
      if (interval) clearInterval(interval)
      if (colorInterval) clearInterval(colorInterval)
      interval = undefined
      colorInterval = undefined
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
    if (colorInterval) clearInterval(colorInterval)
  })

  const pulseColor = () => {
    const base = color()
    const cf = colorFrame()
    const mix = cf === 0 ? 1.0 : cf === 1 ? 0.7 : cf === 2 ? 1.0 : 0.85
    return RGBA.fromValues(
      Math.min(255, Math.round(base.r * mix)),
      Math.min(255, Math.round(base.g * mix)),
      Math.min(255, Math.round(base.b * mix)),
      base.a,
    )
  }

  return (
    <Show when={props.active}>
      <text fg={pulseColor()} selectable={false}>
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
