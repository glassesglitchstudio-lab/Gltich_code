import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"

const GLITCH_LOGO = [
  "  ██████╗ ██╗  ██╗ ██████╗ ███████╗",
  " ██╔════╝ ██║  ██║ ██╔══██╗ ██╔════╝",
  " ██║      ███████║ ██║  ██║ █████╗  ",
  " ██║      ██╔══██║ ██║  ██║ ██╔══╝  ",
  " ╚██████╗ ██║  ██║ ██████╔╝ ███████╗",
  "  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══════╝",
]

const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function StartupAnimation(props: { ready: () => boolean }) {
  const { theme } = useTheme()
  const [show, setShow] = createSignal(false)
  const [frame, setFrame] = createSignal(0)
  const [step, setStep] = createSignal(0)
  const [logoVisible, setLogoVisible] = createSignal(0)
  const [glitchLine, setGlitchLine] = createSignal(-1)
  const [glitchChars, setGlitchChars] = createSignal<number[]>([])
  let interval: ReturnType<typeof setInterval> | undefined
  let stepTimer: ReturnType<typeof setInterval> | undefined
  let glitchTimer: ReturnType<typeof setInterval> | undefined

  const steps = [
    "Initializing Glitch Code...",
    "Loading plugins...",
    "Connecting to provider...",
    "Preparing workspace...",
    "Ready!",
  ]

  const displayLogo = createMemo(() => {
    return GLITCH_LOGO.slice(0, logoVisible()).map((line, lineIdx) => {
      if (lineIdx !== glitchLine()) return line
      const chars = line.split("")
      const glitchIndices = glitchChars()
      glitchIndices.forEach((idx) => {
        if (idx < chars.length) {
          chars[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        }
      })
      return chars.join("")
    })
  })

  onMount(() => {
    setTimeout(() => setShow(true), 300)

    let logoTimer: ReturnType<typeof setInterval> | undefined
    logoTimer = setInterval(() => {
      setLogoVisible((v) => {
        if (v >= GLITCH_LOGO.length) {
          clearInterval(logoTimer)
          return v
        }
        return v + 1
      })
    }, 120)

    interval = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 80)

    stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, steps.length - 1))
    }, 600)

    glitchTimer = setInterval(() => {
      if (logoVisible() === 0) return
      const lineIdx = Math.floor(Math.random() * logoVisible())
      setGlitchLine(lineIdx)
      const numGlitches = Math.floor(2 + Math.random() * 4)
      const indices: number[] = []
      for (let i = 0; i < numGlitches; i++) {
        indices.push(Math.floor(Math.random() * GLITCH_LOGO[0].length))
      }
      setGlitchChars(indices)
      setTimeout(() => setGlitchLine(-1), 100)
    }, 400)
  })

  createEffect(() => {
    if (props.ready()) {
      setStep(steps.length - 1)
      setTimeout(() => setShow(false), 1500)
    }
  })

  onCleanup(() => {
    if (interval) clearInterval(interval)
    if (stepTimer) clearInterval(stepTimer)
    if (glitchTimer) clearInterval(glitchTimer)
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
        backgroundColor={theme.background}
      >
        <box
          flexDirection="column"
          alignItems="center"
          gap={1}
        >
          {/* Logo Animation with Glitch */}
          <box flexDirection="column" alignItems="center" gap={0}>
            {displayLogo().map((line) => (
              <text fg={glitchLine() >= 0 ? theme.warning : theme.primary} selectable={false}>
                {line}
              </text>
            ))}
          </box>

          {/* Subtitle */}
          <Show when={logoVisible() >= GLITCH_LOGO.length}>
            <text fg={theme.textMuted} selectable={false}>
              AI-Powered CLI for Software Engineering
            </text>
          </Show>

          {/* Loading Spinner */}
          <box flexDirection="row" gap={1} marginTop={1}>
            <text fg={theme.primary} selectable={false}>
              {FRAMES[frame()]}
            </text>
            <text fg={theme.text} selectable={false}>
              {steps[step()]}
            </text>
          </box>

          {/* Progress Bar */}
          <box flexDirection="column" marginTop={1} width={40}>
            <box flexDirection="row" gap={0}>
              {Array.from({ length: 30 }).map((_, i) => (
                <text
                  fg={i < (step() / (steps.length - 1)) * 30 ? theme.primary : theme.borderSubtle}
                  selectable={false}
                >
                  ▓
                </text>
              ))}
            </box>
          </box>

          {/* Version */}
          <text fg={theme.textMuted} selectable={false}>
            v0.3.5
          </text>
        </box>
      </box>
    </Show>
  )
}
