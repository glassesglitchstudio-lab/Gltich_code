import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"

const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
const GLITCH_INTERVAL = 80
const GLITCH_DURATION = 300

export function GlitchEffect(props: { active: boolean; intensity?: number }) {
  const { theme } = useTheme()
  const [glitchText, setGlitchText] = createSignal("")
  const [isGlitching, setIsGlitching] = createSignal(false)
  let interval: ReturnType<typeof setInterval> | undefined

  const intensity = () => props.intensity ?? 0.5

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
  }

  const stopGlitch = () => {
    if (!isGlitching()) return
    setIsGlitching(false)
    if (interval) {
      clearInterval(interval)
      interval = undefined
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
  })

  return (
    <Show when={isGlitching()}>
      <text fg={theme.primary} selectable={false}>
        {glitchText()}
      </text>
    </Show>
  )
}

export function GlitchText(props: { text: string; active?: boolean }) {
  const { theme } = useTheme()
  const [display, setDisplay] = createSignal(props.text)
  const [isGlitching, setIsGlitching] = createSignal(false)
  let interval: ReturnType<typeof setInterval> | undefined

  const glitchOnce = () => {
    if (isGlitching()) return
    setIsGlitching(true)
    let count = 0
    interval = setInterval(() => {
      count++
      if (count > 3) {
        setDisplay(props.text)
        setIsGlitching(false)
        if (interval) clearInterval(interval)
        return
      }
      const chars = props.text.split("")
      const idx = Math.floor(Math.random() * chars.length)
      chars[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
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
  })

  return (
    <text fg={theme.primary} selectable={false}>
      {display()}
    </text>
  )
}
