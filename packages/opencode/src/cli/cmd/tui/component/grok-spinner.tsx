import { RGBA } from "@opentui/core"
import { createSignal, onMount, onCleanup, type JSX } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const DOTS = ["   ", ".  ", ".. ", "..."]
const BRAILLE = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"]

interface GrokSpinnerProps {
  label?: string
  variant?: "braille" | "dots" | "wave" | "pulse"
  onDone?: () => void
}

export function GrokSpinner(props: GrokSpinnerProps = {}) {
  const { theme } = useTheme()
  const [frame, setFrame] = createSignal(0)
  const [wavePos, setWavePos] = createSignal(0)
  const [pulse, setPulse] = createSignal(0)
  const variant = props.variant ?? "braille"

  let timer: ReturnType<typeof setInterval> | undefined

  onMount(() => {
    let t = 0
    timer = setInterval(() => {
      t += 0.12
      setFrame((f) => (f + 1) % (variant === "dots" ? DOTS.length : variant === "braille" ? BRAILLE.length : FRAMES.length))
      setWavePos(Math.round((Math.sin(t) * 0.5 + 0.5) * 20))
      setPulse(Math.sin(t * 2) * 0.5 + 0.5)
    }, 80)
  })

  onCleanup(() => {
    if (timer) clearInterval(timer)
  })

  const renderWave = () => {
    const width = 20
    const chars: JSX.Element[] = []
    for (let i = 0; i < width; i++) {
      const dist = Math.abs(i - wavePos())
      const intensity = Math.max(0, 1 - dist / 8)
      const char = dist < 2 ? "█" : dist < 4 ? "▓" : dist < 6 ? "▒" : "░"
      chars.push(
        <text
          fg={intensity > 0.5 ? theme.primary : intensity > 0.2 ? tint(theme.background, theme.secondary, intensity) : theme.background}
          selectable={false}
        >
          {char}
        </text>,
      )
    }
    return <>{chars}</>
  }

  const renderPulse = () => {
    const width = 12
    const chars: JSX.Element[] = []
    for (let i = 0; i < width; i++) {
      const phase = (pulse() + i / width) % 1
      const char = phase > 0.7 ? "●" : phase > 0.4 ? "◉" : phase > 0.2 ? "○" : "·"
      const alpha = Math.sin(phase * Math.PI)
      chars.push(
        <text fg={tint(theme.background, theme.primary, alpha)} selectable={false}>
          {char}
        </text>,
      )
    }
    return <>{chars}</>
  }

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      {variant === "braille" ? (
        <text fg={theme.primary} attributes={1} selectable={false}>
          {BRAILLE[frame()]}
        </text>
      ) : variant === "dots" ? (
        <text fg={theme.primary} attributes={1} selectable={false}>
          {DOTS[frame()]}
        </text>
      ) : variant === "wave" ? (
        <box flexDirection="row">{renderWave()}</box>
      ) : (
        <box flexDirection="row">{renderPulse()}</box>
      )}
      {props.label ? (
        <text fg={theme.text} selectable={false}>
          {props.label}
        </text>
      ) : null}
    </box>
  )
}
