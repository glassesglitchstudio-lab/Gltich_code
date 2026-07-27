import { createEffect, createSignal, onCleanup, Show, createMemo } from "solid-js"
import { useTheme } from "../context/theme"
import type { RGBA } from "@opentui/core"

const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
const GLITCH_INTERVAL = 50
const GLITCH_DURATION = 300
const SCANLINE_INTERVAL = 80
const CORRUPT_INTERVAL = 200

export function GlitchEffect(props: { active: boolean; intensity?: number; multiColor?: boolean }) {
  const { theme } = useTheme()
  const [glitchText, setGlitchText] = createSignal("")
  const [isGlitching, setIsGlitching] = createSignal(false)
  const [colorShift, setColorShift] = createSignal(0)
  const [scanlineOffset, setScanlineOffset] = createSignal(0)
  const [corruptBlocks, setCorruptBlocks] = createSignal<string[]>([])
  const [offsetX, setOffsetX] = createSignal(0)
  const [offsetY, setOffsetY] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined
  let colorInterval: ReturnType<typeof setInterval> | undefined
  let scanlineTimer: ReturnType<typeof setInterval> | undefined
  let corruptTimer: ReturnType<typeof setInterval> | undefined
  let shakeTimer: ReturnType<typeof setInterval> | undefined

  const intensity = () => props.intensity ?? 0.5
  const multiColor = () => props.multiColor ?? true

  const generateGlitch = () => {
    const length = Math.floor(3 + Math.random() * 8 * intensity())
    let text = ""
    for (let i = 0; i < length; i++) {
      if (Math.random() < 0.15 * intensity()) {
        text += " "
      } else {
        text += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
      }
    }
    return text
  }

  const generateCorruptBlocks = () => {
    const count = Math.floor(1 + Math.random() * 3 * intensity())
    const blocks: string[] = []
    for (let i = 0; i < count; i++) {
      const blockLen = 1 + Math.floor(Math.random() * 4)
      let block = ""
      for (let j = 0; j < blockLen; j++) {
        block += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
      }
      blocks.push(block)
    }
    return blocks
  }

  const startGlitch = () => {
    if (isGlitching()) return
    setIsGlitching(true)
    interval = setInterval(() => {
      setGlitchText(generateGlitch())
      setOffsetX((Math.random() - 0.5) * 2 * intensity())
      setOffsetY((Math.random() - 0.5) * 0.5 * intensity())
    }, GLITCH_INTERVAL)
    if (multiColor()) {
      colorInterval = setInterval(() => {
        setColorShift((f) => (f + 1) % 8)
      }, 150)
    }
    scanlineTimer = setInterval(() => {
      setScanlineOffset((f) => (f + 1) % 4)
    }, SCANLINE_INTERVAL)
    corruptTimer = setInterval(() => {
      if (Math.random() < 0.4 * intensity()) {
        setCorruptBlocks(generateCorruptBlocks())
      }
    }, CORRUPT_INTERVAL)
    shakeTimer = setInterval(() => {
      setOffsetX(0)
      setOffsetY(0)
    }, GLITCH_DURATION)
  }

  const stopGlitch = () => {
    if (!isGlitching()) return
    setIsGlitching(false)
    if (interval) { clearInterval(interval); interval = undefined }
    if (colorInterval) { clearInterval(colorInterval); colorInterval = undefined }
    if (scanlineTimer) { clearInterval(scanlineTimer); scanlineTimer = undefined }
    if (corruptTimer) { clearInterval(corruptTimer); corruptTimer = undefined }
    if (shakeTimer) { clearInterval(shakeTimer); shakeTimer = undefined }
    setGlitchText("")
    setCorruptBlocks([])
    setOffsetX(0)
    setOffsetY(0)
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
    if (scanlineTimer) clearInterval(scanlineTimer)
    if (corruptTimer) clearInterval(corruptTimer)
    if (shakeTimer) clearInterval(shakeTimer)
  })

  const currentColor = () => {
    if (!multiColor()) return theme.primary
    const colors = [
      theme.primary,
      theme.secondary,
      theme.primary,
      theme.warning,
      theme.accent,
      theme.primary,
      theme.secondary,
      theme.warning,
    ]
    return colors[colorShift()]
  }

  return (
    <Show when={isGlitching()}>
      <box flexDirection="column" gap={0}>
        <Show when={scanlineOffset() % 2 === 0}>
          <text fg={theme.textMuted} selectable={false} attributes={1}>
            ═══════════════════════
          </text>
        </Show>
        <Show when={corruptBlocks().length > 0}>
          <box flexDirection="row" gap={1}>
            {corruptBlocks().map((block) => (
              <text fg={currentColor()} selectable={false} attributes={1}>
                [{block}]
              </text>
            ))}
          </box>
        </Show>
        <box paddingLeft={Math.max(0, Math.round(offsetX()))}>
          <text fg={currentColor()} selectable={false}>
            {glitchText()}
          </text>
        </box>
      </box>
    </Show>
  )
}

export function GlitchText(props: { text: string; active?: boolean; multiColor?: boolean }) {
  const { theme } = useTheme()
  const [display, setDisplay] = createSignal(props.text)
  const [isGlitching, setIsGlitching] = createSignal(false)
  const [colorShift, setColorShift] = createSignal(0)
  const [offsetX, setOffsetX] = createSignal(0)
  let interval: ReturnType<typeof setInterval> | undefined
  let colorInterval: ReturnType<typeof setInterval> | undefined

  const multiColor = () => props.multiColor ?? true

  const glitchOnce = () => {
    if (isGlitching()) return
    setIsGlitching(true)
    let count = 0
    if (multiColor()) {
      colorInterval = setInterval(() => {
        setColorShift((f) => (f + 1) % 8)
      }, 120)
    }
    interval = setInterval(() => {
      count++
      if (count > 6) {
        setDisplay(props.text)
        setOffsetX(0)
        setIsGlitching(false)
        if (interval) clearInterval(interval)
        if (colorInterval) clearInterval(colorInterval)
        return
      }
      const chars = props.text.split("")
      const numGlitch = Math.floor(1 + Math.random() * 3)
      for (let i = 0; i < numGlitch; i++) {
        const idx = Math.floor(Math.random() * chars.length)
        if (Math.random() < 0.3) {
          chars[idx] = " "
        } else {
          chars[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        }
      }
      if (count > 2 && Math.random() < 0.4) {
        const sliceIdx = Math.floor(Math.random() * chars.length)
        const sliceLen = Math.floor(1 + Math.random() * 3)
        chars.splice(sliceIdx, sliceLen, ...GLITCH_CHARS.slice(0, sliceLen).split(""))
      }
      setDisplay(chars.join(""))
      setOffsetX((Math.random() - 0.5) * 1.5)
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
      theme.accent,
      theme.primary,
      theme.secondary,
      theme.warning,
    ]
    return isGlitching() ? colors[colorShift()] : theme.primary
  }

  return (
    <text fg={currentColor()} selectable={false}>
      {display()}
    </text>
  )
}
