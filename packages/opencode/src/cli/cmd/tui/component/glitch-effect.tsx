import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { useTheme } from "../context/theme"
import type { RGBA } from "@opentui/core"

const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
const GLITCH_INTERVAL = 60
const GLITCH_DURATION = 300

export function GlitchEffect(props: { active: boolean; intensity?: number; multiColor?: boolean }) {
  const { theme } = useTheme()
  const [glitchText, setGlitchText] = createSignal("")
  const [isGlitching, setIsGlitching] = createSignal(false)
  const [colorShift, setColorShift] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined
  let colorInterval: ReturnType<typeof setInterval> | undefined

  const intensity = () => props.intensity ?? 0.5
  const multiColor = () => props.multiColor ?? true

  const generateGlitch = () => {
    const length = Math.floor(3 + Math.random() * 5 * intensity())
    let text = ""
    for (let i = 0; i < length; i++) {
      text += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
    }
    return text
  }

  const startGlitch = () => {
    if (isGlitching()) return
    setIsGlitching(true)
    interval = setInterval(() => {
      setGlitchText(generateGlitch())
    }, GLITCH_INTERVAL)
    if (multiColor()) {
      colorInterval = setInterval(() => {
        setColorShift((f) => (f + 1) % 6)
      }, 200)
    }
  }

  const stopGlitch = () => {
    if (!isGlitching()) return
    setIsGlitching(false)
    if (interval) {
      clearInterval(interval)
      interval = undefined
    }
    if (colorInterval) {
      clearInterval(colorInterval)
      colorInterval = undefined
    }
    setGlitchText("")
  }

  createEffect(() => {
    if (props.active) {
      startGlitch()
    } else {
      stopGlitch()
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
    if (colorInterval) clearInterval(colorInterval)
  })

  const currentColor = () => {
    if (!multiColor()) return theme.primary
    const colors = [
      theme.primary,
      theme.secondary,
      theme.primary,
      theme.warning,
      theme.primary,
      theme.secondary,
    ]
    return colors[colorShift()]
  }

  return (
    <Show when={isGlitching()}>
      <text fg={currentColor()} selectable={false}>
        {glitchText()}
      </text>
    </Show>
  )
}

export function GlitchText(props: { text: string; active?: boolean; multiColor?: boolean }) {
  const { theme } = useTheme()
  const [display, setDisplay] = createSignal(props.text)
  const [isGlitching, setIsGlitching] = createSignal(false)
  const [colorShift, setColorShift] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined
  let colorInterval: ReturnType<typeof setInterval> | undefined

  const multiColor = () => props.multiColor ?? true

  const glitchOnce = () => {
    if (isGlitching()) return
    setIsGlitching(true)
    let count = 0
    if (multiColor()) {
      colorInterval = setInterval(() => {
        setColorShift((f) => (f + 1) % 6)
      }, 120)
    }
    interval = setInterval(() => {
      count++
      if (count > 4) {
        setDisplay(props.text)
        setIsGlitching(false)
        if (interval) clearInterval(interval)
        if (colorInterval) clearInterval(colorInterval)
        return
      }
      const chars = props.text.split("")
      const numGlitch = Math.floor(1 + Math.random() * 2)
      for (let i = 0; i < numGlitch; i++) {
        const idx = Math.floor(Math.random() * chars.length)
        chars[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
      }
      setDisplay(chars.join(""))
    }, GLITCH_INTERVAL)
  }

  createEffect(() => {
    if (props.active) {
      glitchOnce()
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
    if (colorInterval) clearInterval(colorInterval)
  })

  const currentColor = () => {
    if (!multiColor()) return theme.primary
    const colors = [
      theme.primary,
      theme.secondary,
      theme.primary,
      theme.warning,
      theme.primary,
      theme.secondary,
    ]
    return isGlitching() ? colors[colorShift()] : theme.primary
  }

  return (
    <text fg={currentColor()} selectable={false}>
      {display()}
    </text>
  )
}
