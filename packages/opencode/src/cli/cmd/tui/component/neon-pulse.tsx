import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { RGBA } from "@opentui/core"

const PULSE_CHARS = ["◐", "◑", "◒", "◓", "◔", "◕", "●"]
const PULSE_INTERVAL = 100
const GLOW_CHARS = ["·", "∘", "○", "◌", "◍", "◎", "●"]

export function NeonPulse(props: { active: boolean; color?: RGBA; glow?: boolean }) {
  const { theme } = useTheme()
  const [frame, setFrame] = createSignal(0)
  const [colorFrame, setColorFrame] = createSignal(0)
  const [glowFrame, setGlowFrame] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined
  let colorInterval: ReturnType<typeof setInterval> | undefined
  let glowInterval: ReturnType<typeof setInterval> | undefined

  const color = () => props.color ?? theme.primary

  onMount(() => {
    if (props.active) {
      interval = setInterval(() => {
        setFrame((f) => (f + 1) % PULSE_CHARS.length)
      }, PULSE_INTERVAL)
      colorInterval = setInterval(() => {
        setColorFrame((f) => (f + 1) % 5)
      }, 300)
      if (props.glow) {
        glowInterval = setInterval(() => {
          setGlowFrame((f) => (f + 1) % GLOW_CHARS.length)
        }, 120)
      }
    }
  })

  createEffect(() => {
    if (props.active && !interval) {
      interval = setInterval(() => setFrame((f) => (f + 1) % PULSE_CHARS.length), PULSE_INTERVAL)
      colorInterval = setInterval(() => setColorFrame((f) => (f + 1) % 5), 300)
      if (props.glow) glowInterval = setInterval(() => setGlowFrame((f) => (f + 1) % GLOW_CHARS.length), 120)
    } else if (!props.active && interval) {
      clearInterval(interval); interval = undefined
      if (colorInterval) { clearInterval(colorInterval); colorInterval = undefined }
      if (glowInterval) { clearInterval(glowInterval); glowInterval = undefined }
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
    if (colorInterval) clearInterval(colorInterval)
    if (glowInterval) clearInterval(glowInterval)
  })

  const pulseColor = () => {
    const base = color()
    const cf = colorFrame()
    const brightness = [1.0, 0.65, 1.0, 0.8, 0.9][cf]
    return RGBA.fromValues(
      Math.min(255, Math.round(base.r * brightness)),
      Math.min(255, Math.round(base.g * brightness)),
      Math.min(255, Math.round(base.b * brightness)),
      base.a,
    )
  }

  const glowColor = () => {
    const base = color()
    const gf = glowFrame()
    const alpha = [0.3, 0.5, 0.7, 1.0, 0.7, 0.5, 0.3][gf]
    return RGBA.fromValues(base.r, base.g, base.b, base.a * alpha)
  }

  return (
    <Show when={props.active}>
      <box flexDirection="row" gap={0}>
        <Show when={props.glow}>
          <text fg={glowColor()} selectable={false}>
            {GLOW_CHARS[glowFrame()]}
          </text>
        </Show>
        <text fg={pulseColor()} selectable={false}>
          {props.glow ? "●" : PULSE_CHARS[frame()]}
        </text>
      </box>
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
      interval = setInterval(() => setFrame((f) => (f + 1) % (count() + 1)), 100)
    } else if (!props.active && interval) {
      clearInterval(interval); interval = undefined; setFrame(0)
    }
  })

  onCleanup(() => { if (interval) clearInterval(interval) })

  return (
    <Show when={props.active}>
      <text fg={theme.primary} selectable={false}>
        {".".repeat(frame())}
      </text>
    </Show>
  )
}
